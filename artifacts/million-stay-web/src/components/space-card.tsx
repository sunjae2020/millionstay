import { useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { SpaceSummary } from "@/lib/guest-api";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";

interface SpaceCardProps {
  space: SpaceSummary;
  index?: number;
  highlighted?: boolean;
  checkIn?: string;
  checkOut?: string;
}

export function SpaceCard({ space, index = 0, highlighted = false, checkIn = "", checkOut = "" }: SpaceCardProps) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const { formatDisplayPrice } = useDisplayCurrency();

  const s = space as any;
  const priceCurrency: string = (s.base_currency || s.currency || "AUD").toUpperCase();
  const priceAmount = Number(s.base_weekly_price ?? 0);
  const hasPrice = Number.isFinite(priceAmount) && priceAmount > 0;
  const price = formatDisplayPrice(priceAmount, priceCurrency);
  const priceRef = hasPrice ? price.reference : null;

  const getSpaceTypeLabel = (type: string) => {
    switch (type) {
      case "EntireSpace":   return t('space.entire');
      case "RoomSpace":     return t('space.room');
      case "BedSpace":      return t('space.bed');
      case "Whole Property": return "Entire Space";
      case "Private Room":  return "Private Room";
      case "Shared Room":   return "Shared Room";
      default: return type;
    }
  };

  const imgSrc = s.primary_thumbnail ?? s.primary_image;

  // Gender label
  const genderLabel = s.policy_lady_only
    ? { text: "👩 Female Only", cls: "text-pink-600 border-pink-200 bg-pink-50" }
    : s.policy_same_gender
    ? { text: "👥 Same Gender", cls: "text-blue-600 border-blue-200 bg-blue-50" }
    : null;

  // Space options / highlights — show first 4 items in one compact line
  const highlights: string[] = Array.isArray(s.space_options) ? s.space_options.slice(0, 4) : [];

  // Mandatory services (unique names)
  const mandatoryServices: string[] = Array.isArray(s.mandatory_services) ? s.mandatory_services : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:-translate-y-1 ${highlighted ? "ring-2 ring-primary shadow-md -translate-y-1" : ""}`}
      data-testid={`space-card-${space.id}`}
    >
      <Link href={`/spaces/${space.id}${checkIn || checkOut ? `?${new URLSearchParams([["check_in", checkIn], ["check_out", checkOut]].filter(([, v]) => v) as [string, string][]).toString()}` : ""}`} className="absolute inset-0 z-10">
        <span className="sr-only">View Space</span>
      </Link>

      {/* ── Image ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={space.name}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center gap-1">
            <span className="text-4xl">🏠</span>
            <span className="text-xs text-primary">Photos coming soon</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-background"
          onClick={(e) => e.preventDefault()}
        >
          <Heart className="h-4 w-4" />
        </Button>
        <div className="absolute top-3 left-3 z-20 flex gap-2">
          <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm font-medium">
            {getSpaceTypeLabel(space.space_type)}
          </Badge>
          {s.booking_mode === "Instant" && (
            <Badge className="bg-green-500 hover:bg-green-500 text-white font-medium border-0">
              ⚡ Instant
            </Badge>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex flex-col flex-1">

        {/* Name */}
        <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors mb-1">
          {space.name}
        </h3>

        {/* Address / suburb */}
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
          {s.suburb_name ? s.suburb_name : s.property_city ?? ""}
          {s.property_address ? ` · ${s.property_address}` : ""}
        </p>

        {/* Gender badge */}
        {genderLabel && (
          <div className="mb-2">
            <Badge variant="outline" className={`text-xs ${genderLabel.cls}`}>
              {genderLabel.text}
            </Badge>
          </div>
        )}

        {/* Highlights (space options) — 1 compact line */}
        {highlights.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            ✨ {highlights.join(" · ")}
          </p>
        )}

        {/* Mandatory services — 1 compact line */}
        {mandatoryServices.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            📋 {mandatoryServices.join(" · ")}
          </p>
        )}

        {/* Price */}
        <div className="mt-auto pt-3 border-t flex items-end justify-between">
          <div>
            {s.min_contract_period ? (
              <div className="text-xs text-muted-foreground mb-0.5">
                {t('space.min_stay', { weeks: s.min_contract_period })}
              </div>
            ) : null}
            <div className="font-bold text-lg">
              {price.primary}{" "}
              <span className="text-sm font-normal text-muted-foreground">{t('space.per_week')}</span>
            </div>
            {priceRef && (
              <div className="text-xs text-muted-foreground mt-0.5">{priceRef}</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
