import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, ilike, and, or, isNull, inArray, desc, SQL } from "drizzle-orm";
import {
  db, accountsTable, contactsTable, commissionsTable, paymentInfoTable,
  invoicesTable, contractsTable, contractRelatedCostsTable, partnerPayoutsTable,
  spacesTable, propertiesTable, documentsTable, serviceHostsTable,
} from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { formatPersonName } from "../lib/nameFormat";
import { enrichFromWebsite, downloadImage } from "../lib/accounts/websiteEnrich";
import {
  verifyBizNo, isBizVerifyConfigured, isValidBizNoChecksum, formatBizNo, normaliseBizNo,
} from "../lib/accounts/bizNoVerify";
import {
  uploadToCloudinary, uploadPrivateToCloudinary, deleteFromCloudinary,
  cldFolder, isCloudinaryConfigured, generateSignedUrl,
} from "../utils/cloudinary";
import { calcRetentionDate } from "../lib/retention";
import { decodeUploadFilename } from "../lib/uploadFilename";
import {
  ListAccountsQueryParams,
  CreateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  UpdateAccountBody,
  DeleteAccountParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichAccount(row: typeof accountsTable.$inferSelect) {
  const [primaryContact] = row.primary_contact_id
    ? await db.select({ first_name: contactsTable.first_name, last_name: contactsTable.last_name })
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

  return {
    ...row,
    primary_contact_name: primaryContact ? formatPersonName(primaryContact.first_name, primaryContact.last_name) : null,
    secondary_contact_name: secondaryContact ? formatPersonName(secondaryContact.first_name, secondaryContact.last_name) : null,
    default_commission_name: commission?.name ?? null,
    payment_info_name: payInfo?.name ?? null,
    parent_account_name: parentAccount?.name ?? null,
  };
}

router.get("/v1/accounts", async (req, res): Promise<void> => {
  const parsed = ListAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, account_type, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(accountsTable.deleted_at, req)];
  if (account_type) conditions.push(eq(accountsTable.account_type, account_type));
  if (status) conditions.push(eq(accountsTable.status, status));
  if (search) {
    conditions.push(or(
      ilike(accountsTable.name, `%${search}%`),
      ilike(accountsTable.account_email, `%${search}%`),
    )!);
  }
  const rows = await db.select().from(accountsTable)
    .where(and(...conditions))
    .orderBy(accountsTable.name);
  const enriched = await Promise.all(rows.map(enrichAccount));
  res.json(enriched);
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

router.post("/v1/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(accountsTable)
    .values({ ...parsed.data, biz_verified_at: toDate(parsed.data.biz_verified_at) })
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
  const [row] = await db.update(accountsTable)
    .set({ ...bodyParsed.data, biz_verified_at: toDate(bodyParsed.data.biz_verified_at), updated_at: new Date() })
    .where(eq(accountsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
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
  const invoices = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.account_id, id), isNull(invoicesTable.deleted_at)))
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

// GET /v1/accounts/:id/related — 연락처 / 자산 tabs.
// Contacts are the account's primary + secondary links; assets are the spaces
// this account owns (landlord_account_id).
router.get("/v1/accounts/:id/related", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid account id" }); return; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  const contactIds = [account.primary_contact_id, account.secondary_contact_id].filter(Boolean) as number[];
  const contactRows = contactIds.length
    ? await db.select().from(contactsTable).where(inArray(contactsTable.id, contactIds))
    : [];
  const contacts = contactIds
    .map((cid) => {
      const c = contactRows.find((r) => r.id === cid);
      if (!c) return null;
      return {
        ...c,
        role: cid === account.primary_contact_id ? "Primary" : "Secondary",
      };
    })
    .filter(Boolean);

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
