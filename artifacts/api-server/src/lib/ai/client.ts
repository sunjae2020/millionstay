/**
 * The one way to get an AI client. Resolves a task to (provider, model), builds
 * the right vendor client, enforces the capability gate, and meters the call.
 *
 * Call sites keep the Anthropic-SDK shape they already had — `messages.create()`
 * and `messages.stream()` — so switching a task to another vendor is an env
 * change, not a code change. What is NOT preserved is the assumption that the
 * client can do anything: a task declaring `needs.pdf` will refuse to run on a
 * provider without PDF support instead of quietly sending a prompt with the
 * document dropped.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import {
  apiKeyOf,
  baseUrlOf,
  capabilitiesOf,
  isProviderConfigured,
  parseModelRef,
  providerIds,
  providerOrPlaceholder,
  type AiCapabilities,
  type AiProviderId,
} from "./providers.js";
import { AI_TASKS, configuredModelRef, missingCapabilities, type AiTaskId } from "./tasks.js";
import { createGeminiClient } from "./gemini.js";
import { recordUsage, tokensFromResponse } from "./usage.js";

/** Thrown when a task cannot run as configured. Mapped to 503 by the routes. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

/**
 * Thrown when a call succeeded at the HTTP level but produced nothing usable.
 *
 * The case this exists for: a reasoning model spends the whole `max_tokens`
 * budget on `thinking` and stops, returning a well-formed response with no text
 * in it. Every call site here then parses "" as JSON and reports a parse error,
 * which points at the prompt instead of at the real cause. Measured on
 * kimi-k3 / kimi-k2.6 at our standard max_tokens — see the benchmark in
 * docs/AI_PROVIDERS_AND_TASKS.md.
 *
 * Deliberately NOT retried on the fallback engine: this is a configuration
 * mismatch between the task's token budget and the chosen model, and silently
 * paying a second engine to paper over it would hide the thing that needs fixing.
 */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

/**
 * Is this failure worth trying on another engine?
 *
 * Yes for rate limits, server faults and transport failures — the request was
 * fine, the vendor was not. No for 4xx: a bad model name, a rejected content
 * block or a bad key are all requests that would be just as wrong elsewhere, and
 * retrying would mask a real defect behind a silent extra bill.
 */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number") {
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  // No status at all — a connection reset, DNS failure or timeout.
  return err instanceof Error && !(err instanceof AiConfigError) && !(err instanceof AiOutputError);
}

/**
 * A caller asking for fewer than this many output tokens wants a stub, not an
 * answer — the connection-test ping asks for 1. The empty-output guard stays out
 * of the way below the threshold; every real task asks for 1024 or more.
 */
const MIN_TOKENS_FOR_OUTPUT_GUARD = 256;

/** How a task resolves right now. Pure — safe to call for display. */
export interface TaskResolution {
  task: AiTaskId;
  provider: AiProviderId;
  /** Bare model name sent to the vendor. */
  model: string;
  /** Canonical `provider/model`. */
  modelRef: string;
  /** Exactly as configured, which may be an unprefixed legacy value. */
  configured: string;
  configured_via: "task_env" | "fallback_env" | "default";
  provider_configured: boolean;
  /** Capabilities the task needs that the provider lacks. Empty = runnable. */
  missing_capabilities: Array<keyof AiCapabilities>;
}

export function resolveTask(taskId: AiTaskId): TaskResolution {
  const task = AI_TASKS[taskId];
  const configured = configuredModelRef(taskId);
  const { provider, model } = parseModelRef(configured);

  const ownSet = Boolean(process.env[task.envKey]?.trim());
  const fbSet = Boolean(task.fallbackEnvKey && process.env[task.fallbackEnvKey]?.trim());

  return {
    task: taskId,
    provider,
    model,
    modelRef: `${provider}/${model}`,
    configured,
    configured_via: ownSet ? "task_env" : fbSet ? "fallback_env" : "default",
    provider_configured: isProviderConfigured(provider),
    missing_capabilities: missingCapabilities(taskId, capabilitiesOf(provider)),
  };
}

/**
 * Where a task retries when its configured engine is unavailable.
 *
 * Always the task's REGISTRY DEFAULT, which needs no extra configuration to stay
 * correct: the defaults are Anthropic, the one provider with every capability,
 * so the fallback direction is always from a narrower engine to a wider one. The
 * reverse can never be needed — the capability gate refuses to put a task on an
 * engine that cannot run it in the first place.
 *
 * Null when the task is already on its default, when the default's provider has
 * no key, or when the default somehow fails the capability gate.
 */
