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
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, contractSigningRequestsTable } from "@workspace/db";
import { logAction } from "../utils/auditLog.js";
import {
  appendAuditEvent,
  clientIp,
  createSigningRequest,
  DEFAULT_CONSENT_TEXT,
  type SignerSpec,
  type SigningContextType,
} from "../services/contractSigning.js";

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
    await db
      .update(contractSigningRequestsTable)
      .set({ status: "signed", signatures: enriched, signed_at: now, updated_at: now })
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
  } catch (err) {
    console.error("[ContractSign] sign error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to process signatures." });
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
