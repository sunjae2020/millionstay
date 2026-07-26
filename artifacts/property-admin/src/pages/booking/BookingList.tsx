import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListBookings, useConfirmBooking, useCheckInBooking, getListBookingsQueryKey,
  type ListBookingsParams, type BookingListItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, List, Calendar } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";

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
  const { t } = useTranslation();
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
        {t('booking.no_spaces_calendar')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b sticky top-0 bg-white z-10">
          <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">{t('booking.col_space')}</div>
          {dates.map((d) => (
            <div key={d.toISOString()} className={`w-8 shrink-0 text-center py-2 border-r text-xs ${d.toDateString() === today.toDateString() ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"}`}>
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
  const { t } = useTranslation();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const params: ListBookingsParams & { deleted?: string } = {
    search: search || undefined,
    booking_status: statusFilter || undefined,
    booking_source: sourceFilter || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
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

  const columns: ColumnDef<BookingListItem>[] = useMemo(
    () => [
      {
        key: "booking_ref",
        header: "booking.col_ref",
        hideable: false,
        cell: (b) => (
          <Link href={`/booking/bookings/${b.id}`} className="font-mono text-xs text-primary hover:underline">{b.booking_ref}</Link>
        ),
      },
      {
        key: "guest",
        header: "booking.col_guest",
        sortAccessor: (b) => b.account_name ?? b.contact_name ?? "",
        cell: (b) => b.account_name ?? b.contact_name ?? "—",
      },
      {
        key: "space_name",
        header: "booking.col_space",
        cell: (b) => <span className="text-muted-foreground">{b.space_name ?? "—"}</span>,
      },
      {
        key: "check_in_date",
        header: "booking.col_checkin",
        cell: (b) => <span className="text-muted-foreground whitespace-nowrap">{b.check_in_date ?? "—"}</span>,
      },
      {
        key: "check_out_date",
        header: "booking.col_checkout",
        cell: (b) => <span className="text-muted-foreground whitespace-nowrap">{b.check_out_date ?? "—"}</span>,
      },
      {
        key: "stay_nights",
        header: "booking.col_nights",
        align: "center",
        cell: (b) => b.stay_nights ?? "—",
      },
      {
        key: "agreed_weekly_rate",
        header: "booking.col_rate",
        cell: (b) => <span className="whitespace-nowrap">{b.agreed_weekly_rate ? `$${parseFloat(b.agreed_weekly_rate).toFixed(0)}/wk` : "—"}</span>,
      },
      {
        key: "booking_status",
        header: "booking.col_status",
        cell: (b) => <BookingStatusBadge status={b.booking_status} />,
      },
      {
        key: "booking_source",
        header: "booking.col_source",
        cell: (b) => <span className="text-muted-foreground">{b.booking_source ?? "—"}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        cell: (b) => (
          <div className="flex items-center gap-1 justify-end">
            {b.booking_status === "PendingApproval" && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={() => confirmMutation.mutate({ id: b.id })}>
                {t("booking.btn_confirm")}
              </Button>
            )}
            {b.booking_status === "Confirmed" && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-primary border-primary/30" onClick={() => checkInMutation.mutate({ id: b.id })}>
                {t("booking.btn_checkin")}
              </Button>
            )}
            <Link href={`/booking/bookings/${b.id}`}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">{t("common.open")}</Button>
            </Link>
          </div>
        ),
      },
    ],
    [t, confirmMutation, checkInMutation],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.booking")}
        subtitle={`${bookings?.length ?? 0} ${t("common.total")}`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="rounded-none px-3" onClick={() => setView("list")}>
                <List className="w-4 h-4 mr-1" /> {t("booking.view_list")}
              </Button>
              <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" className="rounded-none px-3 border-l" onClick={() => setView("calendar")}>
                <Calendar className="w-4 h-4 mr-1" /> {t("booking.view_calendar")}
              </Button>
            </div>
            <Link href="/booking/bookings/new">
              <Button><Plus className="w-4 h-4 mr-1" /> {t("booking.new")}</Button>
            </Link>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {view === "calendar" ? (
          <CalendarView bookings={bookings ?? []} />
        ) : (
          <DataTable
            tableKey="bookings"
            columns={columns}
            data={bookings}
            isLoading={isLoading}
            rowKey={(b) => b.id}
            emptyText={t("booking.no_bookings")}
            selection={{
              enable: true,
              resource: "bookings",
              onChanged: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }),
            }}
            showDeleted={showDeleted}
            onToggleShowDeleted={setShowDeleted}
            toolbarExtra={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder={t("booking.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter || "_all"} onValueChange={(v) => setStatusFilter(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("booking.all_statuses")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("booking.all_statuses")}</SelectItem>
                    {["Draft", "PendingPayment", "PendingApproval", "Confirmed", "Active", "CheckedOut", "Cancelled", "NoShow"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter || "_all"} onValueChange={(v) => setSourceFilter(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder={t("booking.all_sources")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("booking.all_sources")}</SelectItem>
                    {["Direct", "Agent", "Website", "Referral"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}
      </div>
    </Layout>
  );
}
