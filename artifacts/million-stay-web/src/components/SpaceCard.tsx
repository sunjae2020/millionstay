import { Link } from "wouter";
import { MapPin, Users, DollarSign, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Space } from "@/lib/api";

interface SpaceCardProps {
  space: Space;
}

function spaceTypeLabel(type: string | null) {
  if (!type) return "Room";
  const labels: Record<string, string> = {
    Studio: "Studio",
    SingleRoom: "Single Room",
    DoubleRoom: "Double Room",
    Suite: "Suite",
    Apartment: "Apartment",
    Office: "Office",
    Desk: "Hot Desk",
    MeetingRoom: "Meeting Room",
  };
  return labels[type] ?? type;
}

export default function SpaceCard({ space }: SpaceCardProps) {
  const price = space.base_weekly_price
    ? Number(space.base_weekly_price).toLocaleString()
    : null;
  const currency = space.base_currency ?? "AUD";

  return (
    <Link href={`/spaces/${space.id}`}>
      <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {space.primary_image ? (
            <img
              src={space.primary_image}
              alt={space.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
              <div className="text-5xl opacity-30">🏠</div>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge className="bg-white/90 text-foreground text-xs font-medium shadow-sm">
              {spaceTypeLabel(space.space_type)}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {space.name}
            </h3>
            {(space.property_city || space.property_address) && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="line-clamp-1">
                  {[space.property_name, space.property_city].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Options */}
          {space.space_options.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {space.space_options.slice(0, 3).map((opt) => (
                <span key={opt} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {opt}
                </span>
              ))}
              {space.space_options.length > 3 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  +{space.space_options.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-end justify-between mt-auto pt-2 border-t">
            <div>
              {price ? (
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs text-muted-foreground">{currency}</span>
                  <span className="text-base font-bold text-foreground">${price}</span>
                  <span className="text-xs text-muted-foreground">/wk</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Price on request</span>
              )}
              {space.min_stay_weeks && (
                <p className="text-xs text-muted-foreground">Min {space.min_stay_weeks}wk stay</p>
              )}
            </div>
            {space.max_occupancy && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>{space.max_occupancy}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
