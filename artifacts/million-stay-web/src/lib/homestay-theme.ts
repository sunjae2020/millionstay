// Million Homestay design tokens — from the brand guide
// (docs: "Million Stay - Brand Guide.pdf"). The homestay site uses its own warm
// palette + Montserrat/Poppins/Dynalight, distinct from the orange-only
// short-term rental site. See docs/proposals/HOMESTAY_WORKFLOW.md.
export const HS = {
  brand: "#ed6b1b",       // Brand primary — key visuals & primary CTAs (orange)
  brandDark: "#c9560f",   // hover/darker brand
  mocha: "#b1846c",       // base — dominant warm tone
  cream: "#ecdfdc",       // base — light background
  darkBrown: "#3f2d31",   // base — dark text / footer
  blue: "#3f517c",        // secondary accent
  green: "#005044",       // supporting accent
} as const;

// Soft tints for section backgrounds / chips.
export const HS_TINT = {
  brand: "rgba(237,107,27,0.10)",
  cream: "#f6efec",
} as const;

export const HS_FONT = {
  head: "'Montserrat', sans-serif",   // headings
  body: "'Poppins', sans-serif",      // body
  script: "'Dynalight', cursive",     // decorative accent
} as const;
