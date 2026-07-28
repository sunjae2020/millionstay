import { Router } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { db, invoicesTable, invoiceLineItemsTable, bookingsTable, contractsTable, accountsTable, emailLogsTable } from "@workspace/db";
import { eq, ilike, and, asc, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAction } from "../utils/auditLog";
import { getRateToAud } from "../lib/rateSnapshot";
import { buildInvoiceHtml, type InvoiceDocInput } from "../lib/documents/invoiceDocument";
import { buildReceiptHtml } from "../lib/documents/receiptDocument";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { normalizeLang, t } from "../lib/documents/i18n";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { freezeDocument, snapshotDocType } from "../lib/documents/freeze";
import { formatDocMoney } from "../lib/documents/theme";
import { sendDocumentEmail, resolveDocEmailCopy } from "../lib/email";
import { getStripe } from "./stripe";
import { postInvoicePaid } from "../lib/billing/gl";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  PayInvoiceBody,
} from "@workspace/api-zod";

const router = Router();

async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  const count = rows.length + 1;
  return `MS-INV-${year}-${String(count).padStart(5, "0")}`;
}

/**
 * Optional itemised line items accepted on invoice create/update. When present
 * and non-empty, they drive the stored invoice `amount` and the itemised PDF
 * rendering. Money fields are stored as strings (numeric columns).
 */
const LineItemInput = z.object({
  label: z.string().min(1),
  description: z.string().nullish(),
  quantity: z.number().positive().optional(),
  unit_amount: z.number(),
  // "revenue" (default) posts to GL Revenue; "deposit" posts to the Deposits Held
  // (2100) liability on payment so refundable deposits are never booked as income.
  line_type: z.enum(["revenue", "deposit"]).optional(),
});
type LineItemInput = z.infer<typeof LineItemInput>;
const LineItemsBody = z.object({ line_items: z.array(LineItemInput).optional() });

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Map validated line-item inputs to insert rows for a given invoice. */
function buildLineItemRows(invoiceId: number, items: LineItemInput[]) {
  return items.map((it, idx) => {
    const qty = it.quantity ?? 1;
    return {
      invoice_id: invoiceId,
      label: it.label,
      description: it.description ?? null,
      quantity: String(qty),
      unit_amount: String(it.unit_amount),
      total_amount: String(round2(qty * it.unit_amount)),
      line_type: it.line_type ?? "revenue",
      sort_order: idx,
    };
  });
}

/** Sum of line-item totals, as a string for the numeric `amount` column. */
function sumLineItems(items: LineItemInput[]): string {
  const total = items.reduce((acc, it) => acc + round2((it.quantity ?? 1) * it.unit_amount), 0);
  return String(round2(total));
}

/** Fetch a single invoice's line items, ordered by sort_order. */
async function getLineItems(invoiceId: number) {
  return db.select().from(invoiceLineItemsTable)
    .where(eq(invoiceLineItemsTable.invoice_id, invoiceId))
    .orderBy(asc(invoiceLineItemsTable.sort_order), asc(invoiceLineItemsTable.id));
}

async function enrichInvoices(rows: (typeof invoicesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const bookingIds = [...new Set(rows.map(r => r.booking_id).filter(Boolean))] as number[];
  const contractIds = [...new Set(rows.map(r => r.contract_id).filter(Boolean))] as number[];
  const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))] as number[];

  const bookingMap: Record<number, string> = {};
  const contractMap: Record<number, string> = {};
  const accountMap: Record<number, string> = {};

  for (const id of bookingIds) {
    const [b] = await db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref }).from(bookingsTable).where(eq(bookingsTable.id, id));
    if (b) bookingMap[b.id] = b.booking_ref;
  }
  for (const id of contractIds) {
    const [c] = await db.select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref }).from(contractsTable).where(eq(contractsTable.id, id));
    if (c) contractMap[c.id] = c.contract_ref;
  }
  for (const id of accountIds) {
    const [a] = await db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(eq(accountsTable.id, id));
    if (a) accountMap[a.id] = a.name;
  }

  return rows.map(r => ({
    ...r,
    booking_ref: r.booking_id ? (bookingMap[r.booking_id] ?? null) : null,
    contract_ref: r.contract_id ? (contractMap[r.contract_id] ?? null) : null,
    account_name: r.account_id ? (accountMap[r.account_id] ?? null) : null,
  }));
}

