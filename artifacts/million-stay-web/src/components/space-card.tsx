import { useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { SpaceSummary } from "@/lib/guest-api";

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

  const getSpaceTypeLabel = (type: string) => {
    switch (type) {
      case "EntireSpace": return t('space.entire');
      case "RoomSpace": return t('space.room');
      case "BedSpace": return t('space.bed');
      default: return type;
    }
  };

  // Prefer thumbnail for card (faster load), fall back to full image
  const imgSrc = (space as any).primary_thumbnail ?? space.primary_image;

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
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 flex flex-col items-center justify-center gap-1">
            <span className="text-4xl">🏠</span>
            <span className="text-xs text-orange-400">Photos coming soon</span>
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
          {(space as any).booking_mode === "Instant" && (
            <Badge className="bg-green-500 hover:bg-green-500 text-white font-medium border-0">
              ⚡ Instant
            </Badge>
          )}
        </div>
      </div>
      
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {space.name}
          </h3>
          <div className="flex items-center text-sm font-medium whitespace-nowrap">
            <span className="text-yellow-500 mr-1">★</span> 5.0
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
          {space.suburb_name ? `${space.suburb_name}` : ''} {space.address_line1 && `• ${space.address_line1}`}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {space.lady_only ? (
            <Badge variant="outline" className="text-pink-600 border-pink-200 bg-pink-50">{t('space.female_only')}</Badge>
          ) : space.same_gender ? (
             <Badge variant="outline">{t('space.mixed')}</Badge>
          ) : null}
        </div>
        
        <div className="mt-auto pt-4 border-t flex items-end justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">
              {space.min_contract_period ? t('space.min_stay', { weeks: space.min_contract_period }) : ''}
            </div>
            <div className="font-bold text-lg">
              ${space.base_weekly_price} <span className="text-sm font-normal text-muted-foreground">{t('space.per_week')}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
