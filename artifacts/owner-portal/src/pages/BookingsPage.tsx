import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useServerList } from "@/lib/useServerList";
import { TablePagination } from "@/components/TablePagination";
import { OccupancyCalendar } from "@/components/OccupancyCalendar";
import { Calendar, CalendarDays, List, Search, X } from "lucide-react";

interface Booking {
  id: number;
  booking_ref: string;
  booking_status: string;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
  total_rent: string;
  tenant: { display_name: string; first_name: string; last_name: string; gender: string } | null;
  space_name: string;
  property_name: string;
}

const STATUS_CLS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-700",
  Active: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
  CheckedOut: "bg-purple-100 text-purple-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function BookingsPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = useMemo(
    () => ({
      booking_status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [statusFilter, dateFrom, dateTo],
  );

  const {
    items: bookings,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize,
  } = useServerList<Booking>("/v1/owner/bookings", { search, params });

  const hasFilters = !!(statusFilter || search.trim() || dateFrom || dateTo);
  const clearFilters = () => { setStatusFilter(""); setSearch(""); setDateFrom(""); setDateTo(""); };

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("bookings.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("bookings.subtitle")}</p>
        </div>
        <div className="inline-flex rounded-lg border border-input overflow-hidden">
          <button
            onClick={() => setView("calendar")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${view === "calendar" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/60"}`}
          >
            <CalendarDays className="w-4 h-4" /> {t("bookings.view_calendar")}
          </button>
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/60"}`}
          >
            <List className="w-4 h-4" /> {t("bookings.view_list")}
          </button>
        </div>
      </div>

      {view === "calendar" && <OccupancyCalendar />}

      {view === "list" && (
      <>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("bookings.search_placeholder")}
            className="w-64 pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("common.all_statuses")}</option>
          {["Draft", "Confirmed", "Active", "CheckedOut", "Cancelled"].map((s) => (
            <option key={s} value={s}>{t(`status.${s}`, s)}</option>
          ))}
        </select>

        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">{t("bookings.date_from")}</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">{t("bookings.date_to")}</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-input text-foreground text-sm font-medium hover:bg-muted/60"
          >
            <X className="w-4 h-4" /> {t("common.clear")}
          </button>
        )}

        <span className="text-sm text-muted-foreground ml-auto self-center">
          {t("bookings.result_count", { count: total })}
        </span>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_ref")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_tenant")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_property_space")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_period")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_rate")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            )}
            {!loading && bookings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("bookings.no_bookings")}</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.booking_ref ?? `#${b.id}`}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">
                    {b.tenant ? (
                      <>
                        {b.tenant.first_name} <span className="uppercase">{b.tenant.last_name}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                  {b.tenant?.gender && b.tenant.gender !== "—" && (
                    <div className="text-xs text-muted-foreground capitalize">{b.tenant.gender}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{b.property_name}</div>
                  <div className="text-xs text-muted-foreground">{b.space_name}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="flex items-center gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    {b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : "—"}
                    {" → "}
                    {b.check_out_date ? new Date(b.check_out_date).toLocaleDateString() : t("common.ongoing")}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  ${Number(b.agreed_weekly_rate ?? 0).toLocaleString()}/wk
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                    {t(`status.${b.booking_status}`, b.booking_status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
      </>
      )}
    </Layout>
  );
}