export function fallbackFor(taskId: AiTaskId, current: TaskResolution): { provider: AiProviderId; model: string } | null {
  const { provider, model } = parseModelRef(AI_TASKS[taskId].defaultModel);
  if (provider === current.provider && model === current.model) return null;
  if (!isProviderConfigured(provider)) return null;
  if (missingCapabilities(taskId, capabilitiesOf(provider)).length > 0) return null;
  return { provider, model };
}

export function resolveAllTasks(): TaskResolution[] {
  return (Object.keys(AI_TASKS) as AiTaskId[]).map(resolveTask);
}

/** True when the task would run today. Use for soft-fail features. */
export function isTaskConfigured(taskId: AiTaskId): boolean {
  const r = resolveTask(taskId);
  return r.provider_configured && r.missing_capabilities.length === 0;
}

/** Any provider having a key. Guards "is AI available at all" checks. */
export function isAnyProviderConfigured(): boolean {
  return providerIds().some(isProviderConfigured);
}

/* ── Vendor clients ─────────────────────────────────────────────────────────
 * Rebuilt whenever the key or base URL changes, because both are editable at
 * runtime from Settings → Integrations and a cached client would keep using the
 * old credentials until the next deploy.
 */

interface CachedClient {
  key: string;
  baseUrl: string | null;
  client: any;
}

const clients = new Map<AiProviderId, CachedClient>();

function vendorClient(provider: AiProviderId): any {
  const p = providerOrPlaceholder(provider);
  const key = apiKeyOf(provider);
  if (!key) {
    throw new AiConfigError(
      `${p.label} is not configured: set ${p.keyEnv} in Admin → Settings → Integrations.`,
    );
  }
  const baseUrl = baseUrlOf(provider);

  const cached = clients.get(provider);
  if (cached && cached.key === key && cached.baseUrl === baseUrl) return cached.client;

  const client =
    p.wire === "openai-compat"
      ? createGeminiClient({ apiKey: key, baseUrl: baseUrl! })
      : new Anthropic({ apiKey: key, ...(baseUrl ? { baseURL: baseUrl } : {}) });

  clients.set(provider, { key, baseUrl, client });
  return client;
}

/** Drop cached clients so the next call rebuilds with fresh credentials. */
export function resetAiClients(): void {
  clients.clear();
}

/**
 * Params minus `model`: the registry supplies it. A call site may still pass one
 * to override, but none does — that is the point of the registry.
 */
export type AiCreateParams = Omit<Anthropic.MessageCreateParamsNonStreaming, "model"> & {
  model?: string;
};
export type AiStreamParams = Omit<Anthropic.MessageStreamParams, "model"> & { model?: string };

/**
 * Typed as the Anthropic SDK's own shapes so existing call sites keep their
 * type-checking on `msg.content` blocks. The Gemini adapter returns a
 * structurally compatible message, which is why it can stand in here.
 */
export interface AiClient {
  provider: AiProviderId;
  /** Bare model name — pass this as `model` if a call site needs it. */
  model: string;
  messages: {
    create(params: AiCreateParams): Promise<Anthropic.Message>;
    stream(params: AiStreamParams): MessageStream;
  };
}

/**
 * The client for a task, with its model already resolved and metering attached.
 *
 * Call sites may omit `model` — it is filled in from the registry, which is what
 * lets a task be re-pointed at another vendor without touching the call site.
 */
