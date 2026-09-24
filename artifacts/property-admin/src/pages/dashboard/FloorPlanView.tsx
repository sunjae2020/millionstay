import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Map as MapIcon, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useBrand } from "@/contexts/ThemeContext";
import { DashCard } from "@/components/dashboard/DashboardKit";

// "도면별" 보기 — 층 하나를 복도 양쪽에 호실이 늘어선 평면 도식으로 그리고, 옆 표에
// 같은 층 호실의 세입자·월세·최근 12개월 납부 현황을 보여 준다. 실제 도면 좌표는
// 없으므로 호수 순서대로 위·아래 두 줄에 나누고, 칸 폭은 전용면적에 비례시킨다.
// 납부 데이터는 입금 현황 보드(/dashboard/payment-board)와 같은 원천을 쓴다.

export interface PlanUnit {
  id: number;
  name: string;
  unit_label: string;
  floor: number;
  type: string;
  status: string;
  owner: string | null;
  area?: number | null;
}

type CellStatus = "paid" | "partial" | "overdue" | "due" | "unbilled";
interface PayCell { status: CellStatus; total: number; paid: number }
interface PayUnit {
  id: number;
  occupied: boolean;
  overdue_total: number;
  contract: { monthly_rent: number | null; currency: string; tenant_name: string | null } | null;
  cells: Record<string, PayCell>;
}
interface PayBoard {
  current_month: string;
  months: string[];
  currency: string | null;
  units: PayUnit[];
}

const CELL_STYLE: Record<CellStatus, string> = {
  paid: "bg-green-600",
  partial: "bg-amber-500",
  overdue: "bg-red-600",
  due: "bg-slate-300 dark:bg-slate-600",
  unbilled: "border border-dashed border-muted-foreground/40",
};