router.get("/v1/invoices", async (req, res): Promise<void> => {
  const { q, status, booking_id, contract_id, account_id } = req.query as Record<string, string>;
  const conditions: any[] = [deletedFilter(invoicesTable.deleted_at, req)];
  if (q) conditions.push(ilike(invoicesTable.invoice_ref, `%${q}%`));
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (booking_id) conditions.push(eq(invoicesTable.booking_id, Number(booking_id)));
  if (contract_id) conditions.push(eq(invoicesTable.contract_id, Number(contract_id)));
  if (account_id) conditions.push(eq(invoicesTable.account_id, Number(account_id)));
  const rows = await db.select().from(invoicesTable)
    .where(and(...conditions))
    .orderBy(invoicesTable.id);
  const result = await enrichInvoices(rows);
  res.json(result);
});

router.post("/v1/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const itemsParsed = LineItemsBody.safeParse(req.body);
  if (!itemsParsed.success) { res.status(400).json({ error: itemsParsed.error.message }); return; }
  const lineItems = itemsParsed.data.line_items ?? [];
  const hasLineItems = lineItems.length > 0;

  const invoice_ref = await nextInvoiceRef();
  const ccy = parsed.data.currency ?? DEFAULT_CURRENCY;
  const amount = hasLineItems ? sumLineItems(lineItems) : String(parsed.data.amount ?? 0);
  const [row] = await db.insert(invoicesTable).values({
    invoice_ref,
    booking_id: parsed.data.booking_id ?? null,
    contract_id: parsed.data.contract_id ?? null,
    account_id: parsed.data.account_id ?? null,
    amount,
    currency: ccy,
    exchange_rate_to_aud: await getRateToAud(ccy),
    due_date: parsed.data.due_date ?? null,
    description: parsed.data.description ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  if (hasLineItems) {
    await db.insert(invoiceLineItemsTable).values(buildLineItemRows(row.id, lineItems));
  }
  const [result] = await enrichInvoices([row]);
  res.status(201).json({ ...result, line_items: hasLineItems ? await getLineItems(row.id) : [] });
});

router.get("/v1/invoices/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichInvoices([row]);
  res.json({ ...result, line_items: await getLineItems(row.id) });
});

router.put("/v1/invoices/:id", async (req, res): Promise<void> => {
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const itemsParsed = LineItemsBody.safeParse(req.body);
  if (!itemsParsed.success) { res.status(400).json({ error: itemsParsed.error.message }); return; }
  const lineItems = itemsParsed.data.line_items; // undefined = leave untouched
  const id = Number(req.params.id);

  const updates: Partial<typeof invoicesTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.booking_id !== undefined) updates.booking_id = parsed.data.booking_id;
  if (parsed.data.contract_id !== undefined) updates.contract_id = parsed.data.contract_id;
  if (parsed.data.account_id !== undefined) updates.account_id = parsed.data.account_id;
  if (parsed.data.amount != null) updates.amount = String(parsed.data.amount);
  if (parsed.data.currency != null) updates.currency = parsed.data.currency;
  if (parsed.data.due_date !== undefined) updates.due_date = parsed.data.due_date;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  // When line_items are provided, they own the amount.
  if (lineItems !== undefined) updates.amount = sumLineItems(lineItems);
  const [row] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (lineItems !== undefined) {
    await db.delete(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoice_id, id));
    if (lineItems.length > 0) {
      await db.insert(invoiceLineItemsTable).values(buildLineItemRows(id, lineItems));
    }
  }
  const [result] = await enrichInvoices([row]);
  res.json({ ...result, line_items: await getLineItems(id) });
});

const invoicesSoftDelete = {
  table: invoicesTable,
  idColumn: invoicesTable.id,
};

router.post("/v1/invoices/bulk-delete", makeBulkDelete(invoicesSoftDelete));
router.post("/v1/invoices/bulk-restore", makeBulkRestore(invoicesSoftDelete));

router.delete("/v1/invoices/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  } else {
    await db.update(invoicesTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(invoicesTable.id, id));
  }
  res.status(204).send();
});

