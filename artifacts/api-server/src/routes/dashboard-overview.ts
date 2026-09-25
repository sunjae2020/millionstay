import { Router, type IRouter } from "express";
import { db, spacesTable, accountsTable, invoicesTable, contractsTable, systemLogsTable } from "@workspace/db";
import { eq, and, sql, desc, isNull, inArray, count } from "drizzle-orm";
import { countableUnitFilter } from "../lib/unitScope";
import { billingTodayIso, BILLING_TZ } from "../lib/billing/billingDate";
import { excludeConsolidated } from "../lib/billing/consolidatedInvoices";

/**
 * 대시보드 개요 탭 하단(7일 입주·퇴거 캘린더 · 빠른 작업 · 알림 · 최근 계약 · 활동 피드 ·
 * 포트폴리오)과 이번 달 수납액 카드를 한 번에 채운다. 날짜 기준은 테넌트 영업 시간대.
 *
 * 예약(booking) 원장이 아니라 계약 원장이 기준이다 — Metheim 처럼 임대를 계약으로만
 * 관리하는 인스턴스에서 예약 기반 숫자는 늘 0 이거나 틀렸다. 리스트 API 는 페이지
 * 단위라 클라이언트에서 합산하면 일부만 세므로, 집계는 전부 여기서 한다.
 */

const router: IRouter = Router();

const WINDOW_DAYS = 7;
const EXPIRY_ALERT_DAYS = 30;
// 세대를 실제로 점유하는(했던) 계약. Draft·Sent 는 아직 체결 전이다.
const CONCLUDED = ["Signed", "Active", "Completed", "Expired", "Terminated"];
const LIVE = ["Signed", "Active"];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 활동 피드에서 사람이 읽을 이름을 붙일 엔티티들.
async function activityLabels(logs: { entity_type: string; entity_id: number }[]) {
  const ids = (type: string) => [...new Set(logs.filter(l => l.entity_type === type).map(l => l.entity_id))];
  const labels = new Map<string, string>();
  const invoiceIds = ids("invoice");
  const contractIds = ids("contract");
  const spaceIds = ids("space");
  const accountIds = ids("account");
  await Promise.all([
    invoiceIds.length && db.select({ id: invoicesTable.id, ref: invoicesTable.invoice_ref, space: spacesTable.name })
      .from(invoicesTable)
      .leftJoin(contractsTable, eq(contractsTable.id, invoicesTable.contract_id))
      .leftJoin(spacesTable, eq(spacesTable.id, contractsTable.space_id))
      .where(inArray(invoicesTable.id, invoiceIds))
      .then(rows => rows.forEach(r => labels.set(`invoice:${r.id}`, r.space ? `${r.ref} · ${r.space}` : r.ref))),
    contractIds.length && db.select({ id: contractsTable.id, ref: contractsTable.contract_ref, space: spacesTable.name, tenant: accountsTable.name })
      .from(contractsTable)
      .leftJoin(spacesTable, eq(spacesTable.id, contractsTable.space_id))
      .leftJoin(accountsTable, eq(accountsTable.id, contractsTable.tenant_account_id))
      .where(inArray(contractsTable.id, contractIds))
      .then(rows => rows.forEach(r => labels.set(`contract:${r.id}`, [r.ref, r.space, r.tenant].filter(Boolean).join(" · ")))),
    spaceIds.length && db.select({ id: spacesTable.id, name: spacesTable.name })
      .from(spacesTable).where(inArray(spacesTable.id, spaceIds))
      .then(rows => rows.forEach(r => labels.set(`space:${r.id}`, r.name))),
    accountIds.length && db.select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable).where(inArray(accountsTable.id, accountIds))
      .then(rows => rows.forEach(r => labels.set(`account:${r.id}`, r.name))),
  ]);
  return labels;
}

