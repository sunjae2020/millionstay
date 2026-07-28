/**
 * 업무 캘린더 — one read-only feed over every dated thing the admin team runs.
 *
 * Deliberately NOT a new events table: each source keeps owning its own record
 * (an inspection is a work order, a move-in is a contract) and this endpoint
 * just projects them onto a common shape. Nothing here writes; edits go to the
 * owning entity's own endpoint, so there is no second copy to keep in sync.
 *
 * GET /v1/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&sources=a,b&assigned_user_id=
 *   sources (default: work_orders,tasks,contracts,bookings — invoices OFF):
 *     work_orders | tasks | contracts | bookings | invoices
 */
import { Router } from "express";
import {
  db, workOrdersTable, tasksTable, contractsTable, bookingsTable, invoicesTable,
  spacesTable, propertiesTable, contactsTable, accountsTable, usersTable,
} from "@workspace/db";
import { and, eq, gte, lte, isNull, isNotNull, inArray, or, ne } from "drizzle-orm";
import { formatPersonName } from "../lib/nameFormat";

const router = Router();

export type CalendarSource = "work_orders" | "tasks" | "contracts" | "bookings" | "invoices";

const ALL_SOURCES: CalendarSource[] = ["work_orders", "tasks", "contracts", "bookings", "invoices"];
// 청구·수납은 양이 많아 기본값은 숨김 — 캘린더 UI의 체크박스로 켠다.
const DEFAULT_SOURCES: CalendarSource[] = ["work_orders", "tasks", "contracts", "bookings"];

export interface CalendarEvent {
  /** Stable across reloads: "<source>:<id>:<kind>". */
  id: string;
  source: CalendarSource;
  /** Sub-kind within a source, e.g. move_in / move_out / due / paid. */
  kind: string;
  title: string;
  /** ISO instant for timed events; "YYYY-MM-DD" for all-day ones. */
  start: string;
  end?: string | null;
  all_day: boolean;
  status?: string | null;
  /** Admin route for the owning record. */
  url: string;
  ref?: string | null;
  space_name?: string | null;
  assignee?: string | null;
  amount?: number | null;
  currency?: string | null;
}

/** "YYYY-MM-DD" bounds; defaults to the current month ±1 when absent. */
function parseRange(req: any): { from: string; to: string } {
  const iso = (v: any) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = iso(req.query.from);
  const to = iso(req.query.to);
  if (from && to) return { from, to };
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));
  return { from: from ?? start.toISOString().slice(0, 10), to: to ?? end.toISOString().slice(0, 10) };
}

