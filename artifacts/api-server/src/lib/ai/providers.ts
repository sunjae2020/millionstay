/**
 * Provider registry for every AI vendor the platform can call.
 *
 * The platform used to be hard-wired to Anthropic: one key, one client, one
 * model constant. It now speaks to several vendors so that routine, high-volume
 * work (translation) can run on cheap models while the jobs where a wrong answer
 * is expensive (document classification, OCR) stay on the strongest one.
 *
 * Three vendors ship built in. Anything else — a second Anthropic account, an
 * OpenAI-compatible engine, a self-hosted model — is added by an admin at
 * runtime as a CUSTOM provider (see `customProviders()`), because the set of
 * engines a tenant wants is not knowable at build time and should never require
 * a deploy.
 *
 * Two wire formats cover everything: `anthropic` (reuses the Anthropic SDK with
 * a different key and baseURL) and `openai-compat` (goes through the adapter in
 * `gemini.ts`).
 *
 * ── Capability flags ────────────────────────────────────────────────────────
 * `supports` is a GATE, not documentation: `getAiClient()` refuses to run a task
 * on a provider that lacks a capability the task needs, so a mis-set model fails
 * loudly at configuration time instead of silently returning garbage.
 *
 * The Anthropic column is verified. Every other column starts CONSERVATIVE —
 * anything not confirmed against the vendor's compatibility docs is false,
 * because a false negative costs one env var and a false positive costs a
 * corrupted document classification. Widen a flag only after an actual
 * round-trip against the live endpoint.
 */

/** Free-form: built-in ids plus whatever custom engines an admin has added. */
export type AiProviderId = string;

/** The request/response shape a provider speaks. Picks the client adapter. */
export type AiWire = "anthropic" | "openai-compat";

export interface AiCapabilities {
  /** Accepts base64 `image` content blocks (business-card OCR, photo intake). */
  vision: boolean;
  /** Accepts base64 `document` (PDF) blocks — Anthropic-specific today. */
  pdf: boolean;
  /** Accepts `tools` + returns `tool_use` blocks (the public chat assistant). */
  tools: boolean;
  /** Supports incremental streaming via the SDK's `messages.stream()`. */
  streaming: boolean;
  /** Honours `cache_control: ephemeral` on system blocks (prompt caching). */
  promptCache: boolean;
}

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** Env var holding the API key. Settable at runtime via admin Integrations. */
  keyEnv: string;
  /** Env var overriding the base URL (for self-hosted or regional endpoints). */
  baseUrlEnv: string;
  /** Base URL used when `baseUrlEnv` is unset. Null = the SDK's own default. */
  defaultBaseUrl: string | null;
  wire: AiWire;
  /** Where an admin goes to get a key. Shown in the Integrations card. */
  consoleUrl: string;
  /** Model-name prefixes that imply this provider when no `provider/` prefix. */
  modelPrefixes: string[];
  supports: AiCapabilities;
  /** Shown in the admin when a capability gate blocks a task assignment. */
  note: string;
  /** True for admin-added engines, which can be edited and removed. */
  custom: boolean;
}

const NO_CAPABILITIES: AiCapabilities = {
  vision: false,
  pdf: false,
  tools: false,
  streaming: false,
  promptCache: false,
};

const BUILTIN_PROVIDERS: Record<string, AiProvider> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyEnv: "ANTHROPIC_API_KEY",
    baseUrlEnv: "ANTHROPIC_BASE_URL",
    defaultBaseUrl: null,
    wire: "anthropic",
    consoleUrl: "https://console.anthropic.com",
    modelPrefixes: ["claude-"],
    supports: { vision: true, pdf: true, tools: true, streaming: true, promptCache: true },
    note: "Full capability set. The fallback for every task that has no explicit model.",
    custom: false,
  },
  kimi: {
    id: "kimi",
    label: "Kimi (Moonshot AI)",
    keyEnv: "KIMI_API_KEY",
    baseUrlEnv: "KIMI_BASE_URL",
    // Moonshot publishes an Anthropic-compatible endpoint, which is why Kimi can
    // reuse the Anthropic SDK verbatim. Override per region/account if needed.
    defaultBaseUrl: "https://api.moonshot.ai/anthropic",
    wire: "anthropic",
    consoleUrl: "https://platform.moonshot.ai/console/api-keys",
    modelPrefixes: ["kimi-", "moonshot-"],
    // UNVERIFIED against the live endpoint as of 2026-08-27. Text in / text out
    // is the only thing assumed. Widen with AI_CAPABILITY_OVERRIDES once a real
    // round-trip confirms tool_use / image blocks / streaming.
    supports: { ...NO_CAPABILITIES },
    note:
      "Anthropic-compatible wire format, so text tasks need no code change — only a key. " +
      "Vision / tool-use / streaming are gated off until verified against the live endpoint; " +
      "widen them with AI_CAPABILITY_OVERRIDES after testing.",
    custom: false,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    keyEnv: "GEMINI_API_KEY",
    baseUrlEnv: "GEMINI_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    wire: "openai-compat",
    consoleUrl: "https://aistudio.google.com/apikey",
    modelPrefixes: ["gemini-", "gemma-"],
    // Served through the OpenAI-compatible adapter: text and images translate
    // cleanly, PDF document blocks and Anthropic tool_use do not.
    supports: { ...NO_CAPABILITIES, vision: true },
    note:
      "Reached through an OpenAI-compatible adapter. Text and image tasks work; " +
      "PDF document blocks and Anthropic-style tool use are not translated.",
    custom: false,
  },
};

