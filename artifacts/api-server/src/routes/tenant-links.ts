// 세입자 온보딩 — 로그인 없이 여는 링크(청구서 조회·입금 통보 / 서류 제출).
//
// 입주 전 단계(신청 → 계약 서명 → 세대점검)는 이미 토큰 링크로 끝난다. 입주
// 후 단계는 그렇지 않아서, 청구서는 게스트 포털 로그인을 요구하고 서류는 카톡
// 사진으로 오갔다. 이 라우터가 그 두 개를 앞 단계와 같은 모양으로 맞춘다 —
// 링크 하나, 로그인 없음, 남는 기록은 원장에.
//
// 서명이 필요한 단계는 여기 없다. 그쪽은 `contract_signing_requests`(전자서명
// 원장)가 정본이고, 퇴거 정산 확인서도 그 경로를 탄다.
import { Router, type IRouter } from "express";
import multer from "multer";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db, invoicesTable, contractsTable, contactsTable, accountsTable, documentsTable,
  accountContactsTable, tenantAccessLinksTable, contractSigningRequestsTable,
  conditionReportsTable, depositSettlementsTable,
} from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { clientIp } from "../services/contractSigning.js";
import {
  appendLinkAudit, appendLinkSubmission, cancelTenantLink, createTenantLink,
  listTenantLinks, markTenantLinkCompleted, resolveTenantLink, serializeTenantLink,
  tenantLinkUrl, type TenantLinkKind,
} from "../services/tenantLinks.js";
import { buildInvoiceDocInput, invoiceFilename, sendPdf } from "./invoices.js";
import { buildInvoiceHtml } from "../lib/documents/invoiceDocument";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { normalizeLang, type DocLang } from "../lib/documents/i18n";
import { formatDocMoney } from "../lib/documents/theme";
import { resolveDocFolder } from "../lib/documents/docFileName";
import { calcRetentionDate } from "../lib/retention";
import { decodeUploadFilename } from "../lib/uploadFilename";
import { isCloudinaryConfigured, uploadPrivateToCloudinary, cldFolder } from "../utils/cloudinary";
import { sendTenantLinkEmail } from "../lib/email";
import { formatPersonName } from "../lib/nameFormat";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const adminRouter: IRouter = Router();
const publicRouter: IRouter = Router();

function fail(res: any, code: number, error: string, message: string): void {
  res.status(code).json({ success: false, error: { code: error, message } });
}

/** 링크가 죽어 있을 때 공개 화면에 그대로 띄울 한국어 사유. */
const FAILURE_MESSAGE: Record<string, string> = {
  not_found: "유효하지 않은 링크입니다.",
  expired: "링크 유효기간이 지났습니다. 담당자에게 재발송을 요청해 주세요.",
  cancelled: "취소된 링크입니다. 담당자에게 문의해 주세요.",
  completed: "이미 처리가 완료된 링크입니다.",
};

function failLink(res: any, failure: string): void {
  res.status(failure === "not_found" ? 404 : 410).json({
    success: false,
    error: { code: failure, message: FAILURE_MESSAGE[failure] ?? "링크를 사용할 수 없습니다." },
  });
}

