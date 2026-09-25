import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { unitSpaces } from "@/lib/unitScope";
import {
  useListBookings, useListProperties, useListSpaces,
  useCreateBooking, useCheckInBooking, useCheckOutBooking,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import {
  CalendarDays, LogIn, LogOut, Clock, ChevronLeft, ChevronRight,
  Users, CheckCircle, Plus, Search, AlertTriangle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { LookupSelect } from "@/components/LookupSelect";
import { KpiCard, DashCard, Pill } from "@/components/dashboard/DashboardKit";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { matchesQuery } from "@/lib/search";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
// 계약/퇴거 현황 — 계약 한 건을 오늘 기준 세 단계로 칠한다(서버 /dashboard/lease-status 가 판정).
type LeasePhase = "ongoing" | "moving_out" | "moved_out";
const PHASE_COLORS: Record<LeasePhase, { bg: string; text: string; border: string }> = {
  ongoing:    { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  moving_out: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  moved_out:  { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
};

const STATUS_BADGE: Record<string, string> = {
  Draft:           "bg-slate-100 text-slate-600",
  PendingPayment:  "bg-yellow-100 text-yellow-800",
  PendingApproval: "bg-orange-100 text-orange-800",
  Confirmed:       "bg-blue-100 text-blue-800",
  Active:          "bg-green-100 text-green-700",
  CheckedOut:      "bg-red-100 text-red-800",
  Cancelled:       "bg-gray-100 text-gray-500",
};

interface LeaseStatus {
  today: string;
  month: string;
  move_out_window_days: number;
  ongoing_contracts: number;
  completed_contracts: number;
  move_out_scheduled_units: number;
  moved_out_units: number;
  calendar: {
    start: string; end: string;
    spaces: {
      id: number; name: string; property_name: string | null;
      contracts: {
        id: number; contract_ref: string; status: string; phase: LeasePhase;
        start_date: string; end_date: string | null; tenant_name: string | null;
      }[];
    }[];
  };
}

interface ArrivalDeparture {
  id: number; booking_ref: string; contact_name: string | null;
  space_name: string | null; property_address: string | null;
  check_in_date: string | null; check_out_date: string | null;
  booking_status: string; total_rent: string | null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function LeaseCalendar({
  weekStart,
  data,
  loading,
  onContractClick,
}: {
  weekStart: string;
  data: LeaseStatus | null;
  loading: boolean;
  onContractClick: (id: number) => void;
}) {
  const { t } = useTranslation();
  const weekEnd = addDays(weekStart, 7);
  const days: string[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = data?.today ?? new Date().toISOString().slice(0, 10);
  const phaseLabel: Record<LeasePhase, string> = {
    ongoing: t("dash_reservations.phase_ongoing"),
    moving_out: t("dash_reservations.phase_moving_out"),
    moved_out: t("dash_reservations.phase_moved_out"),
  };

  if (loading && !data) return <div className="py-8 text-center text-sm text-muted-foreground">{t("dash_reservations.loading_calendar")}</div>;
  const spaces = data?.calendar.start === weekStart ? data.calendar.spaces : [];
  if (spaces.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{t("dash_reservations.no_contracts_period")}</div>;
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b bg-muted/30">
          <div className="w-44 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">{t("dash_reservations.col_space")}</div>
          {days.map(d => (
            <div key={d} className={`w-24 shrink-0 border-r text-center py-2 text-xs ${d === today ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>
              <div className="font-medium">{new Date(d + "T12:00:00").getDate()}</div>
              <div className="text-[10px]">{new Date(d + "T12:00:00").toLocaleDateString("en", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
        {spaces.map(space => (
          <div key={space.id} className="flex border-b hover:bg-gray-50 dark:hover:bg-muted/40 min-h-[44px]">
            <div className="w-44 shrink-0 px-3 py-2 border-r">
              <div className="text-xs font-medium truncate">{space.name}</div>
              {space.property_name && <div className="text-[10px] text-muted-foreground truncate">{space.property_name}</div>}
            </div>
            <div className="relative flex" style={{ minWidth: 7 * 96 }}>
              {days.map(d => (
                <div key={d} className={`w-24 shrink-0 border-r h-full ${d === today ? "bg-primary/5" : ""}`} />
              ))}
              {space.contracts.map(c => {
                // 종료일 당일까지 칸을 채운다(퇴거일 포함). 종료일이 없으면 주 끝까지.
                const endExclusive = c.end_date ? addDays(c.end_date, 1) : weekEnd;
                const clampedStart = c.start_date < weekStart ? weekStart : c.start_date;
                const clampedEnd = endExclusive > weekEnd ? weekEnd : endExclusive;
                const startOffset = diffDays(weekStart, clampedStart);
                const span = diffDays(clampedStart, clampedEnd);
                if (span <= 0) return null;
                const colors = PHASE_COLORS[c.phase];
                return (
                  <button
                    key={c.id}
                    onClick={() => onContractClick(c.id)}
                    className="absolute top-1.5 rounded text-[10px] px-1.5 py-0.5 truncate font-medium hover:opacity-90 transition-opacity border cursor-pointer"
                    style={{
                      left: startOffset * 96 + 2,
                      width: span * 96 - 4,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      borderColor: colors.border,
                    }}
                    title={`${c.contract_ref} — ${c.tenant_name ?? "—"} · ${phaseLabel[c.phase]} · ${formatDate(c.start_date)} ~ ${c.end_date ? formatDate(c.end_date) : ""}`}
                  >
                    {c.contract_ref} {c.tenant_name ? `· ${c.tenant_name}` : ""}
                    {c.phase === "moving_out" && c.end_date ? ` · ${t("dash_reservations.move_out_on", { date: formatDate(c.end_date) })}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 p-3 border-t bg-muted/20">
        {(Object.keys(PHASE_COLORS) as LeasePhase[]).map(phase => (
          <div key={phase} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: PHASE_COLORS[phase].bg, borderColor: PHASE_COLORS[phase].border }} />
            <span className="text-[10px] text-muted-foreground">{phaseLabel[phase]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmActionModal({
  open, onClose, onConfirm, title, description, warning, confirmLabel, confirmClass, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; warning?: string;
  confirmLabel: string; confirmClass: string; loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{description}</p>
          {warning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{warning}</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>{t("common.cancel")}</Button>
          <Button className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? t("dash_reservations.processing") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArrivalDeparturePanel({ type, onActionDone }: { type: "arrivals" | "departures"; onActionDone?: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ArrivalDeparture[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmItem, setConfirmItem] = useState<ArrivalDeparture | null>(null);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const checkInMutation = useCheckInBooking({ mutation: { onSettled: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }) } });
  const checkOutMutation = useCheckOutBooking({ mutation: { onSettled: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }) } });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/v1/bookings/today/${type}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm() {
    if (!confirmItem) return;
    setProcessing(true);
    try {
      if (type === "arrivals") {
        await checkInMutation.mutateAsync({ id: confirmItem.id });
      } else {
        await checkOutMutation.mutateAsync({ id: confirmItem.id });
      }
      toast({
        title: type === "arrivals" ? `✅ ${t("dash_reservations.toast_checked_in")}` : `✅ ${t("dash_reservations.toast_checked_out")}`,
        description: `${confirmItem.contact_name ?? t("dash_reservations.guest_fallback")} — ${confirmItem.booking_ref}`,
      });
      setConfirmItem(null);
      load();
      onActionDone?.();
    } catch (e: any) {
      toast({ title: t("dash_reservations.toast_error"), description: e?.message ?? t("dash_reservations.toast_failed"), variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  const isArrivals = type === "arrivals";
  const Icon = isArrivals ? LogIn : LogOut;
  const actionLabel = isArrivals ? t("dash_reservations.check_in") : t("dash_reservations.check_out");
  const btnClass = isArrivals
    ? "bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-1 rounded font-medium"
    : "bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-2 py-1 rounded font-medium";

  const hasOutstandingBalance = confirmItem && confirmItem.total_rent && parseFloat(confirmItem.total_rent) > 0;

  return (
    <>
      <DashCard
        title={isArrivals ? t("dash_reservations.todays_arrivals") : t("dash_reservations.todays_departures")}
        icon={Icon}
        action={<span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">{items.length}</span>}
        bodyClass="p-0"
      >
        <div className="overflow-auto max-h-72">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">{t("common.loading")}</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground text-center">{t("dash_reservations.none_scheduled_today")}</div>
          ) : (
            <div className="divide-y">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(item.contact_name ?? "G").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{item.contact_name ?? t("dash_reservations.guest_fallback")}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.booking_ref} · {item.space_name ?? t("dash_reservations.col_space")}</p>
                    {item.property_address && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.property_address}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill className={STATUS_BADGE[item.booking_status] ?? "bg-gray-100 text-gray-600"}>{item.booking_status}</Pill>
                    <button className={btnClass} onClick={() => setConfirmItem(item)}>
                      {actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashCard>

      <ConfirmActionModal
        open={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onConfirm={handleConfirm}
        title={isArrivals ? t("dash_reservations.confirm_check_in") : t("dash_reservations.confirm_check_out")}
        description={
          isArrivals
            ? t("dash_reservations.confirm_check_in_desc", { name: confirmItem?.contact_name ?? t("dash_reservations.guest_lower"), ref: confirmItem?.booking_ref })
            : t("dash_reservations.confirm_check_out_desc", { name: confirmItem?.contact_name ?? t("dash_reservations.guest_lower"), ref: confirmItem?.booking_ref })
        }
        warning={
          !isArrivals && hasOutstandingBalance
            ? t("dash_reservations.outstanding_balance_warning")
            : undefined
        }
        confirmLabel={isArrivals ? t("dash_reservations.check_in") : t("dash_reservations.check_out")}
        confirmClass={isArrivals ? "bg-green-600 hover:bg-green-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}
        loading={processing}
      />
    </>
  );
}

interface QuickBookingForm {
  contact_id: number | null;
  space_id: number | null;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
  booking_source: string;
  num_guests: number;
  customer_notes: string;
  currency: string;
}

export function QuickBookingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { currencyPosition, currency: brandCurrency } = useBrand();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [form, setForm] = useState<QuickBookingForm>({
    contact_id: null, space_id: null,
    check_in_date: "", check_out_date: "",
    agreed_weekly_rate: "", booking_source: "Direct",
    num_guests: 1, customer_notes: "", currency: brandCurrency,
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: properties } = useListProperties();
  const { data: spaces } = useListSpaces();
  const filteredSpaces = unitSpaces(spaces).filter(s =>
    s.status === "Active" && (!selectedPropertyId || s.property_id === selectedPropertyId)
  );

  const createMutation = useCreateBooking({
    mutation: {
      onSettled: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }),
    },
  });

  const calcStay = () => {
    if (!form.check_in_date || !form.check_out_date) return null;
    const nights = diffDays(form.check_in_date, form.check_out_date);
    if (nights <= 0) return null;
    const weeks = nights / 7;
    const rate = parseFloat(form.agreed_weekly_rate) || 0;
    return { nights, weeks: weeks.toFixed(2), total: (weeks * rate).toFixed(2) };
  };

  const stay = calcStay();

  async function handleSubmit() {
    if (!form.space_id) { toast({ title: t("dash_reservations.err_select_space"), variant: "destructive" }); return; }
    if (!form.check_in_date || !form.check_out_date) { toast({ title: t("dash_reservations.err_enter_dates"), variant: "destructive" }); return; }
    if (form.check_out_date <= form.check_in_date) { toast({ title: t("dash_reservations.err_checkout_after_checkin"), variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        data: {
          contact_id: form.contact_id ?? undefined,
          space_id: form.space_id,
          check_in_date: form.check_in_date,
          check_out_date: form.check_out_date,
          agreed_weekly_rate: form.agreed_weekly_rate || undefined,
          booking_source: form.booking_source,
          num_guests: form.num_guests,
          customer_notes: form.customer_notes || undefined,
          currency: form.currency,
        },
      });
      toast({ title: t("dash_reservations.booking_created"), description: t("dash_reservations.booking_created_desc") });
      onClose();
      setForm({
        contact_id: null, space_id: null,
        check_in_date: "", check_out_date: "",
        agreed_weekly_rate: "", booking_source: "Direct",
        num_guests: 1, customer_notes: "", currency: brandCurrency,
      });
      setSelectedPropertyId(null);
    } catch (e: any) {
      toast({ title: t("dash_reservations.toast_error"), description: e?.message ?? t("dash_reservations.err_create_booking"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-background border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">{t("dash_reservations.quick_booking")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div>
            <Label className="text-xs font-medium">{t("dash_reservations.guest_contact")}</Label>
            <div className="mt-1.5">
              <LookupSelect
                lookupUrl="/api/v1/lookup/contacts"
                value={form.contact_id}
                onChange={v => setForm(f => ({ ...f, contact_id: v }))}
                placeholder={t("dash_reservations.search_guest")}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">{t("dash_reservations.property")}</Label>
            <Select value={selectedPropertyId?.toString() ?? ""} onValueChange={v => { setSelectedPropertyId(v ? parseInt(v) : null); setForm(f => ({ ...f, space_id: null })); }}>
              <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue placeholder={t("dash_reservations.all_properties")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">{t("dash_reservations.all_properties")}</SelectItem>
                {(properties ?? []).map(p => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">{t("dash_reservations.col_space")} <span className="text-red-500">*</span></Label>
            <Select value={form.space_id?.toString() ?? ""} onValueChange={v => setForm(f => ({ ...f, space_id: v ? parseInt(v) : null }))}>
              <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue placeholder={t("dash_reservations.select_space")} /></SelectTrigger>
              <SelectContent>
                {filteredSpaces.length === 0
                  ? <SelectItem value="" disabled className="text-xs">{t("dash_reservations.no_active_spaces")}</SelectItem>
                  : filteredSpaces.map(s => (
                    <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">{t("dash_reservations.col_checkin")} <span className="text-red-500">*</span></Label>
              <DateInput className="mt-1.5 h-9 text-xs" value={form.check_in_date} onChange={iso => setForm(f => ({ ...f, check_in_date: iso }))} />
            </div>
            <div>
              <Label className="text-xs font-medium">{t("dash_reservations.col_checkout")} <span className="text-red-500">*</span></Label>
              <DateInput className="mt-1.5 h-9 text-xs" value={form.check_out_date} onChange={iso => setForm(f => ({ ...f, check_out_date: iso }))} min={form.check_in_date || undefined} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">{t("dash_reservations.weekly_rate", { currency: form.currency })}</Label>
              <Input type="number" min={0} step={0.01} placeholder="0.00" className="mt-1.5 h-9 text-xs" value={form.agreed_weekly_rate} onChange={e => setForm(f => ({ ...f, agreed_weekly_rate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium">{t("dash_reservations.currency")}</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">{t("dash_reservations.source")}</Label>
              <Select value={form.booking_source} onValueChange={v => setForm(f => ({ ...f, booking_source: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Direct", "Airbnb", "Booking.com", "Agent", "Referral", "Other"].map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">{t("dash_reservations.guests")}</Label>
              <Input type="number" min={1} max={20} className="mt-1.5 h-9 text-xs" value={form.num_guests} onChange={e => setForm(f => ({ ...f, num_guests: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>

          {stay && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("dash_reservations.stay_summary")}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{stay.nights}</p>
                  <p className="text-[10px] text-muted-foreground">{t("dash_reservations.nights")}</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{stay.weeks}</p>
                  <p className="text-[10px] text-muted-foreground">{t("dash_reservations.weeks")}</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{formatMoney(stay.total, form.currency, currencyPosition)}</p>
                  <p className="text-[10px] text-muted-foreground">{t("dash_reservations.total_rent")}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium">{t("dash_reservations.special_requests")}</Label>
            <Textarea className="mt-1.5 text-xs" rows={3} placeholder={t("dash_reservations.special_requests_placeholder")} value={form.customer_notes} onChange={e => setForm(f => ({ ...f, customer_notes: e.target.value }))} />
          </div>
        </div>

        <div className="border-t px-5 py-4 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} className="flex-1 bg-primary hover:bg-[#d4541a] text-white" disabled={submitting}>
            {submitting ? t("dash_reservations.creating") : t("dash_reservations.create_booking")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReservationsTab() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [, navigate] = useLocation();

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  });

  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);

  const { data: bookings, refetch: refetchBookings } = useListBookings({});

  // 계약/퇴거 KPI + 7일 캘린더 — 한 번의 호출로 받는다.
  const [lease, setLease] = useState<LeaseStatus | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLeaseLoading(true);
    apiFetch(`/api/v1/dashboard/lease-status?start=${weekStart}&end=${addDays(weekStart, 7)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setLease(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLeaseLoading(false); });
    return () => { cancelled = true; };
  }, [weekStart, calendarKey]);

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const filteredBookings = (bookings ?? []).filter(b => {
    const matchStatus = statusFilter === "All" || b.booking_status === statusFilter;
    const matchSearch = matchesQuery(
      search,
      b.booking_ref,
      (b as any).contact_name,
      (b as any).space_name,
      (b as any).property_name,
    );
    return matchStatus && matchSearch;
  });
  const pageCount = Math.ceil(filteredBookings.length / PER_PAGE);
  const paginated = filteredBookings.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const weekEndStr = addDays(weekStart, 6);
  const weekLabel = `${new Date(weekStart + "T12:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })} – ${new Date(weekEndStr + "T12:00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/booking/bookings/new")} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("dash_reservations.full_form")}
        </Button>
        <Button size="sm" className="gap-1.5 bg-primary hover:bg-[#d4541a] text-white" onClick={() => setQuickBookingOpen(true)}>
          <Plus className="h-4 w-4" /> {t("dash_reservations.quick_booking")}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label={t("dash_reservations.kpi_ongoing_contracts")} value={lease?.ongoing_contracts ?? "—"} icon={CheckCircle} accent="green" sublabel={t("dash_reservations.kpi_ongoing_contracts_sub")} onClick={() => navigate("/booking/contracts")} />
        <KpiCard label={t("dash_reservations.kpi_completed_contracts")} value={lease?.completed_contracts ?? "—"} icon={Clock} accent="slate" sublabel={t("dash_reservations.kpi_completed_contracts_sub")} onClick={() => navigate("/booking/contracts")} />
        <KpiCard label={t("dash_reservations.kpi_move_out_scheduled")} value={lease?.move_out_scheduled_units ?? "—"} icon={LogOut} accent={(lease?.move_out_scheduled_units ?? 0) > 0 ? "amber" : "blue"} sublabel={t("dash_reservations.kpi_move_out_scheduled_sub", { days: lease?.move_out_window_days ?? 30 })} />
        <KpiCard label={t("dash_reservations.kpi_moved_out")} value={lease?.moved_out_units ?? "—"} icon={Users} accent="indigo" sublabel={t("dash_reservations.kpi_moved_out_sub")} />
      </div>

      <DashCard
        title={t("dash_reservations.lease_calendar")}
        icon={CalendarDays}
        bodyClass="p-0"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground font-medium min-w-[160px] text-center">{weekLabel}</span>
            <Button variant="outline" size="sm" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={goToday}>{t("dash_reservations.today")}</Button>
          </div>
        }
      >
        <LeaseCalendar
          weekStart={weekStart}
          data={lease}
          loading={leaseLoading}
          onContractClick={(id) => navigate(`/booking/contracts/${id}`)}
        />
      </DashCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArrivalDeparturePanel type="arrivals" onActionDone={() => { refetchBookings(); setCalendarKey(k => k + 1); }} />
        <ArrivalDeparturePanel type="departures" onActionDone={() => { refetchBookings(); setCalendarKey(k => k + 1); }} />
      </div>

      <DashCard
        title={t("dash_reservations.all_bookings")}
        bodyClass="p-0"
        action={<Link href="/booking/bookings" className="text-xs text-primary hover:underline">{t("dash_reservations.open_full_list")}</Link>}
      >
        <div className="px-4 py-3 border-b flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("dash_reservations.search_ref_or_guest")}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "Draft", "PendingPayment", "PendingApproval", "Confirmed", "Active", "CheckedOut", "Cancelled"].map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s === "All" ? t("dash_reservations.all_statuses") : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-auto">
          <ExportableTable fileName="reservations-tab" className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {[
                  t("dash_reservations.th_ref"),
                  t("dash_reservations.col_guest"),
                  t("dash_reservations.col_space"),
                  t("dash_reservations.col_checkin"),
                  t("dash_reservations.col_checkout"),
                  t("dash_reservations.nights"),
                  t("common.amount"),
                  t("common.status"),
                  t("common.actions"),
                ].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">{t("dash_reservations.no_bookings_found")}</td></tr>
              ) : paginated.map(b => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono font-medium">{b.booking_ref}</td>
                  <td className="px-3 py-2">{(b as any).contact_name ?? "—"}</td>
                  <td className="px-3 py-2">{(b as any).space_name ?? "—"}</td>
                  <td className="px-3 py-2">{formatDate(b.check_in_date)}</td>
                  <td className="px-3 py-2">{formatDate(b.check_out_date)}</td>
                  <td className="px-3 py-2">{b.stay_nights ?? "—"}</td>
                  <td className="px-3 py-2">
                    {b.total_rent ? formatMoney(b.total_rent, b.currency ?? currency, currencyPosition) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Pill className={STATUS_BADGE[b.booking_status] ?? "bg-gray-100 text-gray-600"}>{b.booking_status}</Pill>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/booking/bookings/${b.id}`} className="text-primary hover:underline">{t("common.view")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ExportableTable>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
            <span className="text-muted-foreground">
              {t("dash_reservations.pagination_showing", { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, filteredBookings.length), total: filteredBookings.length })}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ {t("common.prev")}</Button>
              <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>{t("common.next")} ›</Button>
            </div>
          </div>
        )}
      </DashCard>

      <QuickBookingPanel open={quickBookingOpen} onClose={() => setQuickBookingOpen(false)} />
    </div>
  );
}
