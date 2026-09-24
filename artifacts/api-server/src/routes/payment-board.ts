import { Router, type IRouter } from "express";
import { db, propertiesTable, spacesTable, accountsTable, invoicesTable, contractsTable } from "@workspace/db";
import { eq, count, and, sql, desc, isNull, inArray, ne } from "drizzle-orm";
import { countableUnitFilter } from "../lib/unitScope";
import { billingTodayIso } from "../lib/billing/billingDate";

// "입금 현황" 대시보드 탭 — 호실(행) × 월(열) 매트릭스. 각 칸은 그 호실에 걸린 계약들의
// 해당 월 청구서를 묶어 하나의 상태(완납·일부·연체·예정·미청구)로 요약한다.
// 청구 대상 월은 billing_period("YYYY-MM"), 비어 있으면 납기일의 연·월이다.
// 통합 청구서(부모)는 공간별 자식이 정본이라 제외하고, 무효(Void)도 뺀다.

const router: IRouter = Router();

type CellStatus = "paid" | "partial" | "overdue" | "due" | "unbilled";

const OPEN = new Set(["Sent", "Draft", "Overdue", "Unpaid"]);
/** 계약서 초안은 아직 임대가 아니다 — 호실의 세입자·기간으로 쓰지 않는다. */
const LIVE_CONTRACT = ["Active", "Completed", "Expired", "Terminated"];

