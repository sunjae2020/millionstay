import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Star, Check, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListPublicSpaces } from "@/lib/guest-api";
import { FALLBACK_SPACES as REAL_FALLBACK } from "@/lib/fallback-spaces";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } };
}

interface Space {
  id: number | string;
  name: string;
  suburb: string | null;
  price_per_week: number | null;
  room_type: string | null;
  rating: number | null;
  primary_thumbnail?: string | null;
}

const FALLBACK_LIST: Space[] = REAL_FALLBACK.slice(0, 6).map((s) => ({
  id: s.id,
  name: s.name,
  suburb: s.suburb_name,
  price_per_week: Number(s.base_weekly_price),
  room_type: "Entire Apartment",
  rating: 5,
  primary_thumbnail: s.primary_thumbnail,
}));

function SpaceCard({ space }: { space: Space }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const img = (space as { primary_thumbnail?: string | null }).primary_thumbnail
    ?? `https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&q=75`;

  return (
    <motion.div {...fade()} onClick={() => setLocation(`/spaces/${space.id}`)}
      className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group">
      <div className="relative h-44 overflow-hidden">
        <img src={img} alt={space.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-gray-700">
          {space.room_type ?? "Room"}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1 mb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-3 w-3 ${i < Math.round(space.rating ?? 4) ? "fill-primary text-primary" : "text-gray-200"}`} />
          ))}
        </div>
        <h3 className="text-sm font-semibold text-gray-800 leading-tight mb-1 truncate">{space.name}</h3>
        <p className="text-xs text-gray-400 mb-3">{space.suburb ?? "Melbourne"} · Queen Bed</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-primary font-bold text-base">${space.price_per_week ?? 440}</span>
            <span className="text-gray-400 text-xs">{t("stay_plan.space_per_week")}</span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary hover:bg-primary/10 px-2">
            {t("stay_plan.space_view")}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function StayPlan() {
  const { t } = useTranslation();
  const [activePlan, setActivePlan] = useState<string | null>(null);

  const PLANS = [
    {
      id: "1month",
      duration: t("stay_plan.p1_duration"),
      label: t("stay_plan.stay"),
      badge: t("stay_plan.p1_badge"),
      badgeColor: "bg-blue-600",
      price: t("stay_plan.p1_price"),
      description: t("stay_plan.p1_desc"),
      perks: [t("stay_plan.p1_perk1"), t("stay_plan.p1_perk2"), t("stay_plan.p1_perk3"), t("stay_plan.p1_perk4")],
      highlight: false,
    },
    {
      id: "3month",
      duration: t("stay_plan.p2_duration"),
      label: t("stay_plan.stay"),
      badge: t("stay_plan.p2_badge"),
      badgeColor: "bg-blue-600",
      price: t("stay_plan.p2_price"),
      description: t("stay_plan.p2_desc"),
      perks: [t("stay_plan.p2_perk1"), t("stay_plan.p2_perk2"), t("stay_plan.p2_perk3"), t("stay_plan.p2_perk4")],
      highlight: true,
    },
    {
      id: "6month",
      duration: t("stay_plan.p3_duration"),
      label: t("stay_plan.stay"),
      badge: t("stay_plan.p3_badge"),
      badgeColor: "bg-blue-600",
      price: t("stay_plan.p3_price"),
      description: t("stay_plan.p3_desc"),
      perks: [t("stay_plan.p3_perk1"), t("stay_plan.p3_perk2"), t("stay_plan.p3_perk3"), t("stay_plan.p3_perk4")],
      highlight: false,
    },
  ];

  const { data, isLoading } = useListPublicSpaces({ limit: 6 });
  const spaces: Space[] = ((data?.data ?? []) as unknown as Space[]).slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Banner */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={heroBg} alt={t("stay_plan.title")} className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="font-cursive text-white/80 text-lg italic mb-1">{t("stay_plan.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("stay_plan.hero_title")}</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">{t("stay_plan.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600">{t("stay_plan.breadcrumb")}</span>
      </div>

      {/* Plan cards */}
      <section className="max-w-7xl mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.id} {...fade(i * 0.08)}
              onClick={() => setActivePlan(activePlan === plan.id ? null : plan.id)}
              className={`relative rounded-2xl border-2 p-7 cursor-pointer transition-all ${
                activePlan === plan.id
                  ? "border-primary bg-primary/5 shadow-lg"
                  : plan.highlight
                  ? "border-primary/40 bg-white shadow-md"
                  : "border-gray-200 bg-white hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {t("stay_plan.most_popular")}
                  </span>
                </div>
              )}
              <div className="mb-1">
                <span className={`text-xs font-semibold text-white px-2.5 py-1 rounded-full ${plan.badgeColor}`}>
                  {plan.badge}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mt-3">{plan.duration}</h2>
              <p className="text-lg font-semibold text-gray-500 mb-4">{plan.label}</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">{plan.description}</p>
              <ul className="space-y-2 mb-6">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>
              <p className="text-primary font-bold text-lg mb-4">{plan.price}</p>
              <button
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  activePlan === plan.id
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                }`}
              >
                {activePlan === plan.id ? t("stay_plan.selected") : t("stay_plan.more")}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Explore options */}
      <section className="bg-gray-50 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence>
            {!activePlan && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-xs text-gray-400 mb-8 uppercase tracking-widest"
              >
                {t("stay_plan.options_hint")}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="text-center mb-8">
            <p className="font-cursive text-primary text-xl italic">{t("stay_plan.explore")}</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(spaces.length > 0 ? spaces : FALLBACK_LIST).map((space) => (
                <SpaceCard key={space.id} space={space} />
              ))}
            </div>
          )}

          <div className="flex justify-center mt-8">
            <Link href="/search">
              <Button className="bg-primary text-white hover:bg-primary/90 px-8 rounded-full font-semibold">
                {t("stay_plan.see_all")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
