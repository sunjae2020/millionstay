import { Router, type IRouter } from "express";
import { db, propertiesTable, spacesTable, contactsTable, accountsTable, bookingsTable, leadsTable, tasksTable, invoicesTable, contractsTable, workOrdersTable, systemLogsTable, homestayPlacementsTable, homestayStudentRequestsTable, homestayPlacementPaymentsTable, agentCommissionLedgerTable } from "@workspace/db";
import { eq, count, and, gte, lte, lt, sql, desc, isNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/dashboard/stats", async (_req, res) => {
  try {
    const [
      [props],
      [spaces],
      [contacts],
      [accounts],
      [leads],
      [tasks],
      [invoices],
      [contracts],
      [bookings],
      [confirmedBookings],
      [pendingBookings],
    ] = await Promise.all([
      db.select({ count: count() }).from(propertiesTable),
      db.select({ count: count() }).from(spacesTable),
      db.select({ count: count() }).from(contactsTable),
      db.select({ count: count() }).from(accountsTable),
      db.select({ count: count() }).from(leadsTable),
      db.select({ count: count() }).from(tasksTable),
      db.select({ count: count() }).from(invoicesTable),
      db.select({ count: count() }).from(contractsTable),
      db.select({ count: count() }).from(bookingsTable),
      db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.booking_status, "Confirmed")),
      db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.booking_status, "PendingApproval")),
    ]);

    res.json({
      total_properties: Number(props.count),
      total_spaces: Number(spaces.count),
      total_contacts: Number(contacts.count),
      total_accounts: Number(accounts.count),
      total_leads: Number(leads.count),
      total_tasks: Number(tasks.count),
      total_invoices: Number(invoices.count),
      total_contracts: Number(contracts.count),
      total_bookings: Number(bookings.count),
      active_bookings: Number(confirmedBookings.count),
      pending_approvals: Number(pendingBookings.count),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/v1/dashboard/overview/kpis", async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + "-01";
    const nextMonth = (() => {
      const d = new Date(monthStart);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const [[checkins], [checkouts], [active], [totalSpaces], [occupiedSpaces], paidInvoices] = await Promise.all([
      db.select({ count: count() }).from(bookingsTable).where(and(eq(bookingsTable.check_in_date, today), eq(bookingsTable.booking_status, "Confirmed"))),
      db.select({ count: count() }).from(bookingsTable).where(and(eq(bookingsTable.check_out_date, today), eq(bookingsTable.booking_status, "Active"))),
      db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.booking_status, "Active")),
      db.select({ count: count() }).from(spacesTable).where(eq(spacesTable.status, "Active")),
      db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.booking_status, "Active")),
      db.select({ amount: invoicesTable.amount }).from(invoicesTable).where(and(eq(invoicesTable.status, "Paid"), gte(invoicesTable.created_at, new Date(monthStart)), lt(invoicesTable.created_at, new Date(nextMonth)))),
    ]);

    const monthlyRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
    const totalSpacesNum = Number(totalSpaces.count);
    const occupiedNum = Number(occupiedSpaces.count);
    const occupancyPct = totalSpacesNum > 0 ? Math.round((occupiedNum / totalSpacesNum) * 100) : 0;

    res.json({
      checkins_today: Number(checkins.count),
      checkouts_today: Number(checkouts.count),
      active_bookings: Number(active.count),
      total_spaces: totalSpacesNum,
      occupied_spaces: occupiedNum,
      occupancy_pct: occupancyPct,
      monthly_revenue: Math.round(monthlyRevenue * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch KPIs" });
  }
});

