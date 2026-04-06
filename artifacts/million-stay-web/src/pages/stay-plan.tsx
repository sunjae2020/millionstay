import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Star, Check, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListPublicSpaces } from "@/lib/guest-api";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const PLANS = [
  {
    id: "1month",
    duration: "1-Month",
    label: "Stay",
    badge: "Flexible Contract",
    badgeColor: "bg-blue-600",
    price: "From $440/wk",
    description: "Perfect for short-term stays, visa renewals, or trying out Melbourne before committing.",
    perks: ["No long-term lock-in", "Weekly or monthly payment", "Flexible move-out dates", "All bills included"],
    highlight: false,
  },
  {
    id: "3month",
    duration: "3-Month",
    label: "Stay",
    badge: "Better Value",
    badgeColor: "bg-blue-600",
    price: "From $440/wk",
    description: "Ideal for students completing a semester or professionals on project assignments.",
    perks: ["Priority room selection", "Weekly or monthly payment", "Discounted rate vs 1-month", "All bills included"],
    highlight: true,
  },
  {
    id: "6month",
    duration: "6-Month",
    label: "Stay",
    badge: "Best Deal",
    badgeColor: "bg-blue-600",
    price: "From $350/wk",
    description: "Our most popular option for full-year students seeking stability and the lowest weekly rate.",
    perks: ["Lowest weekly rate", "Priority room selection", "Free airport pickup (first stay)", "All bills included"],
    highlight: false,
  },
];

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } };
}

interface Space {
  id: number;
  name: string;
  suburb: string | null;
  price_per_week: number | null;
  room_type: string | null;
  rating: number | null;
  primary_thumbnail?: string | null;
}

function SpaceCard({ space }: { space: Space }) {
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
            <span className="text-gray-400 text-xs">/wk</span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary hover:bg-orange-50 px-2">
            View →
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function StayPlan() {
  const [activePlan, setActivePlan] = useState<string | null>(null);

  const { data } = useListPublicSpaces({
    query: { queryKey: ["stay-plan-spaces"] },
  });
  const spaces: Space[] = ((data?.data ?? []) as Space[]).slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Banner */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={heroBg} alt="Stay Plans" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="font-cursive text-white/80 text-lg italic mb-1">Find your perfect length of stay</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">Choose Your Stay Plan</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600">Stay Plans</span>
      </div>

      {/* Plan cards */}
      <section className="max-w-7xl mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.id} {...fade(i * 0.08)}
              onClick={() => setActivePlan(activePlan === plan.id ? null : plan.id)}
              className={`relative rounded-2xl border-2 p-7 cursor-pointer transition-all ${
                activePlan === plan.id
                  ? "border-primary bg-orange-50 shadow-lg"
                  : plan.highlight
                  ? "border-primary/40 bg-white shadow-md"
                  : "border-gray-200 bg-white hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Most Popular
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
                {activePlan === plan.id ? "Selected ✓" : "MORE"}
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
                OPTIONS WILL SHOW ONCE A PLAN IS CLICKED
              </motion.p>
            )}
          </AnimatePresence>

          <div className="text-center mb-8">
            <p className="font-cursive text-primary text-xl italic">Explore Your Options</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {spaces.length > 0 ? (
              spaces.map((space) => <SpaceCard key={space.id} space={space} />)
            ) : (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border h-64 animate-pulse" />
              ))
            )}
          </div>

          <div className="flex justify-center mt-8">
            <Link href="/search">
              <Button className="bg-primary text-white hover:bg-primary/90 px-8 rounded-full font-semibold">
                SEE ALL →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
