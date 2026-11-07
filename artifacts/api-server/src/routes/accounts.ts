import { Router, type IRouter } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { eq, ilike, and, or, isNull, inArray, desc, SQL, sql, asc } from "drizzle-orm";
import { parseListPage, parseSortParams, buildOrderBy, sendList, type SortMap } from "../utils/pagination.js";
import {
  db, accountsTable, accountContactsTable, contactsTable, commissionsTable, paymentInfoTable,
  invoicesTable, contractsTable, contractRelatedCostsTable, partnerPayoutsTable,
  spacesTable, propertiesTable, documentsTable, serviceHostsTable, partnerUsersTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { validatePassword } from "../utils/passwordPolicy";
import { revokeAllForUser } from "../lib/refreshTokens";
import {
  issuePartnerResetLink, portalBaseUrl, PORTAL_TYPES, BCRYPT_COST,
  generateTempPassword, buildPortalGuide, TEMP_PASSWORD_TTL_MS, type GuideLang,
} from "../lib/partnerPortal";
import { checkLockout, clearFailedAttempts } from "../lib/loginLockout";
import {
  invalidatePartnerCache, signPartnerImpersonationJWT, PARTNER_IMPERSONATION_TTL, type PortalType,
} from "../middlewares/requirePartnerAuth";
import { sendPortalGuideEmail } from "../lib/email";
import { sendSms, smsBytes, smsType } from "../lib/sms";
import { resolveEmailBrand } from "../lib/emailBrand";
import { z } from "zod";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { excludeConsolidated } from "../lib/billing/consolidatedInvoices";
import { formatPersonName, formatFirstName, formatLastName, phoneDigits } from "../lib/nameFormat";
import { enrichFromWebsite, downloadImage } from "../lib/accounts/websiteEnrich";
import {
  verifyBizNo, isBizVerifyConfigured, isValidBizNoChecksum, formatBizNo, normaliseBizNo,
} from "../lib/accounts/bizNoVerify";
import {
  uploadToCloudinary, uploadPrivateToCloudinary, deleteFromCloudinary,
  cldFolder, isCloudinaryConfigured, generateSignedUrl,
} from "../utils/cloudinary";
import { calcRetentionDate } from "../lib/retention";
import { maskResidentNo, maskPassportNo } from "../lib/piiMask";
import { decodeUploadFilename } from "../lib/uploadFilename";
import {
  ListAccountsQueryParams,
  CreateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  UpdateAccountBody,
  DeleteAccountParams,
  CreateContactBody,
} from "@workspace/api-zod";
import { resolvePartyCode } from "../lib/documents/partyCode";

import { keywordCondition, contactIdsByName } from "../lib/listSearch";
const router: IRouter = Router();

async function enrichAccount(row: typeof accountsTable.$inferSelect) {
  const [primaryContact] = row.primary_contact_id
    ? await db.select({
        first_name: contactsTable.first_name,
        last_name: contactsTable.last_name,
        mobile_number: contactsTable.mobile_number,
        office_number: contactsTable.office_number,
      })
        .from(contactsTable).where(eq(contactsTable.id, row.primary_contact_id))
    : [null];
  const [secondaryContact] = row.secondary_contact_id
    ? await db.select({ first_name: contactsTable.first_name, last_name: contactsTable.last_name })
        .from(contactsTable).where(eq(contactsTable.id, row.secondary_contact_id))
    : [null];
  const [commission] = row.default_commission_id
    ? await db.select({ name: commissionsTable.name }).from(commissionsTable)
        .where(eq(commissionsTable.id, row.default_commission_id))
    : [null];
  const [payInfo] = row.payment_info_id
    ? await db.select({ name: paymentInfoTable.name }).from(paymentInfoTable)
        .where(eq(paymentInfoTable.id, row.payment_info_id))
    : [null];
  const [parentAccount] = row.parent_account_id
    ? await db.select({ name: accountsTable.name }).from(accountsTable)
        .where(eq(accountsTable.id, row.parent_account_id))
    : [null];

  // 고객 ID — 상세를 열 때 아직 번호가 없으면 그 자리에서 채번한다. 기존
  // 계정도 처음 열리는 순간 번호를 받고, 이후로는 바뀌지 않는다.
  const party_code = await resolvePartyCode({ entityType: "account", entityId: row.id });

  return {
    ...row,
    party_code,
    primary_contact_name: primaryContact ? formatPersonName(primaryContact.first_name, primaryContact.last_name) : null,
    // 회사 대표번호(phone1)가 비어 있는 계정이 많아 리스트가 빈칸으로 남는다. 주
    // 연락처의 휴대폰(없으면 사무실 번호)을 함께 실어 화면에서 대체 표시한다.
    primary_contact_phone: primaryContact
      ? (primaryContact.mobile_number ?? primaryContact.office_number ?? null)
      : null,
    secondary_contact_name: secondaryContact ? formatPersonName(secondaryContact.first_name, secondaryContact.last_name) : null,
    default_commission_name: commission?.name ?? null,
    payment_info_name: payInfo?.name ?? null,
    parent_account_name: parentAccount?.name ?? null,
  };
}

/** 정렬 허용 컬럼 — AccountList 의 SORTABLE_KEYS 와 1:1(대표 연락처는 파생이라 제외). */
const ACCOUNT_SORT: SortMap = {
  name: accountsTable.name,
  account_type: accountsTable.account_type,
  account_email: accountsTable.account_email,
  status: accountsTable.status,
  created_at: accountsTable.created_at,
  updated_at: accountsTable.updated_at,
};

router.get("/v1/accounts", async (req, res): Promise<void> => {
  const parsed = ListAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, account_type, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(accountsTable.deleted_at, req)];
  if (account_type) conditions.push(eq(accountsTable.account_type, account_type));
  if (status) conditions.push(eq(accountsTable.status, status));
  // 이름·이메일에 더해 사업자등록번호·대표자·전화·주소, 그리고 대표 연락처 이름으로도 찾는다.
  if (search) {
    const contactIds = await contactIdsByName(search);
    conditions.push(keywordCondition(
      search,
      [
        accountsTable.name, accountsTable.account_email, accountsTable.biz_registration_no,
        accountsTable.ceo_name, accountsTable.phone1, accountsTable.address_suburb,
        accountsTable.description,
      ],
      [
        { column: accountsTable.primary_contact_id, ids: contactIds },
        { column: accountsTable.secondary_contact_id, ids: contactIds },
      ],
    ));
  }
  const where = and(...conditions);
  const { limit, offset, page } = parseListPage(req.query);
  const sort = parseSortParams(req.query, ACCOUNT_SORT);
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(accountsTable)
      .where(where)
      .orderBy(...buildOrderBy(ACCOUNT_SORT, sort, accountsTable.id, [asc(accountsTable.name)]))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(accountsTable).where(where),
  ]);
  const enriched = await Promise.all(rows.map(enrichAccount));
  // 고유식별정보(PIPA §24-3): the account list masks 주민등록번호 — the raw value
  // stays on GET /v1/accounts/:id, which the edit form and contract party card use.
  sendList(res, enriched.map((a) => ({
    ...a,
    resident_no: maskResidentNo(a.resident_no),
    has_resident_no: Boolean(a.resident_no?.trim()),
  })), count ?? 0, { limit, offset, page });
});

