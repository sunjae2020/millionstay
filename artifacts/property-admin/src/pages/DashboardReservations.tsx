import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { apiFetch } from "@/lib/apiFetch";
import { useListBookings } from "@workspace/api-client-react";
import {
  CalendarDays, LogIn, LogOut, Clock, ChevronLeft, ChevronRight,
  Users, CheckCircle, XCircle, Plus, Search, Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Draft:           { bg: "#f8fafc", text: "#64748b", border: "#cbd5e1" },
  PendingPayment:  { bg: "#fef9c3", text: "#854d0e", border: "#fde68a" },
  PendingApproval: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  Confirmed:       { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  Active:          { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  CheckedOut:      { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  Cancelled:       { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  Draft:           "bg-slate-100 text-slate-600",
  PendingPayment:  "bg-yellow-100 text-yellow-800",
  PendingApproval: "bg-orange-100 text-orange-800",
  Confirmed:       "bg-blue-100 text-blue-800",
  Active:          "bg-green-100 text-green-700",
  CheckedOut:      "bg-red-100 text-red-800",
  Cancelled:       "bg-gray-100 text-gray-500",
};

interface CalendarData {
  start: string;
  end: string;
  spaces: {
    id: number;
    name: string;
    property_name: string | null;
    bookings: {
      id: number;
      booking_ref: string;
      booking_status: string;
      check_in_date: string;
      check_out_date: string;
      guest_name: string | null;
    }[];
  }[];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function GanttCalendar({ weekStart, onBookingClick }: { weekStart: string; onBookingClick: (id: number) => void }) {
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
                    onClick={() => onBookingClick(bk.id)}
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
        {Object.entries(STATUS_COLORS).slice(0, 6).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: colors.bg, borderColor: colors.border }} />
            <span className="text-[10px] text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ArrivalDeparture {
  id: number;
  booking_ref: string;
  contact_name: string | null;
  space_name: string | null;
  property_address: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  booking_status: string;
}

function ArrivalDeparturePanel({ type }: { type: "arrivals" | "departures" }) {
  const [items, setItems] = useState<ArrivalDeparture[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [processing, setProcessing] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/v1/bookings/today/${type}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: number) {
    const endpoint = type === "arrivals" ? "check-in" : "check-out";
    setProcessing(id);
    try {
      const r = await apiFetch(`/api/v1/bookings/${id}/${endpoint}`, { method: "PATCH" });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: "Error", description: err.error ?? "Failed", variant: "destructive" });
      } else {
        toast({ title: type === "arrivals" ? "Checked in" : "Checked out", description: "Status updated." });
        load();
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  }

  const isArrivals = type === "arrivals";
  const title = isArrivals ? "Today's Arrivals" : "Today's Departures";
  const Icon = isArrivals ? LogIn : LogOut;
  const actionLabel = isArrivals ? "Check In" : "Check Out";
  const iconColor = isArrivals ? "text-green-600" : "text-amber-600";
  const btnClass = isArrivals ? "bg-green-600 hover:bg-green-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white";

  return (
    <div className="bg-card rounded-lg border flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs bg-muted rounded-full px-2 py-0.5 font-medium">{items.length}</span>
      </div>
      <div className="flex-1 overflow-auto max-h-64">
        {loading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">None today</div>
        ) : (
          <div className="divide-y">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.contact_name ?? "Guest"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.booking_ref} · {item.space_name ?? "Space"}</p>
                </div>
                <button
                  className={`text-[10px] px-2 py-1 rounded font-medium shrink-0 ${btnClass} ${processing === item.id ? "opacity-50" : ""}`}
                  onClick={() => handleAction(item.id)}
                  disabled={processing === item.id}
                >
                  {processing === item.id ? "…" : actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, colorClass, sublabel }: {
  label: string; value: number | string; icon: React.ComponentType<{ className?: string }>;
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

export default function DashboardReservations() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const today = new Date();
  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().slice(0, 10);
  };
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  });

  const { data: bookings } = useListBookings({});

  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const monthStr = todayStr.slice(0, 7);

  const activeCount = bookings?.filter(b => b.booking_status === "Active").length ?? 0;
  const pendingCount = bookings?.filter(b => b.booking_status === "PendingApproval").length ?? 0;
  const newThisWeek = bookings?.filter(b => b.created_at?.slice(0, 10) >= weekAgoStr).length ?? 0;
  const monthlyTotal = bookings?.filter(b => b.created_at?.slice(0, 10)?.startsWith(monthStr)).length ?? 0;

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const filteredBookings = (bookings ?? []).filter(b => {
    const matchStatus = statusFilter === "All" || b.booking_status === statusFilter;
    const matchSearch = !search || (b.booking_ref?.toLowerCase().includes(search.toLowerCase()) || b.contact_name?.toLowerCase()?.includes(search.toLowerCase()));
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
          <Link href="/booking/bookings/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Reservation
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Active Bookings" value={activeCount} icon={CheckCircle} colorClass="bg-green-600" sublabel="Currently checked in" />
          <KpiCard label="Pending Approval" value={pendingCount} icon={Clock} colorClass={pendingCount > 0 ? "bg-amber-500" : "bg-gray-400"} sublabel="Awaiting manager sign-off" />
          <KpiCard label="New This Week" value={newThisWeek} icon={CalendarDays} colorClass="bg-blue-500" sublabel="Bookings in last 7 days" />
          <KpiCard label="Monthly Total" value={monthlyTotal} icon={Users} colorClass="bg-indigo-500" sublabel="All bookings this month" />
        </div>

        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
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
          <GanttCalendar weekStart={weekStart} onBookingClick={(id) => navigate(`/booking/bookings/${id}`)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ArrivalDeparturePanel type="arrivals" />
          <ArrivalDeparturePanel type="departures" />
        </div>

        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">All Bookings</h3>
            <Link href="/booking/bookings" className="text-xs text-[#E8621A] hover:underline">Open full list →</Link>
          </div>
          <div className="px-4 py-3 border-b flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search ref or guest…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  {["Ref #", "Guest", "Space", "Check-in", "Check-out", "Nights", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No bookings found</td></tr>
                ) : paginated.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono">{b.booking_ref}</td>
                    <td className="px-3 py-2">{(b as any).contact_name ?? "—"}</td>
                    <td className="px-3 py-2">{(b as any).space_name ?? "—"}</td>
                    <td className="px-3 py-2">{b.check_in_date ?? "—"}</td>
                    <td className="px-3 py-2">{b.check_out_date ?? "—"}</td>
                    <td className="px-3 py-2">{b.stay_nights ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE_CLASSES[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
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
              <span className="text-muted-foreground">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredBookings.length)} of {filteredBookings.length}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
                <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Next ›</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
