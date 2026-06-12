import { type ReactNode } from "react";
import { Link } from "wouter";
import { Check, ArrowRight, Clock } from "lucide-react";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// Reusable presentational primitives for Million Homestay content pages.
// Keeps each page concise and visually consistent with the brand.

export function HsPageHero({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: ReactNode }) {
  return (
    <section style={{ backgroundColor: HS.cream }}>
      <div className="max-w-4xl mx-auto px-5 py-14 md:py-20">
        {eyebrow && (
          <span className="inline-block text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full mb-4" style={{ color: HS.brand, backgroundColor: "white" }}>
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl font-bold leading-tight" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{title}</h1>
        {lead && <div className="mt-4 text-lg text-gray-700 space-y-4">{lead}</div>}
      </div>
    </section>
  );
}

export function HsSection({ heading, children, tint }: { heading?: string; children: ReactNode; tint?: boolean }) {
  return (
    <section style={tint ? { backgroundColor: "#f6efec" } : undefined} className={tint ? "border-y border-gray-100" : ""}>
      <div className="max-w-4xl mx-auto px-5 py-12 md:py-16">
        {heading && <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{heading}</h2>}
        {children}
      </div>
    </section>
  );
}

// Grid of titled blurbs — advantages, benefits, "why" lists.
export function HsCards({ items }: { items: Array<{ title: string; body: ReactNode }> }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.title} className="rounded-2xl p-6" style={{ backgroundColor: HS.cream }}>
          <h3 className="font-semibold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{it.title}</h3>
          <p className="mt-2 text-sm text-gray-600">{it.body}</p>
        </div>
      ))}
    </div>
  );
}

// Numbered steps / tips.
export function HsNumbered({ items }: { items: Array<{ title?: string; body: ReactNode }> }) {
  return (
    <ol className="space-y-4">
      {items.map((it, i) => (
        <li key={i} className="flex gap-4">
          <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: HS.brand }}>{i + 1}</span>
          <div className="pt-0.5">
            {it.title && <span className="font-semibold" style={{ color: HS.darkBrown }}>{it.title}{" — "}</span>}
            <span className="text-gray-600">{it.body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Check-marked bullet list — essential info, commitments.
export function HsBullets({ items }: { items: Array<{ title?: string; body: ReactNode }> }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: HS.green }} />
          <div>
            {it.title && <span className="font-semibold" style={{ color: HS.darkBrown }}>{it.title}: </span>}
            <span className="text-gray-600">{it.body}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HsCTA({ buttons }: { buttons: Array<{ label: string; href: string; variant?: "primary" | "outline"; disabled?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-3">
      {buttons.map((b) =>
        b.disabled ? (
          <span key={b.label} className="px-6 py-3 rounded-lg font-semibold border border-gray-200 text-gray-400 cursor-not-allowed inline-flex items-center gap-2" title="Coming soon">
            {b.label} <span className="text-xs font-normal">(coming soon)</span>
          </span>
        ) : b.variant === "outline" ? (
          <Link key={b.label} href={b.href} className="px-6 py-3 rounded-lg font-semibold border border-gray-300 text-gray-800 inline-flex items-center gap-2">{b.label}</Link>
        ) : (
          <Link key={b.label} href={b.href} className="px-6 py-3 rounded-lg font-semibold text-white inline-flex items-center gap-2" style={{ backgroundColor: HS.brand }}>
            {b.label} <ArrowRight className="w-4 h-4" />
          </Link>
        ),
      )}
    </div>
  );
}

// Inline notice for a feature that ships in a later phase.
export function HsComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-6 flex gap-4" style={{ borderColor: HS.mocha, backgroundColor: "#f6efec" }}>
      <Clock className="w-6 h-6 shrink-0" style={{ color: HS.brand }} />
      <div>
        <p className="font-semibold" style={{ color: HS.darkBrown }}>Coming soon</p>
        <p className="mt-1 text-sm text-gray-600">{children}</p>
      </div>
    </div>
  );
}