/**
 * `biz_verified_at` crosses the wire as an ISO string (JSON has no date type)
 * but is a timestamptz column — hand Drizzle a Date, or nothing at all.
 */
function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined; // absent → leave the column alone
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 회사 계정과 개인 계정은 서로 다른 칸을 쓴다. 화면에서 감춘 칸이 예전 값을 그대로
 * 들고 있으면 계약서·청구서에 유령 대표자나 남의 사업자등록번호가 찍히므로, 주체를
 * 바꾼 저장에서 반대편 칸을 비운다. entity_kind 가 본문에 없으면(예: 다른 화면이
 * 일부 필드만 보내는 경우) 아무것도 건드리지 않는다.
 */
function clearOtherKindFields<T extends { entity_kind?: string | null }>(data: T): T {
  if (data.entity_kind === "Individual") {
    return {
      ...data,
      website_url: null, phone2: null, ceo_name: null,
      biz_registration_no: null, corp_registration_no: null, biz_verify_status: null, biz_verified_at: null,
    };
  }
  if (data.entity_kind === "Company") return { ...data, resident_no: null };
  return data;
}

router.post("/v1/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const values = clearOtherKindFields(parsed.data);
  const [row] = await db.insert(accountsTable)
    .values({ ...values, biz_verified_at: toDate(values.biz_verified_at) })
    .returning();
  res.status(201).json(await enrichAccount(row));
});

