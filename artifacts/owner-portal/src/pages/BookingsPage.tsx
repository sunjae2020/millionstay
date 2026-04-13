import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { Calendar, AlertCircle } from "lucide-react";

interface Booking {
  id: number;
  booking_ref: string;
  booking_status: string;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
  total_rent: string;
  tenant: { display_name: string; gender: string } | null;
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: Booking[] }>("/v1/owner/bookings")
      .then((d) => setBookings(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter
    ? bookings.filter((b) => b.booking_status === statusFilter)
    : bookings;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Occupancy</h1>
        <p className="text-muted-foreground text-sm mt-1">Current and past tenant occupancy across your properties</p>
      </div>

      <div className="flex items-center gap-3 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
        <p className="text-sm text-yellow-700">
          Tenant details are partially masked to protect privacy. Full details are managed by MillionStay.
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {["Draft", "Confirmed", "Active", "CheckedOut", "Cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property / Space</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rate</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No bookings found</td></tr>
            )}
            {filtered.map((b) => (
              <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.booking_ref ?? `#${b.id}`}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{b.tenant?.display_name ?? "—"}</div>
                  {b.tenant?.gender && (
                    <div className="text-xs text-muted-foreground capitalize">{b.tenant.gender}</div>
                  )}
                  <div className="text-xs text-muted-foreground italic">(masked)</div>
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
                    {b.check_out_date ? new Date(b.check_out_date).toLocaleDateString() : "Ongoing"}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  ${Number(b.agreed_weekly_rate ?? 0).toLocaleString()}/wk
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                    {b.booking_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
