import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ChevronRight, AlertTriangle, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useListMyBookings, getListMyBookingsQueryKey } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Calendar, MapPin, Home, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type BookingStatus = string;

const STATUS_COLORS: Record<BookingStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  PendingPayment: "bg-yellow-100 text-yellow-700",
  PendingApproval: "bg-amber-100 text-amber-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Active: "bg-green-100 text-green-700",
  CheckedOut: "bg-indigo-100 text-indigo-700",
  Cancelled: "bg-red-100 text-red-700",
  Completed: "bg-blue-100 text-blue-700",
};

const PULSE_STATUSES = ["PendingApproval", "Active"];

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  const pulse = PULSE_STATUSES.includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {status}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

interface Booking {
  id: number;
  booking_ref: string;
  space_name: string | null;
  property_name: string | null;
  property_address: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  booking_status: string;
  agreed_weekly_rate: number | null;
  total_rent: number | null;
  created_at: string;
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-20 h-20 bg-gradient-to-br from-orange-200 to-orange-100 flex items-center justify-center shrink-0">
          <Home className="h-8 w-8 text-primary/40" />
        </div>
        <div className="flex-1 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">{booking.space_name ?? "Room"}</p>
              {booking.property_address && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {booking.property_address}
                </div>
              )}
            </div>
            <StatusBadge status={booking.booking_status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-400">Ref: <span className="font-mono font-medium text-gray-600">{booking.booking_ref}</span></p>
            <div className="flex gap-2">
              <Link href={`/portal/bookings/${booking.id}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  View
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


export default function PortalBookings() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { token, guest } = useAuthStore();

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/bookings");
  }, [token, setLocation]);

  const { data: bookingsData, isLoading } = useListMyBookings({
    query: {
      enabled: !!token,
      queryKey: getListMyBookingsQueryKey(),
    },
  });

  const bookings: Booking[] = (bookingsData?.data ?? []) as Booking[];

  const filterBookings = (status: string) => {
    if (status === "all") return bookings;
    if (status === "active") return bookings.filter((b) => ["Active", "Confirmed"].includes(b.booking_status));
    if (status === "upcoming") return bookings.filter((b) => ["PendingApproval", "Pending"].includes(b.booking_status));
    if (status === "past") return bookings.filter((b) => ["Completed", "CheckedOut"].includes(b.booking_status));
    if (status === "cancelled") return bookings.filter((b) => b.booking_status === "Cancelled");
    return bookings;
  };

  if (!token) return null;

  return (
    <PortalLayout active="/portal/bookings">
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">My Bookings</h1>
        {/* Action Required Banner for PendingPayment bookings */}
        {bookings.filter((b) => b.booking_status === "PendingPayment" || b.booking_status === "Draft").map((b) => (
          <div key={b.id} className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">Action Required</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-700">
                <span className="font-semibold">{b.space_name ?? "Your booking"}</span> — payment and documents are pending.
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Ref: <span className="font-mono">{b.booking_ref}</span></p>
            </div>
            <button onClick={() => setLocation(`/portal/payment?booking_id=${b.id}`)}
              className="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors">
              <CreditCard className="h-4 w-4" /> Pay & Upload Docs
            </button>
          </div>
        ))}

        <Tabs defaultValue="all">
          <TabsList className="mb-6 bg-white border">
            {["all", "active", "upcoming", "past", "cancelled"].map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize text-sm">
                {tab === "all" ? "All" : tab === "active" ? "Active" : tab === "upcoming" ? "Upcoming" : tab === "past" ? "Past" : "Cancelled"}
              </TabsTrigger>
            ))}
          </TabsList>

          {["all", "active", "upcoming", "past", "cancelled"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))
              ) : filterBookings(tab).length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Home className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No bookings yet</p>
                  <p className="text-sm mt-1">
                    <Link href="/search" className="text-primary hover:underline">Browse available rooms</Link>
                  </p>
                </div>
              ) : (
                filterBookings(tab).map((b) => <BookingCard key={b.id} booking={b} />)
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PortalLayout>
  );
}