router.get("/v1/accounts/:id", async (req, res): Promise<void> => {
  const parsed = GetAccountParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(accountsTable).where(eq(accountsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichAccount(row));
});

router.put("/v1/accounts/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateAccountParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateAccountBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const values = clearOtherKindFields(bodyParsed.data);
  const [row] = await db.update(accountsTable)
    .set({ ...values, biz_verified_at: toDate(values.biz_verified_at), updated_at: new Date() })
    .where(eq(accountsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichAccount(row));
});

/**
 * 통합(단체) 청구 설정 — 여러 공간을 임차하는 계정을 매월 한 장의 청구서로 묶는다.
 *   PUT /v1/accounts/:id/billing-settings { enabled, billing_day, prorate }
 * 생성된 OpenAPI 클라이언트를 다시 돌리지 않아도 되도록 계정 본문 스키마와 분리했다.
 */
const BillingSettingsBody = z.object({
  consolidated_billing_enabled: z.boolean().optional(),
  // 1~28 — 말일 근처 날짜는 달마다 존재 여부가 달라져 청구일이 흔들린다.
  consolidated_billing_day: z.number().int().min(1).max(28).optional(),
  consolidated_prorate_enabled: z.boolean().optional(),
  // 청구서를 만드는 날(1~28). null 이면 매일 이번 달분을 다시 계산하는 기존 동작.
  consolidated_issue_day: z.number().int().min(1).max(28).nullable().optional(),
  // 생성일에 만드는 대상이 다음 달분인지(기본) 이번 달분인지.
  consolidated_issue_next_month: z.boolean().optional(),
});

router.put("/v1/accounts/:id/billing-settings", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = BillingSettingsBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(accountsTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(accountsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logAction({ entityType: "account", entityId: id, action: "UPDATE", newValue: parsed.data });
  res.json(await enrichAccount(row));
});

// ── Enrichment & verification ────────────────────────────────────────────
// Both endpoints return SUGGESTIONS only. Nothing is written to the account —
// the admin approves the fields in the review dialog and the normal PUT saves.

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
// Account paperwork is bigger than a logo — allow a normal document.
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// POST /v1/accounts/enrich-from-website { url } — read a company's public site.
router.post("/v1/accounts/enrich-from-website", async (req, res): Promise<void> => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  if (!url.trim()) { res.status(400).json({ error: "A website address is required" }); return; }
  try {
    const result = await enrichFromWebsite(url);

    // A 사업자등록번호 read off a footer is worth exactly as much as the footer.
    // Check the digits here so the review dialog can flag a bad one up front.
    let biz_check: { checksum_ok: boolean; formatted: string } | null = null;
    const scrapedBizNo = result.fields.biz_registration_no;
    if (scrapedBizNo) {
      const digits = normaliseBizNo(scrapedBizNo);
      biz_check = {
        checksum_ok: !!digits && isValidBizNoChecksum(scrapedBizNo),
        formatted: digits ? formatBizNo(scrapedBizNo) : scrapedBizNo,
      };
      if (digits) result.fields.biz_registration_no = formatBizNo(scrapedBizNo);
    }

    res.json({ success: true, ...result, biz_check });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The website could not be read";
    console.error("[accounts] website enrichment failed:", message);
    // A missing AI key is a configuration problem, not a bad request.
    res.status(/AI is not configured/.test(message) ? 503 : 400).json({ error: message });
  }
});

// POST /v1/accounts/verify-biz-no { biz_no } — 국세청 사업자등록 상태조회.
router.post("/v1/accounts/verify-biz-no", async (req, res): Promise<void> => {
  const input = typeof req.body?.biz_no === "string" ? req.body.biz_no : "";
  const digits = normaliseBizNo(input);
  if (!digits) { res.status(400).json({ error: "사업자등록번호 must be 10 digits" }); return; }

  const checksum_ok = isValidBizNoChecksum(digits);
  if (!isBizVerifyConfigured()) {
    // Without the NTS key the checksum is still a real answer — say so plainly
    // rather than pretending the number was verified with the tax office.
    res.json({
      success: true, configured: false, checksum_ok,
      b_no: digits, formatted: formatBizNo(digits),
      status: null, status_text: null, tax_type: null, end_date: null,
    });
    return;
  }
  try {
    const result = await verifyBizNo(digits);
    res.json({ success: true, configured: true, checksum_ok, formatted: formatBizNo(digits), ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    console.error("[accounts] biz-no verification failed:", message);
    res.status(503).json({ error: message });
  }
});

// POST /v1/accounts/logo — store a logo and return its permanent URL.
// Accepts either a multipart `image` (manual upload) or JSON { url } (a logo
// candidate found by the crawler, which is re-hosted rather than hot-linked).
router.post("/v1/accounts/logo", upload.single("image"), async (req, res): Promise<void> => {
  if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image storage is not configured" }); return; }
  try {
    let buffer: Buffer;
    if (req.file) {
      if (!/^image\//i.test(req.file.mimetype)) { res.status(400).json({ error: "The logo must be an image" }); return; }
      buffer = req.file.buffer;
    } else if (typeof req.body?.url === "string" && req.body.url.trim()) {
      ({ buffer } = await downloadImage(req.body.url.trim()));
    } else {
      res.status(400).json({ error: "An image file or image URL is required" });
      return;
    }
    const up = await uploadToCloudinary(buffer, {
      folder: cldFolder("branding"),
      // Logos are line art on transparency — never upscale, never re-crop.
      transformation: [{ quality: "auto:good", fetch_format: "auto" }, { width: 800, height: 800, crop: "limit" }],
    });
    res.json({ success: true, url: up.secure_url, public_id: up.public_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Logo upload failed";
    console.error("[accounts] logo upload failed:", message);
    res.status(400).json({ error: message });
  }
});

// ── Account tabs: related records ────────────────────────────────────────

/** Sums grouped by currency — accounts can transact in more than one. */
function addTo(totals: Record<string, number>, currency: string, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  totals[currency] = (totals[currency] ?? 0) + amount;
}

interface FinanceTx {
  kind: "Invoice" | "Payout" | "Cost";
  id: number;
  ref: string;
  date: string | null;
  description: string;
  amount: number;
  currency: string;
  status: string;
  detail_url: string;
}

// GET /v1/accounts/:id/finance — 회계 탭.
// Receivable (invoices raised against the account) and payable (partner payouts
// owed to it, plus one-off costs on its contracts), aggregated per currency.
// Money columns are numeric → strings; every read goes through Number().
router.get("/v1/accounts/:id/finance", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const transactions: FinanceTx[] = [];
  const receivable_outstanding: Record<string, number> = {};
  const receivable_overdue: Record<string, number> = {};
  const receivable_paid: Record<string, number> = {};
  const payable_outstanding: Record<string, number> = {};
  const payable_paid: Record<string, number> = {};
  const cost_total: Record<string, number> = {};

  const today = new Date().toISOString().slice(0, 10);

  // ── Receivable: invoices billed to this account ────────────────────────
  // 통합 청구서는 자식(공간별) 인보이스와 금액이 겹치므로 미수/수납 집계에서 뺀다.
  const invoices = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.account_id, id), isNull(invoicesTable.deleted_at), excludeConsolidated()))
    .orderBy(desc(invoicesTable.id));
  for (const inv of invoices) {
    const amount = Number(inv.amount);
    if (inv.status === "Paid") {
      addTo(receivable_paid, inv.currency, amount);
    } else if (inv.status !== "Void" && inv.status !== "Cancelled") {
      addTo(receivable_outstanding, inv.currency, amount);
      if (inv.due_date && inv.due_date < today) addTo(receivable_overdue, inv.currency, amount);
    }
    transactions.push({
      kind: "Invoice", id: inv.id, ref: inv.invoice_ref,
      date: inv.due_date ?? (inv.created_at as Date | null)?.toISOString().slice(0, 10) ?? null,
      description: inv.description ?? "", amount, currency: inv.currency, status: inv.status,
      detail_url: `/finance/invoices/${inv.id}`,
    });
  }

  // ── Payable: partner payouts owed to this account's service-host record ──
  const payouts = await db.select({ p: partnerPayoutsTable })
    .from(partnerPayoutsTable)
    .innerJoin(serviceHostsTable, eq(serviceHostsTable.id, partnerPayoutsTable.service_host_id))
    .where(eq(serviceHostsTable.account_id, id))
    .orderBy(desc(partnerPayoutsTable.id));
  for (const { p } of payouts) {
    const amount = Number(p.amount);
    if (p.status === "Paid") addTo(payable_paid, p.currency, amount);
    else if (p.status !== "Cancelled") addTo(payable_outstanding, p.currency, amount);
    transactions.push({
      kind: "Payout", id: p.id, ref: p.payout_ref,
      date: (p.paid_at ?? p.accrued_at) instanceof Date
        ? ((p.paid_at ?? p.accrued_at) as Date).toISOString().slice(0, 10) : null,
      description: p.description ?? "", amount, currency: p.currency, status: p.status,
      detail_url: `/partners/payouts`,
    });
  }

  // ── One-off costs recorded on this account's contracts ─────────────────
  const contracts = await db.select({ id: contractsTable.id, ref: contractsTable.contract_ref })
    .from(contractsTable)
    .where(and(
      or(eq(contractsTable.tenant_account_id, id), eq(contractsTable.landlord_account_id, id))!,
      isNull(contractsTable.deleted_at),
    ));
  if (contracts.length) {
    const refById = new Map(contracts.map((c) => [c.id, c.ref]));
    const costs = await db.select().from(contractRelatedCostsTable)
      .where(inArray(contractRelatedCostsTable.contract_id, contracts.map((c) => c.id)))
      .orderBy(desc(contractRelatedCostsTable.id));
    for (const cost of costs) {
      if (cost.status !== "Active") continue;
      const amount = Number(cost.amount);
      addTo(cost_total, cost.currency, amount);
      transactions.push({
        kind: "Cost", id: cost.id, ref: refById.get(cost.contract_id) ?? `#${cost.contract_id}`,
        date: cost.remitted_on ?? null,
        description: [cost.cost_type, cost.payee_name].filter(Boolean).join(" · "),
        amount, currency: cost.currency, status: cost.cost_type,
        detail_url: `/contracts/${cost.contract_id}`,
      });
    }
  }

  // Newest first; rows with no date sort last rather than disappearing.
  transactions.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  res.json({
    currency: account.default_currency ?? "AUD",
    receivable: {
      outstanding: receivable_outstanding,
      overdue: receivable_overdue,
      paid: receivable_paid,
      count: invoices.length,
    },
    payable: { outstanding: payable_outstanding, paid: payable_paid, count: payouts.length },
    costs: { total: cost_total },
    transactions,
  });
});

/**
 * Every contact attached to an account, in one shape.
 *
 * Two sources, deliberately: the two designated slots live on the account row
 * (primary/secondary) and everyone else lives in `account_contacts`. `link`
 * tells the UI how to unlink the row — clearing a column vs deleting a link.
 */
async function loadAccountContacts(account: typeof accountsTable.$inferSelect) {
  const links = await db.select().from(accountContactsTable)
    .where(eq(accountContactsTable.account_id, account.id))
    .orderBy(accountContactsTable.id);

  const slotIds = [account.primary_contact_id, account.secondary_contact_id].filter(Boolean) as number[];
  const ids = [...new Set([...slotIds, ...links.map((l) => l.contact_id)])];
  if (!ids.length) return [];

  const rows = await db.select().from(contactsTable)
    .where(and(inArray(contactsTable.id, ids), isNull(contactsTable.deleted_at)));

  // 연락처 탭은 이름·연락처만 보여주는 리스트다 — 고유식별정보는 마스킹해 싣는다.
  // (편집은 연락처 상세 화면이 GET /v1/contacts/:id 로 원본을 다시 받는다.)
  const maskPii = (c: typeof contactsTable.$inferSelect) => ({
    ...c,
    resident_no: maskResidentNo(c.resident_no),
    passport_number: maskPassportNo(c.passport_number),
  });
  const out: Array<Record<string, unknown>> = [];
  for (const cid of slotIds) {
    const c = rows.find((r) => r.id === cid);
    if (!c) continue;
    out.push({ ...maskPii(c), role: cid === account.primary_contact_id ? "Primary" : "Secondary", link: "slot" });
  }
  for (const l of links) {
    if (slotIds.includes(l.contact_id)) continue; // already shown in its slot
    const c = rows.find((r) => r.id === l.contact_id);
    if (!c) continue;
    out.push({ ...maskPii(c), role: l.role || "Member", link: "link", link_id: l.id });
  }
  return out;
}

// GET /v1/accounts/:id/related — 연락처 / 자산 tabs.
// Contacts are the primary/secondary slots plus the account_contacts links;
// assets are the spaces this account owns (landlord_account_id).
router.get("/v1/accounts/:id/related", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const contacts = await loadAccountContacts(account);

  const spaces = await db.select({
    id: spacesTable.id,
    name: spacesTable.name,
    space_type: spacesTable.space_type,
    custom_type_name: spacesTable.custom_type_name,
    status: spacesTable.status,
    floor_number: spacesTable.floor_number,
    exclusive_area_m2: spacesTable.exclusive_area_m2,
    monthly_rent: spacesTable.monthly_rent,
    deposit_amount: spacesTable.deposit_amount,
    base_currency: spacesTable.base_currency,
    property_id: spacesTable.property_id,
    property_name: propertiesTable.name,
  })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(propertiesTable.id, spacesTable.property_id))
    .where(and(eq(spacesTable.landlord_account_id, id), isNull(spacesTable.deleted_at)))
    .orderBy(spacesTable.name);

  // Sub-accounts, so a head office shows its branches.
  const children = await db.select({ id: accountsTable.id, name: accountsTable.name, account_type: accountsTable.account_type, status: accountsTable.status })
    .from(accountsTable)
    .where(and(eq(accountsTable.parent_account_id, id), isNull(accountsTable.deleted_at)))
    .orderBy(accountsTable.name);

  res.json({ contacts, spaces, children });
});

