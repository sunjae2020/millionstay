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
import { db, contractSigningRequestsTable, homestayPlacementsTable, contractsTable, depositSettlementsTable } from "@workspace/db";
import { logAction } from "../utils/auditLog.js";
import {
  appendAuditEvent,
  clientIp,
  createSigningRequest,
  DEFAULT_CONSENT_TEXT,
  signingBaseUrl,
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
import { resolveDocFileName, setDocFileName } from "../lib/documents/docFileName";
import { normalizeLang, t } from "../lib/documents/i18n.js";
import { buildWorkOrderDocInput, buildWorkOrderIcs } from "./work-orders.js";

/** Name of the first signer on a request — the person the document is about. */
function primarySignerName(row: { signers: unknown }): string | null {
  const signers = Array.isArray(row.signers) ? row.signers : [];
  const first = signers.find((s): s is { name?: unknown } => !!s && typeof s === "object");
  return typeof first?.name === "string" && first.name.trim() ? first.name.trim() : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC — token-addressed signing (no auth)
   ═══════════════════════════════════════════════════════════════════════════ */
export const contractSigningPublicRouter: IRouter = Router();

// GET /v1/public/contract-signing/:token — data for the signing page.
/**
 * 토큰 페이지가 로그인 없이 보여 줄 요약. 지금은 작업 확인서만 —
 * 나머지 문서는 기존대로 /preview HTML 을 그대로 띄운다.
 */
async function publicSummary(contextType: string, contextId: number): Promise<unknown> {
  if (contextType !== "work_order") return null;
  try {
    const data = await buildWorkOrderDocInput(contextId);
    if (!data) return null;
    return {
      kind: "work_order",
      order_ref: data.order_ref,
      title: data.title,
      description: data.description ?? null,
      notes: data.notes ?? null,
      category: data.category ?? null,
      status: data.status,
      property_name: data.property_name ?? null,
      unit_no: data.unit_no ?? null,
      unit_type: data.unit_type ?? null,
      scheduled_at: data.scheduled_at ?? null,
      completed_at: data.completed_at ?? null,
      partner_name: data.partner_name ?? null,
      assignee_name: data.assignee_name ?? null,
      photos: data.photos.map((p) => ({
        url: p.url,
        kind: p.kind,
        session_no: p.session_no ?? 1,
        caption: p.caption ?? null,
      })),
    };
  } catch (err) {
    console.error("[ContractSign] summary build failed:", err);
    return null;
  }
}

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
      // 작업 확인서는 휴대폰에서 바로 읽히게 요약을 함께 준다 — 시설 담당자가
      // 카톡으로 받은 링크를 열자마자 무엇을 확인하는지 보여야 한다.
      summary: await publicSummary(row.context_type, row.context_id),
    });
  } catch (err) {
    console.error("[ContractSign] public get error:", err);
    res.status(500).json({ error: "server_error", message: "Failed to fetch signing data." });
  }
});

// GET /v1/public/contract-signing/:token/calendar.ics — 담당자 폰 캘린더 저장용.
// 아이폰은 탭하면 캘린더 추가 시트가 뜨고, 안드로이드는 내려받아 캘린더 앱으로
// 연다. 서명 여부와 무관하게(취소된 링크만 빼고) 내려 준다 — 서명을 마친 뒤에도
// 방문 일정은 캘린더에 남아야 한다.
contractSigningPublicRouter.get("/v1/public/contract-signing/:token/calendar.ics", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(contractSigningRequestsTable)
      .where(eq(contractSigningRequestsTable.token, req.params.token))
      .limit(1);
    if (!row || row.status === "cancelled") { res.status(404).send("Not found"); return; }
    if (row.context_type !== "work_order") { res.status(404).send("Not found"); return; }

    const built = await buildWorkOrderIcs(row.context_id, {
      signUrl: `${signingBaseUrl()}/work-order/${row.token}`,
      lang: normalizeLang(typeof req.query.lang === "string" ? req.query.lang : undefined),
    });
    // 일정이 안 잡힌 작업지시서는 캘린더에 넣을 것이 없다.
    if (!built) { res.status(409).json({ error: "no_schedule", message: "일정이 지정되지 않은 작업입니다." }); return; }

    void appendAuditEvent(row.id, {
      event: "calendar_downloaded",
      at: new Date().toISOString(),
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${built.filename}"`);
    res.send(built.ics);
  } catch (err) {
    console.error("[ContractSign] calendar error:", err);
    res.status(500).send("Failed to build calendar file");
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
    // 동의문은 **서명자가 실제로 읽은 문장**이어야 기록으로서 의미가 있다.
    // 작업 확인서는 계약 동의문이 아니라 작업 완료 확인 문구를 쓰고, 언어도
    // 서명 화면과 맞춘다.
    const consentLang = normalizeLang(
      (typeof req.body?.lang === "string" ? req.body.lang : undefined)
      ?? (req.headers["accept-language"] as string | undefined),
    );
    const consentText = row.context_type === "work_order"
      ? t(consentLang, "wo.signConsentText")
      : row.context_type === "deposit_settlement"
        ? t(consentLang, "moveout.signConsentText")
        : DEFAULT_CONSENT_TEXT;
    const consentBlock = { accepted: true, text: consentText, acceptedAt: nowIso };
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

    // 퇴거 정산 확인서에 서명이 들어오면 제안(proposed) 상태의 정산이 임차인
    // 동의(tenant_ack)로 넘어간다 — 게스트 포털의 /acknowledge 와 같은 자리다.
    if (row.context_type === "deposit_settlement") {
      void db.update(depositSettlementsTable)
        .set({ status: "tenant_ack", tenant_ack_at: now, updated_at: now })
        .where(and(eq(depositSettlementsTable.id, row.context_id), eq(depositSettlementsTable.status, "proposed")))
        .catch((e) => console.error("[ContractSign] settlement ack failed:", e));
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
    const html = await buildSignedDocumentHtml(row, {
      signed: row.status === "signed", forPrint: false, lang: normalizeLang(req.query.lang as string),
    });
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
    res.setHeader("Content-Type", "application/pdf");
    setDocFileName(res, await resolveDocFileName({
      kind: "signed_contract",
      entityType: row.context_type,
      entityId: row.context_id,
      party: [primarySignerName(row)],
      issueDate: row.signed_at ?? row.created_at,
    }));
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
    // signed_snapshot 은 서명 시점 HTML 통째라 목록에 실을 이유가 없다(수백 KB).
    res.json(rows
      .filter((r) => r.context_type === req.params.contextType)
      .map(({ signed_snapshot, ...rest }) => rest));
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