function reqLang(req: any): DocLang {
  return normalizeLang(
    (typeof req.query?.lang === "string" ? req.query.lang : undefined)
    ?? (req.headers?.["accept-language"] as string | undefined),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   제출 가능한 서류 종류
   ═══════════════════════════════════════════════════════════════════════════
   doc_type 은 곧 보존기간 정책 키(`lib/retention.ts`)다. 그래서 세입자에게
   보여 줄 한국어 이름은 doc_type 이 아니라 `label` 로 따로 실어 보낸다 —
   "재직증명서"와 "주민등록등본"은 보존 규칙이 같은 일반 서류(other)이지만
   요청서에는 각자의 이름으로 찍혀야 한다. */

const REQUESTABLE_DOC_TYPES: Record<string, { personOnly?: boolean }> = {
  id_document: { personOnly: true },    // 30일 보존 — 사람(연락처)에만 붙는다
  visa_document: { personOnly: true },  // 30일 보존
  bank_account_copy: {},                // 5년
  other: {},                            // 2년
};

/** 관리자 화면의 체크박스 목록 — 한국 임대차에서 실제로 받는 서류들. */
const DOC_PRESETS: Array<{ key: string; doc_type: string; label: string; required: boolean }> = [
  { key: "id", doc_type: "id_document", label: "신분증 사본", required: true },
  { key: "bank", doc_type: "bank_account_copy", label: "통장 사본", required: true },
  { key: "visa", doc_type: "visa_document", label: "외국인등록증 · 비자", required: false },
  { key: "employment", doc_type: "other", label: "재직 · 재학 증명서", required: false },
  { key: "business", doc_type: "other", label: "사업자등록증", required: false },
  { key: "residence", doc_type: "other", label: "주민등록등본", required: false },
  { key: "seal", doc_type: "other", label: "인감증명서", required: false },
];

interface RequestedDoc {
  key: string;
  doc_type: string;
  label: string;
  required: boolean;
}

function parseRequestedDocs(raw: unknown): RequestedDoc[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: RequestedDoc[] = [];
  for (const [i, item] of list.entries()) {
    if (!item || typeof item !== "object") continue;
    const docType = String((item as any).doc_type ?? "other");
    if (!REQUESTABLE_DOC_TYPES[docType]) continue;
    const label = String((item as any).label ?? "").trim().slice(0, 120);
    if (!label) continue;
    out.push({
      key: String((item as any).key ?? `d${i + 1}`).slice(0, 40),
      doc_type: docType,
      label,
      required: (item as any).required !== false,
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN — 링크 발급 · 조회 · 회수
   ═══════════════════════════════════════════════════════════════════════════ */

adminRouter.get("/v1/tenant-links/doc-presets", (_req, res): void => {
  res.json({ success: true, data: DOC_PRESETS });
});

/**
 * 관리자 대기열 — 세입자가 남긴 것(입금 통보·서류 제출)을 최신순으로 훑는다.
 * 상세 화면을 하나씩 열지 않고도 "처리할 게 있나"를 한 화면에서 본다.
 */
adminRouter.get("/v1/tenant-links", async (req, res): Promise<void> => {
  try {
    const kind = typeof req.query.kind === "string" ? req.query.kind : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const limit = Math.min(Number(req.query.limit) || 100, 300);

    const where = [
      kind ? eq(tenantAccessLinksTable.kind, kind) : undefined,
      status ? eq(tenantAccessLinksTable.status, status) : undefined,
    ].filter(Boolean);

    const rows = await db
      .select()
      .from(tenantAccessLinksTable)
      .where(where.length ? and(...(where as any[])) : undefined)
      .orderBy(desc(tenantAccessLinksTable.updated_at))
      .limit(limit);

    // 참조 번호를 곁들인다 — 목록에서 청구번호·계약번호 없이는 아무 의미가 없다.
    const invoiceIds = rows.filter((r) => r.context_type === "invoice").map((r) => r.context_id);
    const contractIds = rows.filter((r) => r.context_type === "contract").map((r) => r.context_id);
    const invoiceRefs = invoiceIds.length
      ? await db.select({ id: invoicesTable.id, ref: invoicesTable.invoice_ref })
          .from(invoicesTable).where(inArray(invoicesTable.id, invoiceIds))
      : [];
    const contractRefs = contractIds.length
      ? await db.select({ id: contractsTable.id, ref: contractsTable.contract_ref })
          .from(contractsTable).where(inArray(contractsTable.id, contractIds))
      : [];
    const refMap = new Map<string, string>([
      ...invoiceRefs.map((r) => [`invoice:${r.id}`, r.ref] as [string, string]),
      ...contractRefs.map((r) => [`contract:${r.id}`, r.ref] as [string, string]),
    ]);

    res.json({
      success: true,
      data: rows.map((r) => ({
        ...serializeTenantLink(r),
        context_ref: refMap.get(`${r.context_type}:${r.context_id}`) ?? null,
      })),
    });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.get("/v1/tenant-links/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(tenantAccessLinksTable)
    .where(eq(tenantAccessLinksTable.id, Number(req.params.id))).limit(1);
  if (!row) { fail(res, 404, "NOT_FOUND", "링크를 찾을 수 없습니다."); return; }
  res.json({ success: true, data: serializeTenantLink(row, { withAudit: true }) });
});

adminRouter.delete("/v1/tenant-links/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await cancelTenantLink(id);
  void logAction({ entityType: "tenant_access_link", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { status: "cancelled" } });
  res.json({ success: true });
});

/** 링크를 다시 메일로 보낸다(주소만 바뀐 재발송이 아니라 같은 토큰 그대로). */
adminRouter.post("/v1/tenant-links/:id/resend", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(tenantAccessLinksTable)
      .where(eq(tenantAccessLinksTable.id, Number(req.params.id))).limit(1);
    if (!row) { fail(res, 404, "NOT_FOUND", "링크를 찾을 수 없습니다."); return; }
    const to = (typeof req.body?.to === "string" && req.body.to.trim()) || row.sent_to;
    if (!to) { fail(res, 400, "NO_RECIPIENT", "받는 사람 주소가 없습니다."); return; }

    const email = await emailForLink(row, to, typeof req.body?.lang === "string" ? req.body.lang : row.lang);
    if (email.ok) {
      await db.update(tenantAccessLinksTable).set({ sent_to: to, updated_at: new Date() })
        .where(eq(tenantAccessLinksTable.id, row.id));
      void appendLinkAudit(row.id, { event: "resent", to });
    }
    res.json({ success: email.ok, data: { to }, email });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/* ── 청구서 결제 링크 ────────────────────────────────────────────────────── */

/** 인보이스 한 건의 사람 읽는 요약 — 메일 본문과 공개 화면이 같은 값을 쓴다. */
async function invoiceSummary(invoiceId: number, lang: DocLang) {
  const doc = await buildInvoiceDocInput(invoiceId, lang);
  if (!doc) return null;
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  return { doc, row: row ?? null };
}

adminRouter.post("/v1/invoices/:id/pay-link", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const lang = normalizeLang(typeof req.body?.lang === "string" ? req.body.lang : undefined);
    const summary = await invoiceSummary(id, lang);
    if (!summary?.row) { fail(res, 404, "NOT_FOUND", "청구서를 찾을 수 없습니다."); return; }
    const { doc, row } = summary;
    if (row.status === "Void") { fail(res, 409, "VOID", "취소된 청구서에는 링크를 발급하지 않습니다."); return; }

    // 만료는 납기일 + 30일이 자연스럽다 — 납기 전에 링크가 죽으면 안 되고,
    // 연체된 청구서도 한 달은 열려 있어야 독촉이 성립한다.
    const dueMs = row.due_date ? Date.parse(`${row.due_date}T23:59:59`) : NaN;
    const expiresAt = Number.isFinite(dueMs)
      ? new Date(dueMs + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const link = await createTenantLink({
      kind: "invoice_pay",
      contextType: "invoice",
      contextId: id,
      accountId: row.account_id ?? null,
      contactId: Number.isFinite(Number(req.body?.contact_id)) ? Number(req.body.contact_id) : null,
      lang,
      sentTo: typeof req.body?.to === "string" ? req.body.to.trim() : (doc.account_email ?? null),
      expiresAt,
      payload: {
        // 발급 시점 스냅숏 — 나중에 청구서를 정정해도 "그때 보낸 금액"이 남는다.
        invoice_ref: doc.invoice_ref,
        amount: doc.total_amount ?? doc.amount,
        currency: doc.currency,
        due_date: doc.due_date,
        account_name: doc.account_name,
      },
    });

    void logAction({
      entityType: "invoice", entityId: id, action: "UPDATE",
      actorId: (req as any).user?.id ?? null,
      newValue: { pay_link_issued: link.id, expires_at: link.expires_at },
    });

    let email: { ok: boolean; skipped?: boolean; error?: string } | null = null;
    const to = (typeof req.body?.to === "string" && req.body.to.trim()) || doc.account_email;
    if (req.body?.send_email) {
      email = to ? await emailForLink(link, to, lang) : { ok: false, error: "NO_RECIPIENT" };
      if (email.ok) void appendLinkAudit(link.id, { event: "emailed", to });
    }

    res.status(201).json({ success: true, data: serializeTenantLink(link), email });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.get("/v1/invoices/:id/pay-link", async (req, res): Promise<void> => {
  const rows = await listTenantLinks("invoice_pay", "invoice", Number(req.params.id));
  res.json({ success: true, data: rows.map((r) => serializeTenantLink(r, { withAudit: true })) });
});

/* ── 서류 제출 요청 ──────────────────────────────────────────────────────── */

adminRouter.post("/v1/contracts/:id/document-request", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id)).limit(1);
    if (!contract) { fail(res, 404, "NOT_FOUND", "계약을 찾을 수 없습니다."); return; }

    const items = parseRequestedDocs(req.body?.items);
    if (!items.length) { fail(res, 400, "NO_ITEMS", "요청할 서류를 한 개 이상 선택해 주세요."); return; }

    // 신분증·비자는 사람(연락처)에 붙는 서류다 — 붙일 사람이 없으면 30일 보존
    // 서류가 7년 보존 계약서에 얹히게 되므로 발급 단계에서 막는다.
    const contactId = Number.isFinite(Number(req.body?.contact_id))
      ? Number(req.body.contact_id)
      : await tenantContactId(contract);
    if (items.some((i) => REQUESTABLE_DOC_TYPES[i.doc_type]?.personOnly) && !contactId) {
      fail(res, 400, "NO_CONTACT", "신분증·비자를 요청하려면 계약에 임차인 연락처가 연결되어 있어야 합니다.");
      return;
    }

    const lang = normalizeLang(typeof req.body?.lang === "string" ? req.body.lang : undefined);
    const tenant = contactId ? await contactBrief(contactId) : null;
    const days = Number(req.body?.expiry_days);

    const link = await createTenantLink({
      kind: "doc_request",
      contextType: "contract",
      contextId: id,
      contactId,
      accountId: contract.tenant_account_id ?? null,
      lang,
      sentTo: (typeof req.body?.to === "string" && req.body.to.trim()) || tenant?.email || null,
      expiryDays: Number.isFinite(days) && days > 0 ? days : 14,
      payload: {
        contract_ref: contract.contract_ref,
        note: typeof req.body?.note === "string" ? req.body.note.slice(0, 1000) : null,
        tenant_name: tenant?.name ?? null,
        items,
      },
    });

    void logAction({
      entityType: "contract", entityId: id, action: "UPDATE",
      actorId: (req as any).user?.id ?? null,
      newValue: { document_request_issued: link.id, items: items.map((i) => i.label) },
    });

    let email: { ok: boolean; skipped?: boolean; error?: string } | null = null;
    const to = (typeof req.body?.to === "string" && req.body.to.trim()) || tenant?.email || null;
    if (req.body?.send_email) {
      email = to ? await emailForLink(link, to, lang) : { ok: false, error: "NO_RECIPIENT" };
      if (email.ok) void appendLinkAudit(link.id, { event: "emailed", to });
    }

    res.status(201).json({ success: true, data: serializeTenantLink(link), email });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.get("/v1/contracts/:id/document-request", async (req, res): Promise<void> => {
  const rows = await listTenantLinks("doc_request", "contract", Number(req.params.id));
  res.json({ success: true, data: rows.map((r) => serializeTenantLink(r, { withAudit: true })) });
});

/* ── 계약 온보딩 현황 ────────────────────────────────────────────────────── */

/**
 * 계약 한 건의 온보딩 단계를 한 번에 답한다. 관리자 상세 화면이 이 응답 하나로
 * "지금 어디까지 갔고, 다음에 뭘 보내야 하는지"를 그린다. 각 단계는 서로 다른
 * 원장에 살아 있어서(서명 요청 / 점검표 / 청구서 / 링크 원장) 화면이 네 군데를
 * 따로 물으면 순서를 맞추기 어렵다.
 */
adminRouter.get("/v1/contracts/:id/onboarding", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id)).limit(1);
    if (!contract) { fail(res, 404, "NOT_FOUND", "계약을 찾을 수 없습니다."); return; }

    const [signings, docLinks, inspections, invoices, settlements] = await Promise.all([
      db.select().from(contractSigningRequestsTable)
        .where(and(
          eq(contractSigningRequestsTable.context_type, "contract"),
          eq(contractSigningRequestsTable.context_id, id),
        ))
        .orderBy(desc(contractSigningRequestsTable.id)),
      listTenantLinks("doc_request", "contract", id),
      db.select().from(conditionReportsTable)
        .where(eq(conditionReportsTable.contract_id, id))
        .orderBy(desc(conditionReportsTable.id)),
      db.select().from(invoicesTable)
        .where(and(eq(invoicesTable.contract_id, id), isNull(invoicesTable.deleted_at)))
        .orderBy(desc(invoicesTable.id)),
      db.select().from(depositSettlementsTable)
        .where(eq(depositSettlementsTable.contract_id, id))
        .orderBy(desc(depositSettlementsTable.id)),
    ]);

    const payLinks = invoices.length
      ? await db.select().from(tenantAccessLinksTable)
          .where(and(
            eq(tenantAccessLinksTable.kind, "invoice_pay"),
            eq(tenantAccessLinksTable.context_type, "invoice"),
            inArray(tenantAccessLinksTable.context_id, invoices.map((i) => i.id)),
          ))
          .orderBy(desc(tenantAccessLinksTable.id))
      : [];

    const settlementSignings = settlements.length
      ? await db.select().from(contractSigningRequestsTable)
          .where(and(
            eq(contractSigningRequestsTable.context_type, "deposit_settlement"),
            inArray(contractSigningRequestsTable.context_id, settlements.map((s) => s.id)),
          ))
          .orderBy(desc(contractSigningRequestsTable.id))
      : [];

    const signed = signings.find((s) => s.status === "signed") ?? null;
    const pendingSign = signings.find((s) => s.status === "pending") ?? null;
    const moveIn = inspections.find((r) => r.phase === "move_in") ?? null;
    const moveOut = inspections.find((r) => r.phase === "move_out") ?? null;
    const docLink = docLinks[0] ?? null;
    const unpaid = invoices.filter((i) => i.status !== "Paid" && i.status !== "Void");
    const settlement = settlements[0] ?? null;
    const settlementSigned = settlementSignings.find((s) => s.status === "signed") ?? null;
    const settlementPending = settlementSignings.find((s) => s.status === "pending") ?? null;

    const steps = [
      {
        key: "contract_sign",
        label: "계약서 전자서명",
        state: signed ? "done" : pendingSign ? "sent" : "todo",
        at: signed?.signed_at ?? null,
        link: pendingSign ? `${tenantLinkBase()}/sign/${pendingSign.token}` : null,
        detail: contract.contract_ref,
      },
      {
        key: "documents",
        label: "서류 제출",
        state: docLink?.status === "completed" ? "done" : docLink ? "sent" : "todo",
        at: docLink?.completed_at ?? null,
        link: docLink ? tenantLinkUrl(docLink.kind, docLink.token) : null,
        detail: docLink
          ? `${submittedCount(docLink)}/${(docLink.payload as any)?.items?.length ?? 0}건 제출`
          : null,
      },
      {
        key: "move_in_inspection",
        label: "입주 세대점검",
        state: moveIn
          ? (["tenant_agreed", "finalized", "disputed"].includes(moveIn.status) ? "done" : moveIn.sign_token ? "sent" : "todo")
          : "todo",
        at: moveIn?.tenant_responded_at ?? null,
        link: moveIn?.sign_token ? `${tenantLinkBase()}/inspection/${moveIn.sign_token}` : null,
        detail: moveIn?.report_ref ?? null,
      },
      {
        key: "billing",
        label: "청구 · 납부",
        state: invoices.length === 0 ? "todo" : unpaid.length === 0 ? "done" : payLinks.length ? "sent" : "todo",
        at: null,
        link: payLinks[0] ? tenantLinkUrl(payLinks[0].kind, payLinks[0].token) : null,
        detail: invoices.length ? `미납 ${unpaid.length} / 전체 ${invoices.length}건` : null,
      },
      {
        key: "move_out_inspection",
        label: "퇴거 세대점검",
        state: moveOut
          ? (["tenant_agreed", "finalized", "disputed"].includes(moveOut.status) ? "done" : moveOut.sign_token ? "sent" : "todo")
          : "todo",
        at: moveOut?.tenant_responded_at ?? null,
        link: moveOut?.sign_token ? `${tenantLinkBase()}/inspection/${moveOut.sign_token}` : null,
        detail: moveOut?.report_ref ?? null,
      },
      {
        key: "settlement",
        label: "퇴거 정산 확인",
        state: settlementSigned ? "done" : settlementPending ? "sent" : "todo",
        at: settlementSigned?.signed_at ?? null,
        link: settlementPending ? `${tenantLinkBase()}/sign/${settlementPending.token}` : null,
        detail: settlement?.settlement_ref ?? null,
      },
    ];

    res.json({
      success: true,
      data: {
        contract_ref: contract.contract_ref,
        steps,
        pending_submissions: [
          ...payLinks.filter((l) => l.status === "completed").map((l) => ({ kind: l.kind, id: l.id })),
          ...docLinks.filter((l) => submittedCount(l) > 0 && l.status !== "completed").map((l) => ({ kind: l.kind, id: l.id })),
        ],
      },
    });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

function tenantLinkBase(): string {
  // tenantLinkUrl 이 붙이는 것과 같은 기준 주소. 서명·점검 링크는 이 라우터가
  // 발급하지 않으므로(각자의 원장이 있다) 경로만 여기서 조립한다.
  return tenantLinkUrl("invoice_pay", "").replace(/\/pay\/$/, "");
}

function submittedCount(link: { submissions: unknown }): number {
  const list = Array.isArray(link.submissions) ? link.submissions : [];
  return new Set(list.filter((s: any) => s?.doc_key).map((s: any) => s.doc_key)).size;
}

/**
 * 계약의 임차인 연락처. 계정의 대표 연락처 슬롯이 1순위이고, 비어 있으면
 * account_contacts 에 걸린 사람 중 첫 명을 쓴다 — 신분증이 붙을 자리이므로
 * "누구인지" 가 확실해야 한다.
 */
async function tenantContactId(contract: { tenant_account_id: number | null }): Promise<number | null> {
  const accountId = contract.tenant_account_id;
  if (!accountId) return null;
  const [acc] = await db
    .select({ primary: accountsTable.primary_contact_id, secondary: accountsTable.secondary_contact_id })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (acc?.primary) return acc.primary;
  if (acc?.secondary) return acc.secondary;
  const [linked] = await db
    .select({ id: accountContactsTable.contact_id })
    .from(accountContactsTable)
    .where(eq(accountContactsTable.account_id, accountId))
    .orderBy(accountContactsTable.id)
    .limit(1);
  return linked?.id ?? null;
}

async function contactBrief(id: number): Promise<{ name: string | null; email: string | null } | null> {
  const [row] = await db
    .select({ first: contactsTable.first_name, last: contactsTable.last_name, email: contactsTable.email })
    .from(contactsTable).where(eq(contactsTable.id, id)).limit(1);
  if (!row) return null;
  return { name: formatPersonName(row.first, row.last) || null, email: row.email ?? null };
}

/** 링크 한 건을 그 종류에 맞는 문안으로 메일 발송한다. */
async function emailForLink(
  link: { id: number; kind: string; token: string; context_type: string; context_id: number; payload: unknown; expires_at: Date | null },
  to: string,
  lang?: string | null,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const payload = (link.payload ?? {}) as Record<string, any>;
  const url = tenantLinkUrl(link.kind, link.token);
  const docLang = normalizeLang(lang ?? undefined);

  if (link.kind === "invoice_pay") {
    return sendTenantLinkEmail({
      kind: "invoice_pay",
      to,
      toName: payload.account_name ?? null,
      url,
      ref: payload.invoice_ref ?? `INV-${link.context_id}`,
      amount: formatDocMoney(payload.amount ?? null, payload.currency ?? null),
      dueDate: payload.due_date ?? null,
      expiresAt: link.expires_at,
      lang: docLang,
    });
  }
  return sendTenantLinkEmail({
    kind: "doc_request",
    to,
    toName: payload.tenant_name ?? null,
    url,
    ref: payload.contract_ref ?? `CTR-${link.context_id}`,
    items: (payload.items ?? []).map((i: any) => `${i.label}${i.required ? "" : " (선택)"}`),
    expiresAt: link.expires_at,
    lang: docLang,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC — 토큰 링크 (로그인 없음)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 청구서 조회 + 입금 통보 ─────────────────────────────────────────────── */

publicRouter.get("/v1/public/invoice-pay/:token", async (req, res): Promise<void> => {
  try {
    const found = await resolveTenantLink(String(req.params.token), "invoice_pay", {
      ip: clientIp(req), userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    });
    if ("failure" in found) { failLink(res, found.failure); return; }
    const { link } = found;

    const lang = normalizeLang(link.lang ?? undefined) || reqLang(req);
    const summary = await invoiceSummary(link.context_id, lang);
    if (!summary?.row) { failLink(res, "not_found"); return; }
    const { doc, row } = summary;
    const company = await resolveCompanyInfo(lang);

    res.json({
      success: true,
      data: {
        status: link.status,
        lang,
        invoice: {
          invoice_ref: doc.invoice_ref,
          status: row.status,
          paid: row.status === "Paid",
          amount: doc.amount,
          tax_amount: doc.tax_amount,
          total_amount: doc.total_amount ?? doc.amount,
          currency: doc.currency,
          due_date: doc.due_date,
          description: doc.description,
          billing_period: doc.billing_period,
          account_name: doc.account_name,
          line_items: doc.line_items,
        },
        bank_account: doc.bank_account ?? null,
        company: { name: company.tradingName || company.legalName, phone: company.phone ?? null, email: company.email ?? null },
        // 이미 남긴 입금 통보 — 다시 열었을 때 "보냈다"는 사실이 보여야 한다.
        notices: (Array.isArray(link.submissions) ? link.submissions : []).filter((s: any) => s?.event === "paid_notice"),
      },
    });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/** 토큰으로 여는 청구서 PDF — 로그인 없이 내려받아 보관할 수 있어야 한다. */
publicRouter.get("/v1/public/invoice-pay/:token/document.pdf", async (req, res): Promise<void> => {
  try {
    const found = await resolveTenantLink(String(req.params.token), "invoice_pay", { markViewed: false });
    if ("failure" in found) { res.status(404).send("Not found"); return; }
    const lang = normalizeLang(found.link.lang ?? undefined) || reqLang(req);
    const doc = await buildInvoiceDocInput(found.link.context_id, lang);
    if (!doc) { res.status(404).send("Not found"); return; }
    const terms = await resolveTemplateBody("pdf", "pdf.invoice", lang, {
      ref: doc.invoice_ref, due_date: doc.due_date ?? "",
    });
    const asHtml = req.query.format === "html";
    const html = buildInvoiceHtml(doc, await resolveCompanyInfo(lang), !asHtml, lang, terms);
    if (asHtml) { res.type("html").send(html); return; }
    void appendLinkAudit(found.link.id, { event: "pdf_downloaded", ip: clientIp(req) });
    await sendPdf(res, html, await invoiceFilename(found.link.context_id, doc, "invoice"));
  } catch (err: any) {
    res.status(500).send("Failed to render document");
  }
});

/**
 * 입금했다는 통보. 청구서 상태를 바꾸지는 않는다 — 수납 확인은 통장을 보는
 * 사람이 하는 일이고, 여기서 자동으로 Paid 로 넘기면 미입금 건이 장부에서
 * 사라진다. 이 기록은 관리자 대기열에 뜨고, 확인 후 기존 수납 처리로 닫는다.
 */
publicRouter.post("/v1/public/invoice-pay/:token/paid-notice", async (req, res): Promise<void> => {
  try {
    const found = await resolveTenantLink(String(req.params.token), "invoice_pay", { markViewed: false });
    if ("failure" in found) { failLink(res, found.failure); return; }
    const { link } = found;

    const payerName = String(req.body?.payer_name ?? "").trim().slice(0, 120);
    if (!payerName) { fail(res, 400, "NO_PAYER", "입금자명을 입력해 주세요."); return; }
    const paidOn = String(req.body?.paid_on ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) { fail(res, 400, "BAD_DATE", "입금일을 선택해 주세요."); return; }

    const ip = clientIp(req);
    await appendLinkSubmission(link.id, {
      event: "paid_notice",
      payer_name: payerName,
      paid_on: paidOn,
      amount: req.body?.amount != null ? String(req.body.amount) : null,
      memo: typeof req.body?.memo === "string" ? req.body.memo.slice(0, 500) : null,
      ip,
    });
    await markTenantLinkCompleted(link.id);
    void appendLinkAudit(link.id, { event: "paid_notice", ip, payer_name: payerName });
    void logAction({
      entityType: "invoice", entityId: link.context_id, action: "UPDATE",
      ipAddress: ip,
      newValue: { tenant_paid_notice: { payer_name: payerName, paid_on: paidOn } },
    });

    res.json({ success: true, message: "입금 확인 요청이 접수되었습니다. 확인 후 영수증을 보내드리겠습니다." });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/* ── 서류 제출 ───────────────────────────────────────────────────────────── */

function docRequestView(link: any) {
  const payload = (link.payload ?? {}) as Record<string, any>;
  const submissions = Array.isArray(link.submissions) ? link.submissions : [];
  const items = (payload.items ?? []) as RequestedDoc[];
  return {
    status: link.status,
    contract_ref: payload.contract_ref ?? null,
    tenant_name: payload.tenant_name ?? null,
    note: payload.note ?? null,
    items: items.map((it) => {
      const mine = submissions.filter((s: any) => s?.doc_key === it.key);
      return {
        ...it,
        submitted: mine.length > 0,
        files: mine.map((s: any) => ({ file_name: s.file_name, at: s.at })),
      };
    }),
  };
}

publicRouter.get("/v1/public/doc-requests/:token", async (req, res): Promise<void> => {
  try {
    const found = await resolveTenantLink(String(req.params.token), "doc_request", {
      ip: clientIp(req), userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    });
    if ("failure" in found) { failLink(res, found.failure); return; }
    res.json({ success: true, data: docRequestView(found.link) });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

publicRouter.post("/v1/public/doc-requests/:token/upload", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const found = await resolveTenantLink(String(req.params.token), "doc_request", { markViewed: false });
    if ("failure" in found) { failLink(res, found.failure); return; }
    const { link } = found;
    if (link.status === "completed") { fail(res, 409, "COMPLETED", "이미 제출이 완료되었습니다."); return; }

    const file = req.file;
    if (!file) { fail(res, 400, "NO_FILE", "파일이 없습니다."); return; }
    if (!isCloudinaryConfigured()) { fail(res, 503, "NOT_CONFIGURED", "파일 업로드가 설정되지 않았습니다."); return; }

    const payload = (link.payload ?? {}) as Record<string, any>;
    const items = (payload.items ?? []) as RequestedDoc[];
    const item = items.find((i) => i.key === String(req.body?.doc_key ?? ""));
    if (!item) { fail(res, 400, "UNKNOWN_DOC", "요청 목록에 없는 서류입니다."); return; }

    // 신분증류는 사람(연락처)에, 나머지는 계약에 붙는다 — 보존기간이 다르다.
    const personOnly = !!REQUESTABLE_DOC_TYPES[item.doc_type]?.personOnly;
    const entityType = personOnly ? "contact" : "contract";
    const entityId = personOnly ? link.contact_id : link.context_id;
    if (!entityId) { fail(res, 409, "NO_TARGET", "제출 대상을 찾을 수 없습니다. 담당자에게 문의해 주세요."); return; }

    const fileName = decodeUploadFilename(file.originalname).slice(0, 255);
    const up = await uploadPrivateToCloudinary(file.buffer, {
      folder: cldFolder(await resolveDocFolder(entityType, entityId)),
      resource_type: "auto",
    });
    const [row] = await db.insert(documentsTable).values({
      entity_type: entityType,
      entity_id: entityId,
      doc_type: item.doc_type,
      file_name: fileName,
      file_size: file.size,
      mime_type: file.mimetype.slice(0, 100),
      cloudinary_public_id: up.public_id,
      resource_type: up.resource_type,
      // 세입자가 올린 파일은 무엇으로 요청받았는지가 곧 제목이다("재직증명서").
      title: item.label,
      doc_year: new Date().getFullYear(),
      uploaded_by_type: "Tenant",
      retention_until: calcRetentionDate(item.doc_type),
    } as never).returning();

    await appendLinkSubmission(link.id, {
      doc_key: item.key,
      doc_type: item.doc_type,
      label: item.label,
      document_id: row?.id ?? null,
      file_name: fileName,
      ip: clientIp(req),
    });
    void appendLinkAudit(link.id, { event: "uploaded", doc_key: item.key, file_name: fileName });
    void logAction({
      entityType: `${entityType}_document`, entityId, action: "CREATE",
      ipAddress: clientIp(req),
      newValue: { file_name: fileName, doc_type: item.doc_type, via: "tenant_link" },
    });

    res.status(201).json({ success: true, data: { doc_key: item.key, file_name: fileName } });
  } catch (err: any) {
    console.error("[tenant-links] upload failed:", err);
    fail(res, 500, "UPLOAD_FAILED", err.message ?? "업로드에 실패했습니다.");
  }
});

/** 제출 마감 — 필수 서류가 모두 올라왔을 때만 닫는다. */
publicRouter.post("/v1/public/doc-requests/:token/submit", async (req, res): Promise<void> => {
  try {
    const found = await resolveTenantLink(String(req.params.token), "doc_request", { markViewed: false });
    if ("failure" in found) { failLink(res, found.failure); return; }
    const { link } = found;

    const view = docRequestView(link);
    const missing = view.items.filter((i) => i.required && !i.submitted);
    if (missing.length) {
      fail(res, 400, "MISSING_REQUIRED", `아직 제출되지 않은 필수 서류가 있습니다: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    await markTenantLinkCompleted(link.id);
    void appendLinkAudit(link.id, { event: "submitted", ip: clientIp(req) });
    void logAction({
      entityType: "contract", entityId: link.context_id, action: "UPDATE",
      ipAddress: clientIp(req), newValue: { tenant_documents_submitted: link.id },
    });
    res.json({ success: true, message: "서류 제출이 완료되었습니다. 감사합니다." });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

export { adminRouter as tenantLinksAdminRouter, publicRouter as tenantLinksPublicRouter };
