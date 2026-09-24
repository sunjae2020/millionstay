import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import {
  LayoutDashboard, CalendarDays, DollarSign, Wrench, Users, Radio, Handshake, Building2, Wallet,
  ArrowUpDown, GripVertical, RotateCcw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DashTabs, type TabDef } from "@/components/dashboard/DashboardKit";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import OverviewTab from "@/pages/dashboard/OverviewTab";
import ReservationsTab from "@/pages/dashboard/ReservationsTab";
import FinanceTab from "@/pages/dashboard/FinanceTab";
import OperationsTab from "@/pages/dashboard/OperationsTab";
import CrmTab from "@/pages/dashboard/CrmTab";
import ChannelsTab from "@/pages/dashboard/ChannelsTab";
import HomestayOpsTab from "@/pages/dashboard/HomestayOpsTab";
import FloorBoardTab from "@/pages/dashboard/FloorBoardTab";
import PaymentBoardTab from "@/pages/dashboard/PaymentBoardTab";

const TAB_IDS = ["overview", "reservations", "channels", "crm", "finance", "operations", "homestay_ops", "floor_board", "payment_board"] as const;

const VALID = new Set<string>(TAB_IDS);

/** 탭 순서는 사용자별로 저장한다 — 리스트 컬럼 순서와 같은 table-prefs 저장소를 쓴다. */
const PREFS_KEY = "dashboard-tabs";

/** 저장된 순서를 현재 탭 목록에 맞춘다: 사라진 탭은 빼고, 새로 생긴 탭은 기본 위치 뒤에 붙인다. */
function normalizeOrder(saved: string[]): string[] {
  const kept = saved.filter((id) => VALID.has(id));
  const missing = TAB_IDS.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export default function Dashboard() {
  const { t } = useTranslation();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<string[]>([...TAB_IDS]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/v1/table-prefs/${PREFS_KEY}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const saved = body?.data?.order;
        if (!cancelled && Array.isArray(saved) && saved.length) setOrder(normalizeOrder(saved.map(String)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const saveOrder = (ids: string[]) => {
    const next = normalizeOrder(ids);
    setOrder(next);
    void apiFetch(`/api/v1/table-prefs/${PREFS_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next, hidden: [], widths: {} }),
    }).catch(() => {});
  };

  // 순서 편집 목록: 왼쪽 점 6개(⠿) 손잡이를 끌어 옮긴다. 포인터 이벤트라 마우스·터치 모두 된다.
  // 끄는 동안은 draft 로 화면만 바꾸고, 손을 놓을 때 한 번 저장한다.
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  const startDrag = (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft([...order]);
    setDragging(id);
  };
  const onDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || !draft) return;
    // 포인터가 어느 항목의 가운데를 넘었는지로 끼워 넣을 자리를 정한다.
    const others = draft.filter((id) => id !== dragging);
    let at = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = itemRefs.current.get(others[i])?.getBoundingClientRect();
      if (r && e.clientY < r.top + r.height / 2) { at = i; break; }
    }
    const next = [...others.slice(0, at), dragging, ...others.slice(at)];
    if (next.join() !== draft.join()) setDraft(next);
  };
  const endDrag = () => {
    if (draft && draft.join() !== order.join()) saveOrder(draft);
    setDraft(null);
    setDragging(null);
  };

  const ALL_TABS: Record<string, TabDef> = {
    overview:      { id: "overview",      label: t("dashboard.tabs.overview", "Overview"),         icon: LayoutDashboard },
    reservations:  { id: "reservations",  label: t("dashboard.tabs.reservations", "Reservations"), icon: CalendarDays },
    channels:      { id: "channels",      label: t("dashboard.tabs.channels", "Channels"),         icon: Radio },
    crm:           { id: "crm",           label: t("dashboard.tabs.crm", "CRM"),                   icon: Users },
    finance:       { id: "finance",       label: t("dashboard.tabs.finance", "Finance"),           icon: DollarSign },
    operations:    { id: "operations",    label: t("dashboard.tabs.operations", "Operations"),     icon: Wrench },
    homestay_ops:  { id: "homestay_ops",  label: t("dashboard.tabs.homestay_ops", "Homestay Ops"), icon: Handshake },
    floor_board:   { id: "floor_board",   label: t("dashboard.tabs.floor_board", "Floor Board"),   icon: Building2 },
    payment_board: { id: "payment_board", label: t("dashboard.tabs.payment_board", "Rent Board"),  icon: Wallet },
  };
  const TABS = useMemo(() => order.map((id) => ALL_TABS[id]).filter(Boolean), [order, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const requested = new URLSearchParams(search).get("tab") ?? "overview";
  const active = VALID.has(requested) ? requested : "overview";

  const setTab = (id: string) => {
    navigate(id === "overview" ? "/dashboard" : `/dashboard?tab=${id}`);
  };

  return (
    <Layout>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-card px-4 sm:px-6 pt-3 sm:pt-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              {t("dashboard.title", "Dashboard")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {t("dashboard.subtitle", "Real-time operational overview")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {t("dashboard.live_data")}
          </span>
        </div>
        <div className="mt-3 pb-3 flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <DashTabs tabs={TABS} active={active} onChange={setTab} />
          </div>
          {/* 끌어서 옮기기가 어려운 터치 화면·키보드용 순서 편집 */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground"
                title={t("dashboard.reorder_tabs", "Reorder tabs")}
                aria-label={t("dashboard.reorder_tabs", "Reorder tabs")}
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <p className="px-1 pb-2 text-xs text-muted-foreground">
                {t("dashboard.reorder_hint", "Drag the ⠿ handle to reorder tabs.")}
              </p>
              <ul className="space-y-0.5">
                {(draft ?? order).map((id) => ALL_TABS[id]).filter(Boolean).map((tb) => (
                  <li
                    key={tb.id}
                    ref={(el) => { if (el) itemRefs.current.set(tb.id, el); else itemRefs.current.delete(tb.id); }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1 py-1 select-none",
                      dragging === tb.id ? "bg-primary/10 ring-1 ring-primary/40 shadow-sm" : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(tb.id, e)}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className={cn(
                        "h-7 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted touch-none",
                        dragging === tb.id ? "cursor-grabbing" : "cursor-grab",
                      )}
                      aria-label={t("dashboard.drag_tab", "Drag to reorder")}
                      title={t("dashboard.drag_tab", "Drag to reorder")}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <tb.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{tb.label}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => saveOrder([...TAB_IDS])}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                {t("dashboard.reset_order", "Reset order")}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 sm:p-6">
        {active === "overview" && <OverviewTab />}
        {active === "reservations" && <ReservationsTab />}
        {active === "channels" && <ChannelsTab />}
        {active === "crm" && <CrmTab />}
        {active === "finance" && <FinanceTab />}
        {active === "operations" && <OperationsTab />}
        {active === "homestay_ops" && <HomestayOpsTab />}
        {active === "floor_board" && <FloorBoardTab />}
        {active === "payment_board" && <PaymentBoardTab />}
      </div>
    </Layout>
  );
}