router.post("/v1/invoices/:id/send", async (req, res): Promise<void> => {
  const [row] = await db.update(invoicesTable)
    .set({ status: "Sent", updated_at: new Date() })
    .where(and(eq(invoicesTable.id, Number(req.params.id)), eq(invoicesTable.status, "Draft")))
    .returning();
  if (!row) { res.status(400).json({ error: "Invoice not in Draft status" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: "Draft" }, newValue: { status: "Sent" } });
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.post("/v1/invoices/:id/pay", async (req, res): Promise<void> => {
  const parsed = PayInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const paidAt = parsed.data.paid_at ? new Date(parsed.data.paid_at) : new Date();
  const [row] = await db.update(invoicesTable)
    .set({ status: "Paid", payment_method: parsed.data.payment_method, paid_at: paidAt, updated_at: new Date() })
    // Payable from any open state — imported rent ledgers land as Overdue/Draft
    // and are still settled the same way as a Sent invoice.
    .where(and(eq(invoicesTable.id, Number(req.params.id)), inArray(invoicesTable.status, ["Sent", "Draft", "Overdue", "Unpaid"])))
    .returning();
  if (!row) { res.status(400).json({ error: "Invoice is not in a payable status" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "PAYMENT", oldValue: { status: "open" }, newValue: { status: "Paid", payment_method: parsed.data.payment_method } });
  // Auto-post the GL entry (best-effort; never blocks or alters the response).
  void postInvoicePaid({ id: row.id, amount: Number(row.amount), currency: row.currency, paidAt: paidAt.toISOString() });
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.post("/v1/invoices/:id/void", async (req, res): Promise<void> => {
  const existing = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).then(r => r[0]);
  const [row] = await db.update(invoicesTable)
    .set({ status: "Void", updated_at: new Date() })
    .where(eq(invoicesTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: existing?.status }, newValue: { status: "Void" } });
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

/**
 * Build the enriched document input for a single invoice, including the
 * billing account's email + formatted address (needed for the Bill-To block).
 */
async function buildInvoiceDocInput(invoiceId: number): Promise<InvoiceDocInput | null> {
  const row = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).then(r => r[0]);
  if (!row) return null;
  const [enriched] = await enrichInvoices([row]);

  let account_email: string | null = null;
  let account_address: string | null = null;
  if (row.account_id) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id));
    if (acc) {
      account_email = acc.account_email ?? null;
      account_address = [
        acc.address_line1,
        acc.address_suburb,
        [acc.address_state, acc.address_postcode].filter(Boolean).join(" "),
        acc.address_country,
      ].filter(Boolean).join(", ") || null;
    }
  }

  return {
    invoice_ref: enriched.invoice_ref,
    status: enriched.status,
    amount: enriched.amount,
    currency: enriched.currency,
    due_date: enriched.due_date,
    paid_at: enriched.paid_at,
    payment_method: enriched.payment_method,
    description: enriched.description,
    notes: enriched.notes,
    created_at: enriched.created_at,
    account_name: (enriched as any).account_name ?? null,
    account_email,
    account_address,
    booking_ref: (enriched as any).booking_ref ?? null,
    contract_ref: (enriched as any).contract_ref ?? null,
    line_items: (await getLineItems(invoiceId)).map(li => ({
      label: li.label,
      description: li.description,
      quantity: li.quantity,
      unit_amount: li.unit_amount,
      total_amount: li.total_amount,
    })),
  };
}

/**
 * Render an invoice as a branded document.
 *   GET /v1/invoices/:id/pdf               → application/pdf download
 *   GET /v1/invoices/:id/pdf?format=html   → HTML preview (for in-app preview)
 */
router.get("/v1/invoices/:id/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const docInput = await buildInvoiceDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  const asHtml = req.query.format === "html";
  const lang = normalizeLang(req.query.lang as string);
  const terms = await resolveTemplateBody("pdf", "pdf.invoice", lang, {
    ref: docInput.invoice_ref, due_date: docInput.due_date ?? "",
  });
  const html = buildInvoiceHtml(docInput, await resolveCompanyInfo(), !asHtml, lang, terms);

  if (asHtml) {
    res.type("html").send(html);
    return;
  }

  await sendPdf(res, html, docInput.invoice_ref);
});

/**
 * Render the payment receipt for a (paid) invoice.
 *   GET /v1/invoices/:id/receipt/pdf  [?format=html]
 */
