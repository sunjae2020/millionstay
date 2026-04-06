import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/admin-layout";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const API = import.meta.env.VITE_API_URL ?? "";
const ADMIN_KEY = "ms_admin_key";
function getKey() { return localStorage.getItem(ADMIN_KEY) ?? ""; }

type Guest = {
  id: number; email: string; firstName: string; lastName: string;
  phone: string | null; nationality: string | null; isActive: boolean; createdAt: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

export default function AdminGuests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const key = getKey();
    if (!key) { setLocation("/admin"); return; }
    fetch(`${API}/api/v1/admin/guests`, { headers: { "x-admin-api-key": key } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setGuests(d.data); })
      .finally(() => setLoading(false));
  }, [setLocation]);

  const filtered = guests.filter((g) => {
    const q = search.toLowerCase();
    return !q
      || `${g.firstName} ${g.lastName}`.toLowerCase().includes(q)
      || g.email.toLowerCase().includes(q)
      || (g.nationality ?? "").toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guests</h1>
            <p className="text-gray-500 text-sm mt-0.5">{guests.length} registered guests</p>
          </div>
        </div>

        <div className="mb-5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, nationality…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Phone</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Nationality</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No guests found</td></tr>
                )}
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{g.firstName} {g.lastName}</td>
                    <td className="px-5 py-3 text-gray-600">{g.email}</td>
                    <td className="px-5 py-3 text-gray-500">{g.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{g.nationality ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        g.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {g.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{fmtDate(g.createdAt)}</td>
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