type RowState = "current" | "overdue" | "vacant";
const ROW_STATE_STYLE: Record<RowState, string> = {
  current: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  vacant: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const byLabel = (a: PlanUnit, b: PlanUnit) => {
  const na = Number(a.unit_label), nb = Number(b.unit_label);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.unit_label.localeCompare(b.unit_label);
};

export default function FloorPlanView({
  propertyId, floors, units, statusColor, statusLabel,
}: {
  propertyId: number | null;
  floors: number[];
  units: PlanUnit[];
  statusColor: (status: string) => string;
  statusLabel: (status: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const { currency: brandCurrency, currencyPosition } = useBrand();
  const [floor, setFloor] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [pay, setPay] = useState<PayBoard | null>(null);
  const [payLoading, setPayLoading] = useState(true);

  // 매물이 바뀌면 첫 층으로 돌아간다.
  useEffect(() => {
    setFloor((f) => (f != null && floors.includes(f) ? f : floors[0] ?? null));
  }, [floors]);

  useEffect(() => {
    if (propertyId == null) return;
    setPayLoading(true);
    apiFetch(`/api/v1/dashboard/payment-board?property_id=${propertyId}&back=11&ahead=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: PayBoard | null) => setPay(b))
      .catch(() => setPay(null))
      .finally(() => setPayLoading(false));
  }, [propertyId]);

  const floorUnits = useMemo(
    () => units.filter((u) => u.floor === floor).sort(byLabel),
    [units, floor],
  );
  // 복도 위·아래 두 줄 — 위 줄이 한 칸 더 많게.
  const half = Math.ceil(floorUnits.length / 2);
  const rows = [floorUnits.slice(0, half), floorUnits.slice(half)];

  const payById = useMemo(() => new Map((pay?.units ?? []).map((u) => [u.id, u])), [pay]);
  const months = useMemo(() => {
    if (!pay) return [];
    return pay.months.filter((m) => m <= pay.current_month).slice(-12);
  }, [pay]);

  const legend = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of floorUnits) m.set(u.status, (m.get(u.status) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [floorUnits]);

  const money = (n: number | null | undefined, cur?: string | null) =>
    n == null ? "—" : formatMoney(n, cur ?? pay?.currency ?? brandCurrency, currencyPosition);
  const monthShort = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(new Date(y, mo - 1, 1));
  };
  const rowState = (p: PayUnit | undefined): RowState =>
    !p ? "vacant" : p.overdue_total > 0 ? "overdue" : p.occupied ? "current" : "vacant";
  const rowStateLabel: Record<RowState, string> = {
    current: t("dash_floorboard.st_current", "Current"),
    overdue: t("dash_floorboard.st_overdue", "Past due"),
    vacant: t("dash_floorboard.st_vacant", "Vacant"),
  };

  const idx = floor == null ? -1 : floors.indexOf(floor);
  const go = (d: number) => {
    const next = floors[idx + d];
    if (next != null) { setFloor(next); setHighlight(null); }
  };

  const hovered = hoverId != null ? floorUnits.find((u) => u.id === hoverId) ?? null : null;
  const hoveredPay = hovered ? payById.get(hovered.id) : undefined;

  return (
    <div className="space-y-4">
      {/* 층 선택 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={idx <= 0}
          aria-label={t("dash_floorboard.prev_floor", "Previous floor")}
          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border bg-card disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="inline-flex gap-1">
            {floors.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFloor(f); setHighlight(null); }}
                className={cn(
                  "h-8 min-w-[40px] px-2 rounded-lg border text-xs font-semibold transition-colors",
                  f === floor ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f}F
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={idx < 0 || idx >= floors.length - 1}
          aria-label={t("dash_floorboard.next_floor", "Next floor")}
          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border bg-card disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* 평면 도식 */}
        <DashCard
          title={`${t("dash_floorboard.plan_title", "Floor plan")} · ${floor ?? "—"}F`}
          icon={MapIcon}
          bodyClass="p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {legend.map(([key, n]) => {
              const on = highlight === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHighlight(on ? null : key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-all",
                    on && "ring-2 ring-primary/40",
                    highlight != null && !on && "opacity-40",
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: statusColor(key) }} />
                  {statusLabel(key)}
                  <span className="text-muted-foreground">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="relative overflow-x-auto">
            <div
              className="rounded-md border-4 border-slate-500 dark:border-slate-400 bg-slate-500 dark:bg-slate-400 p-1 space-y-0"
              style={{ minWidth: Math.max(rows[0].length, 1) * 60 }}
            >
              {rows.map((row, ri) => (
                <div key={ri}>
                  {ri === 1 && (
                    <div className="my-1 h-9 rounded-sm bg-muted flex items-center justify-center text-[11px] tracking-widest text-muted-foreground">
                      {t("dash_floorboard.corridor", "Corridor")}
                    </div>
                  )}
                  <div className="flex gap-1">
                    {row.map((u) => {
                      const dimmed = highlight != null && highlight !== u.status;
                      return (
                        <Link
                          key={u.id}
                          href={`/property/spaces/${u.id}`}
                          onMouseEnter={() => setHoverId(u.id)}
                          onMouseLeave={() => setHoverId(null)}
                          onFocus={() => setHoverId(u.id)}
                          onBlur={() => setHoverId(null)}
                          className={cn(
                            "h-20 min-w-[52px] rounded-sm flex flex-col items-center justify-center text-white transition-all",
                            hoverId === u.id && "ring-2 ring-offset-1 ring-primary brightness-110",
                            dimmed && "opacity-25",
                          )}
                          style={{ background: statusColor(u.status), flex: `${u.area && u.area > 0 ? u.area : 30} 1 0` }}
                        >
                          <span className="text-xs font-bold leading-tight">{u.unit_label}</span>
                          <span className="text-[10px] opacity-90 leading-tight truncate max-w-full px-1">{u.type}</span>
                        </Link>
                      );
                    })}
                    {/* 아래 줄이 짧으면 빈 벽으로 채워 위 줄과 폭을 맞춘다 */}
                    {ri === 1 && row.length < rows[0].length && (
                      <div style={{ flex: `${(rows[0].length - row.length) * 30} 1 0` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 선택 호실 요약 */}
          <div className="min-h-[52px] rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            {hovered ? (
              <div className="space-y-0.5">
                <div className="font-semibold">
                  {hovered.name} · {hovered.type}
                  {hovered.area ? ` · ${hovered.area.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}㎡` : ""}
                </div>
                <div className="text-muted-foreground">
                  {statusLabel(hovered.status)}
                  {hoveredPay?.contract?.tenant_name ? ` · ${hoveredPay.contract.tenant_name}` : ""}
                  {hoveredPay?.contract?.monthly_rent != null ? ` · ${money(hoveredPay.contract.monthly_rent, hoveredPay.contract.currency)}` : ""}
                  {hovered.owner ? ` · ${hovered.owner}` : ""}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">{t("dash_floorboard.plan_note", "Schematic layout — units in number order, width scaled to exclusive area. Hover a unit for details, click to open it.")}</span>
            )}
          </div>
        </DashCard>

        {/* 층 호실 납부 표 */}
        <DashCard
          title={`${t("dash_floorboard.pay_title", "Rent payments")} · ${floor ?? "—"}F`}
          icon={Wallet}
          bodyClass="p-0"
        >
          {payLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">{t("dash_floorboard.loading", "Loading…")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">{t("dash_floorboard.col_unit", "Unit")}</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">{t("dash_floorboard.col_tenant", "Tenant")}</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap text-right">{t("dash_floorboard.col_rent", "Rent")}</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">{t("dash_floorboard.col_status", "Status")}</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">
                      <div>{t("dash_floorboard.col_months", "Last 12 months")}</div>
                      <div className="mt-1 flex gap-0.5 font-normal text-[9px] text-muted-foreground">
                        {months.map((m) => (
                          <span key={m} className="w-5 text-center truncate">{monthShort(m)}</span>
                        ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {floorUnits.map((u) => {
                    const p = payById.get(u.id);
                    const st = rowState(p);
                    return (
                      <tr
                        key={u.id}
                        onMouseEnter={() => setHoverId(u.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className={cn(
                          "border-t transition-colors",
                          hoverId === u.id && "bg-primary/5",
                          highlight != null && highlight !== u.status && "opacity-40",
                        )}
                      >
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">
                          <Link href={`/property/spaces/${u.id}`} className="hover:underline">{u.unit_label}</Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate">{p?.contract?.tenant_name ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                          {money(p?.contract?.monthly_rent, p?.contract?.currency)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", ROW_STATE_STYLE[st])}>
                            {rowStateLabel[st]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-0.5">
                            {months.map((m) => {
                              const c = p?.cells[m];
                              const s: CellStatus = c?.status ?? "unbilled";
                              return (
                                <span
                                  key={m}
                                  title={`${m} · ${t(`dash_payboard.status_${s}`, s)}${c && c.total ? ` · ${money(c.total)}` : ""}`}
                                  className={cn("h-4 w-5 rounded-sm", CELL_STYLE[s])}
                                />
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
                {(Object.keys(CELL_STYLE) as CellStatus[]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className={cn("h-2.5 w-3 rounded-sm", CELL_STYLE[s])} />
                    {t(`dash_payboard.status_${s}`, s)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}
