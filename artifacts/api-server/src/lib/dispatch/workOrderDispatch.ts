import { db, workOrdersTable, serviceHostsTable, accountsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, notInArray, lte, isNull, sql } from "drizzle-orm";
import { sendHomestayNotification } from "../homestay/notify";

// PARTNER AUTO-DISPATCH + SLA (Phase 3). Matches a work order's category to an
// active service host's declared specialties, assigns it (load-balanced by open
// workload), sets an acknowledgement SLA deadline, and notifies the partner. The
// SLA cron flags un-acknowledged, past-deadline dispatches as breached and
// escalates to admin. Consumer↔partner isolation is preserved: partners only ever
// see their own dispatched work orders (enforced in the service-host portal).

const DEFAULT_SLA_ACK_MINUTES = 60;
const CLOSED_STATUSES = ["Completed", "Cancelled", "Archived"];

function normalize(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}
function hostSpecialties(h: { specialties: unknown }): string[] {
  return Array.isArray(h.specialties) ? h.specialties.map((s) => normalize(s)) : [];
}

export type DispatchResult =
  | { ok: true; service_host_id: number; service_host_name: string; sla_ack_due_at: string }
  | { ok: false; reason: "not_found" | "already_dispatched" | "no_category" | "no_match" | "host_not_found" };

/**
 * Auto-dispatch a work order to the best-matching active partner. Idempotent:
 * a work order that already has a service_host_id is not re-dispatched (call
 * `force` to override). Best-effort notification never blocks the result.
 */
export async function dispatchWorkOrder(
  workOrderId: number,
  opts: { slaAckMinutes?: number; force?: boolean; serviceHostId?: number } = {},
): Promise<DispatchResult> {
  const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, workOrderId)).limit(1);
  if (!wo) return { ok: false, reason: "not_found" };
  if (wo.service_host_id && !opts.force && !opts.serviceHostId) return { ok: false, reason: "already_dispatched" };

  // 관리자가 파트너를 직접 고른 배정 — 카테고리 매칭을 건너뛴다.
  if (opts.serviceHostId) {
    const [host] = await db.select().from(serviceHostsTable)
      .where(eq(serviceHostsTable.id, opts.serviceHostId)).limit(1);
    if (!host) return { ok: false, reason: "host_not_found" };
    return assignHost(wo, host, opts.slaAckMinutes);
  }

  const category = normalize(wo.category);
  if (!category) return { ok: false, reason: "no_category" };

  const activeHosts = await db.select().from(serviceHostsTable).where(eq(serviceHostsTable.status, "Active"));
  const matched = activeHosts.filter((h) => hostSpecialties(h).includes(category));
  // Fall back to partners who declared a "general" specialty when no exact match.
  const pool = matched.length ? matched : activeHosts.filter((h) => hostSpecialties(h).includes("general"));
  if (!pool.length) return { ok: false, reason: "no_match" };

  // Load-balance: pick the matching host with the fewest open work orders.
  const poolIds = pool.map((h) => h.id);
  const counts = await db
    .select({ id: workOrdersTable.service_host_id, c: sql<number>`count(*)::int` })
    .from(workOrdersTable)
    .where(and(inArray(workOrdersTable.service_host_id, poolIds), notInArray(workOrdersTable.status, CLOSED_STATUSES)))
    .groupBy(workOrdersTable.service_host_id);
  const countMap = new Map(counts.map((r) => [r.id, Number(r.c)]));
  pool.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0) || a.id - b.id);
  const chosen = pool[0]!;
  return assignHost(wo, chosen, opts.slaAckMinutes);
}

/** 파트너 배정 + SLA 시계 리셋 + 알림. 자동 매칭·수동 지정이 공유한다. */
async function assignHost(
  wo: typeof workOrdersTable.$inferSelect,
  host: typeof serviceHostsTable.$inferSelect,
  slaAckMinutes?: number,
): Promise<DispatchResult> {
  const now = new Date();
  const due = new Date(now.getTime() + (slaAckMinutes ?? DEFAULT_SLA_ACK_MINUTES) * 60_000);
  await db.update(workOrdersTable)
    .set({ service_host_id: host.id, dispatched_at: now, acknowledged_at: null, sla_ack_due_at: due, sla_status: "pending_ack", updated_at: now })
    .where(eq(workOrdersTable.id, wo.id));

  void notifyPartnerDispatched(host.account_id, host.name, wo.order_ref, wo.title, wo.category, due);
  return { ok: true, service_host_id: host.id, service_host_name: host.name, sla_ack_due_at: due.toISOString() };
}

async function partnerEmail(accountId: number | null): Promise<string | null> {
  if (!accountId) return null;
  const [acc] = await db.select({ email: accountsTable.account_email }).from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  return acc?.email ?? null;
}

async function notifyPartnerDispatched(accountId: number | null, hostName: string, orderRef: string, title: string, category: string | null, due: Date): Promise<void> {
  const to = await partnerEmail(accountId);
  if (!to) return;
  await sendHomestayNotification({
    to,
    subject: `New job assigned — ${orderRef}`,
    heading: "You've been assigned a new job",
    bodyHtml: `
      <p style="font-size:16px;">Hi <strong>${escapeText(hostName)}</strong>,</p>
      <p>A new work order has been dispatched to you. Please acknowledge it in your partner portal.</p>
      <p><strong>Ref:</strong> ${escapeText(orderRef)}<br/>
         <strong>Job:</strong> ${escapeText(title)}<br/>
         ${category ? `<strong>Category:</strong> ${escapeText(category)}<br/>` : ""}
         <strong>Please acknowledge by:</strong> ${due.toISOString().replace("T", " ").slice(0, 16)} UTC</p>
      <p style="font-size:12px;color:#999;">Contact the property manager for details — do not contact the tenant directly.</p>`,
  });
}

/** SLA cron: flag un-acknowledged, past-deadline dispatches as breached + escalate. */
export async function checkWorkOrderSla(): Promise<{ breached: number }> {
  const now = new Date();
  const overdue = await db.select().from(workOrdersTable).where(and(
    eq(workOrdersTable.sla_status, "pending_ack"),
    isNull(workOrdersTable.acknowledged_at),
    lte(workOrdersTable.sla_ack_due_at, now),
  ));
  if (!overdue.length) return { breached: 0 };

  const [admin] = await db.select({ email: usersTable.email }).from(usersTable)
    .where(and(eq(usersTable.role, "SuperAdmin"), isNull(usersTable.deleted_at))).limit(1);

  for (const wo of overdue) {
    await db.update(workOrdersTable).set({ sla_status: "breached", updated_at: now }).where(eq(workOrdersTable.id, wo.id));
    if (admin?.email) {
      void sendHomestayNotification({
        to: admin.email,
        subject: `SLA breach — work order ${wo.order_ref} not acknowledged`,
        heading: "Work-order SLA breached",
        bodyHtml: `<p>Work order <strong>${escapeText(wo.order_ref)}</strong> ("${escapeText(wo.title)}") was dispatched but the partner did not acknowledge it before the SLA deadline.</p>
          <p>Consider re-dispatching or contacting the partner.</p>`,
      });
    }
  }
  return { breached: overdue.length };
}

function escapeText(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
