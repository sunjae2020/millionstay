import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Shared section furniture for the Metheim landing site.
//
// The pages were reading flat because every band was one solid colour with the
// same padding. These primitives give a section three things it did not have:
// a texture derived from the brand's own symbols, a consistent heading rhythm,
// and a table style for the spec data that used to be prose.
//
// Textures come from the guideline's three symbols (물결 / 등대·별 / 열쇠구멍)
// and nothing else — and they sit at 4–6% opacity so they read as paper grain,
// not decoration. The guideline is explicit that the symbols are metaphors used
// lightly, so there is exactly one motif per background, never two stacked.
// ---------------------------------------------------------------------------

/** Yeosu tide lines — for light bands. */
const WAVE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><path d="M0 20 Q 15 8 30 20 T 60 20 T 90 20 T 120 20" fill="none" stroke="%23005F73" stroke-width="1.2"/><path d="M0 34 Q 15 22 30 34 T 60 34 T 90 34 T 120 34" fill="none" stroke="%23005F73" stroke-width="1.2"/></svg>`,
);

/** The building itself: 269 units in typed stacks — for deep-teal bands. */
const UNITS = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><g fill="none" stroke="%23E6D5B8" stroke-width="1"><rect x="4" y="4" width="24" height="16"/><rect x="36" y="4" width="24" height="16"/><rect x="4" y="28" width="24" height="16"/><rect x="36" y="28" width="24" height="16"/></g></svg>`,
);

export type SectionTone = "plain" | "cream" | "deep" | "tint";

const TONE_CLASS: Record<SectionTone, string> = {
  plain: "bg-white text-[hsl(var(--brand-ink))]",
  cream: "bg-[hsl(var(--brand-cream))] text-[hsl(var(--brand-ink))]",
  tint: "bg-[hsl(var(--brand-apricot))]/35 text-[hsl(var(--brand-ink))]",
  deep: "bg-[hsl(var(--brand-navy))] text-white",
};

const TONE_TEXTURE: Record<SectionTone, string | null> = {
  plain: null,
  cream: `url("data:image/svg+xml,${WAVE}")`,
  tint: `url("data:image/svg+xml,${WAVE}")`,
  deep: `url("data:image/svg+xml,${UNITS}")`,
};

const TONE_TEXTURE_OPACITY: Record<SectionTone, number> = {
  plain: 0,
  cream: 0.06,
  tint: 0.05,
  deep: 0.07,
};

/**
 * One band of the page. `tone` picks the palette and its matching texture;
 * `image` puts a photograph behind the band instead, with a teal scrim so the
 * copy keeps its contrast.
 */
export function Section({
  children,
  tone = "plain",
  image,
  texture = true,
  className = "",
  innerClassName = "",
  id,
}: {
  children: ReactNode;
  tone?: SectionTone;
  image?: string;
  texture?: boolean;
  className?: string;
  innerClassName?: string;
  id?: string;
}) {
  const textured = texture && !image && TONE_TEXTURE[tone];

  return (
    <section id={id} className={`relative overflow-hidden ${image ? "text-white" : TONE_CLASS[tone]} ${className}`}>
      {image && (
        <>
          <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[hsl(var(--brand-navy))]/80" />
        </>
      )}
      {textured && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: TONE_TEXTURE[tone]!, opacity: TONE_TEXTURE_OPACITY[tone] }}
        />
      )}
      <div className={`relative max-w-7xl mx-auto px-6 py-14 md:py-20 ${innerClassName}`}>{children}</div>
    </section>
  );
}

/**
 * Section heading. The eyebrow is champagne on dark and teal on light — the
 * guideline's one persistent typographic tell.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  onDark = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  onDark?: boolean;
}) {
  const centered = align === "center";
  return (
    <header className={`${centered ? "text-center mx-auto max-w-2xl" : "max-w-2xl"} mb-10`}>
      {eyebrow && (
        <p
          className={`text-xs font-semibold tracking-[0.2em] uppercase ${
            onDark ? "text-[hsl(var(--brand-apricot))]" : "text-[hsl(var(--brand-orange))]"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2 className={`mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight ${onDark ? "text-white" : ""}`}>
        {title}
      </h2>
      {/* The harbour-light rule: a hairline that brightens at its origin, the
          one place the gold accent appears outside a CTA. */}
      <div
        className={`mt-5 h-px w-24 ${centered ? "mx-auto" : ""}`}
        style={{
          background: `linear-gradient(90deg, hsl(var(--brand-teal)) 0%, ${
            onDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"
          } 100%)`,
        }}
      />
      {lead && (
        <p className={`mt-5 text-base leading-relaxed ${onDark ? "text-white/75" : "text-[hsl(var(--brand-ink))]/70"}`}>
          {lead}
        </p>
      )}
    </header>
  );
}

/**
 * Spec table per guideline §9 — shaded bold header, hairline borders, teal tint
 * on hover, numeric columns right-aligned and monospaced. Scrolls inside itself
 * on narrow screens so the page body never scrolls sideways.
 */
export function SpecTable({
  columns,
  rows,
  caption,
}: {
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, ReactNode>[];
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E4E9EA] bg-white">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-[#F1F4F4]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[hsl(var(--brand-navy))] border-b border-[#E4E9EA]"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-[#E4E9EA] last:border-0 hover:bg-[#E7F0F1] transition-colors">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-3 align-middle ${
                    column.numeric ? "text-right font-mono tabular-nums" : "text-left"
                  }`}
                >
                  {row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Headline figures — used where a page states scale rather than explains it. */
export function StatStrip({
  items,
  onDark = false,
}: {
  items: { value: string; label: string }[];
  onDark?: boolean;
}) {
  return (
    <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="sr-only">{item.label}</dt>
          <dd>
            <span
              className={`block font-display text-3xl md:text-4xl font-bold ${
                onDark ? "text-[hsl(var(--brand-apricot))]" : "text-[hsl(var(--brand-orange))]"
              }`}
            >
              {item.value}
            </span>
            <span className={`mt-1 block text-sm ${onDark ? "text-white/70" : "text-[hsl(var(--brand-ink))]/65"}`}>
              {item.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A card that carries an illustration or photograph rather than just text —
 * what the flat feature lists were missing.
 */
export function FeatureCard({
  image,
  icon,
  title,
  body,
  footer,
}: {
  image?: string;
  icon?: ReactNode;
  title: string;
  body: string;
  footer?: ReactNode;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E4E9EA] bg-white shadow-[0_1px_2px_rgba(18,35,43,0.04)] transition-shadow hover:shadow-[0_8px_28px_rgba(0,50,61,0.10)]">
      {image && (
        <div className="aspect-[16/10] overflow-hidden">
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        {icon && (
          <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--brand-orange))]/10 text-[hsl(var(--brand-orange))]">
            {icon}
          </span>
        )}
        <h3 className="font-display text-lg font-semibold text-[hsl(var(--brand-navy))]">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[hsl(var(--brand-ink))]/70">{body}</p>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </article>
  );
}