export const BUILTIN_PROVIDER_IDS: string[] = Object.keys(BUILTIN_PROVIDERS);

/* ── Custom engines ─────────────────────────────────────────────────────────
 * Persisted as one JSON blob in `integration_settings` under
 * AI_CUSTOM_PROVIDERS, the same runtime-settable channel as every other key, so
 * adding an engine is an admin action rather than a deploy.
 */

/** What an admin submits, and what is stored. Keys/base URLs live separately. */
export interface CustomProviderInput {
  id: string;
  label: string;
  wire: AiWire;
  /** Required for openai-compat; optional for anthropic (SDK default is used). */
  base_url?: string | null;
  console_url?: string | null;
  model_prefixes?: string[];
  supports?: Partial<AiCapabilities>;
  note?: string;
}

/** Env var names are derived from the id, so an admin never types them. */
export function customKeyEnv(id: string): string {
  return `AI_KEY_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function customBaseUrlEnv(id: string): string {
  return `AI_BASE_URL_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/** Slug rules, enforced on write AND on read — a bad stored id must not crash. */
export const CUSTOM_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export function isValidCustomId(id: string): boolean {
  return CUSTOM_ID_PATTERN.test(id) && !BUILTIN_PROVIDER_IDS.includes(id);
}

/** Raw stored list. Never throws — a corrupt blob degrades to "no engines". */
export function readCustomProviderInputs(): CustomProviderInput[] {
  const raw = process.env["AI_CUSTOM_PROVIDERS"];
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomProviderInput[]) : [];
  } catch {
    return [];
  }
}

function toProvider(input: CustomProviderInput): AiProvider | null {
  if (!input || typeof input.id !== "string" || !isValidCustomId(input.id)) return null;
  const wire: AiWire = input.wire === "openai-compat" ? "openai-compat" : "anthropic";
  const baseUrl = (input.base_url ?? "").trim() || null;
  // An OpenAI-compatible engine has no default endpoint to fall back to, so one
  // stored without a base URL is unusable and is dropped rather than surfaced.
  if (wire === "openai-compat" && !baseUrl) return null;
  return {
    id: input.id,
    label: (input.label ?? "").trim() || input.id,
    keyEnv: customKeyEnv(input.id),
    baseUrlEnv: customBaseUrlEnv(input.id),
    defaultBaseUrl: baseUrl,
    wire,
    consoleUrl: (input.console_url ?? "").trim() || "",
    modelPrefixes: Array.isArray(input.model_prefixes)
      ? input.model_prefixes.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim().toLowerCase())
      : [],
    // Same conservative default as a built-in vendor: an admin adding an engine
    // has not proved it can read PDFs, and the gate must not assume it can.
    supports: { ...NO_CAPABILITIES, ...(input.supports ?? {}) },
    note: (input.note ?? "").trim() || "Custom engine added from the admin.",
    custom: true,
  };
}