// GET /v1/accounts/:id/contacts — the 연락처 tab on its own, so linking can
// refresh without re-fetching spaces and sub-accounts.
router.get("/v1/accounts/:id/contacts", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await loadAccountContacts(account));
});

// POST /v1/accounts/:id/contacts — attach a contact to the account, either an
// existing one (`contact_id`) or a brand-new one created from `contact`.
// `as_slot` promotes it into the primary/secondary slot on the account row;
// otherwise it becomes an account_contacts link with a free-text role.
router.post("/v1/accounts/:id/contacts", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const body = (req.body ?? {}) as {
    contact_id?: number;
    role?: string | null;
    as_slot?: "primary" | "secondary" | null;
    contact?: Record<string, unknown>;
  };

  let contactId = Number(body.contact_id) || 0;

  if (!contactId) {
    const draft = body.contact ?? {};
    const first = typeof draft["first_name"] === "string" ? draft["first_name"].trim() : "";
    const last = typeof draft["last_name"] === "string" ? draft["last_name"].trim() : "";
    if (!first && !last) { res.status(400).json({ error: "first_name or last_name is required" }); return; }
    const parsed = CreateContactBody.safeParse({
      ...draft,
      first_name: first || last,
      last_name: last || first,
      // Contacts created from an account are often phone-only in KR leases.
      email: typeof draft["email"] === "string" ? draft["email"] : "",
    });
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const values = {
      ...parsed.data,
      first_name: formatFirstName(parsed.data.first_name),
      last_name: formatLastName(parsed.data.last_name),
      email: parsed.data.email || null,
      // Default the company to the account it was created under.
      company_name: parsed.data.company_name || account.name,
    };
    const [created] = await db.insert(contactsTable).values(values).returning();
    contactId = created!.id;
  } else {
    const [existing] = await db.select({ id: contactsTable.id }).from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), isNull(contactsTable.deleted_at)));
    if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }
  }

  if (body.as_slot === "primary" || body.as_slot === "secondary") {
    await db.update(accountsTable)
      .set(body.as_slot === "primary"
        ? { primary_contact_id: contactId }
        : { secondary_contact_id: contactId })
      .where(eq(accountsTable.id, id));
    // A slot holder does not also need a link row.
    await db.delete(accountContactsTable)
      .where(and(eq(accountContactsTable.account_id, id), eq(accountContactsTable.contact_id, contactId)));
  } else {
    await db.insert(accountContactsTable)
      .values({ account_id: id, contact_id: contactId, role: body.role?.trim() || null })
      .onConflictDoUpdate({
        target: [accountContactsTable.account_id, accountContactsTable.contact_id],
        set: { role: body.role?.trim() || null },
      });
  }

  const [fresh] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  res.status(201).json({ contact_id: contactId, contacts: await loadAccountContacts(fresh!) });
});

// DELETE /v1/accounts/:id/contacts/:contactId — unlink only. The contact record
// itself is never deleted here; it may be attached to other accounts.
router.delete("/v1/accounts/:id/contacts/:contactId", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const contactId = Number(req.params["contactId"]);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(contactId) || contactId <= 0) {
    res.status(400).json({ error: "Invalid id" }); return;
  }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const patch: Record<string, null> = {};
  if (account.primary_contact_id === contactId) patch["primary_contact_id"] = null;
  if (account.secondary_contact_id === contactId) patch["secondary_contact_id"] = null;
  if (Object.keys(patch).length) {
    await db.update(accountsTable).set(patch).where(eq(accountsTable.id, id));
  }
  await db.delete(accountContactsTable)
    .where(and(eq(accountContactsTable.account_id, id), eq(accountContactsTable.contact_id, contactId)));

  const [fresh] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  res.json({ contacts: await loadAccountContacts(fresh!) });
});

