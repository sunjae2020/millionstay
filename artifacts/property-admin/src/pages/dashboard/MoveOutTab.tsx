import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { LogOut, Users, Plus, Search, ClipboardCheck } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { KpiCard } from "@/components/dashboard/DashboardKit";
import { formatDate } from "@/lib/date";
import { MoveOutBoard, type MoveOutRow, type MoveOutView } from "./MoveOutBoard";

// 대시보드 퇴거 현황 탭(?tab=reservations). 진행중·완료 계약 KPI와 7일 캘린더, 예약 패널은
// 입금 현황과 겹쳐 뺐다 — 퇴거예정·퇴거완료 KPI + 퇴거 세대 보드 + 점검표 시작 버튼만 남긴다.
// 수치·보드 행은 서버 /dashboard/lease-status 가 판정한다(연장 계약은 퇴거에서 제외).

interface LeaseStatus {
  today: string;
  move_out_window_days: number;
  move_out_scheduled_units: number;
  moved_out_units: number;
  moved_out_total: number;
  move_outs: MoveOutRow[];
}

interface ContractHit {
  id: number;
  contract_ref: string;
  status: string;
  space_name: string | null;
  tenant_name: string | null;
  end_date: string | null;
}

// 퇴거세대 점검표 시작 — 계약을 고르면 그 계약의 퇴거세대 정산 탭(점검표·정산서)으로 간다.
// 검색어가 없으면 퇴거예정 세대를 먼저 보여준다.
function ChecklistPicker({ open, onClose, suggested }: { open: boolean; onClose: () => void; suggested: MoveOutRow[] }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContractHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQ(""); setHits(null); }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      apiJson<ContractHit[]>(`/api/v1/contracts?q=${encodeURIComponent(term)}&limit=20`)
        .then(d => { if (!cancelled) setHits(Array.isArray(d) ? d : []); })
        .catch(() => { if (!cancelled) setHits([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  const items: ContractHit[] = hits ?? suggested.map(r => ({
    id: r.contract_id, contract_ref: r.contract_ref, status: r.contract_status,
    space_name: r.space_name, tenant_name: r.tenant_name, end_date: r.end_date,
  }));

  const pick = (id: number) => { onClose(); navigate(`/booking/contracts/${id}?tab=move-out`); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dash_reservations.mo_pick_title")}</DialogTitle>
          <DialogDescription>{t("dash_reservations.mo_pick_hint")}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t("dash_reservations.mo_search")} className="pl-8 h-9 text-sm" />
        </div>
        {!hits && items.length > 0 && (
          <p className="text-xs font-medium text-muted-foreground">{t("dash_reservations.mo_pick_suggested")}</p>
        )}
        <div className="max-h-[50vh] overflow-auto divide-y rounded-md border">
          {loading && !hits ? null : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("dash_reservations.mo_pick_empty")}</p>
          ) : items.map(c => (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:bg-muted/50"
            >
              <span className="font-medium min-w-[56px]">{c.space_name ?? "—"}</span>
              <span className="flex-1 truncate">{c.tenant_name ?? "—"}</span>
              <span className="font-mono text-muted-foreground">{c.contract_ref}</span>
              <span className="text-muted-foreground whitespace-nowrap">{c.end_date ? formatDate(c.end_date) : "—"}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MoveOutTab() {
  const { t } = useTranslation();

  const [lease, setLease] = useState<LeaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/v1/dashboard/lease-status`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setLease(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // KPI 카드를 누르면 해당 보기로 바꾸고 보드로 내려간다.
  const [view, setView] = useState<MoveOutView>("moving_out");
  const boardRef = useRef<HTMLDivElement>(null);
  const openView = (v: MoveOutView) => {
    setView(v);
    boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const suggested = (lease?.move_outs ?? [])
    .filter(r => r.phase === "moving_out")
    .sort((a, b) => (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999"));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" /><ClipboardCheck className="h-4 w-4" /> {t("dash_reservations.mo_checklist_button")}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <KpiCard
          label={t("dash_reservations.kpi_move_out_scheduled")}
          value={lease?.move_out_scheduled_units ?? "—"}
          icon={LogOut}
          accent={(lease?.move_out_scheduled_units ?? 0) > 0 ? "amber" : "blue"}
          sublabel={t("dash_reservations.kpi_move_out_scheduled_sub", { days: lease?.move_out_window_days ?? 30 })}
          onClick={() => openView("moving_out")}
        />
        <KpiCard
          label={t("dash_reservations.kpi_moved_out")}
          value={lease?.moved_out_total ?? "—"}
          icon={Users}
          accent="indigo"
          sublabel={t("dash_reservations.kpi_moved_out_sub", { month: lease?.moved_out_units ?? 0 })}
          onClick={() => openView("moved_out")}
        />
      </div>

      <MoveOutBoard
        ref={boardRef}
        rows={lease?.move_outs}
        today={lease?.today}
        loading={loading}
        view={view}
        onViewChange={setView}
      />

      <ChecklistPicker open={pickerOpen} onClose={() => setPickerOpen(false)} suggested={suggested} />
    </div>
  );
}