router.get("/v1/dashboard/overview/board", async (_req, res) => {
  try {
    const today = billingTodayIso();
    const month = today.slice(0, 7);
    const weekEnd = addDays(today, WINDOW_DAYS); // exclusive
    const expirySoon = addDays(today, EXPIRY_ALERT_DAYS);

    const contracts = await db
      .select({
        id: contractsTable.id,
        contract_ref: contractsTable.contract_ref,
        status: contractsTable.status,
        lease_mode: contractsTable.lease_mode,
        start_date: contractsTable.start_date,
        end_date: contractsTable.end_date,
        monthly_rent: contractsTable.monthly_rent,
        actual_monthly_rent: contractsTable.actual_monthly_rent,
        rate_amount: contractsTable.rate_amount,
        rate_period: contractsTable.rate_period,
        bond_amount: contractsTable.bond_amount,
        currency: contractsTable.currency,
        created_at: contractsTable.created_at,
        space_id: contractsTable.space_id,
        space_name: spacesTable.name,
        tenant_name: accountsTable.name,
      })
      .from(contractsTable)
      .leftJoin(spacesTable, eq(spacesTable.id, contractsTable.space_id))
      .leftJoin(accountsTable, eq(accountsTable.id, contractsTable.tenant_account_id))
      .where(isNull(contractsTable.deleted_at));

    const countable = new Set(
      (await db.select({ id: spacesTable.id }).from(spacesTable).where(countableUnitFilter)).map(s => s.id),
    );

    // ── 7일 입주·퇴거 캘린더: 이번 주에 입주일 또는 종료일이 있는 세대 ──
    const moves = new Map<number, {
      space_id: number; space_name: string;
      contracts: { id: number; contract_ref: string; tenant_name: string | null; start_date: string | null; end_date: string | null; status: string }[];
    }>();
    let moveIns = 0;
    let moveOuts = 0;
    for (const c of contracts) {
      if (!c.space_id || !CONCLUDED.includes(c.status)) continue;
      const movesIn = !!c.start_date && c.start_date >= today && c.start_date < weekEnd;
      const movesOut = !!c.end_date && c.end_date >= today && c.end_date < weekEnd && c.status !== "Terminated";
      if (!movesIn && !movesOut) continue;
      if (movesIn) moveIns++;
      if (movesOut) moveOuts++;
      const entry = moves.get(c.space_id) ?? { space_id: c.space_id, space_name: c.space_name ?? `#${c.space_id}`, contracts: [] };
      entry.contracts.push({
        id: c.id, contract_ref: c.contract_ref, tenant_name: c.tenant_name ?? null,
        start_date: c.start_date || null, end_date: c.end_date || null, status: c.status,
      });
      moves.set(c.space_id, entry);
    }
    const calendarRows = [...moves.values()]
      .sort((a, b) => a.space_name.localeCompare(b.space_name, "ko", { numeric: true }));
    // 이번 주가 비어 있을 때 보여줄 다음 일정.
    const nextEvent = contracts
      .filter(c => c.space_id && CONCLUDED.includes(c.status))
      .flatMap(c => [
        c.start_date && c.start_date >= weekEnd ? { date: c.start_date, kind: "move_in" as const, space_name: c.space_name, contract_id: c.id } : null,
        c.end_date && c.end_date >= weekEnd && c.status !== "Terminated" ? { date: c.end_date, kind: "move_out" as const, space_name: c.space_name, contract_id: c.id } : null,
      ])
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

    // ── 임대 현황(포트폴리오) ──
    const rentedUnits = new Set<number>();
    for (const c of contracts) {
      if (!c.space_id || !countable.has(c.space_id)) continue;
      if (!["Signed", "Active", "Completed", "Expired"].includes(c.status)) continue;
      if ((c.start_date || "0000-01-01") > today || (c.end_date || "9999-12-31") < today) continue;
      rentedUnits.add(c.space_id);
    }

    // ── 알림 ──
    const awaitingSignature = contracts.filter(c => c.status === "Sent").length;
    const expiringSoon = contracts.filter(c => LIVE.includes(c.status) && c.end_date && c.end_date >= today && c.end_date <= expirySoon).length;
    const pastEndStillLive = contracts.filter(c => LIVE.includes(c.status) && c.end_date && c.end_date < today).length;
    const draftsStale = contracts.filter(c => c.status === "Draft" && c.created_at < new Date(Date.now() - 7 * 86400_000)).length;

    const [overdue] = await db
      .select({ count: count(), amount: sql<string>`coalesce(sum(${invoicesTable.amount} + ${invoicesTable.tax_amount}), 0)` })
      .from(invoicesTable)
      .where(and(
        excludeConsolidated(),
        inArray(invoicesTable.status, ["Sent", "Overdue", "Unpaid"]),
        sql`${invoicesTable.due_date} < ${today}`,
      ));

    // 이번 달 수납액 — 결제일(paid_at, 없으면 생성일)이 이번 달인 결제 완료 청구서.
    // amount 는 공급가액, 세입자가 실제로 낸 금액은 amount + tax_amount.
    const [collected] = await db
      .select({ amount: sql<string>`coalesce(sum(${invoicesTable.amount} + ${invoicesTable.tax_amount}), 0)`, count: count() })
      .from(invoicesTable)
      .where(and(
        excludeConsolidated(),
        eq(invoicesTable.status, "Paid"),
        sql`to_char(coalesce(${invoicesTable.paid_at}, ${invoicesTable.created_at}) at time zone ${BILLING_TZ}, 'YYYY-MM') = ${month}`,
      ));

    // ── 최근 계약 ──
    const recent = [...contracts]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 6)
      .map(c => ({
        id: c.id, contract_ref: c.contract_ref, status: c.status, lease_mode: c.lease_mode,
        tenant_name: c.tenant_name ?? null, space_name: c.space_name ?? null,
        start_date: c.start_date || null, end_date: c.end_date || null,
        monthly_rent: c.actual_monthly_rent ?? c.monthly_rent ?? null,
        rate_amount: c.rate_amount ?? null, rate_period: c.rate_period ?? null,
        bond_amount: c.bond_amount ?? null, currency: c.currency,
      }));

    // ── 활동 피드 ──
    const logs = await db.select({
      id: systemLogsTable.id, entity_type: systemLogsTable.entity_type, entity_id: systemLogsTable.entity_id,
      action: systemLogsTable.action, actor_type: systemLogsTable.actor_type, actor_email: systemLogsTable.actor_email,
      new_value: systemLogsTable.new_value, created_at: systemLogsTable.created_at,
    }).from(systemLogsTable).orderBy(desc(systemLogsTable.created_at)).limit(10);
    const labels = await activityLabels(logs);
    const activity = logs.map(l => {
      const nv = (l.new_value ?? {}) as Record<string, unknown>;
      return {
        id: l.id, entity_type: l.entity_type, entity_id: l.entity_id, action: l.action,
        actor: l.actor_email ?? l.actor_type, created_at: l.created_at,
        label: labels.get(`${l.entity_type}:${l.entity_id}`) ?? null,
        new_status: typeof nv.status === "string" ? nv.status : null,
      };
    });

    res.json({
      today,
      month,
      calendar: { start: today, days: WINDOW_DAYS, move_ins: moveIns, move_outs: moveOuts, rows: calendarRows, next_event: nextEvent },
      alerts: {
        overdue_invoices: Number(overdue.count),
        overdue_amount: Number(overdue.amount),
        awaiting_signature: awaitingSignature,
        expiring_soon: expiringSoon,
        expiry_window_days: EXPIRY_ALERT_DAYS,
        past_end_still_live: pastEndStillLive,
        stale_drafts: draftsStale,
      },
      collected_this_month: { amount: Number(collected.amount), count: Number(collected.count) },
      portfolio: {
        total_units: countable.size,
        rented_units: rentedUnits.size,
        vacant_units: Math.max(0, countable.size - rentedUnits.size),
        live_contracts: contracts.filter(c => LIVE.includes(c.status)).length,
      },
      recent_contracts: recent,
      activity,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch overview board" });
  }
});

export default router;