router.get("/v1/finance/summary", async (req, res) => {
  try {
    const { month } = req.query as Record<string, string>;
    const monthStr = month || new Date().toISOString().slice(0, 7);
    const monthStart = monthStr + "-01";
    const nextMonth = (() => {
      const d = new Date(monthStart);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const allInvoices = await db.select({ status: invoicesTable.status, amount: invoicesTable.amount, due_date: invoicesTable.due_date, created_at: invoicesTable.created_at })
      .from(invoicesTable);

    const thisMonthInvoices = allInvoices.filter(i => {
      const d = i.created_at?.toISOString().slice(0, 10) ?? "";
      return d >= monthStart && d < nextMonth;
    });

    const totalRevenue = allInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const monthRevenue = thisMonthInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const sentCount = allInvoices.filter(i => i.status === "Sent").length;
    const paidCount = thisMonthInvoices.filter(i => i.status === "Paid").length;
    const draftCount = allInvoices.filter(i => i.status === "Draft").length;
    const overdueCount = allInvoices.filter(i => {
      if (i.status !== "Sent") return false;
      const due = i.due_date;
      return due ? due < new Date().toISOString().slice(0, 10) : false;
    }).length;

    res.json({
      total_revenue: Math.round(totalRevenue * 100) / 100,
      monthly_revenue: Math.round(monthRevenue * 100) / 100,
      sent_count: sentCount,
      paid_count: paidCount,
      draft_count: draftCount,
      overdue_count: overdueCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

router.get("/v1/finance/revenue/monthly", async (req, res) => {
  try {
    const months = Number((req.query as any).months) || 6;
    const result: { month: string; revenue: number; invoice_count: number }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      // Compute month windows in UTC to avoid timezone-induced month shifts/overlaps.
      const startD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const endD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const monthStr = startD.toISOString().slice(0, 7);
      const rows = await db.select({ amount: invoicesTable.amount })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.status, "Paid"), gte(invoicesTable.created_at, startD), lt(invoicesTable.created_at, endD)));
      result.push({ month: monthStr, revenue: Math.round(rows.reduce((s, r) => s + Number(r.amount ?? 0), 0) * 100) / 100, invoice_count: rows.length });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch monthly revenue" });
  }
});

router.get("/v1/finance/revenue/by-property", async (req, res) => {
  try {
    const invoices = await db.select({
      amount: invoicesTable.amount,
      booking_id: invoicesTable.booking_id,
    }).from(invoicesTable).where(eq(invoicesTable.status, "Paid"));

    const bookingIds = [...new Set(invoices.map(i => i.booking_id).filter(Boolean))] as number[];
    const bookingMap: Record<number, number | null> = {};
    for (const id of bookingIds) {
      const [b] = await db.select({ space_id: bookingsTable.space_id }).from(bookingsTable).where(eq(bookingsTable.id, id));
      if (b?.space_id) {
        const [s] = await db.select({ property_id: spacesTable.property_id }).from(spacesTable).where(eq(spacesTable.id, b.space_id));
        bookingMap[id] = s?.property_id ?? null;
      }
    }
    const propRevenue: Record<number, number> = {};
    for (const inv of invoices) {
      const propId = inv.booking_id ? (bookingMap[inv.booking_id] ?? null) : null;
      if (propId) propRevenue[propId] = (propRevenue[propId] ?? 0) + Number(inv.amount ?? 0);
    }
    const propIds = Object.keys(propRevenue).map(Number);
    const props = propIds.length ? await db.select({ id: propertiesTable.id, name: propertiesTable.name }).from(propertiesTable) : [];
    const result = props
      .filter(p => propRevenue[p.id] !== undefined)
      .map(p => ({ property_id: p.id, property_name: p.name, revenue: Math.round((propRevenue[p.id] ?? 0) * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch revenue by property" });
  }
});

router.get("/v1/finance/tax-summary", async (req, res) => {
  try {
    const months = 6;
    const result: { month: string; gross_revenue: number; tax_rate: number; tax_amount: number; net_revenue: number }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      // UTC-consistent month windows (see revenue/monthly note).
      const startD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const endD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const monthStr = startD.toISOString().slice(0, 7);
      const rows = await db.select({ amount: invoicesTable.amount }).from(invoicesTable)
        .where(and(eq(invoicesTable.status, "Paid"), gte(invoicesTable.created_at, startD), lt(invoicesTable.created_at, endD)));
      const gross = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const taxRate = 0.10;
      const taxAmount = gross * taxRate / (1 + taxRate);
      result.push({ month: monthStr, gross_revenue: Math.round(gross * 100) / 100, tax_rate: taxRate, tax_amount: Math.round(taxAmount * 100) / 100, net_revenue: Math.round((gross - taxAmount) * 100) / 100 });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tax summary" });
  }
});

router.get("/v1/operations/summary/kpis", async (_req, res) => {
  try {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [[open], [inProgress], [urgent], completedRows] = await Promise.all([
      db.select({ count: count() }).from(workOrdersTable).where(eq(workOrdersTable.status, "Open")),
      db.select({ count: count() }).from(workOrdersTable).where(eq(workOrdersTable.status, "InProgress")),
      db.select({ count: count() }).from(workOrdersTable).where(and(eq(workOrdersTable.priority, "Urgent"), sql`${workOrdersTable.status} NOT IN ('Completed','Cancelled')`)),
      db.select({ completed_at: workOrdersTable.completed_at }).from(workOrdersTable).where(eq(workOrdersTable.status, "Completed")),
    ]);
    const completedThisMonth = completedRows.filter(r => r.completed_at?.toISOString().slice(0, 7) === thisMonth).length;
    res.json({
      open_count: Number(open.count),
      in_progress_count: Number(inProgress.count),
      urgent_count: Number(urgent.count),
      completed_this_month: completedThisMonth,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch operations KPIs" });
  }
});

router.get("/v1/operations/activity-log", async (req, res) => {
  try {
    const limit = Number((req.query as any).limit) || 30;
    const rows = await db.select().from(systemLogsTable).orderBy(desc(systemLogsTable.created_at)).limit(limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
});

router.get("/v1/homestay-ops/summary", async (_req, res) => {
  try {
    const monthStr = new Date().toISOString().slice(0, 7); // YYYY-MM (current month)

    const [placements, requests, payments, commissions] = await Promise.all([
      db.select({ status: homestayPlacementsTable.status })
        .from(homestayPlacementsTable)
        .where(isNull(homestayPlacementsTable.deleted_at)),
      db.select({ status: homestayStudentRequestsTable.status })
        .from(homestayStudentRequestsTable)
        .where(isNull(homestayStudentRequestsTable.deleted_at)),
      db.select({
        status: homestayPlacementPaymentsTable.status,
        amount: homestayPlacementPaymentsTable.amount,
        paid_at: homestayPlacementPaymentsTable.paid_at,
      }).from(homestayPlacementPaymentsTable),
      db.select({
        agent_account_id: agentCommissionLedgerTable.agent_account_id,
        amount: agentCommissionLedgerTable.amount,
        status: agentCommissionLedgerTable.status,
      }).from(agentCommissionLedgerTable),
    ]);

    // ── Group counts by status (preserve insertion order of first sighting) ──
    const groupByStatus = (rows: { status: string }[]) => {
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1);
      return Array.from(map, ([status, count]) => ({ status, count }));
    };

    const placements_by_status = groupByStatus(placements);
    const student_requests_by_status = groupByStatus(requests);
    const active_placements = placements.filter(p => p.status === "Active").length;

    // ── Revenue (homestay_placement_payments is source of truth) ─────────────
    const round = (n: number) => Math.round(n * 100) / 100;
    const total_paid = round(
      payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    );
    const month_paid = round(
      payments
        .filter(p => p.status === "paid" && p.paid_at?.toISOString().slice(0, 7) === monthStr)
        .reduce((s, p) => s + Number(p.amount ?? 0), 0),
    );
    const pending = round(
      payments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    );

    // ── Agent commissions (ledger may be empty — handle gracefully) ──────────
    const sumByStatus = (status: string) =>
      round(commissions.filter(c => c.status === status).reduce((s, c) => s + Number(c.amount ?? 0), 0));
    const agent_commissions = {
      pending: sumByStatus("Pending"),
      approved: sumByStatus("Approved"),
      paid: sumByStatus("Paid"),
    };

    const agentTotals = new Map<number, number>();
    for (const c of commissions) {
      agentTotals.set(c.agent_account_id, (agentTotals.get(c.agent_account_id) ?? 0) + Number(c.amount ?? 0));
    }
    const agentIds = Array.from(agentTotals.keys());
    const accounts = agentIds.length
      ? await db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable)
      : [];
    const nameById = new Map(accounts.map(a => [a.id, a.name]));
    const top_agents = agentIds
      .map(id => ({ agent_account_id: id, name: nameById.get(id) ?? `#${id}`, total: round(agentTotals.get(id) ?? 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    res.json({
      placements_by_status,
      student_requests_by_status,
      revenue: { total_paid, month_paid, pending },
      active_placements,
      agent_commissions,
      top_agents,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch homestay ops summary" });
  }
});

export default router;
