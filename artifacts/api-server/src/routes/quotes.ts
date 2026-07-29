import { Router } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { db, quotesTable, quoteLineItemsTable, accountsTable, leadsTable, spacesTable, emailLogsTable, invoicesTable } from "@workspace/db";
import { eq, ilike, and, isNull, inArray, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { buildQuoteHtml, type QuoteDocInput } from "../lib/documents/quoteDocument";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { buildDocumentFilename, setDocumentDownloadHeaders } from "../lib/documents/filename";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { normalizeLang, t } from "../lib/documents/i18n";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { freezeDocument, snapshotDocType } from "../lib/documents/freeze";
import { sendDocumentEmail } from "../lib/email";

const router = Router();

const LineItemBody = z.object({
  name: z.string().min(1),
  unit_price: z.number().nonnegative().default(0),
  quantity: z.number().int().positive().default(1),
  notes: z.string().nullish(),
  sort_order: z.number().int().nonnegative().optional(),
});

const CreateQuoteBody = z.object({
  account_id: z.number().int().nullish(),
  lead_id: z.number().int().nullish(),
  space_id: z.number().int().nullish(),
  currency: z.string().default(DEFAULT_CURRENCY),
  valid_until: z.string().nullish(),
  description: z.string().nullish(),
  notes: z.string().nullish(),
  line_items: z.array(LineItemBody).optional(),
});

const UpdateQuoteBody = CreateQuoteBody.partial();

async function nextQuoteRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: quotesTable.id }).from(quotesTable)
    .where(ilike(quotesTable.quote_ref, `MS-QT-${year}-%`));
  return `MS-QT-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

async function enrichQuotes(rows: (typeof quotesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))] as number[];
  const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
  const accountMap: Record<number, string> = {};
  const spaceMap: Record<number, string> = {};
  // Batched lookups — see enrichContracts in contracts.ts.
  const [accountRows, spaceRows] = await Promise.all([
    accountIds.length
      ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, accountIds))
      : Promise.resolve([]),
    spaceIds.length
      ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds))
      : Promise.resolve([]),
  ]);
  for (const a of accountRows) accountMap[a.id] = a.name;
  for (const s of spaceRows) spaceMap[s.id] = s.name;
  return rows.map(r => ({
    ...r,
    account_name: r.account_id ? (accountMap[r.account_id] ?? null) : null,
    space_name: r.space_id ? (spaceMap[r.space_id] ?? null) : null,
  }));
}

/** Recompute and persist subtotal/total from the quote's line items. */
async function recomputeTotals(quoteId: number): Promise<void> {
  const items = await db.select().from(quoteLineItemsTable).where(eq(quoteLineItemsTable.quote_id, quoteId));
  const subtotal = items.reduce((sum, i) => sum + Number(i.total_price), 0);
  await db.update(quotesTable)
    .set({ subtotal: subtotal.toFixed(2), total: subtotal.toFixed(2), updated_at: new Date() })
    .where(eq(quotesTable.id, quoteId));
}

router.get("/v1/quotes", async (req, res): Promise<void> => {
  const { q, status, account_id, lead_id } = req.query as Record<string, string>;
  const conditions: any[] = [deletedFilter(quotesTable.deleted_at, req)];
  if (q) conditions.push(ilike(quotesTable.quote_ref, `%${q}%`));
  if (status) conditions.push(eq(quotesTable.status, status));
  if (account_id) conditions.push(eq(quotesTable.account_id, Number(account_id)));
  if (lead_id) conditions.push(eq(quotesTable.lead_id, Number(lead_id)));
  const rows = await db.select().from(quotesTable).where(and(...conditions)).orderBy(desc(quotesTable.id));
  res.json(await enrichQuotes(rows));
});

router.post("/v1/quotes", async (req, res): Promise<void> => {
  const parsed = CreateQuoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const quote_ref = await nextQuoteRef();
  const [row] = await db.insert(quotesTable).values({
    quote_ref,
    account_id: parsed.data.account_id ?? null,
    lead_id: parsed.data.lead_id ?? null,
    space_id: parsed.data.space_id ?? null,
    currency: parsed.data.currency ?? DEFAULT_CURRENCY,
    valid_until: parsed.data.valid_until ?? null,
    description: parsed.data.description ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  if (parsed.data.line_items?.length) {
    await db.insert(quoteLineItemsTable).values(parsed.data.line_items.map((li, idx) => ({
      quote_id: row.id,
      name: li.name,
      unit_price: li.unit_price.toFixed(2),
      quantity: li.quantity,
      total_price: (li.unit_price * li.quantity).toFixed(2),
      sort_order: li.sort_order ?? idx,
      notes: li.notes ?? null,
    })));
    await recomputeTotals(row.id);
  }
  await logAction({ entityType: "quote", entityId: row.id, action: "CREATE", newValue: { quote_ref } });
  const fresh = await db.select().from(quotesTable).where(eq(quotesTable.id, row.id));
  const [result] = await enrichQuotes(fresh);
  res.status(201).json(result);
});

router.get("/v1/quotes/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(quotesTable).where(eq(quotesTable.id, Number(req.params.id))).then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichQuotes([row]);
  res.json(result);
});

router.put("/v1/quotes/:id", async (req, res): Promise<void> => {
  const parsed = UpdateQuoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = Number(req.params.id);
  const updates: Partial<typeof quotesTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.account_id !== undefined) updates.account_id = parsed.data.account_id;
  if (parsed.data.lead_id !== undefined) updates.lead_id = parsed.data.lead_id;
  if (parsed.data.space_id !== undefined) updates.space_id = parsed.data.space_id;
  if (parsed.data.currency != null) updates.currency = parsed.data.currency;
  if (parsed.data.valid_until !== undefined) updates.valid_until = parsed.data.valid_until;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  // Full replace of line items when provided.
  if (parsed.data.line_items) {
    await db.delete(quoteLineItemsTable).where(eq(quoteLineItemsTable.quote_id, id));
    if (parsed.data.line_items.length) {
      await db.insert(quoteLineItemsTable).values(parsed.data.line_items.map((li, idx) => ({
        quote_id: id,
        name: li.name,
        unit_price: li.unit_price.toFixed(2),
        quantity: li.quantity,
        total_price: (li.unit_price * li.quantity).toFixed(2),
        sort_order: li.sort_order ?? idx,
        notes: li.notes ?? null,
      })));
    }
  }
  const [row] = await db.update(quotesTable).set(updates).where(eq(quotesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (parsed.data.line_items) await recomputeTotals(id);
  const fresh = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  const [result] = await enrichQuotes(fresh);
  res.json(result);
});

router.get("/v1/quotes/:id/line-items", async (req, res): Promise<void> => {
  const rows = await db.select().from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quote_id, Number(req.params.id)))
    .orderBy(asc(quoteLineItemsTable.sort_order), asc(quoteLineItemsTable.id));
  res.json(rows);
});

router.delete("/v1/quotes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") { res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return; }
    await db.delete(quoteLineItemsTable).where(eq(quoteLineItemsTable.quote_id, id));
    await db.delete(quotesTable).where(eq(quotesTable.id, id));
  } else {
    await db.update(quotesTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(quotesTable.id, id));
  }
  res.status(204).send();
});

// ── Status transitions ─────────────────────────────────────────────────
router.post("/v1/quotes/:id/send", async (req, res): Promise<void> => {
  const [row] = await db.update(quotesTable)
    .set({ status: "Sent", sent_at: new Date(), updated_at: new Date() })
    .where(and(eq(quotesTable.id, Number(req.params.id)), eq(quotesTable.status, "Draft")))
    .returning();
  if (!row) { res.status(400).json({ error: "Quote not in Draft status" }); return; }
  await logAction({ entityType: "quote", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: "Draft" }, newValue: { status: "Sent" } });
  const [result] = await enrichQuotes([row]);
  res.json(result);
});

router.post("/v1/quotes/:id/accept", async (req, res): Promise<void> => {
  const [row] = await db.update(quotesTable)
    .set({ status: "Accepted", accepted_at: new Date(), updated_at: new Date() })
    .where(and(eq(quotesTable.id, Number(req.params.id)), eq(quotesTable.status, "Sent")))
    .returning();
  if (!row) { res.status(400).json({ error: "Quote not in Sent status" }); return; }
  await logAction({ entityType: "quote", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: "Sent" }, newValue: { status: "Accepted" } });
  const [result] = await enrichQuotes([row]);
  res.json(result);
});

router.post("/v1/quotes/:id/decline", async (req, res): Promise<void> => {
  const [row] = await db.update(quotesTable)
    .set({ status: "Declined", updated_at: new Date() })
    .where(and(eq(quotesTable.id, Number(req.params.id)), eq(quotesTable.status, "Sent")))
    .returning();
  if (!row) { res.status(400).json({ error: "Quote not in Sent status" }); return; }
  await logAction({ entityType: "quote", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: "Sent" }, newValue: { status: "Declined" } });
  const [result] = await enrichQuotes([row]);
  res.json(result);
});

/** Build the full document input (header + party + line items) for one quote. */
async function buildQuoteDocInput(id: number): Promise<QuoteDocInput | null> {
  const row = await db.select().from(quotesTable).where(eq(quotesTable.id, id)).then(r => r[0]);
  if (!row) return null;
  const [enriched] = await enrichQuotes([row]);
  const items = await db.select().from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quote_id, id))
    .orderBy(asc(quoteLineItemsTable.sort_order), asc(quoteLineItemsTable.id));

  let party_email: string | null = null;
  if (row.account_id) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id));
    party_email = acc?.account_email ?? null;
  } else if (row.lead_id) {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, row.lead_id));
    party_email = (lead as any)?.email ?? null;
  }

  return {
    quote_ref: enriched.quote_ref,
    status: enriched.status,
    currency: enriched.currency,
    subtotal: enriched.subtotal,
    total: enriched.total,
    valid_until: enriched.valid_until,
    description: enriched.description,
    notes: enriched.notes,
    created_at: enriched.created_at,
    party_name: (enriched as any).account_name ?? null,
    party_email,
    space_name: (enriched as any).space_name ?? null,
    line_items: items.map(i => ({ name: i.name, unit_price: i.unit_price, quantity: i.quantity, total_price: i.total_price })),
  };
}

// ── PDF / preview ──────────────────────────────────────────────────────
router.get("/v1/quotes/:id/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const docInput = await buildQuoteDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  const asHtml = req.query.format === "html";
  const lang = normalizeLang(req.query.lang as string);
  const terms = await resolveTemplateBody("pdf", "pdf.quote", lang, {
    ref: docInput.quote_ref, valid_until: docInput.valid_until ?? "",
  });
  const html = buildQuoteHtml(docInput, await resolveCompanyInfo(lang), !asHtml, lang, terms);
  if (asHtml) { res.type("html").send(html); return; }
  try {
    const pdf = await htmlToPdf(html);
    setDocumentDownloadHeaders(res, buildDocumentFilename({
      docName: t(lang, "doctype.quote"), customerName: docInput.party_name,
    }));
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    console.error("[quotes] PDF generation failed:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

/** Email a quote to its recipient as a branded PDF; advances Draft → Sent. */
router.post("/v1/quotes/:id/email", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const docInput = await buildQuoteDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  const to = (req.body?.to as string)?.trim() || docInput.party_email;
  if (!to) { res.status(400).json({ error: "No recipient email — set one on the account/lead or pass { to }." }); return; }

  const lang = normalizeLang(req.body?.lang as string);
  const quoteTerms = await resolveTemplateBody("pdf", "pdf.quote", lang, { ref: docInput.quote_ref, valid_until: docInput.valid_until ?? "" });
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(buildQuoteHtml(docInput, await resolveCompanyInfo(lang), true, lang, quoteTerms));
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }

  const result = await sendDocumentEmail({
    to, toName: docInput.party_name, lang, docTypeLabel: t(lang, "doctype.quote"), ref: docInput.quote_ref,
    amountLabel: `${Number(docInput.total ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })} ${docInput.currency || DEFAULT_CURRENCY}`,
    note: docInput.valid_until ? t(lang, "email.note.validUntil", { date: docInput.valid_until }) : null,
    pdf, filename: buildDocumentFilename({ docName: t(lang, "doctype.quote"), customerName: docInput.party_name }),
  });

  await db.insert(emailLogsTable).values({
    template_code: "document.quote", to_email: to, to_name: docInput.party_name ?? null,
    subject: result.subject, resend_message_id: result.id ?? null, status: result.ok ? "Sent" : "Failed",
    entity_type: "quote", entity_id: id, error_message: result.error ?? null,
  }).catch(() => {});

  if (!result.ok) { res.status(result.skipped ? 503 : 502).json({ error: result.error ?? "Send failed" }); return; }
  // Freeze an immutable snapshot of exactly what was emailed (best-effort).
  await freezeDocument({ entityType: "quote", entityId: id, docType: snapshotDocType("quote"), ref: docInput.quote_ref, pdf }).catch(() => null);
  await db.update(quotesTable).set({ status: "Sent", sent_at: new Date(), updated_at: new Date() })
    .where(and(eq(quotesTable.id, id), eq(quotesTable.status, "Draft")));
  res.json({ ok: true, id: result.id, to });
});

/** Manually freeze the current quote PDF as an immutable versioned snapshot. */
router.post("/v1/quotes/:id/freeze", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const docInput = await buildQuoteDocInput(id);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }
  const lang = normalizeLang(req.body?.lang as string);
  const quoteTerms = await resolveTemplateBody("pdf", "pdf.quote", lang, { ref: docInput.quote_ref, valid_until: docInput.valid_until ?? "" });
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(buildQuoteHtml(docInput, await resolveCompanyInfo(lang), true, lang, quoteTerms));
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }
  const snap = await freezeDocument({ entityType: "quote", entityId: id, docType: snapshotDocType("quote"), ref: docInput.quote_ref, pdf });
  if (!snap) { res.status(503).json({ error: "Document storage not configured" }); return; }
  res.json({ ok: true, ...snap });
});

/**
 * Convert an accepted/sent quote into a Draft invoice.
 * Idempotent guard: a quote can only be converted once.
 */
router.post("/v1/quotes/:id/convert", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const quote = await db.select().from(quotesTable).where(eq(quotesTable.id, id)).then(r => r[0]);
  if (!quote) { res.status(404).json({ error: "Not found" }); return; }
  if (quote.converted_invoice_id) {
    res.status(409).json({ error: "Quote already converted", invoice_id: quote.converted_invoice_id }); return;
  }

  const year = new Date().getFullYear();
  const existing = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  const invoiceRef = `MS-INV-${year}-${String(existing.length + 1).padStart(5, "0")}`;

  const [invoice] = await db.insert(invoicesTable).values({
    invoice_ref: invoiceRef,
    account_id: quote.account_id ?? null,
    quote_id: quote.id,
    amount: quote.total ?? "0",
    currency: quote.currency ?? DEFAULT_CURRENCY,
    status: "Draft",
    description: quote.description ?? `Converted from quote ${quote.quote_ref}`,
  }).returning();

  await db.update(quotesTable)
    .set({ converted_invoice_id: invoice.id, status: quote.status === "Draft" ? "Sent" : quote.status, updated_at: new Date() })
    .where(eq(quotesTable.id, id));

  await logAction({ entityType: "quote", entityId: id, action: "STATUS_CHANGE", oldValue: { quote_ref: quote.quote_ref }, newValue: { converted_invoice_id: invoice.id, invoice_ref: invoiceRef } });
  res.status(201).json({ ok: true, invoice });
});

const quotesSoftDelete = {
  table: quotesTable,
  idColumn: quotesTable.id,
};
router.post("/v1/quotes/bulk-delete", makeBulkDelete(quotesSoftDelete));
router.post("/v1/quotes/bulk-restore", makeBulkRestore(quotesSoftDelete));

router.get("/v1/lookup/quotes", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [ilike(quotesTable.quote_ref, `%${q}%`)] : [];
  const rows = await db.select({ id: quotesTable.id, quote_ref: quotesTable.quote_ref, status: quotesTable.status })
    .from(quotesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(quotesTable.id)).limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.quote_ref} (${r.status})` })));
});

export default router;
