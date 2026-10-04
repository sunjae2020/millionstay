import { forwardRef, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { LogOut, Check, Circle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DashCard, Pill } from "@/components/dashboard/DashboardKit";
import { ExportableTable } from "@/components/ui/ExportCsvButton";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { matchesQuery } from "@/lib/search";

// 퇴거 세대 보드 — 계약/퇴거 현황 탭 하단. 행 = 퇴거 예정·퇴거 완료 세대(서버 /dashboard/lease-status
// 의 move_outs), 칸 = 세대점검표 퇴거 점검 → 보증금 정산(작성 → 확인 요청 → 임차인 확인 → 확정).
// 행을 누르면 그 계약의 퇴거세대 정산 탭이 열린다.

export interface MoveOutRow {
  contract_id: number;
  contract_ref: string;
  contract_status: string;
  phase: "ongoing" | "moving_out" | "moved_out";
  space_id: number | null;
  space_name: string | null;
  property_name: string | null;
  tenant_name: string | null;
  start_date: string | null;
  end_date: string | null;
  renewed_by: string | null;
  inspection: { id: number; state: "in_progress" | "done" } | null;
  settlement: {
    id: number;
    settlement_ref: string;
    status: "draft" | "proposed" | "tenant_ack" | "finalized";
    deposit_held: number;
    total_deducted: number;
    refund_amount: number;
    currency: string;
    as_of_date: string | null;
    finalized_at: string | null;
  } | null;
}

export type MoveOutView = "moving_out" | "moved_out" | "settling" | "settled";
type Period = "month" | "3m" | "12m";

// 정산 단계 순서 — 정산서가 없으면 0단계(미작성).
const SETTLEMENT_STEPS = ["draft", "proposed", "tenant_ack", "finalized"] as const;

function stepIndex(row: MoveOutRow): number {
  return row.settlement ? SETTLEMENT_STEPS.indexOf(row.settlement.status) + 1 : 0;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

function periodStart(today: string, period: Period): string {
  if (period === "month") return today.slice(0, 7) + "-01";
  const d = new Date(today + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - (period === "3m" ? 3 : 12));
  return d.toISOString().slice(0, 10);
}

export const MoveOutBoard = forwardRef<HTMLDivElement, {
  rows: MoveOutRow[] | undefined;
  today: string | undefined;
  loading: boolean;
  view: MoveOutView;
  onViewChange: (v: MoveOutView) => void;
}>(function MoveOutBoard({ rows, today: todayProp, loading, view, onViewChange }, ref) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { currencyPosition } = useBrand();
  const [period, setPeriod] = useState<Period>("month");
  const [search, setSearch] = useState("");
  const today = todayProp ?? new Date().toISOString().slice(0, 10);

  const groups = useMemo(() => {
    const all = rows ?? [];
    const since = periodStart(today, period);
    // 퇴거 완료는 기간 필터를 탄다. 정산 진행중은 기간과 상관없이 끝나지 않은 건 전부.
    return {
      moving_out: all.filter(r => r.phase === "moving_out"),
      moved_out: all.filter(r => r.phase === "moved_out" && (!r.end_date || r.end_date >= since)),
      settling: all.filter(r => r.settlement?.status !== "finalized" && (r.settlement || r.phase === "moved_out")),
      settled: all.filter(r => r.settlement?.status === "finalized"),
    } satisfies Record<MoveOutView, MoveOutRow[]>;
  }, [rows, today, period]);

  const visible = groups[view].filter(r => matchesQuery(search, r.space_name, r.tenant_name, r.contract_ref, r.settlement?.settlement_ref));
  // 퇴거 예정은 가까운 순, 나머지는 최근 퇴거가 위로.
  const sorted = [...visible].sort((a, b) => {
    const cmp = (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999");
    return view === "moving_out" ? cmp : -cmp;
  });

  const views: { id: MoveOutView; label: string }[] = [
    { id: "moving_out", label: t("dash_reservations.mo_view_moving_out") },
    { id: "moved_out", label: t("dash_reservations.mo_view_moved_out") },
    { id: "settling", label: t("dash_reservations.mo_view_settling") },
    { id: "settled", label: t("dash_reservations.mo_view_settled") },
  ];
  const stepLabels = [
    t("dash_reservations.mo_step_draft"),
    t("dash_reservations.mo_step_proposed"),
    t("dash_reservations.mo_step_tenant_ack"),
    t("dash_reservations.mo_step_finalized"),
  ];

  const dday = (r: MoveOutRow) => {
    if (!r.end_date) return null;
    const n = daysBetween(today, r.end_date);
    if (n === 0) return <Pill className="bg-amber-100 text-amber-800">{t("dash_reservations.mo_dday_today")}</Pill>;
    if (n > 0) return <Pill className={n <= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}>D-{n}</Pill>;
    return <span className="text-[10px] text-muted-foreground">{t("dash_reservations.mo_days_ago", { n: -n })}</span>;
  };

  const inspectionCell = (r: MoveOutRow) => {
    if (!r.inspection) return <Pill className="bg-slate-100 text-slate-500">{t("dash_reservations.mo_insp_none")}</Pill>;
    return r.inspection.state === "done"
      ? <Pill className="bg-green-100 text-green-700">{t("dash_reservations.mo_insp_done")}</Pill>
      : <Pill className="bg-blue-100 text-blue-700">{t("dash_reservations.mo_insp_in_progress")}</Pill>;
  };

  const stepsCell = (r: MoveOutRow) => {
    const idx = stepIndex(r);
    return (
      <div className="flex items-center gap-1" title={idx === 0 ? t("dash_reservations.mo_step_none") : stepLabels[idx - 1]}>
        {stepLabels.map((label, i) => {
          const done = i < idx;
          return (
            <div key={label} className="flex items-center gap-1">
              {i > 0 && <div className={`h-px w-2 ${done ? "bg-green-500" : "bg-border"}`} />}
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] whitespace-nowrap ${done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="h-2.5 w-2.5" /> : <Circle className="h-2 w-2" />}
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const money = (v: number | undefined, currency: string | undefined) =>
    v == null ? "—" : formatMoney(v, currency, currencyPosition);

  return (
    <div ref={ref}>
      <DashCard
        title={t("dash_reservations.mo_board_title")}
        icon={LogOut}
        bodyClass="p-0"
      >
        <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
            {views.map(v => (
              <button
                key={v.id}
                onClick={() => onViewChange(v.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === v.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v.label}
                <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${view === v.id ? "bg-primary/10 text-primary" : "bg-muted"}`}>{groups[v.id].length}</span>
              </button>
            ))}
          </div>
          {view === "moved_out" && (
            <div className="flex gap-1">
              {(["month", "3m", "12m"] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${period === p ? "border-primary text-primary bg-primary/5" : "text-muted-foreground"}`}
                >
                  {t(`dash_reservations.mo_period_${p}`)}
                </button>
              ))}
            </div>
          )}
          <div className="relative ml-auto min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("dash_reservations.mo_search")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <div className="overflow-auto">
          <ExportableTable fileName="move-out-board" className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {[
                  t("dash_reservations.mo_col_unit"),
                  t("dash_reservations.mo_col_tenant"),
                  t("dash_reservations.mo_col_contract"),
                  t("dash_reservations.mo_col_end_date"),
                  t("dash_reservations.mo_col_inspection"),
                  t("dash_reservations.mo_col_settlement"),
                  t("dash_reservations.mo_col_deposit"),
                  t("dash_reservations.mo_col_deducted"),
                  t("dash_reservations.mo_col_refund"),
                ].map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-muted-foreground font-medium whitespace-nowrap ${i >= 6 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && !rows ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">{t("dash_reservations.mo_empty")}</td></tr>
              ) : sorted.map(r => (
                <tr
                  key={r.contract_id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/booking/contracts/${r.contract_id}?tab=move-out`)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.space_name ?? "—"}</div>
                    {r.property_name && <div className="text-[10px] text-muted-foreground">{r.property_name}</div>}
                  </td>
                  <td className="px-3 py-2">{r.tenant_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.contract_ref}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{r.end_date ? formatDate(r.end_date) : "—"}</span>
                      {dday(r)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{inspectionCell(r)}</td>
                  <td className="px-3 py-2">
                    {stepsCell(r)}
                    {r.settlement && <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">{r.settlement.settlement_ref}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.settlement?.deposit_held, r.settlement?.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.settlement ? money(r.settlement.total_deducted, r.settlement.currency) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(r.settlement?.refund_amount, r.settlement?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </ExportableTable>
        </div>
      </DashCard>
    </div>
  );
});
