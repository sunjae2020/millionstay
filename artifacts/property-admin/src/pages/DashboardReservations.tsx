import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { apiFetch } from "@/lib/apiFetch";
import {
  useListBookings, useListProperties, useListSpaces, useListContacts,
  useCreateBooking, useCheckInBooking, useCheckOutBooking,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import {
  CalendarDays, LogIn, LogOut, Clock, ChevronLeft, ChevronRight,
  Users, CheckCircle, XCircle, Plus, Search, AlertTriangle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { LookupSelect } from "@/components/LookupSelect";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Draft:           { bg: "#f8fafc", text: "#64748b", border: "#cbd5e1" },
  PendingPayment:  { bg: "#fef9c3", text: "#854d0e", border: "#fde68a" },
  PendingApproval: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  Confirmed:       { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  Active:          { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  CheckedOut:      { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  Cancelled:       { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" },
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

interface CalendarData {
  start: string; end: string;
  spaces: {
    id: number; name: string; property_name: string | null;
    bookings: {
      id: number; booking_ref: string; booking_status: string;
      check_in_date: string; check_out_date: string; guest_name: string | null;
    }[];
  }[];
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

function KpiCard({ label, value, icon: Icon, colorClass, sublabel }: {
  label: string; value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string; sublabel?: string;
}) {
  return (
    <div className="bg-card rounded-lg border p-5 flex items-start gap-4">
      <div className={`rounded-lg p-2.5 ${colorClass}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

function GanttCalendar({
  weekStart,
  onBookingClick,
}: {
  weekStart: string;
  onBookingClick: (id: number, status: string) => void;
}) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const weekEnd = addDays(weekStart, 7);
  const days: string[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/v1/bookings/calendar?start=${weekStart}&end=${weekEnd}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weekStart]);

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading calendar…</div>;
  if (!data || data.spaces.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No bookings in this period.</div>;
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b bg-muted/30">
          <div className="w-44 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">Space</div>
          {days.map(d => (
            <div key={d} className={`w-24 shrink-0 border-r text-center py-2 text-xs ${d === today ? "bg-[#E8621A]/10 text-[#E8621A] font-bold" : "text-muted-foreground"}`}>
              <div className="font-medium">{new Date(d + "T12:00:00").getDate()}</div>
              <div className="text-[10px]">{new Date(d + "T12:00:00").toLocaleDateString("en", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
        {data.spaces.map(space => (
          <div key={space.id} className="flex border-b hover:bg-gray-50 min-h-[44px]">
            <div className="w-44 shrink-0 px-3 py-2 border-r">
              <div className="text-xs font-medium truncate">{space.name}</div>
              {space.property_name && <div className="text-[10px] text-muted-foreground truncate">{space.property_name}</div>}
            </div>
            <div className="relative flex" style={{ minWidth: 7 * 96 }}>
              {days.map(d => (
                <div key={d} className={`w-24 shrink-0 border-r h-full ${d === today ? "bg-[#E8621A]/5" : ""}`} />
              ))}
              {space.bookings.map(bk => {
                const clampedStart = bk.check_in_date < weekStart ? weekStart : bk.check_in_date;
                const clampedEnd = bk.check_out_date > weekEnd ? weekEnd : bk.check_out_date;
                const startOffset = diffDays(weekStart, clampedStart);
                const span = diffDays(clampedStart, clampedEnd);
                if (span <= 0) return null;
                const colors = STATUS_COLORS[bk.booking_status] ?? STATUS_COLORS.Draft!;
                return (
                  <button
                    key={bk.id}
                    onClick={() => onBookingClick(bk.id, bk.booking_status)}
                    className="absolute top-1.5 rounded text-[10px] px-1.5 py-0.5 truncate font-medium hover:opacity-90 transition-opacity border cursor-pointer"
                    style={{
                      left: startOffset * 96 + 2,
                      width: span * 96 - 4,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      borderColor: colors.border,
                    }}
                    title={`${bk.booking_ref} — ${bk.guest_name ?? "Guest"} · ${bk.booking_status}`}
                  >
                    {bk.booking_ref} {bk.guest_name ? `· ${bk.guest_name}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 p-3 border-t bg-muted/20">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: colors.bg, borderColor: colors.border }} />
            <span className="text-[10px] text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  confirmLabel,
  confirmClass,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  warning?: string;
  confirmLabel: string;
  confirmClass: string;
  loading: boolean;
}) {
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
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? "Processing…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArrivalDeparturePanel({ type, onActionDone }: { type: "arrivals" | "departures"; onActionDone?: () => void }) {
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
        title: type === "arrivals" ? "✅ Checked In" : "✅ Checked Out",
        description: `${confirmItem.contact_name ?? "Guest"} — ${confirmItem.booking_ref}`,
      });
      setConfirmItem(null);
      load();
      onActionDone?.();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  const isArrivals = type === "arrivals";
  const Icon = isArrivals ? LogIn : LogOut;
  const actionLabel = isArrivals ? "Check In" : "Check Out";
  const iconColor = isArrivals ? "text-green-600" : "text-amber-600";
  const btnClass = isArrivals
    ? "bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-1 rounded font-medium"
    : "bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-2 py-1 rounded font-medium";

  const hasOutstandingBalance = confirmItem && confirmItem.total_rent && parseFloat(confirmItem.total_rent) > 0;

  return (
    <>
      <div className="bg-card rounded-lg border flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <h3 className="text-sm font-semibold">{isArrivals ? "Today's Arrivals" : "Today's Departures"}</h3>
          <span className="ml-auto text-xs bg-muted rounded-full px-2 py-0.5 font-medium">{items.length}</span>
        </div>
        <div className="flex-1 overflow-auto max-h-72">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground text-center">None scheduled today</div>
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
                    <p className="text-xs font-semibold truncate">{item.contact_name ?? "Guest"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.booking_ref} · {item.space_name ?? "Space"}</p>
                    {item.property_address && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.property_address}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[item.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {item.booking_status}
                    </span>
                    <button className={btnClass} onClick={() => setConfirmItem(item)}>
                      {actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onConfirm={handleConfirm}
        title={isArrivals ? "Confirm Check-In" : "Confirm Check-Out"}
        description={
          isArrivals
            ? `Check in ${confirmItem?.contact_name ?? "guest"} for booking ${confirmItem?.booking_ref}?`
            : `Check out ${confirmItem?.contact_name ?? "guest"} for booking ${confirmItem?.booking_ref}?`
        }
        warning={
          !isArrivals && hasOutstandingBalance
            ? "Please verify all outstanding balances have been settled before check-out."
            : undefined
        }
        confirmLabel={isArrivals ? "Check In" : "Check Out"}
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

function QuickBookingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [form, setForm] = useState<QuickBookingForm>({
    contact_id: null, space_id: null,
    check_in_date: "", check_out_date: "",
    agreed_weekly_rate: "", booking_source: "Direct",
    num_guests: 1, customer_notes: "", currency: "AUD",
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: properties } = useListProperties();
  const { data: spaces } = useListSpaces();
  const filteredSpaces = spaces?.filter(s =>
    s.status === "Active" && (!selectedPropertyId || s.property_id === selectedPropertyId)
  ) ?? [];

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
    if (!form.space_id) { toast({ title: "Select a space", variant: "destructive" }); return; }
    if (!form.check_in_date || !form.check_out_date) { toast({ title: "Enter check-in and check-out dates", variant: "destructive" }); return; }
    if (form.check_out_date <= form.check_in_date) { toast({ title: "Check-out must be after check-in", variant: "destructive" }); return; }
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
      toast({ title: "Booking created", description: "Draft booking saved successfully." });
      onClose();
      setForm({
        contact_id: null, space_id: null,
        check_in_date: "", check_out_date: "",
        agreed_weekly_rate: "", booking_source: "Direct",
        num_guests: 1, customer_notes: "", currency: "AUD",
      });
      setSelectedPropertyId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create booking", variant: "destructive" });
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
          <h2 className="text-base font-semibold">Quick Booking</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div>
            <Label className="text-xs font-medium">Guest (Contact)</Label>
            <div className="mt-1.5">
              <LookupSelect
                entity="contacts"
                value={form.contact_id}
                onChange={v => setForm(f => ({ ...f, contact_id: v }))}
                placeholder="Search guest…"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Property</Label>
            <Select value={selectedPropertyId?.toString() ?? ""} onValueChange={v => { setSelectedPropertyId(v ? parseInt(v) : null); setForm(f => ({ ...f, space_id: null })); }}>
              <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue placeholder="All properties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">All properties</SelectItem>
                {(properties ?? []).map(p => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Space <span className="text-red-500">*</span></Label>
            <Select value={form.space_id?.toString() ?? ""} onValueChange={v => setForm(f => ({ ...f, space_id: v ? parseInt(v) : null }))}>
              <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue placeholder="Select space" /></SelectTrigger>
              <SelectContent>
                {filteredSpaces.length === 0
                  ? <SelectItem value="" disabled className="text-xs">No active spaces</SelectItem>
                  : filteredSpaces.map(s => (
                    <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Check-in <span className="text-red-500">*</span></Label>
              <Input type="date" className="mt-1.5 h-9 text-xs" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium">Check-out <span className="text-red-500">*</span></Label>
              <Input type="date" className="mt-1.5 h-9 text-xs" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Weekly Rate ({form.currency})</Label>
              <Input type="number" min={0} step={0.01} placeholder="0.00" className="mt-1.5 h-9 text-xs" value={form.agreed_weekly_rate} onChange={e => setForm(f => ({ ...f, agreed_weekly_rate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium">Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["AUD", "USD", "KRW", "CNY", "JPY", "SGD", "NZD"].map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Source</Label>
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
              <Label className="text-xs font-medium">Guests</Label>
              <Input type="number" min={1} max={20} className="mt-1.5 h-9 text-xs" value={form.num_guests} onChange={e => setForm(f => ({ ...f, num_guests: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>

          {stay && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stay Summary</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{stay.nights}</p>
                  <p className="text-[10px] text-muted-foreground">Nights</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{stay.weeks}</p>
                  <p className="text-[10px] text-muted-foreground">Weeks</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{form.currency} {parseFloat(stay.total).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Total Rent</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium">Special Requests</Label>
            <Textarea className="mt-1.5 text-xs" rows={3} placeholder="Optional notes or requests…" value={form.customer_notes} onChange={e => setForm(f => ({ ...f, customer_notes: e.target.value }))} />
          </div>
        </div>

        <div className="border-t px-5 py-4 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} className="flex-1 bg-[#E8621A] hover:bg-[#d4541a] text-white" disabled={submitting}>
            {submitting ? "Creating…" : "Create Booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardReservations() {
  const [, navigate] = useLocation();

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  });

  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);

  const { data: bookings, refetch: refetchBookings } = useListBookings({});

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = addDays(todayStr, -7);
  const monthStr = todayStr.slice(0, 7);

  const activeCount = bookings?.filter(b => b.booking_status === "Active").length ?? 0;
  const pendingCount = bookings?.filter(b => b.booking_status === "PendingApproval").length ?? 0;
  const newThisWeek = bookings?.filter(b => (b.created_at?.slice(0, 10) ?? "") >= weekAgoStr).length ?? 0;
  const monthlyTotal = bookings?.filter(b => b.created_at?.slice(0, 10)?.startsWith(monthStr)).length ?? 0;

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const filteredBookings = (bookings ?? []).filter(b => {
    const matchStatus = statusFilter === "All" || b.booking_status === statusFilter;
    const matchSearch = !search || (
      b.booking_ref?.toLowerCase().includes(search.toLowerCase()) ||
      (b as any).contact_name?.toLowerCase()?.includes(search.toLowerCase())
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
    <Layout>
      <PageHeader
        title="Reservations Dashboard"
        subtitle="Booking calendar, arrivals, departures, and reservation management"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/booking/bookings/new")} className="gap-1.5">
              <Plus className="h-4 w-4" /> Full Form
            </Button>
            <Button size="sm" className="gap-1.5 bg-[#E8621A] hover:bg-[#d4541a] text-white" onClick={() => setQuickBookingOpen(true)}>
              <Plus className="h-4 w-4" /> Quick Booking
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Active Bookings" value={activeCount} icon={CheckCircle} colorClass="bg-green-600" sublabel="Currently checked in" />
          <KpiCard label="Pending Approval" value={pendingCount} icon={Clock} colorClass={pendingCount > 0 ? "bg-amber-500" : "bg-gray-400"} sublabel="Awaiting sign-off" />
          <KpiCard label="New This Week" value={newThisWeek} icon={CalendarDays} colorClass="bg-blue-500" sublabel="Created last 7 days" />
          <KpiCard label="Monthly Total" value={monthlyTotal} icon={Users} colorClass="bg-indigo-500" sublabel="All bookings this month" />
        </div>

        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              7-Day Availability Calendar
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground font-medium min-w-[160px] text-center">{weekLabel}</span>
              <Button variant="outline" size="sm" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            </div>
          </div>
          <GanttCalendar
            key={calendarKey}
            weekStart={weekStart}
            onBookingClick={(id) => navigate(`/booking/bookings/${id}`)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ArrivalDeparturePanel type="arrivals" onActionDone={() => { refetchBookings(); setCalendarKey(k => k + 1); }} />
          <ArrivalDeparturePanel type="departures" onActionDone={() => { refetchBookings(); setCalendarKey(k => k + 1); }} />
        </div>

        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">All Bookings</h3>
            <Link href="/booking/bookings" className="text-xs text-[#E8621A] hover:underline">Open full list →</Link>
          </div>
          <div className="px-4 py-3 border-b flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ref or guest…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["All", "Draft", "PendingPayment", "PendingApproval", "Confirmed", "Active", "CheckedOut", "Cancelled"].map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s === "All" ? "All Statuses" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {["Ref #", "Guest", "Space", "Check-in", "Check-out", "Nights", "Amount", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No bookings found</td></tr>
                ) : paginated.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-medium">{b.booking_ref}</td>
                    <td className="px-3 py-2">{(b as any).contact_name ?? "—"}</td>
                    <td className="px-3 py-2">{(b as any).space_name ?? "—"}</td>
                    <td className="px-3 py-2">{b.check_in_date ?? "—"}</td>
                    <td className="px-3 py-2">{b.check_out_date ?? "—"}</td>
                    <td className="px-3 py-2">{b.stay_nights ?? "—"}</td>
                    <td className="px-3 py-2">
                      {b.total_rent ? `${b.currency ?? "AUD"} ${parseFloat(b.total_rent).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                        {b.booking_status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/booking/bookings/${b.id}`} className="text-[#E8621A] hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
              <span className="text-muted-foreground">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredBookings.length)} of {filteredBookings.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
                <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Next ›</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickBookingPanel open={quickBookingOpen} onClose={() => setQuickBookingOpen(false)} />
    </Layout>
  );
}
