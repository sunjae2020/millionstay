import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, MapPin, Calendar, Users, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyBooking } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Confirmed: "bg-green-100 text-green-800 border-green-200",
  Active: "bg-blue-100 text-blue-800 border-blue-200",
  CheckedOut: "bg-gray-100 text-gray-700 border-gray-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getMyBooking(bookingId),
    enabled: !!bookingId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Booking not found</h2>
        <Link href="/portal/bookings">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to bookings</Button>
        </Link>
      </div>
    );
  }

  const b = data.data;
  const statusClass = STATUS_COLORS[b.booking_status] ?? "bg-muted text-muted-foreground border-border";

  const nights = Math.round(
    (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/portal/bookings">
        <Button variant="ghost" size="sm" className="-ml-2 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to bookings
        </Button>
      </Link>

      {/* Header */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-1">{b.booking_ref}</p>
            <h1 className="text-xl font-bold">{b.space_name ?? "Space"}</h1>
            {b.property_name && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{[b.property_name, b.property_address, b.property_city, b.property_state].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusClass}`}>
            {b.booking_status}
          </span>
        </div>
      </div>

      {/* Stay Dates */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          Stay Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Check-in</p>
            <p className="font-medium text-sm">{formatDate(b.check_in_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Check-out</p>
            <p className="font-medium text-sm">{formatDate(b.check_out_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Duration</p>
            <p className="font-medium text-sm">{nights} nights{b.stay_weeks ? ` (${b.stay_weeks} weeks)` : ""}</p>
          </div>
          {b.num_guests != null && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Guests</p>
              <p className="font-medium text-sm">{b.num_guests}</p>
            </div>
          )}
        </div>
      </div>

      {/* Financial */}
      {(b.agreed_weekly_rate || b.total_rent) && (
        <div className="bg-card border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            Financial Summary
          </h2>
          <div className="space-y-2">
            {b.agreed_weekly_rate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weekly rate</span>
                <span>{b.currency ?? "AUD"} ${Number(b.agreed_weekly_rate).toLocaleString()}</span>
              </div>
            )}
            {b.stay_weeks && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span>{b.stay_weeks} weeks</span>
              </div>
            )}
            {b.total_rent && (
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">{b.currency ?? "AUD"} ${Number(b.total_rent).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {b.customer_notes && (
        <div className="bg-card border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-sm mb-2">Your Notes</h2>
          <p className="text-sm text-muted-foreground">{b.customer_notes}</p>
        </div>
      )}

      {/* Cancellation reason */}
      {b.cancellation_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Cancellation Reason</p>
          <p className="text-sm text-red-600">{b.cancellation_reason}</p>
        </div>
      )}
    </div>
  );
}