// GET /v1/accounts/:id/documents — 문서 탭. Files stored against the account.
// Signed URLs expire in 15 minutes (APP 11: sensitive files are never public).
router.get("/v1/accounts/:id/documents", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  const rows = await db.select().from(documentsTable)
    .where(and(
      eq(documentsTable.entity_type, "account"),
      eq(documentsTable.entity_id, id),
      isNull(documentsTable.deleted_at),
    ))
    .orderBy(desc(documentsTable.created_at));
  res.json(rows.map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    file_name: d.file_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    created_at: d.created_at,
    signed_url: generateSignedUrl(d.cloudinary_public_id, 900),
  })));
});

// POST /v1/accounts/:id/documents (multipart: file, doc_type?) — file anything
// against the account. Private upload + retention date, same as contact files:
// a company's paperwork is no less sensitive for belonging to a company.
router.post("/v1/accounts/:id/documents", docUpload.single("file"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  if (!req.file) { res.status(400).json({ error: "A file is required" }); return; }
  if (!isCloudinaryConfigured()) { res.status(503).json({ error: "File storage is not configured" }); return; }

  const [account] = await db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const docType = (typeof req.body?.doc_type === "string" && req.body.doc_type.trim() ? req.body.doc_type : "other")
    .slice(0, 32);
  try {
    const up = await uploadPrivateToCloudinary(req.file.buffer, { folder: cldFolder("private/accounts") });
    const [row] = await db.insert(documentsTable).values({
      entity_type: "account",
      entity_id: id,
      doc_type: docType,
      file_name: decodeUploadFilename(req.file.originalname).slice(0, 255),
      file_size: req.file.size,
      mime_type: req.file.mimetype.slice(0, 100),
      cloudinary_public_id: up.public_id,
      uploaded_by: (req as any).user?.id ?? null,
      uploaded_by_type: "User",
      retention_until: calcRetentionDate(docType),
    } as never).returning();
    res.status(201).json({ success: true, document: row });
  } catch (err) {
    console.error("[accounts] document upload failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// DELETE /v1/accounts/:id/documents/:docId — soft-delete the row, drop the asset.
router.delete("/v1/accounts/:id/documents/:docId", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const docId = String(req.params["docId"] ?? "");
  if (!Number.isInteger(id) || id <= 0 || !docId) { res.status(400).json({ error: "Invalid request" }); return; }
  const [doc] = await db.select().from(documentsTable).where(
    and(
      eq(documentsTable.id, docId),
      eq(documentsTable.entity_type, "account"),
      eq(documentsTable.entity_id, id),
      isNull(documentsTable.deleted_at),
    ),
  );
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(documentsTable).set({ deleted_at: new Date() }).where(eq(documentsTable.id, doc.id));
  await deleteFromCloudinary(doc.cloudinary_public_id);
  res.status(204).end();
});

/* ────────────────────────────────────────────────────────────────────────────
 * 포털 사용 — per-user portal access for this account.
 *
 * A row in `partner_users` IS the login: the email is the 아이디, `portal_type`
 * decides which portal (agent / owner / service_host) it opens, and `is_active`
 * is the on/off switch. Passwords are only ever written here (bcrypt) — never
 * read back — so the admin UI can set one directly or mail an invite/reset link
 * that lands on the same /reset-password flow the portals already use.
 * ──────────────────────────────────────────────────────────────────────────── */

const PORTAL_USER_COLUMNS = {
  id: partnerUsersTable.id,
  account_id: partnerUsersTable.account_id,
  portal_type: partnerUsersTable.portal_type,
  email: partnerUsersTable.email,
  first_name: partnerUsersTable.first_name,
  last_name: partnerUsersTable.last_name,
  phone: partnerUsersTable.phone,
  avatar_url: partnerUsersTable.avatar_url,
  is_active: partnerUsersTable.is_active,
  last_login_at: partnerUsersTable.last_login_at,
  force_password_change: partnerUsersTable.force_password_change,
  temp_password_expires_at: partnerUsersTable.temp_password_expires_at,
  created_at: partnerUsersTable.created_at,
  updated_at: partnerUsersTable.updated_at,
};

/** The listed shape, plus where this login actually signs in. */
function shapePortalUser(row: Record<string, any>) {
  return {
    ...row,
    display_name: formatPersonName(row["first_name"], row["last_name"]) || null,
    portal_url: portalBaseUrl(String(row["portal_type"])),
  };
}

function actorOf(req: any): { actorId: number | null; actorEmail: string | null } {
  const user = req?.user;
  return { actorId: user?.id ?? null, actorEmail: user?.email ?? null };
}

async function loadPortalUser(accountId: number, userId: number) {
  const [row] = await db.select(PORTAL_USER_COLUMNS).from(partnerUsersTable)
    .where(and(
      eq(partnerUsersTable.id, userId),
      eq(partnerUsersTable.account_id, accountId),
      isNull(partnerUsersTable.deleted_at),
    ));
  return row ?? null;
}

/** Path ids + account existence in one place — every handler below starts here. */
async function resolveAccountAndUser(req: any, res: any, withUser: boolean): Promise<{ id: number; userId: number } | null> {
  const id = Number(req.params["id"]);
  const userId = withUser ? Number(req.params["userId"]) : 0;
  if (!Number.isInteger(id) || id <= 0 || (withUser && (!Number.isInteger(userId) || userId <= 0))) {
    res.status(400).json({ error: "Invalid id" });
    return null;
  }
  const [account] = await db.select({ id: accountsTable.id }).from(accountsTable)
    .where(and(eq(accountsTable.id, id), isNull(accountsTable.deleted_at)));
  if (!account) { res.status(404).json({ error: "Not found" }); return null; }
  return { id, userId };
}

// GET /v1/accounts/:id/portal-users — the 포털 사용 tab.
router.get("/v1/accounts/:id/portal-users", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, false);
  if (!ids) return;
  const rows = await db.select(PORTAL_USER_COLUMNS).from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.account_id, ids.id), isNull(partnerUsersTable.deleted_at)))
    .orderBy(partnerUsersTable.portal_type, partnerUsersTable.email);
  res.json(rows.map(shapePortalUser));
});

