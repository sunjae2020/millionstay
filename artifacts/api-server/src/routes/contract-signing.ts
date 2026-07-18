// E-signature shared module — HTTP routes.
//
// Public (no auth): the token-addressed signing page fetches the request and
// submits drawn signatures. Server-side legal metadata (serverSignedAt, ip,
// userAgent, consent) is authoritative.
// Admin (behind requireAuth): create a signing request for a record, list a
// record's requests, cancel a pending request.
//
// PDF rendering of the signed document is intentionally NOT included here — the
// signature images + legal metadata are captured in JSONB; rendering is wired up
// per concrete document (host application, placement contract) in later phases.
import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, contractSigningRequestsTable, homestayPlacementsTable, contractsTable } from "@workspace/db";
import { logAction } from "../utils/auditLog.js";
import {
  appendAuditEvent,
  clientIp,
  createSigningRequest,
  DEFAULT_CONSENT_TEXT,
  type SignerSpec,
  type SigningContextType,
} from "../services/contractSigning.js";
import {
  buildSignedDocumentHtml,
  generateAndStoreSignedPdf,
  processSignedApplication,
  resolveRecipients,
  emailApplicationPdf,
  sendServiceBriefs,
  refForSigning,
  type RecipientSelection,
} from "../services/applicationDocs.js";
import { isCloudinaryConfigured, generateSignedUrl } from "../utils/cloudinary.js";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC — token-addressed signing (no auth)
   ═══════════════════════════════════════════════════════════════════════════ */
export const contractSigningPublicRouter: IRouter = Router();

// GET /v1/public/contract-signing/:token — data for the signing page.
contractSigningPublicRouter.get("/v1/public/contract-signing/:token", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.token, req.params.token))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Signing request not found." });
      return;
    }
    if (row.status === "signed") {
      res.status(410).json({ error: "already_signed", message: "This document has already been signed." });
      return;
    }
    if (row.status === "cancelled") {
      res.status(410).json({ error: "cancelled", message: "This signing request has been cancelled." });
      return;
    }
    if (row.status === "expired" || (row.expires_at && new Date(row.expires_at) < new Date())) {
      if (row.status !== "expired") {
        await db.update(contractSigningRequestsTable).set({ status: "expired" }).where(eq(contractSigningRequestsTable.id, row.id));
      }
      res.status(410).json({ error: "expired", message: "This signing link has expired." });
      return;
    }

    // Record that the link was opened (access proof for the audit trail).
    void appendAuditEvent(row.id, {
      event: "viewed",
      at: new Date().toISOString(),
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    });

    res.json({
      id: row.id,
      status: row.status,
      context_type: row.context_type,
      context_id: row.context_id,
      signers: row.signers,
      expires_at: row.expires_at,
    });
  } catch (err) {
    console.error("[ContractSign] public get error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to fetch signing data." });
  }
});