router.get("/v1/invoices/:id/receipt/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const docInput = await buildInvoiceDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  const asHtml = req.query.format === "html";
  const lang = normalizeLang(req.query.lang as string);
  const terms = await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = buildReceiptHtml(docInput, await resolveCompanyInfo(), !asHtml, lang, terms);

  if (asHtml) { res.type("html").send(html); return; }
  await sendPdf(res, html, `${docInput.invoice_ref}-receipt`);
});

/** Render HTML to PDF and stream it, mapping renderer failures to HTTP codes. */
async function sendPdf(res: import("express").Response, html: string, refBase: string): Promise<void> {
  try {
    const pdf = await htmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${refBase}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    console.error("[invoices] PDF generation failed:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}

function moneyLabel(amount: string | number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

/**
 * Email an invoice (or its receipt) to the billing account as a branded PDF.
 *   POST /v1/invoices/:id/email          body: { to?, kind?: "invoice"|"receipt" }
 *   POST /v1/invoices/:id/receipt/email  (kind=receipt)
 */
async function emailInvoiceDocument(req: import("express").Request, res: import("express").Response, kind: "invoice" | "receipt"): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const docInput = await buildInvoiceDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  const to = (req.body?.to as string)?.trim() || docInput.account_email;
  if (!to) { res.status(400).json({ error: "No recipient email — set one on the linked account or pass { to }." }); return; }

  const lang = normalizeLang(req.body?.lang as string);
  const company = await resolveCompanyInfo();
  const terms = kind === "invoice"
    ? await resolveTemplateBody("pdf", "pdf.invoice", lang, { ref: docInput.invoice_ref, due_date: docInput.due_date ?? "" })
    : await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = kind === "receipt"
    ? buildReceiptHtml(docInput, company, true, lang, terms)
    : buildInvoiceHtml(docInput, company, true, lang, terms);
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(html);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }

  const docTypeLabel = t(lang, kind === "receipt" ? "doctype.receipt" : "doctype.invoice");
  const amountLabel = moneyLabel(docInput.amount, docInput.currency);
  // Editable email copy (Templates Studio); falls back to the hardcoded note.
  const fallbackNote = kind === "invoice" && docInput.due_date ? t(lang, "email.note.due", { date: docInput.due_date }) : null;
  const copy = await resolveDocEmailCopy(kind === "receipt" ? "email.receipt" : "email.invoice", lang, {
    ref: docInput.invoice_ref, name: docInput.account_name ?? "", amount: amountLabel, due_date: docInput.due_date ?? "",
  });
  const result = await sendDocumentEmail({
    to, toName: docInput.account_name, lang, docTypeLabel, ref: docInput.invoice_ref,
    amountLabel,
    note: copy.note ?? fallbackNote,
    subject: copy.subject,
    pdf, filename: `${docInput.invoice_ref}${kind === "receipt" ? "-receipt" : ""}.pdf`,
  });

  await db.insert(emailLogsTable).values({
    template_code: `document.${kind}`, to_email: to, to_name: docInput.account_name ?? null,
    subject: result.subject, resend_message_id: result.id ?? null, status: result.ok ? "Sent" : "Failed",
    entity_type: "invoice", entity_id: id, error_message: result.error ?? null,
  }).catch(() => {});

  if (!result.ok) { res.status(result.skipped ? 503 : 502).json({ error: result.error ?? "Send failed" }); return; }

  // Freeze an immutable snapshot of exactly what was emailed (best-effort).
  await freezeDocument({
    entityType: "invoice", entityId: id,
    docType: snapshotDocType("invoice", kind === "receipt" ? "receipt" : undefined),
    ref: docInput.invoice_ref, pdf,
  }).catch(() => null);

  // Sending an invoice advances Draft → Sent.
  if (kind === "invoice") {
    await db.update(invoicesTable).set({ status: "Sent", updated_at: new Date() })
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.status, "Draft")));
  }
  res.json({ ok: true, id: result.id, to });
}

router.post("/v1/invoices/:id/email", (req, res) => emailInvoiceDocument(req, res, "invoice"));
router.post("/v1/invoices/:id/receipt/email", (req, res) => emailInvoiceDocument(req, res, "receipt"));

