import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  Wallet, Receipt, AlertTriangle, DoorOpen, Search, Plus, FileText, Eye, CheckCircle2,
  ExternalLink, Home, Wrench, CalendarClock, X, Columns3, Crosshair,
} from "lucide-react";
import { usePayInvoice } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/apiFetch";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useBrand } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { KpiCard, DashCard } from "@/components/dashboard/DashboardKit";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CellStatus = "paid" | "partial" | "overdue" | "due" | "unbilled";

interface BoardInvoice {
  id: number;
  invoice_ref: string;
  contract_id: number | null;
  account_id: number | null;
  status: string;
  amount: number;
  total: number;
  currency: string;
  month: string;
  due_date: string | null;
  paid_at: string | null;
  overdue: boolean;
}
interface BoardCell { status: CellStatus; total: number; paid: number; invoices: BoardInvoice[] }
interface BoardContract {
  id: number;
  contract_ref: string;
  status: string;
  contract_date: string | null;
  start_date: string | null;
  end_date: string | null;
  term_months: number | null;
  monthly_rent: number | null;
  deposit: number | null;
  rent_due_day: number | null;
  currency: string;
  tenant_account_id: number | null;
  tenant_name: string | null;
}
interface BoardUnit {
  id: number;
  name: string;
  unit_label: string;
  floor: number | null;
  space_status: string | null;
  occupied: boolean;
  contract: BoardContract | null;
  overdue_total: number;
  overdue_count: number;
  cells: Record<string, BoardCell>;
}
interface Board {
  property_id: number | null;
  property_name: string | null;
  available_properties: { id: number; name: string; unit_count: number }[];
  today: string;
  current_month: string;
  months: string[];
  currency: string | null;
  units: BoardUnit[];
  summary: {
    total_units: number;
    occupied_units: number;
    month_billed: number;
    month_collected: number;
    month_outstanding: number;
    overdue_total: number;
    overdue_units: number;
  };
}

type Filter = "all" | "overdue" | "vacant";

const STATUS_STYLE: Record<CellStatus, string> = {
  paid: "bg-green-600 text-white",
  partial: "bg-amber-500 text-white",
  overdue: "bg-red-600 text-white",
  due: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  unbilled: "border border-dashed border-muted-foreground/40 text-muted-foreground",
};
const STATUS_DOT: Record<CellStatus, string> = {
  paid: "bg-green-600",
  partial: "bg-amber-500",
  overdue: "bg-red-600",
  due: "bg-slate-400",
  unbilled: "border border-dashed border-muted-foreground",
};
const STATUS_ORDER: CellStatus[] = ["paid", "partial", "overdue", "due", "unbilled"];

/** 청구서 자체의 상태 배지(패널용) — 목록 화면과 같은 색. */
const INVOICE_STATUS_STYLE: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700",
  Unpaid: "bg-red-100 text-red-700",
};

/** 정보 열 보기/숨기기는 사용자별로 저장한다(리스트 컬럼 설정과 같은 table-prefs 저장소). */
const PREFS_KEY = "payment-board";

/** 정보 열 폭(px) — 가로 스크롤 때 고정(sticky) 위치를 계산하는 데 쓴다. */
const COL_W = { unit: 72, tenant: 116, contract_date: 88, period: 100, rent: 92, term: 56, deposit: 100 };

type InfoKey = keyof typeof COL_W;
const INFO_KEYS = Object.keys(COL_W) as InfoKey[];

