import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Search, MapPin, Users, Loader2, Send, CheckCircle2 } from "lucide-react";
import {
  useOwnerSite,
  useOwnerSiteSpaces,
  pickContent,
  submitOwnerInquiry,
} from "@/lib/owner-site";
import type { PublicSpacesParams, SpaceSummary } from "@/lib/guest-api";
import { APP_NAME } from "../lib/appName";

const SPACE_TYPES: Array<{ value: PublicSpacesParams["space_type"]; label: string }> = [
  { value: undefined, label: "All types" },
  { value: "EntireSpace", label: "Whole property" },
  { value: "RoomSpace", label: "Private room" },
  { value: "BedSpace", label: "Shared room" },
  { value: "Homestay", label: "Homestay" },
];

export default function OwnerLanding({ slug }: { slug: string }) {
  const { i18n } = useTranslation();
  const lang = i18n.language || "en";
  const { data, isLoading, isError } = useOwnerSite(slug);
  const site = data?.data;

  // Search filter state.
  const [spaceType, setSpaceType] = useState<PublicSpacesParams["space_type"]>(undefined);
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [applied, setApplied] = useState<PublicSpacesParams>({ limit: 24 });

  const spacesQuery = useOwnerSiteSpaces(slug, applied, !!site);
  const spaces = spacesQuery.data?.data ?? [];

  const content = useMemo(() => (site ? pickContent(site.content, lang) : {}), [site, lang]);
  const accent = site?.primary_color || "#0ea5e9";

  // Per-site SEO: title / description / OG, applied client-side.
  useEffect(() => {
    if (!site) return;
    const title = site.seo_title || content.hero_title || `${slug} — ${APP_NAME}`;
    document.title = title;
    setMeta("description", site.seo_description || content.hero_subtitle || "");
    setMetaProp("og:title", title);
    setMetaProp("og:description", site.seo_description || content.hero_subtitle || "");
    if (site.og_image_url) setMetaProp("og:image", site.og_image_url);
  }, [site, content, slug]);

  function applyFilters() {
    setApplied({
      limit: 24,
      space_type: spaceType,
      max_price: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !site) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-6">
        <h1 className="text-2xl font-bold text-gray-800">Site not found</h1>
        <p className="text-gray-500 mt-2">This landing page is not available.</p>
        <a href="https://millionstay.com" className="mt-4 text-sm font-medium" style={{ color: accent }}>
          Go to {APP_NAME} →
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ ["--accent" as any]: accent }}>
      {/* ── Hero ── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 py-24 sm:py-32"
        style={{
          backgroundImage: site.hero_image_url
            ? `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)), url(${site.hero_image_url})`
            : `linear-gradient(135deg, ${accent}22, ${accent}05)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {site.logo_url && (
          <img src={site.logo_url} alt={slug} className="h-14 w-auto object-contain mb-6" />
        )}
        <h1 className={`text-4xl sm:text-5xl font-bold ${site.hero_image_url ? "text-white" : "text-gray-900"}`}>
          {content.hero_title || slug}
        </h1>
        {content.hero_subtitle && (
          <p className={`mt-4 max-w-2xl text-lg ${site.hero_image_url ? "text-white/90" : "text-gray-600"}`}>
            {content.hero_subtitle}
          </p>
        )}
        <a
          href="#search"
          className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-white font-medium shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          <Search className="w-4 h-4" /> Browse stays
        </a>
      </section>

      {/* ── About ── */}
      {content.about && (
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-lg leading-relaxed text-gray-700 whitespace-pre-wrap">{content.about}</p>
        </section>
      )}

      {/* ── Search + listings ── */}
      <section id="search" className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={spaceType ?? ""}
              onChange={(e) => setSpaceType((e.target.value || undefined) as PublicSpacesParams["space_type"])}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {SPACE_TYPES.map((t) => (
                <option key={t.label} value={t.value ?? ""}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max weekly price</label>
            <input
              type="number"
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="e.g. 600"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={applyFilters}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-white text-sm font-medium"
            style={{ backgroundColor: accent }}
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>

        <div className="mt-8">
          {spacesQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-72 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <p className="text-center text-gray-500 py-16">No stays match your search right now.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {spaces.map((s) => (
                <SpaceCard key={s.id} space={s} accent={accent} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="bg-gray-50 border-t border-gray-200 py-16">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Get in touch</h2>
          {(content.contact_email || content.contact_phone) && (
            <p className="text-center text-gray-500 mt-2 text-sm">
              {[content.contact_email, content.contact_phone].filter(Boolean).join("  ·  ")}
            </p>
          )}
          <InquiryForm slug={slug} accent={accent} />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 text-center text-sm text-gray-400">
        <a href="https://millionstay.com" target="_blank" rel="noreferrer" className="hover:text-gray-600">
          Powered by {APP_NAME}
        </a>
      </footer>
    </div>
  );
}

function SpaceCard({ space, accent }: { space: SpaceSummary; accent: string }) {
  const img = space.primary_thumbnail || space.primary_image || space.images?.[0]?.file_url;
  const price = space.base_weekly_price ? Number(space.base_weekly_price) : null;
  const currency = space.base_currency || "AUD";
  return (
    <Link href={`/spaces/${space.id}`}>
      <a className="block rounded-xl border border-gray-200 overflow-hidden bg-white hover:shadow-lg transition-shadow">
        <div className="aspect-[4/3] bg-gray-100">
          {img ? (
            <img src={img} alt={space.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <MapPin className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate">{space.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{space.space_type}</p>
          <div className="flex items-center justify-between mt-3">
            {price != null ? (
              <span className="font-semibold" style={{ color: accent }}>
                {currency} ${price.toLocaleString()}<span className="text-xs font-normal text-gray-400">/wk</span>
              </span>
            ) : <span />}
            {space.max_occupancy != null && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Users className="w-3 h-3" /> {space.max_occupancy}
              </span>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}

function InquiryForm({ slug, accent }: { slug: string; accent: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErr("");
    try {
      await submitOwnerInquiry(slug, form);
      setState("sent");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="mt-6 flex flex-col items-center text-center gap-2 py-6">
        <CheckCircle2 className="w-10 h-10" style={{ color: accent }} />
        <p className="font-medium text-gray-800">Thanks — we'll be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="Your name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <input placeholder="Phone (optional)" value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <textarea placeholder="Message" rows={4} value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y" />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" disabled={state === "sending"}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-white text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: accent }}>
        {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send inquiry
      </button>
    </form>
  );
}

// ── DOM meta helpers (no react-helmet dependency) ──
function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function setMetaProp(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