export function customProviders(): AiProvider[] {
  const seen = new Set<string>(BUILTIN_PROVIDER_IDS);
  const out: AiProvider[] = [];
  for (const input of readCustomProviderInputs()) {
    const p = toProvider(input);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/* ── Lookups ────────────────────────────────────────────────────────────────
 * Every accessor reads process.env on each call rather than caching: keys, base
 * URLs and the custom-engine list are all editable at runtime from the admin,
 * and a cached roster would keep serving the pre-edit answer until a deploy.
 */

export function allProviders(): AiProvider[] {
  return [...BUILTIN_PROVIDER_IDS.map((id) => BUILTIN_PROVIDERS[id]!), ...customProviders()];
}

export function providerIds(): string[] {
  return allProviders().map((p) => p.id);
}

export function getProvider(id: AiProviderId): AiProvider | undefined {
  return BUILTIN_PROVIDERS[id] ?? customProviders().find((p) => p.id === id);
}

/** Provider record, or a placeholder so display code never has to null-check. */
export function providerOrPlaceholder(id: AiProviderId): AiProvider {
  return (
    getProvider(id) ?? {
      id,
      label: id,
      keyEnv: customKeyEnv(id),
      baseUrlEnv: customBaseUrlEnv(id),
      defaultBaseUrl: null,
      wire: "anthropic",
      consoleUrl: "",
      modelPrefixes: [],
      supports: { ...NO_CAPABILITIES },
      // Reached when a task still points at an engine that was deleted.
      note: "This engine is no longer registered. Re-add it, or repoint the task.",
      custom: true,
    }
  );
}

/**
 * Per-instance capability widening, e.g.
 *   AI_CAPABILITY_OVERRIDES={"kimi":{"tools":true,"streaming":true}}
 * Exists so that confirming Kimi supports tool use is an env change on the
 * running server, not a redeploy — the flags are conservative by design and this
 * is the intended way to relax them.
 */
function capabilityOverrides(): Record<string, Partial<AiCapabilities>> {
  const raw = process.env["AI_CAPABILITY_OVERRIDES"];
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Partial<AiCapabilities>>;
  } catch {
    return {};
  }
}

export function capabilitiesOf(id: AiProviderId): AiCapabilities {
  return { ...providerOrPlaceholder(id).supports, ...(capabilityOverrides()[id] ?? {}) };
}

export function apiKeyOf(id: AiProviderId): string | undefined {
  const v = process.env[providerOrPlaceholder(id).keyEnv];
  return v && v.trim() ? v.trim() : undefined;
}

export function baseUrlOf(id: AiProviderId): string | null {
  const p = providerOrPlaceholder(id);
  const override = process.env[p.baseUrlEnv];
  return override && override.trim() ? override.trim().replace(/\/+$/, "") : p.defaultBaseUrl;
}

export function isProviderConfigured(id: AiProviderId): boolean {
  return Boolean(apiKeyOf(id));
}

/** Every env var name that steers a provider. Feeds the admin's key whitelist. */
export function providerEnvKeys(): string[] {
  return allProviders().flatMap((p) => [p.keyEnv, p.baseUrlEnv]);
}

/**
 * Split a configured model string into provider + bare model name.
 *
 * Accepts an explicit `provider/model` prefix, which is the unambiguous form and
 * the only way to reach a model whose name does not identify its vendor. Without
 * a prefix the vendor is inferred from the name, so the pre-existing
 * `claude-sonnet-4-6` values already in the DB keep resolving to Anthropic with
 * no migration.
 */
export function parseModelRef(ref: string): { provider: AiProviderId; model: string } {
  const trimmed = ref.trim();
  const slash = trimmed.indexOf("/");
  if (slash > 0) {
    const maybe = trimmed.slice(0, slash).toLowerCase();
    if (providerIds().includes(maybe)) {
      return { provider: maybe, model: trimmed.slice(slash + 1) };
    }
  }
  const lower = trimmed.toLowerCase();
  // Longest prefix wins, so a custom engine registering "claude-opus-" can claim
  // that family without stealing every "claude-" model from Anthropic.
  let best: { provider: string; len: number } | null = null;
  for (const p of allProviders()) {
    for (const prefix of p.modelPrefixes) {
      if (lower.startsWith(prefix) && (!best || prefix.length > best.len)) {
        best = { provider: p.id, len: prefix.length };
      }
    }
  }
  if (best) return { provider: best.provider, model: trimmed };

  // Unknown vendor naming — fall back to Anthropic, which is the historical
  // default and the only provider guaranteed to be configured.
  return { provider: "anthropic", model: trimmed };
}

/** Canonical `provider/model` form, for display and for storing back. */
export function formatModelRef(provider: AiProviderId, model: string): string {
  return `${provider}/${model}`;
}
