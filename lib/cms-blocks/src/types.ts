// ---------------------------------------------------------------------------
// The CMS block model — ONE definition shared by the admin editor, the API and
// the public renderer. Everything that reads or writes a page body goes through
// `normaliseBlocks()` so a schema drift in any one app cannot corrupt content.
// ---------------------------------------------------------------------------

/** Background is a token ROLE, never a raw colour — this is the design guardrail. */
export const BLOCK_BG = ["transparent", "surface", "muted", "primary", "accent", "ink"] as const;
export type BlockBg = (typeof BLOCK_BG)[number];

/** Spacing is a scale step (0–4), never a pixel value. */
export const SPACING_STEPS = [0, 1, 2, 3, 4] as const;
export type SpacingStep = (typeof SPACING_STEPS)[number];

export const BLOCK_ALIGN = ["left", "center", "right"] as const;
export type BlockAlign = (typeof BLOCK_ALIGN)[number];

export const BLOCK_WIDTH = ["contained", "full"] as const;
export type BlockWidth = (typeof BLOCK_WIDTH)[number];

export interface BlockStyle {
  bg?: BlockBg;
  spacingTop?: SpacingStep;
  spacingBottom?: SpacingStep;
  align?: BlockAlign;
  width?: BlockWidth;
  /**
   * Which layout the renderer draws for this block type. Absent falls back to
   * the block's first registered variant, so reordering that list restyles
   * saved pages without a data migration. Values are validated against the
   * block's own `variants` — an unknown one is dropped, never rendered.
   */
  variant?: string;
}

/** A selectable layout for one block type. `value` is stored in BlockStyle.variant. */
export interface BlockVariant {
  value: string;
  label: string;
  description?: string;
}

export interface Block {
  /** Stable id — drag/drop identity and the translation mapping key. */
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
  style?: BlockStyle;
  /** Container blocks only. */
  children?: Block[];
  hidden?: boolean;
}

export interface PageBody {
  blocks: Block[];
}

/** An image prop value. `assetId` links back to cms_media_assets when picked. */
export interface BlockImage {
  url: string;
  alt?: string;
  assetId?: number;
}

// ── Field schema — drives the auto-generated block edit form ────────────────

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "html"
  | "image"
  | "link"
  | "number"
  | "boolean"
  | "select"
  | "items";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Text-bearing fields are what the AI translator rewrites. */
  translatable?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** For type "items": the shape of each repeated row. */
  fields?: FieldDef[];
  /** For type "items": cap the number of rows. */
  max?: number;
}

export interface BlockSpec {
  type: BlockType;
  name: string;
  description: string;
  category: BlockCategory;
  /** Container blocks accept nested children. */
  container?: boolean;
  /** Blocks that read live rows from the API instead of storing content. */
  dataBacked?: boolean;
  fields: FieldDef[];
  defaultProps: Record<string, unknown>;
  defaultStyle?: BlockStyle;
  /** Alternate layouts offered in the editor. The FIRST entry is the default. */
  variants?: BlockVariant[];
}

export const BLOCK_CATEGORIES = [
  "Layout",
  "Content",
  "Media",
  "Marketing",
  "Form",
  "Data",
] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

export const BLOCK_TYPES = [
  // Layout / hero
  "section",
  "hero-banner",
  "hero-slider",
  // Content
  "rich-text",
  "about-us",
  "content-featured",
  "feature-list",
  "quote",
  "steps",
  "statistics",
  "custom-html",
  // Offer
  "services",
  "pricing",
  "faqs",
  // Trust
  "brands",
  "testimonials",
  "team",
  // Media
  "gallery",
  "video",
  // Marketing / forms
  "cta-banner",
  "contact-block",
  "contact-form",
  "google-maps",
  // Data-backed
  "space-listings",
  "sale-listings",
  "blog-posts",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** A translatable string found inside a block tree, addressed by path. */
export interface TextRef {
  /** e.g. "3.props.title" or "3.props.items.1.label" */
  path: string;
  value: string;
}