// POST /v1/accounts/:id/portal-users — grant portal access to one person.
// `password` is optional: without it the user is created inactive-until-set and
// an invite (reset) mail goes out instead, so no plaintext is ever handled here.
router.post("/v1/accounts/:id/portal-users", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, false);
  if (!ids) return;

  const body = (req.body ?? {}) as {
    portal_type?: string;
    email?: string;
    password?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    is_active?: boolean;
    send_invite?: boolean;
  };

  const portal_type = String(body.portal_type ?? "").trim();
  if (!(PORTAL_TYPES as readonly string[]).includes(portal_type)) {
    res.status(400).json({ error: "portal_type must be one of agent, owner, service_host" });
    return;
  }
  const email = String(body.email ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const password = typeof body.password === "string" && body.password ? body.password : null;
  if (password) {
    const policy = validatePassword(password);
    if (!policy.ok) { res.status(400).json({ error: policy.error }); return; }
  }

  // The email is unique across the whole table (it is the login), so a clash can
  // also be a previously removed user — revive that row instead of failing.
  const [clash] = await db.select().from(partnerUsersTable).where(eq(partnerUsersTable.email, email));
  if (clash && !clash.deleted_at) {
    res.status(409).json({ error: "This email already has a portal login" });
    return;
  }

  // No password yet → a random one nobody knows; the invite link sets the real one.
  const password_hash = await bcrypt.hash(password ?? crypto.randomUUID() + crypto.randomUUID(), BCRYPT_COST);
  const values = {
    account_id: ids.id,
    portal_type,
    email,
    password_hash,
    first_name: body.first_name?.trim() || null,
    last_name: body.last_name?.trim() || null,
    phone: body.phone?.trim() || null,
    is_active: body.is_active ?? true,
    deleted_at: null,
    reset_token_hash: null,
    reset_token_expires_at: null,
  };

  const [created] = clash
    ? await db.update(partnerUsersTable).set(values).where(eq(partnerUsersTable.id, clash.id)).returning(PORTAL_USER_COLUMNS)
    : await db.insert(partnerUsersTable).values(values).returning(PORTAL_USER_COLUMNS);

  let invited = false;
  if (!password || body.send_invite) {
    try { invited = await issuePartnerResetLink({ ...created!, portal_type }); } catch { invited = false; }
  }

  const actor = actorOf(req);
  await logAction({
    entityType: "partner_users", entityId: created!.id, action: "CREATE", ...actor,
    newValue: { account_id: ids.id, portal_type, email, is_active: created!.is_active },
  });

  res.status(201).json({ ...shapePortalUser(created!), invite_sent: invited });
});

// PUT /v1/accounts/:id/portal-users/:userId — profile + the on/off switch.
// Deactivating also invalidates live tokens, so access stops immediately rather
// than at the next token expiry.
router.put("/v1/accounts/:id/portal-users/:userId", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const existing = await loadPortalUser(ids.id, ids.userId);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (typeof body["portal_type"] === "string") {
    const portal_type = body["portal_type"].trim();
    if (!(PORTAL_TYPES as readonly string[]).includes(portal_type)) {
      res.status(400).json({ error: "portal_type must be one of agent, owner, service_host" });
      return;
    }
    patch["portal_type"] = portal_type;
  }
  if (typeof body["email"] === "string") {
    const email = body["email"].toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "A valid email is required" }); return; }
    if (email !== existing["email"]) {
      const [clash] = await db.select({ id: partnerUsersTable.id }).from(partnerUsersTable)
        .where(and(eq(partnerUsersTable.email, email), isNull(partnerUsersTable.deleted_at)));
      if (clash) { res.status(409).json({ error: "This email already has a portal login" }); return; }
      patch["email"] = email;
    }
  }
  for (const key of ["first_name", "last_name", "phone"]) {
    if (typeof body[key] === "string") patch[key] = (body[key] as string).trim() || null;
  }
  if (typeof body["is_active"] === "boolean") patch["is_active"] = body["is_active"];

  if (!Object.keys(patch).length) { res.json(shapePortalUser(existing)); return; }

  // An email or portal change moves the login itself — cut existing sessions too.
  const cutSessions = patch["is_active"] === false || "email" in patch || "portal_type" in patch;
  if (cutSessions) patch["tokens_invalid_after"] = new Date();

  const [updated] = await db.update(partnerUsersTable).set(patch)
    .where(eq(partnerUsersTable.id, ids.userId)).returning(PORTAL_USER_COLUMNS);

  if (cutSessions) {
    invalidatePartnerCache(ids.userId);
    try { await revokeAllForUser(ids.userId, "partner"); } catch {}
  }

  const actor = actorOf(req);
  await logAction({
    entityType: "partner_users", entityId: ids.userId,
    action: "is_active" in patch ? "STATUS_CHANGE" : "UPDATE", ...actor,
    oldValue: { email: existing["email"], portal_type: existing["portal_type"], is_active: existing["is_active"] },
    newValue: patch,
  });

  res.json(shapePortalUser(updated!));
});

// POST /v1/accounts/:id/portal-users/:userId/password — operator sets a password
// directly (handover, phone support). Every live session is dropped.
router.post("/v1/accounts/:id/portal-users/:userId/password", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const existing = await loadPortalUser(ids.id, ids.userId);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const password = String((req.body ?? {})["password"] ?? "");
  const policy = validatePassword(password);
  if (!policy.ok) { res.status(400).json({ error: policy.error }); return; }

  const password_hash = await bcrypt.hash(password, BCRYPT_COST);
  await db.update(partnerUsersTable)
    .set({ password_hash, reset_token_hash: null, reset_token_expires_at: null, tokens_invalid_after: new Date() })
    .where(eq(partnerUsersTable.id, ids.userId));
  invalidatePartnerCache(ids.userId);
  try { await revokeAllForUser(ids.userId, "partner"); } catch {}

  const actor = actorOf(req);
  await logAction({ entityType: "partner_users", entityId: ids.userId, action: "UPDATE", ...actor, newValue: { password: "reset-by-admin" } });

  res.json({ success: true });
});

// POST /v1/accounts/:id/portal-users/:userId/send-reset — mail the invite /
// reset link rather than handing a password over in person.
router.post("/v1/accounts/:id/portal-users/:userId/send-reset", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const existing = await loadPortalUser(ids.id, ids.userId);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  let sent = false;
  try {
    sent = await issuePartnerResetLink(existing as any);
  } catch (err) {
    console.error("Portal reset link failed:", err);
  }
  const actor = actorOf(req);
  await logAction({ entityType: "partner_users", entityId: ids.userId, action: "UPDATE", ...actor, newValue: { reset_link_sent: sent } });

  if (!sent) { res.status(502).json({ error: "Could not send the email — check the mail settings" }); return; }
  res.json({ success: true });
});

// DELETE /v1/accounts/:id/portal-users/:userId — revoke access. Soft delete so
// the audit trail (and any CS ticket authored by this login) survives.
router.delete("/v1/accounts/:id/portal-users/:userId", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const existing = await loadPortalUser(ids.id, ids.userId);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(partnerUsersTable)
    .set({ deleted_at: new Date(), is_active: false, tokens_invalid_after: new Date() })
    .where(eq(partnerUsersTable.id, ids.userId));
  invalidatePartnerCache(ids.userId);
  try { await revokeAllForUser(ids.userId, "partner"); } catch {}

  const actor = actorOf(req);
  await logAction({
    entityType: "partner_users", entityId: ids.userId, action: "DELETE", ...actor,
    oldValue: { email: existing["email"], portal_type: existing["portal_type"] },
  });

  res.status(204).end();
});


