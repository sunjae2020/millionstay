import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Download, Search } from "lucide-react";

const BOOKING_STATUSES = ["Draft", "PendingApproval", "Confirmed", "Active", "CheckedOut", "Cancelled", "NoShow"];

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  PendingApproval: "bg-amber-100 text-amber-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Active: "bg-green-100 text-green-700",
  CheckedOut: "bg-indigo-100 text-indigo-700",
  Cancelled: "bg-red-100 text-red-700",
  NoShow: "bg-pink-100 text-pink-700",
};

async function fetchReport(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  const res = await fetch(`/api/v1/reports/bookings${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function exportCsv(data: any[]) {
  if (!data.length) return;
  const headers = ["Booking Ref", "Guest", "Space", "Check-In", "Check-Out", "Weeks", "Rate", "Total Rent", "Status", "Source"];
  const rows = data.map(r => [
    r.booking_ref, r.guest_name, r.space_name, r.check_in_date, r.check_out_date,
    r.weeks, r.agreed_weekly_rate, r.total_rent, r.booking_status, r.booking_source ?? "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `booking-report-${new Date().toISOString().split("T")[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function BookingReportPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("_all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["booking-report", from, to, status],
    queryFn: () => fetchReport({ from, to, ...(status !== "_all" ? { status } : {}) }),
  });

  const rows: any[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  const columns: ColumnDef<any>[] = useMemo(() => [
    { key: "booking_ref", header: "Booking Ref", cell: (r) => <span className="font-mono text-sm text-primary">{r.booking_ref}</span> },
    { key: "guest_name", header: "Guest", cell: (r) => <span className="text-sm">{r.guest_name}</span> },
    { key: "space_name", header: "Space", cell: (r) => <span className="text-sm text-muted-foreground">{r.space_name}</span> },
    { key: "check_in_date", header: "Check-In", cell: (r) => <span className="text-sm">{r.check_in_date}</span> },
    { key: "check_out_date", header: "Check-Out", cell: (r) => <span className="text-sm">{r.check_out_date}</span> },
    { key: "weeks", header: "Weeks", align: "right", cell: (r) => <span className="text-sm">{r.weeks}</span> },
    { key: "agreed_weekly_rate", header: "Rate", align: "right", cell: (r) => <span className="text-sm">${r.agreed_weekly_rate}/wk</span> },
    { key: "total_rent", header: "Total", align: "right", cell: (r) => <span className="text-sm font-medium">${Number(r.total_rent ?? 0).toFixed(2)}</span> },
    {
      key: "booking_status",
      header: "Status",
      cell: (r) => (
        <Badge className={STATUS_COLORS[r.booking_status] ?? "bg-gray-100 text-gray-700"}>
          {r.booking_status}
        </Badge>
      ),
    },
  ], []);

  return (
    <Layout>
      <PageHeader
        title={<><BarChart2 className="h-5 w-5" />{t("nav.booking_report")}</>}
        subtitle="Occupancy and booking analytics"
      />
      <div className="px-8 py-6">
        <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">From Date</Label>
            <DateInput value={from} onChange={setFrom} className="mt-1 w-40" />
          </div>
          <div>
            <Label className="text-xs">To Date</Label>
            <DateInput value={to} onChange={setTo} className="mt-1 w-40" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                {BOOKING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <Search className="h-4 w-4 mr-2" />Run Report
          </Button>
          <Button variant="outline" onClick={() => exportCsv(rows)} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold mt-1">{meta.total}</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold mt-1">
                ${Number(meta.total_revenue ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })} AUD
              </p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Avg per Booking</p>
              <p className="text-2xl font-bold mt-1">
                ${meta.total > 0 ? Number(meta.total_revenue / meta.total).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} AUD
              </p>
            </div>
          </div>
        )}

        <DataTable
          tableKey="booking-report"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyText="No bookings found. Adjust filters and run the report."
        />

        {rows.length > 0 && (
          <div className="mt-3 flex justify-end gap-6 text-sm font-medium text-muted-foreground">
            <span>Total: {meta.total} bookings</span>
            <span>${Number(meta.total_revenue ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
