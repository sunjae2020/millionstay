// Million Homestay design tokens — Brand Guideline v2.0.
// Single source of truth for homestay.millionstay.com colour/type/shape.
//
// Colour ratio (fixed): Cream/White 60% · Navy 25% · Orange 12% · Teal 3%.
//  - Orange = ACTION  → buttons, CTAs, icons, keyword emphasis only.
//  - Navy   = STRUCTURE → headings, footer, dark UI.
//  - Teal   = IDENTITY/TRUST signature (NOT primary, never on buttons/CTAs).
//    Teal appears only in fixed slots: step connectors, WWCC/safety/support
//    trust elements, student check ✓ icons, active link underlines on student
//    pages, 1px section dividers. Max 1–2 teal elements per viewport.
//
// Keys from the previous (warm-brown) palette are kept as back-compat aliases so
// existing pages retheme instantly; new code should prefer the semantic names
// (navy / teal / orange / ink / line …).
export const HS = {
  // — Action: Orange (instance primary token → white-label themeable) —
  orange: "hsl(var(--brand-orange))",
  orangeDark: "hsl(var(--brand-burnt))",
  orangeSoft: "hsl(var(--brand-apricot))",
  brand: "hsl(var(--brand-orange))",      // alias → orange (primary action)
  brandDark: "hsl(var(--brand-burnt))",   // alias → orangeDark (hover)

  // — Structure: Navy —
  navy: "#16263F",
  darkBrown: "#16263F",  // alias → navy (headings / footer / dark text)
  blue: "#16263F",       // alias → navy (former secondary accent)

  // — Identity / trust: Teal (fixed slots only) —
  teal: "#2A9D8F",
  tealSoft: "#E0F0EE",
  green: "#2A9D8F",      // alias → teal (check ✓ marks)

  // — Surfaces —
  cream: "#FAF5EC",      // warm page background
  apricot: "hsl(var(--brand-apricot))",  // apricot tint (= orange-soft) for hero/card fills
  white: "#FFFFFF",      // cards

  // — Text —
  ink: "#2A2620",        // body
  inkMuted: "#6B6258",   // secondary text

  // — Lines —
  line: "#ECE3D6",       // hairlines / dividers
  mocha: "#ECE3D6",      // alias → line (former dashed-border colour)
} as const;

// Soft tints for section backgrounds / chips.
export const HS_TINT = {
  brand: "hsl(var(--brand-orange) / 0.10)",
  orange: "hsl(var(--brand-orange) / 0.10)",
  cream: "#F6EFEC",      // subtle warm section tint (rhythm between white sections)
  apricot: "hsl(var(--brand-apricot))",
  teal: "#E0F0EE",
} as const;

export const HS_FONT = {
  // Display headings — Poppins 700/800, tight tracking.
  display: "'Poppins', 'Pretendard', system-ui, sans-serif",
  // Body — Inter + Pretendard, with CJK/Thai fallbacks for the 6 locales.
  body: "'Inter', 'Pretendard', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans Thai', sans-serif",
  head: "'Poppins', 'Pretendard', system-ui, sans-serif",   // alias → display
  script: "'Poppins', 'Pretendard', system-ui, sans-serif", // alias → display (wordmark)
} as const;

// Shape / elevation / spacing tokens — use these instead of ad-hoc values.
export const HS_RADIUS = {
  sm: "8px",
  md: "14px",
  lg: "20px",
  pill: "999px",
} as const;

export const HS_SHADOW = {
  // Very gentle, navy-tinted card elevation.
  card: "0 1px 2px rgba(22,38,63,.04), 0 8px 24px rgba(22,38,63,.06)",
  cardHover: "0 2px 4px rgba(22,38,63,.06), 0 14px 36px rgba(22,38,63,.10)",
} as const;
