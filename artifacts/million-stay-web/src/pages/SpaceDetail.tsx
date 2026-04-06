import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Users, Star, Calendar, DollarSign,
  ChevronLeft, ChevronRight, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";
import { getSpace, createBookingInquiry } from "@/lib/api";

export default function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const spaceId = Number(id);
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [imgIdx, setImgIdx] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [numGuests, setNumGuests] = useState(1);
  const [notes, setNotes] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => getSpace(spaceId),
    enabled: !!spaceId,
  });

  const bookingMutation = useMutation({
    mutationFn: createBookingInquiry,
    onSuccess: (res) => {
      setBookingSuccess(res.data.booking_ref);
      setBookingError(null);
    },
    onError: (err: Error) => {
      setBookingError(err.message);
    },
  });

  function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    setBookingSuccess(null);
    setBookingError(null);
    bookingMutation.mutate({
      space_id: spaceId,
      check_in_date: checkIn,
      check_out_date: checkOut,
      num_guests: numGuests,
      customer_notes: notes || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Space not found</h2>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
          </Button>
        </Link>
      </div>
    );
  }

  const space = data.data;
  const images = space.images ?? [];
  const price = space.base_weekly_price ? Number(space.base_weekly_price).toLocaleString() : null;
  const currency = space.base_currency ?? "AUD";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to listings
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Images + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="relative rounded-xl overflow-hidden bg-muted aspect-[16/9]">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[imgIdx]?.file_url}
                    alt={space.name}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setImgIdx((i) => Math.max(0, i - 1))}
                        disabled={imgIdx === 0}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center disabled:opacity-30 hover:bg-white shadow"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setImgIdx((i) => Math.min(images.length - 1, i + 1))}
                        disabled={imgIdx === images.length - 1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center disabled:opacity-30 hover:bg-white shadow"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                        {imgIdx + 1} / {images.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🏠</div>
              )}
              {space.images_from_parent && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-black/50 text-white text-xs">Property photos</Badge>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setImgIdx(idx)}
                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === imgIdx ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img.thumbnail_url ?? img.file_url} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}

            {/* Title & Location */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{space.name}</h1>
                  {(space.property_city || space.property_address) && (
                    <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="text-sm">
                        {[space.property_name, space.property_address, space.property_city, space.property_state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                {space.space_type && (
                  <Badge variant="secondary" className="shrink-0">{space.space_type}</Badge>
                )}
              </div>

              {/* Key Info */}
              <div className="flex flex-wrap gap-4 mt-4">
                {space.max_occupancy && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>Up to {space.max_occupancy} guest{space.max_occupancy > 1 ? "s" : ""}</span>
                  </div>
                )}
                {space.floor_area_sqm && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">📐</span>
                    <span>{space.floor_area_sqm} m²</span>
                  </div>
                )}
                {space.floor_number && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">🏢</span>
                    <span>Floor {space.floor_number}</span>
                  </div>
                )}
                {space.min_stay_weeks && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Min {space.min_stay_weeks} week stay</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {space.description && (
              <div>
                <h2 className="font-semibold mb-2">About this space</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{space.description}</p>
              </div>
            )}

            {/* Amenities */}
            {space.space_options.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {space.space_options.map((opt) => (
                    <div key={opt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Tiers */}
            {space.pricing_tiers.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3">Pricing Options</h2>
                <div className="grid gap-3">
                  {space.pricing_tiers.map((tier) => (
                    <div key={tier.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium text-sm">{tier.name}</p>
                        {tier.min_contract_period && (
                          <p className="text-xs text-muted-foreground">
                            Min {tier.min_contract_period} {tier.min_contract_period_unit ?? "weeks"}
                          </p>
                        )}
                      </div>
                      {tier.price && (
                        <div className="text-right">
                          <p className="font-bold">{currency} ${Number(tier.price).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">per week</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-xl border bg-card shadow-md p-5">
              {/* Price */}
              <div className="mb-4 pb-4 border-b">
                {price ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">{currency} ${price}</span>
                    <span className="text-muted-foreground text-sm">/ week</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-muted-foreground">Price on request</p>
                )}
                {space.booking_mode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Booking mode: {space.booking_mode}
                  </p>
                )}
              </div>

              {/* Booking Form */}
              {bookingSuccess ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-1">Inquiry Sent!</h3>
                  <p className="text-sm text-muted-foreground mb-1">Your booking reference:</p>
                  <p className="font-mono font-bold text-primary text-lg">{bookingSuccess}</p>
                  <p className="text-xs text-muted-foreground mt-3 mb-4">
                    We'll contact you shortly to confirm your booking.
                  </p>
                  <Link href="/portal/bookings">
                    <Button variant="outline" size="sm" className="w-full">View My Bookings</Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-3">
                  <h3 className="font-semibold text-sm mb-1">Request a Booking</h3>

                  {bookingError && (
                    <Alert variant="destructive">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="text-xs">{bookingError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-medium">Check-in</Label>
                      <Input
                        type="date"
                        required
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="mt-1 text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Check-out</Label>
                      <Input
                        type="date"
                        required
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || new Date().toISOString().split("T")[0]}
                        className="mt-1 text-sm h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Guests</Label>
                    <Input
                      type="number"
                      min={1}
                      max={space.max_occupancy ?? 10}
                      value={numGuests}
                      onChange={(e) => setNumGuests(Number(e.target.value))}
                      className="mt-1 text-sm h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Notes (optional)</Label>
                    <Textarea
                      placeholder="Any special requirements..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 text-sm resize-none h-20"
                    />
                  </div>

                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground text-center">
                      You'll be asked to sign in to complete your booking.
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={bookingMutation.isPending}
                  >
                    {bookingMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                    ) : (
                      "Request Booking"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
