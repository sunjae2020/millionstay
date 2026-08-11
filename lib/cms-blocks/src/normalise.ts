import { BLOCK_ALIGN, BLOCK_BG, BLOCK_WIDTH, SPACING_STEPS } from "./types";
import type { Block, BlockStyle, PageBody, TextRef } from "./types";
import { getBlockSpec } from "./registry";
import { sanitiseHtml } from "./sanitise";

// ---------------------------------------------------------------------------
// Defensive normalisation. Every read and write of a block tree passes through
// here: unknown block types, invalid style values and non-object props are
// dropped rather than trusted, so a stale app version can never persist or
// render a malformed tree.
// ---------------------------------------------------------------------------

const MAX_DEPTH = 4;

function randomId(): string {
  // Not cryptographic — just needs to be unique within a page tree.
  return `b_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function newBlockId(): string {
  return randomId();
}

function normaliseStyle(type: string, input: unknown): BlockStyle | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const out: BlockStyle = {};
  // A variant only survives if the block type still offers it — a layout removed
  // from the registry falls back to the default rendering instead of blanking.
  const variants = getBlockSpec(type)?.variants ?? [];
  if (typeof raw["variant"] === "string" && variants.some((v) => v.value === raw["variant"])) {
    out.variant = raw["variant"] as string;
  }
  if (BLOCK_BG.includes(raw["bg"] as never)) out.bg = raw["bg"] as BlockStyle["bg"];
  if (SPACING_STEPS.includes(raw["spacingTop"] as never)) out.spacingTop = raw["spacingTop"] as BlockStyle["spacingTop"];
  if (SPACING_STEPS.includes(raw["spacingBottom"] as never)) {
    out.spacingBottom = raw["spacingBottom"] as BlockStyle["spacingBottom"];
  }
  if (BLOCK_ALIGN.includes(raw["align"] as never)) out.align = raw["align"] as BlockStyle["align"];
  if (BLOCK_WIDTH.includes(raw["width"] as never)) out.width = raw["width"] as BlockStyle["width"];
  return Object.keys(out).length > 0 ? out : undefined;
}

function normaliseProps(type: string, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const props = { ...(input as Record<string, unknown>) };
  const spec = getBlockSpec(type);
  // Any "html" field is sanitised at the boundary — never trusted from a client.
  for (const field of spec?.fields ?? []) {
    if (field.type === "html" && typeof props[field.key] === "string") {
      props[field.key] = sanitiseHtml(props[field.key] as string);
    }
    if (field.type === "richtext" && typeof props[field.key] === "string") {
      props[field.key] = sanitiseHtml(props[field.key] as string);
    }
  }
  return props;
}

function normaliseBlock(input: unknown, depth: number): Block | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const type = typeof raw["type"] === "string" ? (raw["type"] as string) : "";
  const spec = getBlockSpec(type);
  if (!spec) return null; // unknown type — drop it

  const block: Block = {
    id: typeof raw["id"] === "string" && raw["id"] ? (raw["id"] as string) : randomId(),
    type: spec.type,
    props: normaliseProps(type, raw["props"]),
  };
  const style = normaliseStyle(spec.type, raw["style"]);
  if (style) block.style = style;
  if (raw["hidden"] === true) block.hidden = true;
  if (spec.container && Array.isArray(raw["children"]) && depth < MAX_DEPTH) {
    block.children = (raw["children"] as unknown[])
      .map((c) => normaliseBlock(c, depth + 1))
      .filter((c): c is Block => c !== null);
  }
  return block;
}

export function normaliseBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input.map((b) => normaliseBlock(b, 0)).filter((b): b is Block => b !== null);
}

/** Accepts either `{ blocks: [...] }` or a bare array; always returns PageBody. */
export function normaliseBody(input: unknown): PageBody {
  if (Array.isArray(input)) return { blocks: normaliseBlocks(input) };
  if (input && typeof input === "object") {
    return { blocks: normaliseBlocks((input as Record<string, unknown>)["blocks"]) };
  }
  return { blocks: [] };
}

/** Seed a new block of `type` from its registry defaults. */
export function createBlock(type: string): Block | null {
  const spec = getBlockSpec(type);
  if (!spec) return null;
  const block: Block = {
    id: randomId(),
    type: spec.type,
    props: JSON.parse(JSON.stringify(spec.defaultProps)) as Record<string, unknown>,
  };
  if (spec.defaultStyle) block.style = { ...spec.defaultStyle };
  if (spec.container) block.children = [];
  return block;
}

// ── Translation helpers ────────────────────────────────────────────────────

/**
 * Walk a tree and collect every translatable string, addressed by a stable path
 * so the translated values can be written back into a cloned tree.
 */
export function collectTextRefs(blocks: Block[], prefix = ""): TextRef[] {
  const refs: TextRef[] = [];
  blocks.forEach((block, index) => {
    const base = prefix ? `${prefix}.children.${index}` : String(index);
    const spec = getBlockSpec(block.type);
    for (const field of spec?.fields ?? []) {
      if (field.type === "items" && Array.isArray(block.props[field.key])) {
        const rows = block.props[field.key] as Record<string, unknown>[];
        rows.forEach((row, rowIndex) => {
          for (const sub of field.fields ?? []) {
            if (!sub.translatable) continue;
            const value = row?.[sub.key];
            if (typeof value === "string" && value.trim()) {
              refs.push({ path: `${base}.props.${field.key}.${rowIndex}.${sub.key}`, value });
            }
          }
        });
        continue;
      }
      if (!field.translatable) continue;
      const value = block.props[field.key];
      if (typeof value === "string" && value.trim()) {
        refs.push({ path: `${base}.props.${field.key}`, value });
      }
    }
    if (block.children?.length) refs.push(...collectTextRefs(block.children, base));
  });
  return refs;
}

/** Write translated values back into a (deep-cloned) tree by path. */
export function applyTextRefs(blocks: Block[], refs: TextRef[]): Block[] {
  const clone = JSON.parse(JSON.stringify(blocks)) as Block[];
  for (const ref of refs) {
    const parts = ref.path.split(".");
    let cursor: unknown = clone;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i] as string;
      if (cursor === null || cursor === undefined) break;
      cursor = (cursor as Record<string, unknown>)[key];
    }
    const last = parts[parts.length - 1] as string;
    if (cursor && typeof cursor === "object") {
      (cursor as Record<string, unknown>)[last] = ref.value;
    }
  }
  return clone;
}

/** Total block count including nested children — used for list summaries. */
export function countBlocks(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + 1 + (b.children ? countBlocks(b.children) : 0), 0);
}