export function getAiClient(taskId: AiTaskId): AiClient {
  const r = resolveTask(taskId);
  const p = providerOrPlaceholder(r.provider);

  // ── Vendor pinning for movable:"no" tasks ──
  // A task marked movable:"no" in the registry (ID-document OCR, document
  // intake) handles identity documents or sets retention clocks: which VENDOR
  // sees that data is a privacy decision, not a cost one. The env/admin
  // override may still pick a different MODEL, but only on the task's default
  // provider — any other vendor is refused here rather than silently honoured.
  const task = AI_TASKS[taskId];
  if (task.movable === "no") {
    const pinned = parseModelRef(task.defaultModel).provider;
    if (r.provider !== pinned) {
      throw new AiConfigError(
        `Task "${taskId}" is pinned to ${pinned} (movable: "no" — ${task.rationale.slice(0, 120)}…). ` +
          `${task.envKey} resolves to ${r.provider}/${r.model}; unset it or point it at a ${pinned} model.`,
      );
    }
  }

  if (r.missing_capabilities.length > 0) {
    throw new AiConfigError(
      `Task "${taskId}" needs ${r.missing_capabilities.join(", ")}, which ${p.label} does not ` +
        `provide for model "${r.model}". Point ${AI_TASKS[taskId].envKey} at a capable model ` +
        `(Anthropic supports all of them), or widen the provider's flags via AI_CAPABILITY_OVERRIDES ` +
        `once you have verified them against the live endpoint.`,
    );
  }

  const fallback = fallbackFor(taskId, r);

  /** Record one attempt. `note` explains a failure's disposition to the admin. */
  function meter(
    target: { provider: AiProviderId; model: string },
    started: number,
    msg: any,
  ): void {
    const t = tokensFromResponse(msg);
    recordUsage({
      task: taskId,
      provider: target.provider,
      model: target.model,
      inputTokens: t.inputTokens,
      outputTokens: t.outputTokens,
      cacheReadTokens: t.cacheReadTokens,
      cacheWriteTokens: t.cacheWriteTokens,
      latencyMs: Date.now() - started,
      ok: true,
    });
  }

  function meterFailure(
    target: { provider: AiProviderId; model: string },
    started: number,
    err: unknown,
    note: string,
  ): void {
    recordUsage({
      task: taskId,
      provider: target.provider,
      model: target.model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      latencyMs: Date.now() - started,
      ok: false,
      // The note rides in the error text so the fallback RATE is readable off
      // the meter without a schema change: every failed row says whether a
      // fallback was taken, and the recovery shows up as its own ok row.
      error: `${err instanceof Error ? err.message : String(err)} ${note}`,
    });
  }

  /**
   * Reject a response that is well-formed but carries no usable text.
   *
   * A reasoning model can spend the entire output budget on `thinking` and stop;
   * the call sites then parse "" and report a prompt problem. Naming the real
   * cause here saves that hunt. Skipped below the stub threshold so the
   * one-token connection ping is unaffected.
   */
  function assertUsableOutput(
    target: { provider: AiProviderId; model: string },
    params: AiCreateParams,
    msg: Anthropic.Message,
  ): void {
    if ((params.max_tokens ?? 0) < MIN_TOKENS_FOR_OUTPUT_GUARD) return;
    if (msg.stop_reason !== "max_tokens") return;
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (text) return;
    const reasoning = msg.content.some((b) => b.type === "thinking" || b.type === "redacted_thinking");
    throw new AiOutputError(
      `${target.provider}/${target.model} hit max_tokens (${params.max_tokens}) without producing any text` +
        (reasoning ? " — the whole budget went to reasoning" : "") +
        `. Raise this task's token budget or point ${AI_TASKS[taskId].envKey} at a model that does not ` +
        `spend its output budget on reasoning.`,
    );
  }

  async function attempt(
    target: { provider: AiProviderId; model: string },
    params: AiCreateParams,
  ): Promise<Anthropic.Message> {
    const started = Date.now();
    let msg: Anthropic.Message;
    try {
      msg = (await vendorClient(target.provider).messages.create({
        ...params,
        model: target.model,
      })) as Anthropic.Message;
    } catch (err) {
      // Disposition is decided by the caller; it records the failure itself so
      // the note can say whether a fallback was taken.
      throw err;
    }
    meter(target, started, msg);
    // Runs after metering: the call was billed, and the admin should see it.
    assertUsableOutput(target, params, msg);
    return msg;
  }

  return {
    provider: r.provider,
    model: r.model,
    messages: {
      async create(params: AiCreateParams): Promise<Anthropic.Message> {
        const primary = { provider: r.provider, model: r.model };
        const started = Date.now();
        try {
          return await attempt(primary, params);
        } catch (err) {
          // An unusable-output error is a config mismatch, not an outage — let
          // it surface instead of paying a second engine to hide it.
          if (err instanceof AiOutputError) throw err;
          if (!fallback || !isRetryable(err)) {
            meterFailure(primary, started, err, fallback ? "[not retryable — no fallback]" : "[no fallback available]");
            throw err;
          }
          meterFailure(primary, started, err, `[fell back to ${fallback.provider}/${fallback.model}]`);
          return await attempt(fallback, params);
        }
      },
      /**
       * No fallback on streams: by the time a failure surfaces the caller has
       * already emitted deltas to the visitor, and replaying the turn on another
       * engine would repeat or contradict what they just read. The only
       * streaming task (chat) runs on its default engine anyway, so a fallback
       * would have nowhere to go.
       */
      stream(params: AiStreamParams): MessageStream {
        const primary = { provider: r.provider, model: r.model };
        const started = Date.now();
        const s = vendorClient(r.provider).messages.stream({ ...params, model: r.model }) as MessageStream;
        // Meter at finalMessage() rather than at stream creation: that is the
        // point where usage totals exist, and it is awaited by every caller.
        const original = s.finalMessage.bind(s);
        (s as { finalMessage: () => Promise<Anthropic.Message> }).finalMessage = async () => {
          try {
            const msg = await original();
            meter(primary, started, msg);
            return msg;
          } catch (err) {
            meterFailure(primary, started, err, "[stream — no fallback]");
            throw err;
          }
        };
        return s;
      },
    },
  };
}
