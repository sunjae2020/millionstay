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

  if (r.missing_capabilities.length > 0) {
    throw new AiConfigError(
      `Task "${taskId}" needs ${r.missing_capabilities.join(", ")}, which ${p.label} does not ` +
        `provide for model "${r.model}". Point ${AI_TASKS[taskId].envKey} at a capable model ` +
        `(Anthropic supports all of them), or widen the provider's flags via AI_CAPABILITY_OVERRIDES ` +
        `once you have verified them against the live endpoint.`,
    );
  }

  const raw = vendorClient(r.provider);

  function meter(started: number, msg: any): void {
    const t = tokensFromResponse(msg);
    recordUsage({
      task: taskId,
      provider: r.provider,
      model: r.model,
      inputTokens: t.inputTokens,
      outputTokens: t.outputTokens,
      cacheReadTokens: t.cacheReadTokens,
      cacheWriteTokens: t.cacheWriteTokens,
      latencyMs: Date.now() - started,
      ok: true,
    });
  }

  function meterFailure(started: number, err: unknown): void {
    recordUsage({
      task: taskId,
      provider: r.provider,
      model: r.model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      latencyMs: Date.now() - started,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    provider: r.provider,
    model: r.model,
    messages: {
      async create(params: AiCreateParams): Promise<Anthropic.Message> {
        const started = Date.now();
        try {
          const msg = (await raw.messages.create({ ...params, model: r.model })) as Anthropic.Message;
          meter(started, msg);
          return msg;
        } catch (err) {
          meterFailure(started, err);
          throw err;
        }
      },
      stream(params: AiStreamParams): MessageStream {
        const started = Date.now();
        const s = raw.messages.stream({ ...params, model: r.model }) as MessageStream;
        // Meter at finalMessage() rather than at stream creation: that is the
        // point where usage totals exist, and it is awaited by every caller.
        const original = s.finalMessage.bind(s);
        (s as { finalMessage: () => Promise<Anthropic.Message> }).finalMessage = async () => {
          try {
            const msg = await original();
            meter(started, msg);
            return msg;
          } catch (err) {
            meterFailure(started, err);
            throw err;
          }
        };
        return s;
      },
    },
  };
}
