import { useState } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("_all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["booking-report", from, to, status],
    queryFn: () => fetchReport({ from, to, ...(status !== "_all" ? { status } : {}) }),
  });

  const rows: any[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <Layout>
      <PageHeader
        title={<><BarChart2 className="h-5 w-5" />Booking Report</>}
        subtitle="Occupancy and booking analytics"
      />
      <div className="px-8 py-6">
        <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">From Date</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" />
          </div>
          <div>
            <Label className="text-xs">To Date</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" />
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

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking Ref</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead className="text-right">Weeks</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No bookings found. Adjust filters and run the report.</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm text-blue-600">{r.booking_ref}</TableCell>
                  <TableCell className="text-sm">{r.guest_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.space_name}</TableCell>
                  <TableCell className="text-sm">{r.check_in_date}</TableCell>
                  <TableCell className="text-sm">{r.check_out_date}</TableCell>
                  <TableCell className="text-sm text-right">{r.weeks}</TableCell>
                  <TableCell className="text-sm text-right">${r.agreed_weekly_rate}/wk</TableCell>
                  <TableCell className="text-sm text-right font-medium">${Number(r.total_rent ?? 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[r.booking_status] ?? "bg-gray-100 text-gray-700"}>
                      {r.booking_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={7} className="text-right">Total: {meta.total} bookings</TableCell>
                  <TableCell className="text-right">
                    ${Number(meta.total_revenue ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