// POST /v1/public/contract-signing/:token/sign — submit drawn signatures.
contractSigningPublicRouter.post("/v1/public/contract-signing/:token/sign", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.token, req.params.token))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Signing request not found." });
      return;
    }
    if (row.status !== "pending") {
      res.status(410).json({ error: "inactive", message: "This request is no longer active." });
      return;
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await db.update(contractSigningRequestsTable).set({ status: "expired" }).where(eq(contractSigningRequestsTable.id, row.id));
      res.status(410).json({ error: "expired", message: "This signing link has expired." });
      return;
    }

    const { signatures, consent } = req.body as {
      signatures: Array<{ role: string; name: string; signatureImage: string; signedAt?: string }>;
      consent?: boolean;
    };
    if (!signatures || signatures.length === 0) {
      res.status(400).json({ error: "no_signatures", message: "No signatures provided." });
      return;
    }

    const signers = (row.signers as SignerSpec[]) ?? [];
    for (const reqSigner of signers.filter((s) => s.required)) {
      const found = signatures.find((s) => s.role === reqSigner.role);
      if (!found || !found.signatureImage) {
        res.status(400).json({ error: "missing_signature", message: `Signature required for: ${reqSigner.name}` });
        return;
      }
    }
    if (consent === false) {
      res.status(400).json({ error: "consent_required", message: "You must agree to the terms and conditions to sign." });
      return;
    }

    // ── Capture legal e-signature metadata server-side (authoritative) ──
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] ?? "").slice(0, 500);
    const nowIso = new Date().toISOString();
    const consentBlock = { accepted: true, text: DEFAULT_CONSENT_TEXT, acceptedAt: nowIso };
    const byRole = new Map(signers.map((s) => [s.role, s]));
    const enriched = signatures.map((s) => ({
      role: s.role,
      name: s.name,
      email: byRole.get(s.role)?.email ?? "",
      signatureImage: s.signatureImage,
      signedAt: s.signedAt ?? nowIso, // client-reported (kept for reference)
      serverSignedAt: nowIso,         // authoritative
      ip,
      userAgent: ua,
      consent: consentBlock,
    }));

    const now = new Date();

    // ── Tamper-evidence: freeze the exact signed document (H-201) ──
    // Render the signed doc now and store it + its sha256 so /preview and /pdf
    // serve this verbatim instead of re-rendering live (which would silently
    // reflect any later edit to the underlying record).
    const signedRow = { ...row, status: "signed", signatures: enriched, signed_at: now };
    let content_hash: string | null = null;
    let signed_snapshot: { html: string; capturedAt: string } | null = null;
    try {
      const snapHtml = await buildSignedDocumentHtml(signedRow, { signed: true, forPrint: true });
      if (snapHtml) {
        content_hash = crypto.createHash("sha256").update(snapHtml, "utf8").digest("hex");
        signed_snapshot = { html: snapHtml, capturedAt: nowIso };
      }
    } catch (e) {
      console.error("[ContractSign] signed-snapshot capture failed:", e);
    }

    await db
      .update(contractSigningRequestsTable)
      .set({ status: "signed", signatures: enriched, signed_at: now, updated_at: now, content_hash, signed_snapshot })
      .where(eq(contractSigningRequestsTable.id, row.id));

    void appendAuditEvent(row.id, {
      event: "signed",
      at: nowIso,
      ip,
      userAgent: ua,
      signers: enriched.map((s) => ({ role: s.role, name: s.name, email: s.email })),
      consent: true,
    });
    await logAction({
      entityType: "contract_signing_requests",
      entityId: row.id,
      action: "STATUS_CHANGE",
      actorEmail: enriched.find((s) => s.email)?.email ?? null,
      ipAddress: ip,
      newValue: { status: "signed", signedAt: nowIso, context_type: row.context_type, context_id: row.context_id },
    }).catch(() => {});

    res.json({ success: true, message: "Document signed successfully." });

    // Best-effort, fire-and-forget: render the signed PDF, store it privately,
    // and email it (applicant + host + linked agent + ops). Never blocks the response.
    void processSignedApplication({ ...row, status: "signed", signatures: enriched, signed_at: now, content_hash, signed_snapshot })
      .catch((e) => console.error("[ContractSign] post-sign pdf/email failed:", e));

    // A signed placement contract advances the placement to AwaitingPayment.
    if (row.context_type === "placement_contract") {
      void db.update(homestayPlacementsTable)
        .set({ status: "AwaitingPayment", confirmed_at: now, updated_at: now })
        .where(and(eq(homestayPlacementsTable.id, row.context_id), eq(homestayPlacementsTable.status, "HostAccepted")))
        .catch((e) => console.error("[ContractSign] placement advance failed:", e));
    }

    // A signed regular contract advances Draft/Sent → Signed (activation stays
    // a manual admin step that pre-generates invoices via /v1/contracts/:id/activate).
    if (row.context_type === "contract") {
      void db.update(contractsTable)
        .set({ status: "Signed", signed_at: now, updated_at: now })
        .where(and(eq(contractsTable.id, row.context_id), inArray(contractsTable.status, ["Draft", "Sent"])))
        .catch((e) => console.error("[ContractSign] contract advance failed:", e));
    }
  } catch (err) {
    console.error("[ContractSign] sign error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to process signatures." });
  }
});

// GET /v1/public/contract-signing/:token/preview — token-gated HTML preview of the
// application (submit-time pending view, or the signed view once signed).
contractSigningPublicRouter.get("/v1/public/contract-signing/:token/preview", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.token, req.params.token))
      .limit(1);
    if (!row) {
      res.status(404).send("Not found");
      return;
    }
    // Signed documents are served from the frozen snapshot captured at sign time
    // (H-201) — never re-rendered live, so the preview always matches what was signed.
    const snapshot = (row.signed_snapshot as { html?: string } | null)?.html;
    if (row.status === "signed" && snapshot) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(snapshot);
      return;
    }
    const html = await buildSignedDocumentHtml(row, { signed: row.status === "signed", forPrint: false });
    if (!html) {
      res.status(404).send("Document unavailable");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[ContractSign] preview error:", err);
    res.status(500).send("Failed to render preview.");
  }
});

