import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, providerSettlementsTable, invoicesTable, accountsTable } from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { approveSettlement, paySettlement, generateSettlementsForInvoice } from "../lib/billing/payout";

// 정산 원장 — the payout legs a customer receipt fans out into.
// See docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §3.
const router: IRouter = Router();
const ENTITY = "provider_settlement";

const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Attach payee display names for rows that point at a CRM account. */
async function enrich(rows: (typeof providerSettlementsTable.$inferSelect)[]) {
  const ids = [...new Set(rows.map((r) => r.payee_account_id).filter((v): v is number => !!v))];
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const accts = await db
      .select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable)
      .where(inArray(accountsTable.id, ids));
    for (const a of accts) names.set(a.id, a.name);
  }
  return rows.map((r) => ({
    ...r,
    payee_display: (r.payee_account_id ? names.get(r.payee_account_id) : null) ?? r.payee_name,
  }));
}

router.get("/v1/provider-settlements", async (req, res): Promise<void> => {
  try {
    const { status, party_type, contract_id, split_role } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(providerSettlementsTable)
      .where(
        and(
          isNull(providerSettlementsTable.deleted_at),
          status ? eq(providerSettlementsTable.status, status) : undefined,
          party_type ? eq(providerSettlementsTable.party_type, party_type) : undefined,
          split_role ? eq(providerSettlementsTable.split_role, split_role) : undefined,
          contract_id ? eq(providerSettlementsTable.contract_id, Number(contract_id)) : undefined,
        ),
      )
      .orderBy(desc(providerSettlementsTable.id));
    res.json({ success: true, data: await enrich(rows), meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list settlements" });
  }
});

/**
 * The settlement board for one contract: every receipt with the legs it split
 * into, plus the reconciliation that proves the split adds up.
 *
 * `balanced=false` means money came in that nobody was assigned — the row must
 * show a warning rather than a plausible-looking margin.
 */
router.get("/v1/contracts/:contractId/settlement-board", async (req, res): Promise<void> => {
  try {
    const contractId = Number(req.params.contractId);
    if (!Number.isFinite(contractId)) { res.status(400).json({ error: "Invalid contract id" }); return; }

    const rows = await db
      .select()
      .from(providerSettlementsTable)
      .where(and(eq(providerSettlementsTable.contract_id, contractId), isNull(providerSettlementsTable.deleted_at)))
      .orderBy(desc(providerSettlementsTable.source_id), desc(providerSettlementsTable.id));
    const enriched = await enrich(rows);

    // Group by the receipt each leg came out of.
    const bySource = new Map<number, typeof enriched>();
    for (const r of enriched) {
      if (r.source_id == null) continue;
      const arr = bySource.get(r.source_id) ?? [];
      arr.push(r);
      bySource.set(r.source_id, arr);
    }

    const invoiceIds = [...bySource.keys()];
    const invoices = invoiceIds.length
      ? await db
          .select({ id: invoicesTable.id, invoice_ref: invoicesTable.invoice_ref, amount: invoicesTable.amount, currency: invoicesTable.currency, paid_at: invoicesTable.paid_at })
          .from(invoicesTable)
          .where(inArray(invoicesTable.id, invoiceIds))
      : [];
    const invoiceById = new Map(invoices.map((i) => [i.id, i]));

    const receipts = invoiceIds.map((sid) => {
      const legs = bySource.get(sid) ?? [];
      const inv = invoiceById.get(sid);
      const received = round2(num(inv?.amount));
      const legsTotal = round2(legs.reduce((s, l) => s + num(l.amount), 0));
      const retained = round2(
        legs.filter((l) => l.split_role === "internal_transfer").reduce((s, l) => s + num(l.amount), 0),
      );
      return {
        source_type: "invoice",
        source_id: sid,
        invoice_ref: inv?.invoice_ref ?? null,
        currency: inv?.currency ?? legs[0]?.currency ?? null,
        paid_at: inv?.paid_at ?? null,
        received,
        legs_total: legsTotal,
        retained,
        margin_pct: received > 0 ? Math.round((retained / received) * 1000) / 10 : null,
        balanced: Math.abs(received - legsTotal) < 0.01,
        legs,
      };
    });

    res.json({
      success: true,
      data: {
        contract_id: contractId,
        receipts,
        totals: {
          received: round2(receipts.reduce((s, r) => s + r.received, 0)),
          retained: round2(receipts.reduce((s, r) => s + r.retained, 0)),
          unbalanced: receipts.filter((r) => !r.balanced).length,
        },
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to build settlement board" });
  }
});

/** Re-run the split for an invoice (no-op if it already has legs). */
router.post("/v1/invoices/:id/generate-settlements", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await generateSettlementsForInvoice(id);
  if (!result) { res.json({ success: true, data: { created: 0, note: "no terms, already split, or not applicable" } }); return; }
  res.json({ success: true, data: result });
});

router.post("/v1/provider-settlements/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const row = await approveSettlement(id);
  if (!row) { res.status(400).json({ error: "Settlement is not in 'due' status" }); return; }
  void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", oldValue: { status: "due" }, newValue: { status: "approved" } });
  res.json({ success: true, data: row });
});

const PayBody = z.object({ method: z.string().nullish() });

router.post("/v1/provider-settlements/:id/pay", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = PayBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = await paySettlement(id, parsed.data.method ?? null);
  if (!row) { res.status(400).json({ error: "Settlement must be approved before payment" }); return; }
  void logAction({ entityType: ENTITY, entityId: id, action: "PAYMENT", oldValue: { status: "approved" }, newValue: { status: "paid", method: parsed.data.method } });
  res.json({ success: true, data: row });
});

/**
 * Pay run — everything owed, grouped by payee, so the weekly routine is
 * "approve the list" rather than twenty individual buttons.
 */
router.get("/v1/ap/pay-run", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(providerSettlementsTable)
      .where(
        and(
          isNull(providerSettlementsTable.deleted_at),
          eq(providerSettlementsTable.split_role, "external_payment"),
          status ? eq(providerSettlementsTable.status, status) : inArray(providerSettlementsTable.status, ["due", "approved"]),
        ),
      )
      .orderBy(desc(providerSettlementsTable.id));
    const enriched = await enrich(rows);

    const groups = new Map<string, { payee: string; party_type: string; currency: string; count: number; total: number; items: typeof enriched }>();
    for (const r of enriched) {
      // Totals never mix currencies — a combined figure across currencies is a
      // meaningless number that still looks authoritative.
      const key = `${r.party_type}::${r.payee_display}::${r.currency}`;
      const g = groups.get(key) ?? { payee: r.payee_display, party_type: r.party_type, currency: r.currency, count: 0, total: 0, items: [] };
      g.count += 1;
      g.total = round2(g.total + num(r.amount));
      g.items.push(r);
      groups.set(key, g);
    }

    res.json({ success: true, data: [...groups.values()].sort((a, b) => b.total - a.total) });
  } catch {
    res.status(500).json({ error: "Failed to build pay run" });
  }
});