/** Manually freeze the current invoice (or receipt) PDF as an immutable snapshot. */
async function freezeInvoiceDocument(req: import("express").Request, res: import("express").Response, kind: "invoice" | "receipt"): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const docInput = await buildInvoiceDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }
  const lang = normalizeLang(req.body?.lang as string);
  const company = await resolveCompanyInfo();
  const terms = kind === "invoice"
    ? await resolveTemplateBody("pdf", "pdf.invoice", lang, { ref: docInput.invoice_ref, due_date: docInput.due_date ?? "" })
    : await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = kind === "receipt" ? buildReceiptHtml(docInput, company, true, lang, terms) : buildInvoiceHtml(docInput, company, true, lang, terms);
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(html);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }
  const snap = await freezeDocument({
    entityType: "invoice", entityId: id,
    docType: snapshotDocType("invoice", kind === "receipt" ? "receipt" : undefined),
    ref: docInput.invoice_ref, pdf,
  });
  if (!snap) { res.status(503).json({ error: "Document storage not configured" }); return; }
  res.json({ ok: true, ...snap });
}

router.post("/v1/invoices/:id/freeze", (req, res) => freezeInvoiceDocument(req, res, "invoice"));
router.post("/v1/invoices/:id/receipt/freeze", (req, res) => freezeInvoiceDocument(req, res, "receipt"));

/**
 * Create a Stripe Checkout session to collect payment for an invoice and return
 * the hosted payment URL. metadata.invoice_id lets the Stripe webhook mark the
 * invoice Paid on completion (see routes/stripe.ts). Issuing a link advances a
 * Draft invoice to Sent. Mirrors the homestay placement checkout flow.
 */
router.post("/v1/invoices/:id/checkout", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.status === "Paid") { res.status(400).json({ error: "Invoice is already paid." }); return; }
  if (row.status === "Void" || row.status === "Archived") { res.status(400).json({ error: "Invoice is not collectable." }); return; }

  const amount = Number(row.amount);
  if (!(amount > 0)) { res.status(400).json({ error: "Invoice amount must be greater than zero." }); return; }

  const surchargePct = Number((req.body?.surcharge_pct ?? 0));
  const hasSurcharge = Number.isFinite(surchargePct) && surchargePct > 0;
  const surcharge = hasSurcharge ? round2(amount * surchargePct / 100) : 0;
  const chargeable = round2(amount + surcharge);

  const stripe = getStripe();
  if (!stripe) { res.status(503).json({ error: "Stripe is not configured" }); return; }

  let email: string | null = null;
  if (row.account_id) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id));
    email = acc?.account_email ?? null;
  }

  const webBase = (process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com").replace(/\/+$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: (row.currency || DEFAULT_CURRENCY).toLowerCase(),
        product_data: { name: `Invoice ${row.invoice_ref}${row.description ? ` — ${row.description}` : ""}${hasSurcharge ? ` (incl. ${surchargePct}% card surcharge)` : ""}`.slice(0, 250) },
        unit_amount: Math.round(chargeable * 100),
      },
      quantity: 1,
    }],
    metadata: {
      invoice_id: String(id),
      invoice_ref: row.invoice_ref,
      ...(hasSurcharge ? { surcharge_pct: String(surchargePct) } : {}),
    },
    customer_email: email || undefined,
    success_url: `${webBase}/payment-result?status=success&ref=${encodeURIComponent(row.invoice_ref)}`,
    cancel_url: `${webBase}/payment-result?status=cancelled&ref=${encodeURIComponent(row.invoice_ref)}`,
  });

  if (row.status === "Draft") {
    await db.update(invoicesTable).set({ status: "Sent", updated_at: new Date() })
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.status, "Draft")));
  }
  await logAction({ entityType: "invoice", entityId: id, action: "STATUS_CHANGE", newValue: { checkout_session: session.id } }).catch(() => {});
  res.json({ success: true, url: session.url });
});

router.get("/v1/lookup/invoices", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [ilike(invoicesTable.invoice_ref, `%${q}%`)] : [];
  const rows = await db.select({ id: invoicesTable.id, invoice_ref: invoicesTable.invoice_ref, status: invoicesTable.status })
    .from(invoicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(invoicesTable.id)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.invoice_ref} (${r.status})` })));
});

export default router;