export default function PaymentBoardTab() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { currency: brandCurrency, currencyPosition } = useBrand();

  const [board, setBoard] = useState<Board | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [hidden, setHidden] = useState<Set<InfoKey>>(new Set());
  const [selected, setSelected] = useState<{ unitId: number; month: string } | null>(null);
  const [payTarget, setPayTarget] = useState<BoardInvoice | null>(null);
  const [payMethod, setPayMethod] = useState("BankTransfer");
  const [payDate, setPayDate] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentThRef = useRef<HTMLTableCellElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = pid != null ? `?property_id=${pid}` : "";
    return apiFetch(`/api/v1/dashboard/payment-board${qs}`)
      .then((r) => r.json())
      .then((b: Board) => {
        setBoard(b);
        if (pid == null && b.property_id != null) setPid(b.property_id);
      })
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/v1/table-prefs/${PREFS_KEY}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const saved = body?.data?.hidden;
        if (!cancelled && Array.isArray(saved)) {
          setHidden(new Set(saved.filter((k: string): k is InfoKey => (INFO_KEYS as string[]).includes(k))));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const saveHidden = (next: Set<InfoKey>) => {
    setHidden(next);
    void apiFetch(`/api/v1/table-prefs/${PREFS_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: [], hidden: [...next], widths: {} }),
    }).catch(() => {});
  };
  const toggleCol = (k: InfoKey, show: boolean) => {
    const next = new Set(hidden);
    if (show) next.delete(k); else next.add(k);
    saveHidden(next);
  };

  const money = (n: number | null | undefined, cur?: string | null) =>
    n == null ? "—" : formatMoney(n, cur ?? board?.currency ?? brandCurrency, currencyPosition);

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    const month = new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(new Date(Number(y), Number(mo) - 1, 1));
    return { year: y, month };
  };
  const statusLabel = (s: CellStatus) => t(`dash_payboard.status_${s}`, s);

  // 정보 열 — 체크박스로 고른 열만 보인다. 보이는 열은 가로 스크롤 때 왼쪽에 고정된다.
  const colLabels: Record<InfoKey, string> = {
    unit: t("dash_payboard.col_unit", "Unit"),
    tenant: t("dash_payboard.col_tenant", "Tenant"),
    contract_date: t("dash_payboard.col_contract_date", "Signed"),
    period: t("dash_payboard.col_period", "Start / End"),
    rent: t("dash_payboard.col_rent", "Rent"),
    term: t("dash_payboard.col_term", "Term"),
    deposit: t("dash_payboard.col_deposit", "Deposit"),
  };
  const infoCols = useMemo(() => {
    let left = 0;
    return INFO_KEYS.filter((k) => !hidden.has(k)).map((key, i) => {
      const out = { key, label: colLabels[key], left, width: COL_W[key], first: i === 0 };
      left += COL_W[key];
      return out;
    });
  }, [hidden, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const stickyWidth = infoCols.reduce((a, c) => a + c.width, 0);

  const units = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (board?.units ?? []).filter((u) => {
      if (filter === "overdue" && u.overdue_total <= 0) return false;
      if (filter === "vacant" && u.occupied) return false;
      if (!needle) return true;
      return (
        u.name.toLowerCase().includes(needle) ||
        String(u.unit_label).toLowerCase().includes(needle) ||
        (u.contract?.tenant_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [board, q, filter]);

  // 처음 그릴 때 이번 달이 정보 열 바로 옆 첫 칸에 오도록 가로 스크롤을 맞춘다.
  // 이전 달은 왼쪽, 남은 달은 오른쪽으로 스크롤하면 보인다.
  const scrollToCurrent = useCallback(() => {
    const box = scrollRef.current, th = currentThRef.current;
    if (!box || !th) return;
    // offsetLeft 는 표가 아닌 다른 조상 기준일 수 있어, 화면 좌표 차이로 계산한다.
    const delta = th.getBoundingClientRect().left - box.getBoundingClientRect().left - stickyWidth;
    box.scrollLeft = Math.max(0, box.scrollLeft + delta);
  }, [stickyWidth]);

  useLayoutEffect(() => {
    if (!board || loading) return;
    const key = `${board.property_id}|${[...hidden].sort().join()}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    scrollToCurrent();
  }, [board, loading, hidden, scrollToCurrent]);

  const selUnit = selected ? board?.units.find((u) => u.id === selected.unitId) ?? null : null;
  const selCell = selUnit && selected ? selUnit.cells[selected.month] ?? null : null;
  // "최근 활동" — 선택한 호실의 최근 청구서 8건(오늘 이후 납기 제외).
  const recent = useMemo(() => {
    if (!selUnit || !board) return [];
    return Object.values(selUnit.cells)
      .flatMap((c) => c.invoices)
      .filter((i) => (i.due_date ?? `${i.month}-01`) <= board.today)
      .sort((a, b) => (b.due_date ?? b.month).localeCompare(a.due_date ?? a.month))
      .slice(0, 8);
  }, [selUnit, board]);

  const select = (unitId: number, month: string) => {
    setSelected({ unitId, month });
    // 좁은 화면에서는 패널이 표 아래에 있으니 그쪽으로 내려 준다.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  // ── 문서 미리보기 + 메일 (청구서는 발송 엔드포인트가 있다) ─────────────────
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const previewInvoice = (inv: BoardInvoice) => {
    const typeLabel = t("nav.invoice", "Invoice");
    openPreview({
      title: `${inv.invoice_ref} · ${typeLabel}`,
      filename: `${inv.invoice_ref}.pdf`,
      source: { kind: "api", path: `/api/v1/invoices/${inv.id}/pdf` },
      email: {
        recipientsPath: `/api/v1/invoices/${inv.id}/email-recipients`,
        send: async (to: string[]) => {
          const res = await apiFetch(`/api/v1/invoices/${inv.id}/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            const msg = body?.error ?? `HTTP ${res.status}`;
            toast({ title: t("document_hub.email_failed", "Email failed"), description: msg, variant: "destructive" });
            throw new Error(msg);
          }
          toast({
            title: t("document_hub.email_sent", "Email sent"),
            description: t("document_hub.email_sent_desc", "{{type}} emailed to {{recipient}}.", { type: typeLabel, recipient: to.join(", ") }),
          });
        },
      },
    });
  };

  // ── 입금 확인 ─────────────────────────────────────────────────────────────
  const payMutation = usePayInvoice({
    mutation: {
      onSuccess: () => {
        toast({ title: t("dash_payboard.paid_toast", "Payment recorded") });
        setPayTarget(null);
        void load();
      },
      onError: (err: unknown) => {
        toast({
          title: t("dash_payboard.pay_failed", "Could not record payment"),
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      },
    },
  });
  const openPay = (inv: BoardInvoice) => {
    setPayMethod("BankTransfer");
    setPayDate(board?.today ?? "");
    setPayTarget(inv);
  };

  const newInvoiceHref = (u: BoardUnit) => {
    const p = new URLSearchParams();
    if (u.contract) p.set("contract_id", String(u.contract.id));
    if (u.contract) p.set("contract_ref", u.contract.contract_ref);
    if (u.contract?.tenant_account_id) p.set("account_id", String(u.contract.tenant_account_id));
    if (u.contract?.tenant_account_id && u.contract.tenant_name) p.set("account_name", u.contract.tenant_name);
    return `/finance/invoices/new${p.toString() ? `?${p}` : ""}`;
  };

  const props = board?.available_properties ?? [];
  const months = board?.months ?? [];
  const current = board?.current_month ?? "";
  const s = board?.summary;
  const vacancy = s && s.total_units ? ((s.total_units - s.occupied_units) / s.total_units) * 100 : null;
  const collectRate = s && s.month_billed ? (s.month_collected / s.month_billed) * 100 : undefined;

  // 알림 패널(선택 전): 연체 호실, 60일 안에 끝나는 계약.
  const overdueUnits = useMemo(
    () => (board?.units ?? []).filter((u) => u.overdue_total > 0).sort((a, b) => b.overdue_total - a.overdue_total).slice(0, 8),
    [board],
  );
  const expiring = useMemo(() => {
    if (!board) return [];
    const today = new Date(`${board.today}T00:00:00`);
    const limit = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10);
    return board.units
      .filter((u) => u.contract?.status === "Active" && u.contract.end_date && u.contract.end_date >= board.today && u.contract.end_date <= limit)
      .map((u) => ({ u, days: Math.round((new Date(`${u.contract!.end_date}T00:00:00`).getTime() - today.getTime()) / 86400000) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 8);
  }, [board]);

  const stickyCell = (c: (typeof infoCols)[number]) => ({
    className: cn(c.first ? "sticky" : "md:sticky"),
    style: { left: c.left, minWidth: c.width, maxWidth: c.width, width: c.width },
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">{t("dash_payboard.title", "Rent payment board")}</h2>
            <p className="text-xs text-muted-foreground">{t("dash_payboard.subtitle", "Every unit's monthly payment status — this month first")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.length > 1 && (
            <select
              value={pid ?? ""}
              onChange={(e) => { setPid(Number(e.target.value)); setSelected(null); scrolledFor.current = null; }}
              className="h-8 rounded-lg border bg-card px-2 text-xs font-medium max-w-[200px]"
              aria-label={t("dash_payboard.property", "Property")}
            >
              {props.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit_count})</option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs font-medium">
            {(["all", "overdue", "vacant"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md transition-all",
                  filter === f ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`dash_payboard.filter_${f}`, f)}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("dash_payboard.search", "Search unit or tenant")}
              className="h-8 w-44 rounded-lg border bg-card pl-7 pr-2 text-xs"
            />
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={scrollToCurrent}>
            <Crosshair className="h-3.5 w-3.5 mr-1" />
            {t("dash_payboard.this_month", "This month")}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => navigate("/booking/contracts/new")}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("dash_payboard.new_contract", "New contract")}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={Wallet} accent="green"
          label={t("dash_payboard.kpi_collected", "Collected this month")}
          value={s ? money(s.month_collected) : "—"}
          sublabel={s ? t("dash_payboard.kpi_billed_of", "of {{amount}} billed", { amount: money(s.month_billed) }) : undefined}
          progress={collectRate}
        />
        <KpiCard
          icon={Receipt} accent="amber"
          label={t("dash_payboard.kpi_outstanding", "Outstanding this month")}
          value={s ? money(s.month_outstanding) : "—"}
        />
        <KpiCard
          icon={AlertTriangle} accent="red"
          label={t("dash_payboard.kpi_overdue", "Overdue (all months)")}
          value={s ? money(s.overdue_total) : "—"}
          sublabel={s ? t("dash_payboard.kpi_overdue_units", "{{n}} units behind", { n: s.overdue_units }) : undefined}
          onClick={() => setFilter("overdue")}
        />
        <KpiCard
          icon={DoorOpen} accent="slate"
          label={t("dash_payboard.kpi_vacancy", "Vacancy")}
          value={vacancy == null ? "—" : `${vacancy.toFixed(1)}%`}
          sublabel={s ? t("dash_payboard.kpi_vacancy_sub", "{{v}} of {{n}} units vacant", { v: s.total_units - s.occupied_units, n: s.total_units }) : undefined}
          onClick={() => setFilter("vacant")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        {/* Matrix */}
        <DashCard bodyClass="p-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 border-b text-[11px] text-muted-foreground">
            {STATUS_ORDER.map((st) => (
              <span key={st} className="inline-flex items-center gap-1">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[st])} />
                {statusLabel(st)}
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    {t("dash_payboard.columns", "Columns")}
                    {hidden.size > 0 && (
                      <span className="text-muted-foreground">{INFO_KEYS.length - hidden.size}/{INFO_KEYS.length}</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-2">
                  <p className="px-1 pb-1.5 text-xs text-muted-foreground">{t("dash_payboard.columns_hint", "Choose columns to show")}</p>
                  <ul className="space-y-0.5">
                    {INFO_KEYS.map((k) => (
                      <li key={k}>
                        <label className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm cursor-pointer hover:bg-muted/60">
                          <Checkbox checked={!hidden.has(k)} onCheckedChange={(v) => toggleCol(k, v === true)} />
                          {colLabels[k]}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => saveHidden(new Set())}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                      {t("dash_payboard.columns_all", "Show all")}
                    </button>
                    <button type="button" onClick={() => saveHidden(new Set(INFO_KEYS.filter((k) => k !== "unit")))}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                      {t("dash_payboard.columns_min", "Unit only")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
              {t("dash_payboard.unit_count", "{{n}} units", { n: units.length })}
            </span>
          </div>
          {loading && !board ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">{t("dash_payboard.loading", "Loading…")}</div>
          ) : units.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
              <Wallet className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("dash_payboard.empty", "No units match.")}</p>
            </div>
          ) : (
            <div ref={scrollRef} className={cn("overflow-auto max-h-[70vh]", loading && "opacity-60")}>
              <table className="border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    {infoCols.map((c) => {
                      const sc = stickyCell(c);
                      return (
                        <th key={c.key} className={cn(sc.className, "top-0 z-30 bg-card border-b border-r px-2 py-2 text-left font-semibold whitespace-nowrap", !c.first && "z-20 md:z-30")} style={sc.style}>
                          {c.label}
                        </th>
                      );
                    })}
                    {months.map((m) => {
                      const { year, month } = monthLabel(m);
                      const isCur = m === current;
                      return (
                        <th
                          key={m}
                          ref={isCur ? currentThRef : undefined}
                          className={cn(
                            "sticky top-0 z-20 border-b border-r px-2 py-1.5 text-center font-semibold whitespace-nowrap min-w-[76px]",
                            "bg-card",
                            isCur && "text-primary shadow-[inset_0_-2px_0_hsl(var(--primary))]",
                          )}
                        >
                          <div className="text-[10px] font-medium text-muted-foreground">{year}</div>
                          <div>{month}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const on = selected?.unitId === u.id;
                    const c = u.contract;
                    // 고정 열은 가로 스크롤 때 달 칸 위를 덮으므로 반투명 배경을 쓰면 안 된다.
                    const rowBg = "bg-card group-hover:bg-muted";
                    return (
                      <tr key={u.id} className="group cursor-pointer" onClick={() => select(u.id, current)}>
                        {infoCols.map((col) => {
                          const sc = stickyCell(col);
                          let content: React.ReactNode = null;
                          switch (col.key) {
                            case "unit":
                              content = <span className={cn("font-semibold", on && "text-primary")}>{u.unit_label}</span>;
                              break;
                            case "tenant":
                              content = c?.tenant_name && u.occupied
                                ? <span className="truncate block" title={c.tenant_name}>{c.tenant_name}</span>
                                : <span className="text-muted-foreground">{u.occupied ? "—" : t("dash_payboard.vacant", "Vacant")}</span>;
                              break;
                            case "contract_date":
                              content = <span className="text-muted-foreground">{u.occupied ? formatDate(c?.contract_date) : "—"}</span>;
                              break;
                            case "period":
                              content = u.occupied && c ? (
                                <span className="text-muted-foreground leading-tight block">
                                  {formatDate(c.start_date)}<br />{formatDate(c.end_date)}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>;
                              break;
                            case "rent":
                              content = <span className="tabular-nums">{u.occupied ? money(c?.monthly_rent, c?.currency) : "—"}</span>;
                              break;
                            case "term":
                              content = <span className="text-muted-foreground">{u.occupied && c?.term_months ? t("dash_payboard.term_months", "{{n}}mo", { n: c.term_months }) : "—"}</span>;
                              break;
                            case "deposit":
                              content = <span className="tabular-nums">{u.occupied ? money(c?.deposit, c?.currency) : "—"}</span>;
                              break;
                          }
                          return (
                            <td key={col.key} className={cn(sc.className, "z-10 border-b border-r px-2 py-1.5 whitespace-nowrap overflow-hidden", rowBg, !col.first && "z-0 md:z-10")} style={{ ...sc.style, ...(on && col.first ? { boxShadow: "inset 3px 0 0 hsl(var(--primary))" } : {}) }}>
                              {content}
                            </td>
                          );
                        })}
                        {months.map((m) => {
                          const cell = u.cells[m];
                          const isSel = on && selected?.month === m;
                          return (
                            <td
                              key={m}
                              onClick={(e) => { e.stopPropagation(); select(u.id, m); }}
                              className={cn(
                                "border-b border-r px-1.5 py-1.5 text-center",
                                m === current && "bg-primary/[0.04]",
                                on && "bg-primary/5",
                                isSel && "ring-2 ring-inset ring-primary",
                              )}
                              title={cell ? `${statusLabel(cell.status)}${cell.total ? ` · ${money(cell.total, cell.invoices[0]?.currency)}` : ""}${cell.invoices.length ? ` · ${cell.invoices.map((i) => i.invoice_ref).join(", ")}` : ""}` : undefined}
                            >
                              {cell ? (
                                <span className={cn("inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none min-w-[44px]", STATUS_STYLE[cell.status])}>
                                  {statusLabel(cell.status)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashCard>

        {/* Side panel */}
        <div ref={panelRef} className="space-y-3 lg:sticky lg:top-40 scroll-mt-24">
          {selUnit ? (
            <>
              <DashCard
                title={
                  <span className="flex items-center gap-1.5">
                    {t("dash_payboard.unit_title", "Unit {{unit}}", { unit: selUnit.unit_label })}
                    {selUnit.contract?.tenant_name && selUnit.occupied && (
                      <span className="font-normal text-muted-foreground truncate">· {selUnit.contract.tenant_name}</span>
                    )}
                  </span>
                }
                icon={Home}
                action={
                  <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-muted" aria-label={t("common.close", "Close")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                }
                bodyClass="p-3 space-y-3"
              >
                {selUnit.contract ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">{t("dash_payboard.contract", "Contract")}</dt>
                    <dd className="text-right">
                      <Link href={`/booking/contracts/${selUnit.contract.id}`} className="text-primary hover:underline">{selUnit.contract.contract_ref}</Link>
                    </dd>
                    <dt className="text-muted-foreground">{t("dash_payboard.col_period", "Start / End")}</dt>
                    <dd className="text-right">{formatDate(selUnit.contract.start_date)} ~ {formatDate(selUnit.contract.end_date)}</dd>
                    <dt className="text-muted-foreground">{t("dash_payboard.col_rent", "Rent")}</dt>
                    <dd className="text-right tabular-nums">{money(selUnit.contract.monthly_rent, selUnit.contract.currency)}</dd>
                    <dt className="text-muted-foreground">{t("dash_payboard.col_deposit", "Deposit")}</dt>
                    <dd className="text-right tabular-nums">{money(selUnit.contract.deposit, selUnit.contract.currency)}</dd>
                    {selUnit.contract.rent_due_day != null && (
                      <>
                        <dt className="text-muted-foreground">{t("dash_payboard.due_day", "Due day")}</dt>
                        <dd className="text-right">{t("dash_payboard.due_day_n", "Day {{n}}", { n: selUnit.contract.rent_due_day })}</dd>
                      </>
                    )}
                    {selUnit.overdue_total > 0 && (
                      <>
                        <dt className="text-red-600 font-medium">{t("dash_payboard.overdue", "Overdue")}</dt>
                        <dd className="text-right text-red-600 font-semibold tabular-nums">
                          {money(selUnit.overdue_total, selUnit.contract.currency)} ({selUnit.overdue_count})
                        </dd>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("dash_payboard.no_contract", "No contract on this unit yet.")}</p>
                )}

                {/* 선택한 달 */}
                <div className="rounded-lg border p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {selected && `${monthLabel(selected.month).year} ${monthLabel(selected.month).month}`}
                    </span>
                    {selCell && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STATUS_STYLE[selCell.status])}>
                        {statusLabel(selCell.status)}
                      </span>
                    )}
                  </div>
                  {selCell && selCell.invoices.length > 0 ? (
                    selCell.invoices.map((inv) => (
                      <div key={inv.id} className="rounded-md bg-muted/40 p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <Link href={`/finance/invoices/${inv.id}`} className="font-medium text-primary hover:underline truncate">{inv.invoice_ref}</Link>
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", INVOICE_STATUS_STYLE[inv.status] ?? "bg-gray-100 text-gray-600")}>
                            {t(`invoice.status_${inv.status.toLowerCase()}`, inv.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{t("dash_payboard.due", "Due")} {formatDate(inv.due_date)}</span>
                          <span className="font-semibold text-foreground tabular-nums">{money(inv.total, inv.currency)}</span>
                        </div>
                        {inv.paid_at && (
                          <div className="text-[11px] text-green-700">{t("dash_payboard.paid_on", "Paid {{date}}", { date: formatDate(inv.paid_at) })}</div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => previewInvoice(inv)}>
                            <Eye className="h-3 w-3 mr-1" />{t("dash_payboard.preview_send", "View / send")}
                          </Button>
                          {inv.status !== "Paid" && (
                            <Button size="sm" className="h-7 px-2 text-[11px] bg-green-600 hover:bg-green-700" onClick={() => openPay(inv)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />{t("dash_payboard.mark_paid", "Record payment")}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {selCell?.status === "unbilled"
                        ? t("dash_payboard.unbilled_hint", "No invoice for this month although the contract covers it.")
                        : t("dash_payboard.no_invoice", "No invoice this month.")}
                    </p>
                  )}
                </div>

                {/* 동작 */}
                <div className="grid grid-cols-2 gap-1.5">
                  {selUnit.contract && (
                    <Button size="sm" variant="outline" className="h-8 text-xs justify-start" onClick={() => navigate(newInvoiceHref(selUnit))}>
                      <FileText className="h-3.5 w-3.5 mr-1" />{t("dash_payboard.new_invoice", "New invoice")}
                    </Button>
                  )}
                  {selUnit.contract && (
                    <Button size="sm" variant="outline" className="h-8 text-xs justify-start" onClick={() => navigate(`/booking/contracts/${selUnit.contract!.id}`)}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />{t("dash_payboard.open_contract", "Contract")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs justify-start" onClick={() => navigate(`/property/spaces/${selUnit.id}`)}>
                    <Home className="h-3.5 w-3.5 mr-1" />{t("dash_payboard.open_unit", "Unit")}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs justify-start" onClick={() => navigate(`/maintenance/work-orders/new?space_id=${selUnit.id}`)}>
                    <Wrench className="h-3.5 w-3.5 mr-1" />{t("dash_payboard.new_work_order", "Work order")}
                  </Button>
                  {!selUnit.occupied && (
                    <Button size="sm" className="h-8 text-xs justify-start col-span-2" onClick={() => navigate("/booking/contracts/new")}>
                      <Plus className="h-3.5 w-3.5 mr-1" />{t("dash_payboard.new_contract", "New contract")}
                    </Button>
                  )}
                </div>
              </DashCard>

              {recent.length > 0 && (
                <DashCard title={t("dash_payboard.recent", "Recent activity")} icon={Receipt} bodyClass="p-2">
                  <ul className="space-y-0.5">
                    {recent.map((inv) => (
                      <li key={inv.id}>
                        <button
                          type="button"
                          onClick={() => setSelected({ unitId: selUnit.id, month: inv.month })}
                          className="w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium truncate">{inv.invoice_ref}</span>
                            <span className={cn("block text-[11px]", inv.status === "Paid" ? "text-green-700" : inv.overdue ? "text-red-600" : "text-muted-foreground")}>
                              {t(`invoice.status_${inv.status.toLowerCase()}`, inv.status)} · {inv.month}
                            </span>
                          </span>
                          <span className="text-[11px] tabular-nums">{money(inv.total, inv.currency)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </DashCard>
              )}
            </>
          ) : (
            <>
              <DashCard title={t("dash_payboard.overdue_list", "Overdue")} icon={AlertTriangle} bodyClass="p-2">
                {overdueUnits.length === 0 ? (
                  <p className="px-1.5 py-2 text-xs text-muted-foreground">{t("dash_payboard.no_overdue", "No overdue rent.")}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {overdueUnits.map((u) => (
                      <li key={u.id}>
                        <button type="button" onClick={() => select(u.id, current)}
                          className="w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60">
                          <span className="text-xs font-semibold w-12 shrink-0">{u.unit_label}</span>
                          <span className="flex-1 min-w-0 text-xs truncate">{u.contract?.tenant_name ?? "—"}</span>
                          <span className="text-[11px] text-red-600 font-semibold tabular-nums">{money(u.overdue_total, u.contract?.currency)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </DashCard>
              <DashCard title={t("dash_payboard.expiring", "Leases ending soon")} icon={CalendarClock} bodyClass="p-2">
                {expiring.length === 0 ? (
                  <p className="px-1.5 py-2 text-xs text-muted-foreground">{t("dash_payboard.no_expiring", "No leases end in the next 60 days.")}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {expiring.map(({ u, days }) => (
                      <li key={u.id}>
                        <button type="button" onClick={() => select(u.id, current)}
                          className="w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60">
                          <span className="text-xs font-semibold w-12 shrink-0">{u.unit_label}</span>
                          <span className="flex-1 min-w-0 text-xs truncate">{u.contract?.tenant_name ?? "—"}</span>
                          <span className="text-[11px] text-muted-foreground">{t("dash_payboard.days_left", "{{n}}d left", { n: days })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </DashCard>
              <p className="px-1 text-[11px] text-muted-foreground">
                {t("dash_payboard.select_hint", "Pick a row or a month cell to see its invoices and actions.")}
              </p>
            </>
          )}
        </div>
      </div>

      {/* 입금 확인 */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) setPayTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("invoice.add_payment_title", "Record payment")}</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-4 py-1">
              <p className="text-sm">
                {payTarget.invoice_ref} · <span className="font-semibold">{money(payTarget.total, payTarget.currency)}</span>
              </p>
              <div className="space-y-1.5">
                <Label>{t("invoice.label_payment_method", "Payment method")}</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BankTransfer">{t("invoice.method_bank_transfer")}</SelectItem>
                    <SelectItem value="Cash">{t("invoice.method_cash")}</SelectItem>
                    <SelectItem value="CreditCard">{t("invoice.method_credit_card")}</SelectItem>
                    <SelectItem value="Stripe">{t("invoice.method_stripe")}</SelectItem>
                    <SelectItem value="Cheque">{t("invoice.method_cheque")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("dash_payboard.paid_date", "Payment date")}</Label>
                <DateInput value={payDate} onChange={(v) => setPayDate(v ?? "")} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>{t("common.cancel")}</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={payMutation.isPending}
              onClick={() => payTarget && payMutation.mutate({
                id: payTarget.id,
                data: { payment_method: payMethod, paid_at: payDate || null },
              })}
            >
              {t("invoice.btn_confirm_payment", "Confirm payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}