/** AP aging — what we owe, bucketed by how long it has been sitting. */
router.get("/v1/ap/aging", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(providerSettlementsTable)
      .where(
        and(
          isNull(providerSettlementsTable.deleted_at),
          eq(providerSettlementsTable.split_role, "external_payment"),
          inArray(providerSettlementsTable.status, ["due", "approved"]),
        ),
      );
    const enriched = await enrich(rows);
    const now = Date.now();
    type Bucket = "current" | "d31_60" | "d61_90" | "d90_plus";
    type AgingRow = { payee: string; currency: string; total: number } & Record<Bucket, number>;
    const bucketOf = (d: Date | null): Bucket => {
      const days = d ? Math.floor((now - d.getTime()) / 86_400_000) : 0;
      if (days <= 30) return "current";
      if (days <= 60) return "d31_60";
      if (days <= 90) return "d61_90";
      return "d90_plus";
    };
    const byPayee = new Map<string, AgingRow>();
    for (const r of enriched) {
      const key = `${r.payee_display}::${r.currency}`;
      const g: AgingRow = byPayee.get(key) ?? { payee: r.payee_display, currency: r.currency, current: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
      const b = bucketOf(r.created_at);
      g[b] = round2(g[b] + num(r.amount));
      g.total = round2(g.total + num(r.amount));
      byPayee.set(key, g);
    }
    res.json({ success: true, data: [...byPayee.values()].sort((a, b) => b.total - a.total) });
  } catch {
    res.status(500).json({ error: "Failed to build AP aging" });
  }
});

/**
 * Net revenue (실 매출) by month — the retained legs, not gross receipts.
 * This is the number the dashboard should show as revenue.
 */
router.get("/v1/reports/net-revenue", async (req, res): Promise<void> => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const rows = await db
      .select({
        month: sql<string>`to_char(${providerSettlementsTable.created_at}, 'YYYY-MM')`,
        currency: providerSettlementsTable.currency,
        retained: sql<string>`SUM(${providerSettlementsTable.amount})`,
      })
      .from(providerSettlementsTable)
      .where(
        and(
          isNull(providerSettlementsTable.deleted_at),
          eq(providerSettlementsTable.split_role, "internal_transfer"),
          from ? sql`${providerSettlementsTable.created_at} >= ${from}` : undefined,
          to ? sql`${providerSettlementsTable.created_at} <= ${to}` : undefined,
        ),
      )
      // Grouped by currency as well as month — summing across currencies would
      // produce a confident-looking but meaningless total.
      .groupBy(sql`1`, providerSettlementsTable.currency)
      .orderBy(sql`1`);
    res.json({
      success: true,
      data: rows.map((r) => ({ month: r.month, currency: r.currency, net_revenue: round2(Number(r.retained ?? 0)) })),
    });
  } catch {
    res.status(500).json({ error: "Failed to build net revenue report" });
  }
});

export default router;
