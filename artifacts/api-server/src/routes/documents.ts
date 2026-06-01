import { Router } from "express";
import { db, invoicesTable, contractsTable, accountsTable, bookingsTable, quotesTable } from "@workspace/db";
import { and, eq, ilike, isNull, desc } from "drizzle-orm";

/**
 * Document Hub — unified cross-cutting index over all customer-facing documents
 * (Phase 2). Rather than duplicating storage, this aggregates existing records
 * (invoices, receipts, contracts) into one common shape, each with a link back
 * to its source record and a ready-to-render PDF URL. Quotes plug in here once
 * the `quotes` model lands.
 */
const router = Router();

export interface HubDocument {
  doc_type: "Invoice" | "Receipt" | "Contract" | "Quote";
  source_id: number;
  ref: string;
  status: string;
  amount: number | null;
  currency: string | null;
  party: string | null;
  links: string[];
  date: string | null;
  detail_url: string;
  pdf_url: string;
}

async function accountNameMap(ids: number[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  for (const id of [...new Set(ids)]) {
    const [a] = await db.select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable).where(eq(accountsTable.id, id));
    if (a) map[a.id] = a.name;
  }
  return map;
}

async function bookingRefMap(ids: number[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  for (const id of [...new Set(ids)]) {
    const [b] = await db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref })
      .from(bookingsTable).where(eq(bookingsTable.id, id));
    if (b) map[b.id] = b.booking_ref;
  }
  return map;
}

router.get("/v1/documents", async (req, res): Promise<void> => {
  const { q, type } = req.query as Record<string, string>;
  const wantsType = (t: HubDocument["doc_type"]) => !type || type === "_all" || type === t;
  const docs: HubDocument[] = [];

  // ── Invoices + Receipts ──────────────────────────────────────────────
  if (wantsType("Invoice") || wantsType("Receipt")) {
    const invConds: any[] = [isNull(invoicesTable.deleted_at)];
    if (q) invConds.push(ilike(invoicesTable.invoice_ref, `%${q}%`));
    const invoices = await db.select().from(invoicesTable).where(and(...invConds)).orderBy(desc(invoicesTable.id));

    const accIds = invoices.map(i => i.account_id).filter(Boolean) as number[];
    const bkIds = invoices.map(i => i.booking_id).filter(Boolean) as number[];
    const accMap = await accountNameMap(accIds);
    const bkMap = await bookingRefMap(bkIds);

    for (const inv of invoices) {
      const links = [
        inv.booking_id && bkMap[inv.booking_id] ? `Booking ${bkMap[inv.booking_id]}` : null,
      ].filter(Boolean) as string[];
      const party = inv.account_id ? (accMap[inv.account_id] ?? null) : null;

      if (wantsType("Invoice")) {
        docs.push({
          doc_type: "Invoice", source_id: inv.id, ref: inv.invoice_ref, status: inv.status,
          amount: Number(inv.amount), currency: inv.currency, party, links,
          date: (inv.created_at as Date | null)?.toISOString() ?? null,
          detail_url: `/finance/invoices/${inv.id}`,
          pdf_url: `/api/v1/invoices/${inv.id}/pdf`,
        });
      }
      if (wantsType("Receipt") && inv.status === "Paid") {
        docs.push({
          doc_type: "Receipt", source_id: inv.id, ref: inv.invoice_ref, status: "Paid",
          amount: Number(inv.amount), currency: inv.currency, party, links,
          date: (inv.paid_at as Date | null)?.toISOString() ?? (inv.created_at as Date | null)?.toISOString() ?? null,
          detail_url: `/finance/invoices/${inv.id}`,
          pdf_url: `/api/v1/invoices/${inv.id}/receipt/pdf`,
        });
      }
    }
  }

  // ── Contracts ────────────────────────────────────────────────────────
  if (wantsType("Contract")) {
    const cConds: any[] = [isNull(contractsTable.deleted_at)];
    if (q) cConds.push(ilike(contractsTable.contract_ref, `%${q}%`));
    const contracts = await db.select().from(contractsTable).where(and(...cConds)).orderBy(desc(contractsTable.id));

    const accIds = contracts.map(c => c.tenant_account_id).filter(Boolean) as number[];
    const bkIds = contracts.map(c => c.booking_id).filter(Boolean) as number[];
    const accMap = await accountNameMap(accIds);
    const bkMap = await bookingRefMap(bkIds);

    for (const c of contracts) {
      const links = [
        c.booking_id && bkMap[c.booking_id] ? `Booking ${bkMap[c.booking_id]}` : null,
      ].filter(Boolean) as string[];
      docs.push({
        doc_type: "Contract", source_id: c.id, ref: c.contract_ref, status: c.status,
        amount: c.total_rent != null ? Number(c.total_rent) : null, currency: c.currency,
        party: c.tenant_account_id ? (accMap[c.tenant_account_id] ?? null) : null, links,
        date: (c.created_at as Date | null)?.toISOString() ?? null,
        detail_url: `/booking/contracts/${c.id}`,
        pdf_url: `/api/v1/contracts/${c.id}/pdf`,
      });
    }
  }

  // ── Quotes ───────────────────────────────────────────────────────────
  if (wantsType("Quote")) {
    const qConds: any[] = [isNull(quotesTable.deleted_at)];
    if (q) qConds.push(ilike(quotesTable.quote_ref, `%${q}%`));
    const quotes = await db.select().from(quotesTable).where(and(...qConds)).orderBy(desc(quotesTable.id));
    const accMap = await accountNameMap(quotes.map(x => x.account_id).filter(Boolean) as number[]);
    for (const x of quotes) {
      docs.push({
        doc_type: "Quote", source_id: x.id, ref: x.quote_ref, status: x.status,
        amount: Number(x.total), currency: x.currency,
        party: x.account_id ? (accMap[x.account_id] ?? null) : null, links: [],
        date: (x.created_at as Date | null)?.toISOString() ?? null,
        detail_url: `/documents/quotes/${x.id}`,
        pdf_url: `/api/v1/quotes/${x.id}/pdf`,
      });
    }
  }

  docs.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  res.json(docs);
});

export default router;
