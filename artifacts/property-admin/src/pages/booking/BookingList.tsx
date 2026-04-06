import { useState } from "react";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListBookings, useConfirmBooking, useCheckInBooking, getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, List, Calendar } from "lucide-react";

const BOOKING_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  PendingPayment: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PendingApproval: "bg-amber-100 text-amber-800 border-amber-200",
  Confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  Active: "bg-green-100 text-green-700 border-green-200",
  CheckedOut: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  NoShow: "bg-pink-100 text-pink-700 border-pink-200",
};

const CALENDAR_COLORS: Record<string, string> = {
  Draft: "#9ca3af",
  PendingPayment: "#eab308",
  PendingApproval: "#f59e0b",
  Confirmed: "#3b82f6",
  Active: "#22c55e",
  CheckedOut: "#6366f1",
  Cancelled: "#ef4444",
  NoShow: "#ec4899",
};

function BookingStatusBadge({ status }: { status: string }) {
  const cls = BOOKING_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{status}</span>;
}

function CalendarView({ bookings }: { bookings: any[] }) {
  const today = new Date();
  const dates: Date[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const spaces = Array.from(new Set(bookings.map((b) => b.space_id).filter(Boolean)));
  const spaceNames: Record<number, string> = {};
  bookings.forEach((b) => { if (b.space_id) spaceNames[b.space_id] = b.space_name ?? `Space #${b.space_id}`; });

  function getBookingsForSpaceDate(spaceId: number, date: Date) {
    const dateStr = date.toISOString().slice(0, 10);
    return bookings.filter((b) => {
      if (b.space_id !== spaceId) return false;
      if (!b.check_in_date || !b.check_out_date) return false;
      return dateStr >= b.check_in_date && dateStr < b.check_out_date;
    });
  }

  if (spaces.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">
        No bookings with spaces assigned to show in calendar view.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b sticky top-0 bg-white z-10">
          <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">Space</div>
          {dates.map((d) => (
            <div key={d.toISOString()} className={`w-8 shrink-0 text-center py-2 border-r text-xs ${d.toDateString() === today.toDateString() ? "bg-orange-50 font-bold text-[#E8621A]" : "text-muted-foreground"}`}>
              <div>{d.getDate()}</div>
              <div className="text-[10px]">{d.toLocaleDateString("en", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
        {spaces.map((spaceId) => (
          <div key={spaceId} className="flex border-b hover:bg-gray-50">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-medium border-r truncate">{spaceNames[spaceId]}</div>
            {dates.map((d) => {
              const bks = getBookingsForSpaceDate(spaceId!, d);
              const bk = bks[0];
              return (
                <div key={d.toISOString()} className="w-8 shrink-0 border-r relative h-10">
                  {bk && (
                    <Link href={`/booking/bookings/${bk.id}`}>
                      <div
                        className="absolute inset-0.5 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: CALENDAR_COLORS[bk.booking_status] ?? "#9ca3af" }}
                        title={`${bk.booking_ref} — ${bk.booking_status}`}
                      />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="p-3 flex flex-wrap gap-3 border-t">
        {Object.entries(CALENDAR_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingList() {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const qc = useQueryClient();

  const params = {
    search: search || undefined,
    booking_status: statusFilter || undefined,
    booking_source: sourceFilter || undefined,
  };
  const { data: bookings, isLoading } = useListBookings(params, {
    query: { queryKey: getListBookingsQueryKey(params) },
  });

  const confirmMutation = useConfirmBooking({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }) },
  });
  const checkInMutation = useCheckInBooking({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }) },
  });

  return (
    <Layout>
      <PageHeader
        title="Bookings"
        subtitle={`${bookings?.length ?? 0} total`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="rounded-none px-3" onClick={() => setView("list")}>
                <List className="w-4 h-4 mr-1" /> List
              </Button>
              <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" className="rounded-none px-3 border-l" onClick={() => setView("calendar")}>
                <Calendar className="w-4 h-4 mr-1" /> Calendar
              </Button>
            </div>
            <Link href="/booking/bookings/new">
              <Button><Plus className="w-4 h-4 mr-1" /> New Booking</Button>
            </Link>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "_all"} onValueChange={(v) => setStatusFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              {["Draft", "PendingPayment", "PendingApproval", "Confirmed", "Active", "CheckedOut", "Cancelled", "NoShow"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter || "_all"} onValueChange={(v) => setSourceFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All sources</SelectItem>
              {["Direct", "Agent", "Website", "Referral"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {view === "calendar" ? (
          <CalendarView bookings={bookings ?? []} />
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Booking Ref", "Guest", "Space", "Check-In", "Check-Out", "Nights", "Rate", "Status", "Source", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                ) : !bookings?.length ? (
                  <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No bookings found</td></tr>
                ) : bookings.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/booking/bookings/${b.id}`} className="font-mono text-xs text-[#E8621A] hover:underline">{b.booking_ref}</Link>
                    </td>
                    <td className="px-4 py-3">{b.account_name ?? b.contact_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.space_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.check_in_date ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.check_out_date ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{b.stay_nights ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.agreed_weekly_rate ? `$${parseFloat(b.agreed_weekly_rate).toFixed(0)}/wk` : "—"}</td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.booking_status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{b.booking_source ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {b.booking_status === "PendingApproval" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={() => confirmMutation.mutate({ id: b.id })}>
                            ✓ Confirm
                          </Button>
                        )}
                        {b.booking_status === "Confirmed" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-[#E8621A] border-orange-300" onClick={() => checkInMutation.mutate({ id: b.id })}>
                            ✓ Check In
                          </Button>
                        )}
                        <Link href={`/booking/bookings/${b.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">Open</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
