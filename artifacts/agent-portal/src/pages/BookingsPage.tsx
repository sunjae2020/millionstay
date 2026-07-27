import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useServerList } from "@/lib/useServerList";
import { TablePagination } from "@/components/TablePagination";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/money";
import { Search, ChevronRight } from "lucide-react";

interface Booking {
  id: number;
  booking_ref: string;
  booking_status: string;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
  total_rent: string;
  space_name: string;
  property_name: string;
  tenant: { display_name: string; email: string } | null;
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { items: bookings, loading, error, page, pageSize, total, totalPages, setPage, setPageSize } =
    useServerList<Booking>("/v1/agent/bookings", {
      search,
      params: { booking_status: statusFilter || undefined },
    });

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("bookings.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("bookings.subtitle")}</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("bookings.search_placeholder")}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
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
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_ref")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_tenant")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_property_space")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_checkin")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_rate")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("bookings.col_status")}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            )}
            {!loading && bookings.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("bookings.no_bookings")}</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.booking_ref ?? `#${b.id}`}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{b.tenant?.display_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{b.tenant?.email ?? ""}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{b.property_name}</div>
                  <div className="text-xs text-muted-foreground">{b.space_name}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(b.check_in_date)}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {formatMoney(b.agreed_weekly_rate ?? 0)}/wk
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                    {t(`status.${b.booking_status}`, b.booking_status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/bookings/${b.id}`}>
                    <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
    </Layout>
  );
}