/* ── 포털 사용 — 임시 비밀번호 · 로그인 상태 · 안내 문구 · 대신 열기 ──────────
 *
 * 위의 CRUD 가 "누가 로그인할 수 있는가"를 정한다면, 아래는 담당자가 실제로
 * 파트너를 앉히기까지 하는 일들이다 — 비밀번호를 쥐여 주고, 못 들어온다는
 * 전화를 받아 상태를 확인하고, 필요하면 그 사람 화면을 직접 열어 본다.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 이 사람이 로그인 시도 횟수 집계에 쓰는 키.
 *
 * 이메일과 휴대폰 둘 다 아이디로 쓸 수 있어(loginIdentifier 참조) 한 사람 앞으로
 * 카운터가 둘 생길 수 있다. 잠금 조회·해제는 양쪽을 모두 봐야 "이메일로는
 * 풀렸는데 번호로는 여전히 잠김" 같은 상태가 안 생긴다.
 */
function lockoutKeysOf(user: Record<string, any>): string[] {
  const keys: string[] = [];
  const email = String(user["email"] ?? "").toLowerCase().trim();
  if (email) keys.push(email);
  const digits = phoneDigits(user["phone"]);
  if (digits.length >= 9) keys.push(digits);
  return keys;
}

/** 잠금 상태는 두 키 중 "더 나쁜 쪽"이 곧 이 사람의 상태다. */
async function portalLockState(user: Record<string, any>) {
  const keys = lockoutKeysOf(user);
  const states = await Promise.all(keys.map((k) => checkLockout(k, "partner")));
  const locked = states.find((s) => s.locked) ?? null;
  const failureCount = states.reduce((max, s) => Math.max(max, s.failureCount), 0);
  return {
    locked: !!locked,
    retry_after_seconds: locked?.retryAfterSeconds ?? null,
    failed_attempts: failureCount,
    max_attempts: 5,
  };
}

// GET /v1/accounts/:id/portal-users/:userId/login-status — 최근 로그인, 실패
// 횟수, 잠금, 비밀번호 상태. 잠금은 별도 컬럼이 아니라 login_attempts 에서
// 계산되므로(loginLockout) 목록에 같이 실어 보내지 않고 여기서만 조회한다.
router.get("/v1/accounts/:id/portal-users/:userId/login-status", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const user = await loadPortalUser(ids.id, ids.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const lock = await portalLockState(user);
  const expiresAt = user["temp_password_expires_at"] as Date | null;
  res.json({
    last_login_at: user["last_login_at"] ?? null,
    is_active: user["is_active"],
    force_password_change: user["force_password_change"] === true,
    temp_password_expires_at: expiresAt ?? null,
    temp_password_active: !!(expiresAt && new Date(expiresAt) > new Date()),
    ...lock,
  });
});

// POST /v1/accounts/:id/portal-users/:userId/unlock — 반복 실패로 잠긴 로그인을
// 담당자가 풀어 준다. 15분을 기다리게 하는 대신 실패 기록을 지운다.
router.post("/v1/accounts/:id/portal-users/:userId/unlock", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const user = await loadPortalUser(ids.id, ids.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const cleared = await clearFailedAttempts(lockoutKeysOf(user), "partner");
  const actor = actorOf(req);
  await logAction({
    entityType: "partner_users", entityId: ids.userId, action: "UNBLOCK", ...actor,
    newValue: { unlocked: true, cleared_attempts: cleared },
  });
  res.json({ success: true, cleared_attempts: cleared, ...(await portalLockState(user)) });
});

// POST /v1/accounts/:id/portal-users/:userId/temp-password — 1회용 비밀번호.
// 응답에 평문이 한 번 실려 나가고 저장은 해시뿐이라, 화면을 닫으면 다시 볼 수
// 없다. 파트너는 이 비밀번호로 들어와 곧바로 새 비밀번호를 정해야 한다.
router.post("/v1/accounts/:id/portal-users/:userId/temp-password", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const user = await loadPortalUser(ids.id, ids.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const password = generateTempPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
  await db.update(partnerUsersTable)
    .set({
      password_hash: await bcrypt.hash(password, BCRYPT_COST),
      force_password_change: true,
      temp_password_expires_at: expiresAt,
      // 이전에 보낸 재설정 링크는 무효로 — 살아 있는 경로는 하나여야 한다.
      reset_token_hash: null,
      reset_token_expires_at: null,
      tokens_invalid_after: new Date(),
    })
    .where(eq(partnerUsersTable.id, ids.userId));
  invalidatePartnerCache(ids.userId);
  try { await revokeAllForUser(ids.userId, "partner"); } catch {}

  const actor = actorOf(req);
  await logAction({
    entityType: "partner_users", entityId: ids.userId, action: "UPDATE", ...actor,
    newValue: { temp_password_issued: true, expires_at: expiresAt.toISOString() },
  });

  res.json({ temp_password: password, expires_at: expiresAt.toISOString() });
});

/* ── 이용 안내 문구 ───────────────────────────────────────────────────────── */

/** 로그인 아이디 — 이메일이 없는 임차인은 휴대폰 번호가 곧 아이디다. */
function loginIdOf(user: Record<string, any>): string {
  return String(user["email"] ?? "").trim() || String(user["phone"] ?? "").trim();
}

async function composeGuide(user: Record<string, any>, body: Record<string, any>) {
  const brand = await resolveEmailBrand();
  const lang: GuideLang = String(body["lang"] ?? "").toLowerCase() === "en" ? "en" : "ko";
  return {
    lang,
    ...buildPortalGuide({
      portalType: String(user["portal_type"]),
      loginId: loginIdOf(user),
      password: typeof body["password"] === "string" ? body["password"] : null,
      tempPasswordExpiresAt: (user["temp_password_expires_at"] as Date | null) ?? null,
      brandName: brand.name,
      lang,
    }),
  };
}

// POST /v1/accounts/:id/portal-users/:userId/guide — 안내 문구 미리보기.
// 비밀번호가 담기므로 GET(+쿼리스트링)이 아니라 POST 다 — 쿼리는 접근 로그에
// 그대로 남는다.
router.post("/v1/accounts/:id/portal-users/:userId/guide", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const user = await loadPortalUser(ids.id, ids.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const { subject, text } = await composeGuide(user, (req.body ?? {}) as Record<string, any>);
  const bytes = smsBytes(text);
  res.json({
    subject, text,
    sms_bytes: bytes,
    sms_type: smsType(text),
    can_email: !!String(user["email"] ?? "").trim(),
    can_sms: phoneDigits(user["phone"]).length >= 9,
  });
});

