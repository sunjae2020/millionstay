import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import AdminLayout from "@/components/admin-layout";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const API = import.meta.env.VITE_API_URL ?? "";
const ADMIN_KEY = "ms_admin_key";
function getKey() { return localStorage.getItem(ADMIN_KEY) ?? ""; }

type Booking = {
  id: number; bookingRef: string; checkInDate: string | null; checkOutDate: string | null;
  contractStatus: string; totalAmount: string | null;
  guestFirstName: string; guestLastName: string; guestEmail: string;
  spaceName: string; createdAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-600",
    PendingPayment: "bg-amber-100 text-amber-700",
    Confirmed: "bg-blue-100 text-blue-700",
    Active: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-600",
    Completed: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

const ALL_STATUSES = ["All", "Draft", "PendingPayment", "Confirmed", "Active", "Cancelled", "Completed"];

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const key = getKey();
    if (!key) { setLocation("/admin"); return; }
    fetch(`${API}/api/v1/admin/bookings`, { headers: { "x-admin-api-key": key } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setBookings(d.data); })
      .finally(() => setLoading(false));
  }, [setLocation]);

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.bookingRef.toLowerCase().includes(q)
      || `${b.guestFirstName} ${b.guestLastName}`.toLowerCase().includes(q)
      || b.guestEmail.toLowerCase().includes(q)
      || (b.spaceName ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || b.contractStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            <p className="text-gray-500 text-sm mt-0.5">{bookings.length} total bookings</p>
          </div>
        </div>

        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by ref, guest, space…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s ? "bg-primary text-white" : "bg-white border text-gray-600 hover:border-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Ref</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Guest</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Space</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Check In</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Check Out</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No bookings found</td></tr>
                )}
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/bookings/${b.id}`}>
                        <span className="text-primary font-mono font-semibold hover:underline cursor-pointer">{b.bookingRef}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{b.guestFirstName} {b.guestLastName}</p>
                      <p className="text-gray-400 text-xs">{b.guestEmail}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700 max-w-[150px] truncate">{b.spaceName ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmtDate(b.checkInDate)}</td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmtDate(b.checkOutDate)}</td>
                    <td className="px-5 py-3 text-gray-800 font-medium">
                      {b.totalAmount ? `$${Number(b.totalAmount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={b.contractStatus} /></td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