/** Resolve space ids → "Property · Unit" labels in one round trip. */
async function spaceLabels(ids: number[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  const unique = [...new Set(ids.filter(Boolean))] as number[];
  if (!unique.length) return out;
  const rows = await db.select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
    .from(spacesTable).where(inArray(spacesTable.id, unique));
  const propIds = [...new Set(rows.map(r => r.property_id).filter(Boolean))] as number[];
  const propMap: Record<number, string> = {};
  if (propIds.length) {
    const props = await db.select({ id: propertiesTable.id, name: propertiesTable.name })
      .from(propertiesTable).where(inArray(propertiesTable.id, propIds));
    for (const p of props) propMap[p.id] = p.name;
  }
  for (const r of rows) {
    const prop = r.property_id ? propMap[r.property_id] : null;
    out[r.id] = [prop, r.name].filter(Boolean).join(" · ");
  }
  return out;
}

router.get("/v1/calendar/events", async (req, res): Promise<void> => {
  const { from, to } = parseRange(req);
  const requested = typeof req.query.sources === "string" && req.query.sources.length
    ? (req.query.sources.split(",").map(s => s.trim()) as CalendarSource[]).filter(s => ALL_SOURCES.includes(s))
    : DEFAULT_SOURCES;
  const sources = new Set<CalendarSource>(requested);
  const assignedUserId = req.query.assigned_user_id ? Number(req.query.assigned_user_id) : null;

  // Range bounds as instants for the timestamptz columns (inclusive end day).
  const fromInstant = new Date(`${from}T00:00:00.000Z`);
  const toInstant = new Date(`${to}T23:59:59.999Z`);

  const events: CalendarEvent[] = [];

  // ── 인스펙션 · 작업지시 방문 ───────────────────────────────────────────────
  if (sources.has("work_orders")) {
    const conds: any[] = [
      isNull(workOrdersTable.deleted_at),
      isNotNull(workOrdersTable.scheduled_start_at),
      gte(workOrdersTable.scheduled_start_at, fromInstant),
      lte(workOrdersTable.scheduled_start_at, toInstant),
    ];
    if (assignedUserId) conds.push(eq(workOrdersTable.assigned_user_id, assignedUserId));
    const rows = await db.select().from(workOrdersTable).where(and(...conds));

    const labels = await spaceLabels(rows.map(r => r.space_id).filter(Boolean) as number[]);
    const userIds = [...new Set(rows.map(r => r.assigned_user_id).filter(Boolean))] as number[];
    const userMap: Record<number, string> = {};
    if (userIds.length) {
      const users = await db.select({ id: usersTable.id, first_name: usersTable.first_name, last_name: usersTable.last_name, email: usersTable.email })
        .from(usersTable).where(inArray(usersTable.id, userIds));
      for (const u of users) userMap[u.id] = formatPersonName(u.first_name, u.last_name) || u.email;
    }

    for (const r of rows) {
      const start = r.scheduled_start_at!;
      events.push({
        id: `work_orders:${r.id}:visit`,
        source: "work_orders",
        kind: r.category === "inspection" || r.inspection_type ? (r.inspection_type ?? "inspection") : "work_order",
        title: r.title,
        start: start.toISOString(),
        end: (r.scheduled_end_at ?? new Date(start.getTime() + 60 * 60 * 1000)).toISOString(),
        all_day: false,
        status: r.status,
        url: `/maintenance/work-orders/${r.id}`,
        ref: r.order_ref,
        space_name: r.space_id ? (labels[r.space_id] ?? null) : null,
        assignee: r.assigned_user_id ? (userMap[r.assigned_user_id] ?? null) : null,
      });
    }
  }

  // ── 업무(tasks) 마감일 ────────────────────────────────────────────────────
  if (sources.has("tasks")) {
    const rows = await db.select().from(tasksTable).where(and(
      isNull(tasksTable.deleted_at),
      isNotNull(tasksTable.due_date),
      gte(tasksTable.due_date, from),
      lte(tasksTable.due_date, to),
    ));
    for (const r of rows) {
      events.push({
        id: `tasks:${r.id}:due`,
        source: "tasks",
        kind: "due",
        title: r.name,
        start: r.due_date!,
        end: null,
        all_day: true,
        status: r.task_status,
        url: `/account/tasks/${r.id}`,
        ref: null,
      });
    }
  }

  // ── 계약 입·퇴거일 ────────────────────────────────────────────────────────
  if (sources.has("contracts")) {
    const rows = await db.select().from(contractsTable).where(and(
      isNull(contractsTable.deleted_at),
      ne(contractsTable.status, "Cancelled"),
      or(
        and(isNotNull(contractsTable.start_date), gte(contractsTable.start_date, from), lte(contractsTable.start_date, to)),
        and(isNotNull(contractsTable.end_date), gte(contractsTable.end_date, from), lte(contractsTable.end_date, to)),
      ),
    ));
    const labels = await spaceLabels(rows.map(r => r.space_id).filter(Boolean) as number[]);
    for (const r of rows) {
      const space = r.space_id ? (labels[r.space_id] ?? null) : null;
      const base = { source: "contracts" as const, status: r.status, url: `/booking/contracts/${r.id}`, ref: r.contract_ref, space_name: space, all_day: true, end: null };
      if (r.start_date && r.start_date >= from && r.start_date <= to) {
        events.push({ ...base, id: `contracts:${r.id}:move_in`, kind: "move_in", title: `입주 — ${space ?? r.contract_ref}`, start: r.start_date });
      }
      if (r.end_date && r.end_date >= from && r.end_date <= to) {
        events.push({ ...base, id: `contracts:${r.id}:move_out`, kind: "move_out", title: `퇴거 — ${space ?? r.contract_ref}`, start: r.end_date });
      }
    }
  }

  // ── 예약 체크인/체크아웃 ──────────────────────────────────────────────────
  if (sources.has("bookings")) {
    const rows = await db.select().from(bookingsTable).where(and(
      isNull(bookingsTable.deleted_at),
      ne(bookingsTable.booking_status, "Cancelled"),
      or(
        and(isNotNull(bookingsTable.check_in_date), gte(bookingsTable.check_in_date, from), lte(bookingsTable.check_in_date, to)),
        and(isNotNull(bookingsTable.check_out_date), gte(bookingsTable.check_out_date, from), lte(bookingsTable.check_out_date, to)),
      ),
    ));
    const labels = await spaceLabels(rows.map(r => r.space_id).filter(Boolean) as number[]);
    for (const r of rows) {
      const space = r.space_id ? (labels[r.space_id] ?? null) : null;
      const who = r.name ?? r.booking_ref;
      const base = { source: "bookings" as const, status: r.booking_status, url: `/booking/bookings/${r.id}`, ref: r.booking_ref, space_name: space, all_day: true, end: null };
      if (r.check_in_date && r.check_in_date >= from && r.check_in_date <= to) {
        events.push({ ...base, id: `bookings:${r.id}:check_in`, kind: "check_in", title: `체크인 — ${who}`, start: r.check_in_date });
      }
      if (r.check_out_date && r.check_out_date >= from && r.check_out_date <= to) {
        events.push({ ...base, id: `bookings:${r.id}:check_out`, kind: "check_out", title: `체크아웃 — ${who}`, start: r.check_out_date });
      }
    }
  }

  // ── 청구·수납 예정일 (기본 숨김) ──────────────────────────────────────────
  if (sources.has("invoices")) {
    const rows = await db.select().from(invoicesTable).where(and(
      isNull(invoicesTable.deleted_at),
      isNotNull(invoicesTable.due_date),
      gte(invoicesTable.due_date, from),
      lte(invoicesTable.due_date, to),
    ));
    const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))] as number[];
    const accountMap: Record<number, string> = {};
    if (accountIds.length) {
      const accs = await db.select({ id: accountsTable.id, name: accountsTable.name })
        .from(accountsTable).where(inArray(accountsTable.id, accountIds));
      for (const a of accs) accountMap[a.id] = a.name;
    }
    for (const r of rows) {
      const who = r.account_id ? (accountMap[r.account_id] ?? null) : null;
      events.push({
        id: `invoices:${r.id}:due`,
        source: "invoices",
        kind: r.paid_at ? "paid" : "due",
        title: `${r.paid_at ? "수납" : "청구"} — ${who ?? r.invoice_ref}`,
        start: r.due_date!,
        end: null,
        all_day: true,
        status: r.status,
        url: `/finance/invoices/${r.id}`,
        ref: r.invoice_ref,
        amount: Number(r.amount),
        currency: r.currency,
      });
    }
  }

  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  res.json({ success: true, data: events, range: { from, to }, sources: [...sources] });
});

export default router;
