import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, MapPin, Loader2, Plus, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMyBookings } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Confirmed: "bg-green-100 text-green-800 border-green-200",
  Active: "bg-blue-100 text-blue-800 border-blue-200",
  CheckedOut: "bg-gray-100 text-gray-700 border-gray-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  NoShow: "bg-red-100 text-red-700 border-red-200",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Bookings() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: listMyBookings,
  });

  const bookings = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Loading..." : `${bookings.length} booking${bookings.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/">
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" />
            Browse Spaces
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20 bg-card border rounded-xl">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Browse our spaces and make your first booking.
          </p>
          <Link href="/">
            <Button className="bg-primary hover:bg-primary/90">Browse Spaces</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Link key={booking.id} href={`/portal/bookings/${booking.id}`}>
              <div className="bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-medium text-muted-foreground">{booking.booking_ref}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_COLORS[booking.booking_status] ?? "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {booking.booking_status}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm leading-snug">
                      {booking.space_name ?? "Space"}
                    </h3>

                    {booking.property_name && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{[booking.property_name, booking.property_city].filter(Boolean).join(", ")}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(booking.check_in_date)}</span>
                      </div>
                      <span>→</span>
                      <span>{formatDate(booking.check_out_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {booking.total_rent && (
                      <div className="text-right">
                        <p className="font-semibold text-sm">{booking.currency ?? "AUD"} ${Number(booking.total_rent).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">total</p>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