// POST /v1/accounts/:id/portal-users/:userId/guide/send — 같은 문구를 메일이나
// 문자로. 문구를 클라이언트에서 받아 그대로 보내지 않고 여기서 다시 만든다 —
// 발송 내용이 화면 미리보기와 어긋나지 않게, 그리고 임의 문구를 우리 발신
// 주소로 실어 보내지 못하게.
router.post("/v1/accounts/:id/portal-users/:userId/guide/send", async (req, res): Promise<void> => {
  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;
  const user = await loadPortalUser(ids.id, ids.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const body = (req.body ?? {}) as Record<string, any>;
  const channel = String(body["channel"] ?? "email");
  if (channel !== "email" && channel !== "sms") {
    res.status(400).json({ error: "channel must be email or sms" });
    return;
  }
  const { subject, text } = await composeGuide(user, body);

  let sent = false;
  let error: string | null = null;
  if (channel === "email") {
    const to = String(user["email"] ?? "").trim();
    if (!to) { res.status(400).json({ error: "이 사용자에게는 이메일 주소가 없습니다" }); return; }
    sent = await sendPortalGuideEmail({
      to, subject, text,
      name: formatPersonName(user["first_name"], user["last_name"]) || to,
      portalUrl: portalBaseUrl(String(user["portal_type"])),
    });
    if (!sent) error = "메일을 보내지 못했습니다 — 메일 설정을 확인하세요";
  } else {
    const to = String(user["phone"] ?? "").trim();
    if (!to) { res.status(400).json({ error: "이 사용자에게는 휴대폰 번호가 없습니다" }); return; }
    const result = await sendSms({ to, text, smsOnly: true });
    sent = result.ok;
    if (!sent) error = result.error ?? "문자를 보내지 못했습니다";
  }

  const actor = actorOf(req);
  await logAction({
    entityType: "partner_users", entityId: ids.userId, action: "UPDATE", ...actor,
    // 비밀번호는 기록하지 않는다 — 감사 로그는 보낸 사실만 남기면 된다.
    newValue: { portal_guide_sent: sent, channel },
  });

  if (!sent) { res.status(502).json({ error }); return; }
  res.json({ success: true, channel });
});

// POST /v1/accounts/:id/portal-users/:userId/impersonate — 담당자가 파트너
// 포털을 그 사람으로 열어 본다("안 보인다"는 문의를 눈으로 확인하는 용도).
//
// 안전장치:
//   - SuperAdmin·Admin 만(IMPERSONATION_ROLES). Viewer 는 requireAuth 가 POST 를
//     이미 막지만, RBAC 매트릭스는 fail-open 이라(lib/rbac.ts) 사용자 정의 역할이
//     통과할 수 있으므로 여기서 허용 목록으로 직접 막는다.
//   - 토큰은 30분짜리 접근 토큰 하나뿐(refresh 없음)이고 `impersonated_by` 에
//     관리자 id 가 박힌다. 그 세션에서는 비밀번호·패스키·개인정보 권리 행사
//     경로가 막힌다(requirePartnerAuth IMPERSONATION_BLOCKED, passkeys resolveCaller).
//   - 발급할 때마다 감사 로그(관리자 id·파트너 사용자 id·계정 id)를 남긴다.
//   - 토큰은 쿼리스트링이 아니라 `#sso=` 프래그먼트로 넘긴다(서버 로그·Referer 에
//     남지 않는다). 포털은 이미 통합 로그인 핸드오프로 이 프래그먼트를 읽는다.
const IMPERSONATION_ROLES = new Set(["SuperAdmin", "Super Admin", "superadmin", "super_admin", "Admin"]);

router.post("/v1/accounts/:id/portal-users/:userId/impersonate", async (req, res): Promise<void> => {
  const role = String((req as any).user?.role ?? "");
  const adminId = Number((req as any).user?.id);
  if (!IMPERSONATION_ROLES.has(role) || !Number.isInteger(adminId) || adminId <= 0) {
    res.status(403).json({ error: "포털 대신 열기는 관리자만 사용할 수 있습니다" });
    return;
  }

  const ids = await resolveAccountAndUser(req, res, true);
  if (!ids) return;

  const user = await loadPortalUser(ids.id, ids.userId);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  if (user["is_active"] !== true) {
    res.status(409).json({ error: "포털 사용이 꺼져 있는 사용자입니다" });
    return;
  }
  // 임시 비밀번호 상태면 포털이 비밀번호 변경 화면만 보여 준다 — 그 화면을
  // 관리자가 대신 통과하면 파트너의 비밀번호를 관리자가 정하게 된다.
  if (user["force_password_change"] === true) {
    res.status(409).json({ error: "임시 비밀번호를 바꾸기 전인 사용자는 대신 열 수 없습니다" });
    return;
  }

  let token: string;
  try {
    token = signPartnerImpersonationJWT({
      id: Number(user["id"]),
      email: String(user["email"] ?? ""),
      account_id: Number(user["account_id"]),
      portal_type: String(user["portal_type"]) as PortalType,
    }, adminId);
  } catch {
    res.status(409).json({ error: "포털 종류가 올바르지 않은 사용자입니다" });
    return;
  }

  const actor = actorOf(req);
  const expiresAt = new Date(Date.now() + PARTNER_IMPERSONATION_TTL * 1000);
  await logAction({
    // 감사 로그에서는 "관리자가 이 파트너로 들어갔다"는 사실이 핵심이라 LOGIN 으로 남긴다.
    entityType: "partner_users", entityId: ids.userId, action: "LOGIN", ...actor,
    newValue: {
      impersonated: true,
      admin_user_id: adminId,
      admin_email: actor.actorEmail,
      partner_user_id: ids.userId,
      account_id: ids.id,
      portal_type: user["portal_type"],
      expires_at: expiresAt.toISOString(),
    },
  });

  res.json({
    token,
    portal_url: portalBaseUrl(String(user["portal_type"])),
    expires_at: expiresAt.toISOString(),
  });
});

const accountsSoftDelete = {
  table: accountsTable,
  idColumn: accountsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/accounts/bulk-delete", makeBulkDelete(accountsSoftDelete));
router.post("/v1/accounts/bulk-restore", makeBulkRestore(accountsSoftDelete));

router.delete("/v1/accounts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteAccountParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only Super Admin can permanently delete records" }); return;
    }
    await db.delete(accountsTable).where(eq(accountsTable.id, parsed.data.id));
  } else {
    await db.update(accountsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(accountsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

export default router;
