import { type ReactNode } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Check, ArrowRight, Clock } from "lucide-react";
import { HS, HS_FONT, HS_RADIUS, HS_SHADOW } from "@/lib/homestay-theme";

// Reusable presentational primitives for Million Homestay content pages, styled
// to Brand Guideline v2.0. Colour roles are enforced here so pages stay on-brand
// for free: Navy = structure (headings), Orange = action (CTAs/numbers), Teal =
// trust signature in FIXED slots only (✓ checks, step connectors, 1px dividers).

// Small uppercase eyebrow label — Inter SemiBold, orange, wide tracking.
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block text-xs font-semibold uppercase mb-4"
      style={{ color: HS.orange, fontFamily: HS_FONT.body, letterSpacing: "0.14em" }}
    >
      {children}
    </span>
  );
}

// Page hero — warm apricot-tint band, orange eyebrow, navy display title, muted
// lead. A 1px teal divider closes the band (the signature trust slot).
export function HsPageHero({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: ReactNode }) {
  return (
    <section style={{ backgroundColor: HS.apricot, borderBottom: `1px solid ${HS.teal}` }}>
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {eyebrow && <div><Eyebrow>{eyebrow}</Eyebrow></div>}
        <h1
          className="text-4xl md:text-5xl font-extrabold leading-[1.08]"
          style={{ fontFamily: HS_FONT.display, color: HS.navy, letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {lead && <div className="mt-5 text-lg leading-relaxed space-y-4" style={{ color: HS.inkMuted }}>{lead}</div>}
      </div>
    </section>
  );
}

// Content band. `tint` paints the subtle warm-cream rhythm background; otherwise
// white. Heading is navy display type.
export function HsSection({ id, heading, children, tint }: { id?: string; heading?: string; children: ReactNode; tint?: boolean }) {
  return (
    <section
      id={id}
      style={{
        backgroundColor: tint ? HS.cream : HS.white,
        ...(tint ? { borderTop: `1px solid ${HS.line}`, borderBottom: `1px solid ${HS.line}` } : {}),
        ...(id ? { scrollMarginTop: "5.5rem" } : {}),
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-14 md:py-20">
        {heading && (
          <h2 className="text-2xl md:text-3xl font-bold mb-7" style={{ fontFamily: HS_FONT.display, color: HS.navy, letterSpacing: "-0.01em" }}>
            {heading}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}

// Grid of titled blurbs — advantages, benefits, "why" lists. Apricot-tint cards
// with a gentle hover lift; navy titles, muted body.
export function HsCards({ items }: { items: Array<{ title: string; body: ReactNode }> }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.title}
          className="p-6 transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
          style={{ backgroundColor: HS.apricot, borderRadius: HS_RADIUS.lg }}
        >
          <h3 className="font-semibold text-lg" style={{ fontFamily: HS_FONT.display, color: HS.navy }}>{it.title}</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: HS.inkMuted }}>{it.body}</p>
        </div>
      ))}
    </div>
  );
}

// Numbered steps / tips — orange number chips joined by a teal dotted connector
// (the "process" trust slot). Navy titles, muted body.
export function HsNumbered({ items }: { items: Array<{ title?: string; body: ReactNode }> }) {
  return (
    <ol className="relative space-y-6">
      {items.map((it, i) => (
        <li key={i} className="relative flex gap-4">
          {/* teal dotted connector to the next step */}
          {i < items.length - 1 && (
            <span
              aria-hidden
              className="absolute left-4 top-9 bottom-[-1.5rem] -translate-x-1/2 border-l-2 border-dashed"
              style={{ borderColor: HS.teal, opacity: 0.5 }}
            />
          )}
          <span
            className="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: HS.orange }}
          >
            {i + 1}
          </span>
          <div className="pt-0.5">
            {it.title && <span className="font-semibold" style={{ color: HS.navy }}>{it.title}{" — "}</span>}
            <span style={{ color: HS.inkMuted }}>{it.body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Check-marked bullet list — essential info, commitments. Teal ✓ (trust slot).
export function HsBullets({ items }: { items: Array<{ title?: string; body: ReactNode }> }) {
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span
            className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: HS.tealSoft }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} style={{ color: HS.teal }} />
          </span>
          <div>
            {it.title && <span className="font-semibold" style={{ color: HS.navy }}>{it.title}: </span>}
            <span style={{ color: HS.inkMuted }}>{it.body}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Button system. Orange owns "what to press"; teal is reserved for safe/support
// contexts and used sparingly. All variants share a focus-visible ring.
const FOCUS = "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary";

export function HsCTA({ buttons }: { buttons: Array<{ label: string; href: string; variant?: "primary" | "outline" | "secondary" | "ghost" | "teal"; disabled?: boolean }> }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3">
      {buttons.map((b) => {
        if (b.disabled) {
          return (
            <span
              key={b.label}
              className="px-6 py-3 font-semibold border text-gray-400 cursor-not-allowed inline-flex items-center gap-2"
              style={{ borderColor: HS.line, borderRadius: HS_RADIUS.pill }}
              title={t("homestay.sections.coming_soon")}
            >
              {b.label} <span className="text-xs font-normal">{t("homestay.sections.coming_soon_paren")}</span>
            </span>
          );
        }
        if (b.variant === "outline" || b.variant === "secondary") {
          return (
            <Link
              key={b.label}
              href={b.href}
              className={`px-6 py-3 font-semibold bg-white inline-flex items-center gap-2 border transition-colors ${FOCUS}`}
              style={{ color: HS.navy, borderColor: HS.navy, borderRadius: HS_RADIUS.pill }}
            >
              {b.label}
            </Link>
          );
        }
        if (b.variant === "ghost") {
          return (
            <Link
              key={b.label}
              href={b.href}
              className={`font-semibold inline-flex items-center gap-2 hover:underline underline-offset-4 ${FOCUS}`}
              style={{ color: HS.orange }}
            >
              {b.label} <ArrowRight className="w-4 h-4" />
            </Link>
          );
        }
        if (b.variant === "teal") {
          return (
            <Link
              key={b.label}
              href={b.href}
              className={`px-6 py-3 font-semibold text-white inline-flex items-center gap-2 transition-colors ${FOCUS}`}
              style={{ backgroundColor: HS.teal, borderRadius: HS_RADIUS.pill }}
            >
              {b.label} <ArrowRight className="w-4 h-4" />
            </Link>
          );
        }
        return (
          <Link
            key={b.label}
            href={b.href}
            className={`px-6 py-3 font-semibold text-white inline-flex items-center gap-2 transition-colors hover:brightness-95 ${FOCUS}`}
            style={{ backgroundColor: HS.orange, borderRadius: HS_RADIUS.pill }}
          >
            {b.label} <ArrowRight className="w-4 h-4" />
          </Link>
        );
      })}
    </div>
  );
}

// Inline notice for a feature that ships in a later phase.
export function HsComingSoon({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div
      className="border border-dashed p-6 flex gap-4"
      style={{ borderColor: HS.line, backgroundColor: HS.cream, borderRadius: HS_RADIUS.lg, boxShadow: HS_SHADOW.card }}
    >
      <Clock className="w-6 h-6 shrink-0" style={{ color: HS.orange }} />
      <div>
        <p className="font-semibold" style={{ color: HS.navy }}>{t("homestay.sections.coming_soon")}</p>
        <p className="mt-1 text-sm" style={{ color: HS.inkMuted }}>{children}</p>
      </div>
    </div>
  );
}
