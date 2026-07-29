import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import AdminLayout from "@/components/admin-layout";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/dateFormat";
import { CalendarCheck, Users, Home, FileWarning } from "lucide-react";

import { getApiBase } from "@/lib/api-base";
import { APP_NAME } from "../lib/appName";
const API = getApiBase();
const ADMIN_KEY = "ms_admin_key";

function getKey() { return localStorage.getItem(ADMIN_KEY) ?? ""; }

type Stats = { totalBookings: number; totalGuests: number; activeSpaces: number; pendingDocuments: number };
type Booking = {
  id: number; bookingRef: string; checkInDate: string | null; checkOutDate: string | null;
  contractStatus: string; guestFirstName: string; guestLastName: string;
  guestEmail: string; spaceName: string; createdAt: string;
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const key = getKey();
    if (!key) { setLocation("/admin"); return; }

    Promise.all([
      fetch(`${API}/api/v1/admin/stats`, { headers: { "x-admin-api-key": key } }).then((r) => r.json()),
      fetch(`${API}/api/v1/admin/bookings`, { headers: { "x-admin-api-key": key } }).then((r) => r.json()),
    ]).then(([s, b]) => {
      if (s.success) setStats(s.data);
      if (b.success) setBookings((b.data as Booking[]).slice(0, 10));
    }).catch(() => setLocation("/admin"));
  }, [setLocation]);

  const STAT_CARDS = stats ? [
    { label: t("legacy_admin.stat_bookings"), value: stats.totalBookings, icon: CalendarCheck, color: "text-blue-600 bg-blue-50" },
    { label: t("legacy_admin.stat_guests"), value: stats.totalGuests, icon: Users, color: "text-green-600 bg-green-50" },
    { label: t("legacy_admin.stat_spaces"), value: stats.activeSpaces, icon: Home, color: "text-primary bg-primary/10" },
    { label: t("legacy_admin.stat_docs"), value: stats.pendingDocuments, icon: FileWarning, color: "text-amber-600 bg-amber-50" },
  ] : [];

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t("legacy_admin.nav_dashboard")}</h1>
        <p className="text-gray-500 text-sm mb-8">{APP_NAME} overview — Melbourne</p>

        {stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-2xl border p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1,2,3,4].map((i) => <div key={i} className="bg-white rounded-2xl border p-5 h-28 animate-pulse" />)}
          </div>
        )}

        <div className="bg-white rounded-2xl border">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-800">{t("legacy_admin.recent_bookings")}</h2>
            <Link href="/admin/bookings">
              <span className="text-sm text-primary font-medium hover:underline cursor-pointer">{t("legacy_admin.view_all")}</span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">{t("legacy_admin.col_ref")}</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">{t("legacy_admin.col_guest")}</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">{t("legacy_admin.col_space")}</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">{t("booking_new.check_in")}</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">{t("legacy_admin.col_status")}</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">{t("legacy_admin.col_created")}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">{t("legacy_admin.no_bookings_yet")}</td></tr>
                )}
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/admin/bookings/${b.id}`}>
                        <span className="text-primary font-mono font-semibold hover:underline cursor-pointer">{b.bookingRef}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-800">{b.guestFirstName} {b.guestLastName}</p>
                      <p className="text-gray-400 text-xs">{b.guestEmail}</p>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{b.spaceName ?? "—"}</td>
                    <td className="px-6 py-3 text-gray-600">{formatDate(b.checkInDate)}</td>
                    <td className="px-6 py-3"><StatusBadge status={b.contractStatus} /></td>
                    <td className="px-6 py-3 text-gray-400">{formatDate(b.createdAt)}</td>
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
