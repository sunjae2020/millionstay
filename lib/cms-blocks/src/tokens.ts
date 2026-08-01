import type { BlockStyle } from "./types";

// ---------------------------------------------------------------------------
// Design tokens — the guardrail. Blocks reference token ROLES and scale STEPS;
// this file is the only place those resolve to actual CSS. Admins edit the
// values per site (cms_site_settings.design_tokens); they never edit a block's
// raw colour, so pages stay visually consistent as content grows.
// ---------------------------------------------------------------------------

export const TOKEN_ROLES = ["primary", "accent", "ink", "surface", "muted"] as const;
export type TokenRole = (typeof TOKEN_ROLES)[number];

export interface DesignTokens {
  palette: Record<TokenRole, string>;
  /** Text colour used on top of each palette role. */
  onPalette?: Partial<Record<TokenRole, string>>;
  fontPair: string;
  radiusScale: "sharp" | "soft" | "round";
  spacingScale: "compact" | "regular" | "airy";
  headingScale: "modest" | "regular" | "bold";
}

/** MillionStay brand defaults (Guideline v2.0). */
export const DEFAULT_TOKENS: DesignTokens = {
  palette: {
    primary: "#E8621A",
    accent: "#0F9B8E",
    ink: "#16263F",
    surface: "#FAF5EC",
    muted: "#F1F1F0",
  },
  onPalette: { primary: "#FFFFFF", accent: "#FFFFFF", ink: "#FFFFFF", surface: "#16263F", muted: "#16263F" },
  fontPair: "pretendard-inter",
  radiusScale: "soft",
  spacingScale: "regular",
  headingScale: "regular",
};

export const FONT_PAIRS: { value: string; label: string; heading: string; body: string }[] = [
  { value: "pretendard-inter", label: "Pretendard + Inter", heading: "Pretendard, Inter, sans-serif", body: "Pretendard, Inter, sans-serif" },
  { value: "inter-lora", label: "Inter + Lora", heading: "Inter, sans-serif", body: "Lora, Georgia, serif" },
  { value: "noto-noto", label: "Noto Sans KR", heading: "'Noto Sans KR', sans-serif", body: "'Noto Sans KR', sans-serif" },
  { value: "playfair-inter", label: "Playfair Display + Inter", heading: "'Playfair Display', serif", body: "Inter, sans-serif" },
];

const RADIUS: Record<DesignTokens["radiusScale"], string> = {
  sharp: "0px",
  soft: "0.75rem",
  round: "1.5rem",
};

const SPACING_UNIT: Record<DesignTokens["spacingScale"], number> = {
  compact: 0.75,
  regular: 1,
  airy: 1.5,
};

const HEADING_SCALE: Record<DesignTokens["headingScale"], number> = {
  modest: 0.9,
  regular: 1,
  bold: 1.15,
};

/** Spacing step (0–4) → rem, scaled by the site's spacing preference. */
const STEP_REM = [0, 1.5, 3, 4.5, 6];

export function resolveTokens(input: unknown): DesignTokens {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<DesignTokens>;
  return {
    palette: { ...DEFAULT_TOKENS.palette, ...(raw.palette ?? {}) },
    onPalette: { ...DEFAULT_TOKENS.onPalette, ...(raw.onPalette ?? {}) },
    fontPair: raw.fontPair ?? DEFAULT_TOKENS.fontPair,
    radiusScale: raw.radiusScale ?? DEFAULT_TOKENS.radiusScale,
    spacingScale: raw.spacingScale ?? DEFAULT_TOKENS.spacingScale,
    headingScale: raw.headingScale ?? DEFAULT_TOKENS.headingScale,
  };
}

/** CSS custom properties applied to the page wrapper. */
export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const pair = FONT_PAIRS.find((p) => p.value === tokens.fontPair) ?? FONT_PAIRS[0]!;
  const vars: Record<string, string> = {
    "--cms-radius": RADIUS[tokens.radiusScale],
    "--cms-font-heading": pair.heading,
    "--cms-font-body": pair.body,
    "--cms-heading-scale": String(HEADING_SCALE[tokens.headingScale]),
  };
  for (const role of TOKEN_ROLES) {
    vars[`--cms-${role}`] = tokens.palette[role];
    vars[`--cms-on-${role}`] = tokens.onPalette?.[role] ?? "#FFFFFF";
  }
  return vars;
}

/** Inline style for one block, derived only from token roles + scale steps. */
export function styleToCss(style: BlockStyle | undefined, tokens: DesignTokens): Record<string, string> {
  const unit = SPACING_UNIT[tokens.spacingScale];
  const css: Record<string, string> = {};
  const bg = style?.bg ?? "transparent";
  if (bg !== "transparent") {
    css["backgroundColor"] = `var(--cms-${bg})`;
    css["color"] = `var(--cms-on-${bg})`;
  }
  const top = STEP_REM[style?.spacingTop ?? 2] ?? 3;
  const bottom = STEP_REM[style?.spacingBottom ?? 2] ?? 3;
  css["paddingTop"] = `${(top * unit).toFixed(2)}rem`;
  css["paddingBottom"] = `${(bottom * unit).toFixed(2)}rem`;
  if (style?.align) css["textAlign"] = style.align;
  return css;
}