const ym = (d: string | null | undefined) => (d && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null);

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 60; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** 계약 기간(개월) — 시작·종료일 사이의 달 수, 끝날이 시작일 전날이면 꽉 찬 달로 센다. */
function termMonths(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00Z`), e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null;
  const endPlus = new Date(e.getTime() + 86400000);
  return (endPlus.getUTCFullYear() - s.getUTCFullYear()) * 12 + (endPlus.getUTCMonth() - s.getUTCMonth());
}

router.get("/v1/dashboard/payment-board", async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const requestedPid = Number(q.property_id) || null;
    const today = billingTodayIso();
    const current = today.slice(0, 7);
    const back = Math.min(Math.max(Number(q.back) || 12, 1), 36);
    const ahead = Math.min(Math.max(Number(q.ahead) || 12, 1), 24);
    const months = monthsBetween(addMonths(current, -back), addMonths(current, ahead));

    const propAgg = await db
      .select({ property_id: spacesTable.property_id, name: propertiesTable.name, unit_count: count() })
      .from(spacesTable)
      .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
      .where(and(countableUnitFilter, sql`${spacesTable.property_id} is not null`))
      .groupBy(spacesTable.property_id, propertiesTable.name)
      .orderBy(desc(count()));
    const available_properties = propAgg.map((p) => ({
      id: Number(p.property_id),
      name: p.name ?? `#${p.property_id}`,
      unit_count: Number(p.unit_count),
    }));
    const pid = requestedPid && available_properties.some((p) => p.id === requestedPid)
      ? requestedPid
      : (available_properties[0]?.id ?? null);

    const empty = {
      property_id: pid, property_name: null, available_properties, today, current_month: current, months,
      currency: null, units: [],
      summary: { total_units: 0, occupied_units: 0, month_billed: 0, month_collected: 0, month_outstanding: 0, overdue_total: 0, overdue_units: 0 },
    };
    if (pid == null) { res.json(empty); return; }

    const spaces = await db
      .select({ id: spacesTable.id, name: spacesTable.name, floor: spacesTable.floor_number, status: spacesTable.status })
      .from(spacesTable)
      .where(and(eq(spacesTable.property_id, pid), countableUnitFilter));
    const spaceIds = spaces.map((s) => s.id);
    if (spaceIds.length === 0) { res.json({ ...empty, property_name: available_properties.find((p) => p.id === pid)?.name ?? null }); return; }

    const contracts = await db
      .select({
        id: contractsTable.id,
        contract_ref: contractsTable.contract_ref,
        space_id: contractsTable.space_id,
        status: contractsTable.status,
        contract_date: contractsTable.contract_date,
        start_date: contractsTable.start_date,
        end_date: contractsTable.end_date,
        monthly_rent: contractsTable.monthly_rent,
        actual_monthly_rent: contractsTable.actual_monthly_rent,
        bond_amount: contractsTable.bond_amount,
        rent_due_day: contractsTable.rent_due_day,
        currency: contractsTable.currency,
        tenant_account_id: contractsTable.tenant_account_id,
        tenant_name: accountsTable.name,
      })
      .from(contractsTable)
      .leftJoin(accountsTable, eq(accountsTable.id, contractsTable.tenant_account_id))
      .where(and(
        isNull(contractsTable.deleted_at),
        inArray(contractsTable.space_id, spaceIds),
        inArray(contractsTable.status, LIVE_CONTRACT),
      ));
    const contractIds = contracts.map((c) => c.id);

    const invoices = contractIds.length
      ? await db
          .select({
            id: invoicesTable.id,
            invoice_ref: invoicesTable.invoice_ref,
            contract_id: invoicesTable.contract_id,
            account_id: invoicesTable.account_id,
            status: invoicesTable.status,
            amount: invoicesTable.amount,
            tax_amount: invoicesTable.tax_amount,
            currency: invoicesTable.currency,
            billing_period: invoicesTable.billing_period,
            due_date: invoicesTable.due_date,
            paid_at: invoicesTable.paid_at,
          })
          .from(invoicesTable)
          .where(and(
            isNull(invoicesTable.deleted_at),
            inArray(invoicesTable.contract_id, contractIds),
            ne(invoicesTable.invoice_kind, "consolidated"),
            ne(invoicesTable.status, "Void"),
          ))
      : [];

    const contractsBySpace = new Map<number, typeof contracts>();
    for (const c of contracts) {
      const arr = contractsBySpace.get(c.space_id!) ?? [];
      arr.push(c);
      contractsBySpace.set(c.space_id!, arr);
    }
    const spaceOfContract = new Map(contracts.map((c) => [c.id, c.space_id!]));

    type Inv = {
      id: number; invoice_ref: string; contract_id: number | null; account_id: number | null; status: string;
      amount: number; total: number; currency: string; month: string; due_date: string | null;
      paid_at: string | null; overdue: boolean;
    };
    const invBySpace = new Map<number, Inv[]>();
    for (const r of invoices) {
      const month = ym(r.billing_period) ?? ym(r.due_date);
      if (!month) continue;
      const sid = spaceOfContract.get(r.contract_id!);
      if (sid == null) continue;
      const total = Math.round((Number(r.amount ?? 0) + Number(r.tax_amount ?? 0)) * 100) / 100;
      const open = OPEN.has(r.status);
      const inv: Inv = {
        id: r.id, invoice_ref: r.invoice_ref, contract_id: r.contract_id, account_id: r.account_id, status: r.status,
        amount: Number(r.amount ?? 0), total, currency: r.currency, month, due_date: r.due_date,
        paid_at: r.paid_at ? r.paid_at.toISOString() : null,
        overdue: open && (r.status === "Overdue" || (!!r.due_date && r.due_date < today)),
      };
      const arr = invBySpace.get(sid) ?? [];
      arr.push(inv);
      invBySpace.set(sid, arr);
    }

    const covers = (c: { start_date: string | null; end_date: string | null }, month: string) =>
      !!c.start_date && ym(c.start_date)! <= month && (!c.end_date || ym(c.end_date)! >= month);

    // 호실의 "현재" 계약: 오늘을 덮는 진행 중 계약 → 곧 시작할 진행 중 계약 → 가장 최근에 끝난 계약.
    function pickCurrent(list: typeof contracts) {
      const active = list.filter((c) => c.status === "Active");
      const running = active.find((c) => (c.start_date ?? "") <= today && (!c.end_date || c.end_date >= today));
      if (running) return { contract: running, occupied: true };
      const upcoming = active
        .filter((c) => (c.start_date ?? "") > today)
        .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0];
      if (upcoming) return { contract: upcoming, occupied: false };
      const last = [...list].sort((a, b) => (b.end_date ?? b.start_date ?? "").localeCompare(a.end_date ?? a.start_date ?? ""))[0];
      return { contract: last ?? null, occupied: false };
    }

    let monthBilled = 0, monthCollected = 0, overdueTotal = 0, overdueUnits = 0, occupied = 0;
    const currencyCount = new Map<string, number>();

    const units = spaces.map((s) => {
      const list = contractsBySpace.get(s.id) ?? [];
      const { contract: cur, occupied: isOccupied } = pickCurrent(list);
      if (isOccupied) occupied++;
      const invs = (invBySpace.get(s.id) ?? []).sort((a, b) => (a.due_date ?? a.month).localeCompare(b.due_date ?? b.month));
      for (const i of invs) currencyCount.set(i.currency, (currencyCount.get(i.currency) ?? 0) + 1);

      const cells: Record<string, { status: CellStatus; total: number; paid: number; invoices: Inv[] }> = {};
      for (const m of months) {
        const mine = invs.filter((i) => i.month === m);
        if (mine.length === 0) {
          // 계약 기간 안인데 청구서가 없는 달 — 이번 달까지만 "미청구"로 표시한다(앞으로 올 달은 아직 발행 전).
          if (m <= current && list.some((c) => c.status !== "Terminated" && covers(c, m))) {
            cells[m] = { status: "unbilled", total: 0, paid: 0, invoices: [] };
          }
          continue;
        }
        const total = mine.reduce((a, i) => a + i.total, 0);
        const paid = mine.filter((i) => i.status === "Paid").reduce((a, i) => a + i.total, 0);
        const status: CellStatus = mine.some((i) => i.overdue)
          ? "overdue"
          // 금액이 아니라 상태로 판단한다 — 0원짜리 미결 청구서가 "완납"으로 보이면 안 된다.
          : mine.every((i) => i.status === "Paid") ? "paid"
          : mine.some((i) => i.status === "Paid") ? "partial"
          : "due";
        cells[m] = { status, total, paid, invoices: mine };
        if (m === current) { monthBilled += total; monthCollected += paid; }
      }

      const overdueInvs = invs.filter((i) => i.overdue);
      const unitOverdue = overdueInvs.reduce((a, i) => a + i.total, 0);
      if (unitOverdue > 0) { overdueTotal += unitOverdue; overdueUnits++; }

      return {
        id: s.id,
        name: s.name,
        unit_label: (s.name ?? "").replace(/\s*·.*$/, "").replace(/호$/, "").trim() || s.name,
        floor: s.floor != null ? Number(s.floor) : null,
        space_status: s.status,
        occupied: isOccupied,
        contract: cur
          ? {
              id: cur.id,
              contract_ref: cur.contract_ref,
              status: cur.status,
              contract_date: cur.contract_date,
              start_date: cur.start_date,
              end_date: cur.end_date,
              term_months: termMonths(cur.start_date, cur.end_date),
              monthly_rent: cur.actual_monthly_rent ?? cur.monthly_rent ?? null,
              deposit: cur.bond_amount ?? null,
              rent_due_day: cur.rent_due_day,
              currency: cur.currency,
              tenant_account_id: cur.tenant_account_id,
              tenant_name: cur.tenant_name,
            }
          : null,
        overdue_total: unitOverdue,
        overdue_count: overdueInvs.length,
        cells,
      };
    });

    // 호실 번호순(숫자 우선) — "101", "1203" 처럼 층을 앞에 둔 번호가 자연스럽게 정렬된다.
    units.sort((a, b) => {
      const na = Number(a.unit_label), nb = Number(b.unit_label);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.unit_label).localeCompare(String(b.unit_label), "ko");
    });

    const currency = [...currencyCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      ?? contracts[0]?.currency ?? null;

    res.json({
      property_id: pid,
      property_name: available_properties.find((p) => p.id === pid)?.name ?? null,
      available_properties,
      today,
      current_month: current,
      months,
      currency,
      units,
      summary: {
        total_units: units.length,
        occupied_units: occupied,
        month_billed: monthBilled,
        month_collected: monthCollected,
        month_outstanding: Math.max(0, monthBilled - monthCollected),
        overdue_total: overdueTotal,
        overdue_units: overdueUnits,
      },
    });
  } catch (err) {
    console.error("payment-board failed", err);
    res.status(500).json({ error: "Failed to fetch payment board" });
  }
});

export default router;