// GET /v1/public/contract-signing/:token/pdf — token-gated signed PDF. Redirects
// to a short-lived Cloudinary signed URL when stored; otherwise renders on the fly.
contractSigningPublicRouter.get("/v1/public/contract-signing/:token/pdf", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.token, req.params.token))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Signing request not found." });
      return;
    }
    if (row.status !== "signed") {
      res.status(409).json({ error: "not_signed", message: "This document has not been signed yet." });
      return;
    }
    if (row.pdf_url && isCloudinaryConfigured()) {
      res.redirect(generateSignedUrl(row.pdf_url, 900));
      return;
    }
    // No stored copy — render on the fly (and lazily store for next time).
    const { pdf } = await generateAndStoreSignedPdf(row);
    if (!pdf) {
      res.status(503).json({ error: "pdf_unavailable", message: "The signed PDF could not be generated." });
      return;
    }
    const ref = await refForSigning(row);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${ref}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("[ContractSign] pdf error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to fetch the signed PDF." });
  }
});

// POST /v1/public/contract-signing/:token/send — (re)send the signed PDF to the
// selected recipients. Selection is expressed in the body { applicant, agent, ops }.
contractSigningPublicRouter.post("/v1/public/contract-signing/:token/send", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.token, req.params.token))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Signing request not found." });
      return;
    }
    if (row.status !== "signed") {
      res.status(409).json({ error: "not_signed", message: "This document has not been signed yet." });
      return;
    }
    const body = (req.body ?? {}) as RecipientSelection;
    // host + serviceHost only apply to homestay placement agreements.
    const isPlacement = row.context_type === "placement_contract";
    const select: RecipientSelection = {
      applicant: body.applicant ?? true,
      agent: body.agent ?? false,
      ops: body.ops ?? false,
      host: isPlacement ? (body.host ?? false) : false,
      serviceHost: isPlacement ? (body.serviceHost ?? false) : false,
    };
    const { pdf } = await generateAndStoreSignedPdf(row);
    if (!pdf) {
      res.status(503).json({ error: "pdf_unavailable", message: "The signed PDF could not be generated." });
      return;
    }
    const recipients = await resolveRecipients(row);
    const ref = await refForSigning(row);
    const sent = await emailApplicationPdf(row, pdf, recipients, select, ref);
    // Service hosts get a separate MASKED brief (their service + fee only), never
    // the full signed agreement — sent as its own document, not the shared PDF.
    if (select.serviceHost && isPlacement) {
      const briefSent = await sendServiceBriefs(row.context_id, ref);
      sent.push(...briefSent);
    }
    res.json({ success: true, sent });
  } catch (err) {
    console.error("[ContractSign] send error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to send the document." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN — create / list / cancel (mounted behind requireAuth)
   ═══════════════════════════════════════════════════════════════════════════ */
export const contractSigningAdminRouter: IRouter = Router();

// POST /v1/contract-signing — create a signing request for a record.
contractSigningAdminRouter.post("/v1/contract-signing", async (req, res): Promise<void> => {
  try {
    const { context_type, context_id, signers, expiry_days } = req.body as {
      context_type: SigningContextType;
      context_id: number;
      signers: SignerSpec[];
      expiry_days?: number;
    };
    if (!context_type || !context_id || !signers?.length) {
      res.status(400).json({ error: "invalid_input", message: "context_type, context_id and signers are required." });
      return;
    }
    const result = await createSigningRequest({ contextType: context_type, contextId: Number(context_id), signers, expiryDays: expiry_days });
    await logAction({
      entityType: "contract_signing_requests",
      entityId: result.id,
      action: "CREATE",
      actorId: (req as any).user?.id ?? null,
      actorEmail: (req as any).user?.email ?? null,
      newValue: { context_type, context_id, signers: signers.map((s) => ({ role: s.role, email: s.email })) },
    }).catch(() => {});
    res.status(201).json(result);
  } catch (err) {
    console.error("[ContractSign] create error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to create signing request." });
  }
});

// GET /v1/contract-signing/:contextType/:contextId — a record's signing requests.
contractSigningAdminRouter.get("/v1/contract-signing/:contextType/:contextId", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.context_id, Number(req.params.contextId)));
    res.json(rows.filter((r) => r.context_type === req.params.contextType));
  } catch (err) {
    console.error("[ContractSign] list error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to list signing requests." });
  }
});

// DELETE /v1/contract-signing/:id/cancel — cancel a pending request.
contractSigningAdminRouter.delete("/v1/contract-signing/:id/cancel", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db
      .update(contractSigningRequestsTable)
      .set({ status: "cancelled", updated_at: new Date() })
      .where(eq(contractSigningRequestsTable.id, id));
    await logAction({
      entityType: "contract_signing_requests",
      entityId: id,
      action: "STATUS_CHANGE",
      actorId: (req as any).user?.id ?? null,
      actorEmail: (req as any).user?.email ?? null,
      newValue: { status: "cancelled" },
    }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("[ContractSign] cancel error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to cancel request." });
  }
});
