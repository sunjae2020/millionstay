/**
 * Token prices, used to turn the usage meter's token counts into a dollar
 * figure an admin can act on.
 *
 * These are ESTIMATES held in code, not billed amounts. Vendor list prices move
 * and none of the three providers returns a price on the response, so the meter
 * would otherwise show tokens only — and "1.2M tokens last month" does not tell
 * anyone whether moving CS translation to a cheaper model is worth doing.
 *
 * Keep the vendor invoice as the source of truth for what was actually spent.
 * Correct a stale entry at runtime with AI_PRICE_OVERRIDES rather than waiting
 * for a deploy:
 *   AI_PRICE_OVERRIDES={"kimi/kimi-k2":{"input":0.6,"output":2.5}}
 */

/** USD per 1,000,000 tokens. */
export interface ModelPrice {
  input: number;
  output: number;
  /** Cached-read input, when the vendor discounts it. Defaults to `input`. */
  cachedInput?: number;
}

/**
 * Keyed by bare model name OR `provider/model`. Longest match wins.
 *
 * Anthropic rows verified against the published rate card on 2026-08-27.
 * `cachedInput` is the ~0.1x cache-read rate. Cache WRITES are billed above the
 * input rate (~1.25x) and `estimateCostUsd` charges them at 1x, so a
 * cache-heavy workload reads slightly low — see the note there.
 */
const PRICES: Record<string, ModelPrice> = {
  // ── Anthropic ──
  "claude-opus-5": { input: 5, output: 25, cachedInput: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cachedInput: 0.5 },
  // Sonnet 5 carries introductory pricing ($2/$10) through 2026-08-31; the
  // standard rate is used here so the meter does not under-report from 09-01.
  "claude-sonnet-5": { input: 3, output: 15, cachedInput: 0.3 },
  "claude-sonnet-4-6": { input: 3, output: 15, cachedInput: 0.3 },
  "claude-haiku-4-5": { input: 1, output: 5, cachedInput: 0.1 },
  // ── Kimi / Moonshot ──
  "kimi/": { input: 0.6, output: 2.5 },
  // ── Google Gemini ──
  "gemini/gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini/": { input: 0.3, output: 2.5 },
};

function overrides(): Record<string, ModelPrice> {
  const raw = process.env["AI_PRICE_OVERRIDES"];
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ModelPrice>;
  } catch {
    return {};
  }
}

/**
 * Best price entry for a model. Matches the most specific key that prefixes
 * either `provider/model` or the bare model name, so a dated model id
 * (`claude-haiku-4-5-20251001`) resolves through its family key.
 */
export function priceFor(provider: string, model: string): ModelPrice | null {
  const table = { ...PRICES, ...overrides() };
  const candidates = [`${provider}/${model}`, model];
  let best: { key: string; price: ModelPrice } | null = null;
  for (const key of Object.keys(table)) {
    for (const c of candidates) {
      if (c.startsWith(key) && (!best || key.length > best.key.length)) {
        best = { key, price: table[key]! };
      }
    }
  }
  return best?.price ?? null;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Estimated USD for one call. Returns null for a model with no price entry, so
 * the meter can show "tokens only" instead of a confidently wrong $0.00.
 *
 * Cache writes are billed at the input rate here; Anthropic charges a premium on
 * them, so this is a floor, not a ceiling.
 */
export function estimateCostUsd(
  provider: string,
  model: string,
  tokens: TokenCounts,
): number | null {
  const p = priceFor(provider, model);
  if (!p) return null;
  const cachedRate = p.cachedInput ?? p.input;
  const usd =
    ((tokens.input + tokens.cacheWrite) * p.input +
      tokens.cacheRead * cachedRate +
      tokens.output * p.output) /
    1_000_000;
  // Six decimals: a single Haiku translation lands around $0.0002.
  return Math.round(usd * 1_000_000) / 1_000_000;
}
