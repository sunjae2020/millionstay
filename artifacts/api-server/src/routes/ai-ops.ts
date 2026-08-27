/**
 * AI operations API — the provider roster, the task registry and the usage
 * meter behind Settings → Integrations → AI.
 *
 * Split out from `integrations.ts` because it answers a different question. That
 * router asks "is this vendor connected?"; this one asks "which model runs which
 * job, is that assignment legal, and what has it cost?" — and it is the only
 * place that knows both halves.
 *
 * Mounted under the global requireAuth guard in app.ts, so every route here is
 * admin-authenticated. Key VALUES are never returned, only masks.
 */

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import {
  BUILTIN_PROVIDER_IDS,
  CUSTOM_ID_PATTERN,
  allProviders,
  apiKeyOf,
  baseUrlOf,
  capabilitiesOf,
  customBaseUrlEnv,
  customKeyEnv,
  customProviders,
  getProvider,
  isProviderConfigured,
  isValidCustomId,
  parseModelRef,
  providerIds,
  providerOrPlaceholder,
  readCustomProviderInputs,
  type AiProviderId,
  type CustomProviderInput,
} from "../lib/ai/providers.js";
import { AI_TASKS, AI_TASK_IDS, eligibleProviders, type AiTaskId } from "../lib/ai/tasks.js";
import { resetAiClients, resolveAllTasks, resolveTask } from "../lib/ai/client.js";
import { createGeminiClient } from "../lib/ai/gemini.js";
import { priceFor } from "../lib/ai/pricing.js";
import { usageSummary } from "../lib/ai/usage.js";
import { setIntegrationSetting } from "./integrations.js";

const router: IRouter = Router();

function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 12) return key.slice(0, 4) + "...";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

function isProviderId(v: string): v is AiProviderId {
  return providerIds().includes(v);
}

function isTaskId(v: string): v is AiTaskId {
  return (AI_TASK_IDS as string[]).includes(v);
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET /v1/ai/overview — providers + tasks in one payload
 * ──────────────────────────────────────────────────────────────────────────*/

router.get("/v1/ai/overview", async (_req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");

  const providers = allProviders().map((p) => {
    const id = p.id;
    return {
      id,
      label: p.label,
      key_env: p.keyEnv,
      base_url_env: p.baseUrlEnv,
      base_url: baseUrlOf(id),
      console_url: p.consoleUrl,
      wire: p.wire,
      custom: p.custom,
      model_prefixes: p.modelPrefixes,
      configured: isProviderConfigured(id),
      masked_key: maskKey(apiKeyOf(id)),
      // Reflects AI_CAPABILITY_OVERRIDES, so the admin shows what is actually
      // enforced right now rather than the conservative compiled-in defaults.
      supports: capabilitiesOf(id),
      note: p.note,
    };
  });

  const capsOf = (p: AiProviderId) => capabilitiesOf(p);
  const tasks = resolveAllTasks().map((r) => {
    const t = AI_TASKS[r.task];
    const price = priceFor(r.provider, r.model);
    return {
      ...r,
      label: t.label,
      area: t.area,
      env_key: t.envKey,
      fallback_env_key: t.fallbackEnvKey ?? null,
      default_model: t.defaultModel,
      volume: t.volume,
      movable: t.movable,
      source: t.source,
      rationale: t.rationale,
      needs: Object.keys(t.needs).filter((k) => (t.needs as Record<string, boolean>)[k]),
      eligible_providers: eligibleProviders(r.task, capsOf, providerIds()),
      price_per_mtok: price ? { input: price.input, output: price.output } : null,
    };
  });

  res.json({ success: true, data: { providers, tasks } });
});

/* ────────────────────────────────────────────────────────────────────────────
 * PUT /v1/ai/tasks/:id — repoint one task at another model
 * ──────────────────────────────────────────────────────────────────────────*/

const TaskModelBody = z.object({
  // Empty string clears the override so the task falls back to its default —
  // that is the "undo my experiment" path, and it must not be a 400.
  model: z.string().max(200),
});

router.put("/v1/ai/tasks/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  if (!isTaskId(id)) {
    res.status(404).json({ success: false, error: `Unknown AI task "${id}"` });
    return;
  }
  const parsed = TaskModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  const model = parsed.data.model.trim();

  // Refuse an assignment the client factory would reject at call time. Failing
  // here means an admin sees "Gemini cannot read PDFs" while choosing, instead
  // of the next document upload failing for a reason nobody connects to this.
  if (model) {
    const { provider } = parseModelRef(model);
    const caps = capabilitiesOf(provider);
    const missing = (Object.keys(AI_TASKS[id].needs) as Array<keyof typeof caps>).filter(
      (k) => AI_TASKS[id].needs[k] === true && !caps[k],
    );
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error:
          `${providerOrPlaceholder(provider).label} does not provide ${missing.join(", ")}, ` +
          `which this task requires. ${providerOrPlaceholder(provider).note}`,
      });
      return;
    }
  }

  try {
    await setIntegrationSetting(AI_TASKS[id].envKey, model);
  } catch (e: any) {
    res.status(500).json({ success: false, error: `Save failed: ${e?.message}` });
    return;
  }

  res.json({ success: true, data: resolveTask(id) });
});

/* ────────────────────────────────────────────────────────────────────────────
 * POST /v1/ai/providers/:id/test — one-token round-trip
 * ──────────────────────────────────────────────────────────────────────────*/

router.post("/v1/ai/providers/:id/test", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  if (!isProviderId(id)) {
    res.status(404).json({ success: false, error: `Unknown provider "${id}"` });
    return;
  }
  const p = providerOrPlaceholder(id);
  const key = apiKeyOf(id);
  if (!key) {
    res.status(400).json({ success: false, error: `${p.keyEnv} is not configured` });
    return;
  }

  // Test the model the admin is about to use, not a hard-coded one — a valid key
  // with a wrong model name is the more common failure, and it must be visible.
  const bodyModel = typeof req.body?.model === "string" ? req.body.model.trim() : "";
  const model = bodyModel
    ? parseModelRef(bodyModel).model
    : id === "anthropic"
      ? resolveTask("chat").model
      : "";
  if (!model) {
    res.status(400).json({
      success: false,
      error: `Enter a model name to test against ${p.label}.`,
    });
    return;
  }

  const baseUrl = baseUrlOf(id);
  const started = Date.now();
  try {
    const client =
      p.wire === "openai-compat"
        ? createGeminiClient({ apiKey: key, baseUrl: baseUrl! })
        : new Anthropic({ apiKey: key, ...(baseUrl ? { baseURL: baseUrl } : {}) });

    await client.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    res.json({ success: true, provider: id, model, latency_ms: Date.now() - started });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      provider: id,
      model,
      error: e?.message ?? `${p.label} connection failed`,
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * Custom engines — register any additional AI vendor without a deploy
 *
 * Stored as one JSON blob in `integration_settings` (AI_CUSTOM_PROVIDERS). The
 * engine's API key and base-URL override are SEPARATE settings under derived
 * names, so a key never ends up inside the roster blob that the overview
 * endpoint returns.
 * ──────────────────────────────────────────────────────────────────────────*/

const CapabilitiesBody = z.object({
  vision: z.boolean().optional(),
  pdf: z.boolean().optional(),
  tools: z.boolean().optional(),
  streaming: z.boolean().optional(),
  promptCache: z.boolean().optional(),
});

const CustomProviderBody = z.object({
  id: z.string().regex(CUSTOM_ID_PATTERN, "Use 2–32 lowercase letters, digits or hyphens, starting with a letter."),
  label: z.string().min(1).max(80),
  wire: z.enum(["anthropic", "openai-compat"]),
  base_url: z.string().max(500).optional().nullable(),
  console_url: z.string().max(500).optional().nullable(),
  /** Bare model names starting with one of these resolve to this engine. */
  model_prefixes: z.array(z.string().min(1).max(64)).max(10).optional(),
  supports: CapabilitiesBody.optional(),
  note: z.string().max(500).optional(),
  /** Optional: saved to the engine's own key setting, never into the roster. */
  api_key: z.string().max(500).optional(),
});

/** Persist the roster and apply it to this process in one step. */
async function saveCustomProviders(list: CustomProviderInput[]): Promise<void> {
  await setIntegrationSetting("AI_CUSTOM_PROVIDERS", list.length ? JSON.stringify(list) : "");
}

/**
 * POST /v1/ai/providers — add or update a custom engine.
 *
 * Upsert rather than create-only: an admin fixing a typo in a base URL should
 * not have to delete the engine first, which would orphan every task pointed at
 * it. Built-in ids are refused so a custom entry can never shadow Anthropic.
 */
router.post("/v1/ai/providers", async (req: Request, res: Response): Promise<void> => {
  const parsed = CustomProviderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  const body = parsed.data;

  if (!isValidCustomId(body.id)) {
    res.status(400).json({
      success: false,
      error: `"${body.id}" is reserved by a built-in provider (${BUILTIN_PROVIDER_IDS.join(", ")}).`,
    });
    return;
  }
  // An OpenAI-compatible engine has no default endpoint to fall back to.
  const baseUrl = (body.base_url ?? "").trim();
  if (body.wire === "openai-compat" && !baseUrl) {
    res.status(400).json({ success: false, error: "An OpenAI-compatible engine needs a base URL." });
    return;
  }
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    res.status(400).json({ success: false, error: "The base URL must start with http:// or https://." });
    return;
  }

  const entry: CustomProviderInput = {
    id: body.id,
    label: body.label.trim(),
    wire: body.wire,
    base_url: baseUrl || null,
    console_url: (body.console_url ?? "").trim() || null,
    model_prefixes: (body.model_prefixes ?? []).map((p) => p.trim().toLowerCase()).filter(Boolean),
    supports: body.supports ?? {},
    note: (body.note ?? "").trim() || undefined,
  };

  const list = readCustomProviderInputs().filter((p) => p?.id !== entry.id);
  list.push(entry);

  try {
    await saveCustomProviders(list);
    // The key rides along on the same request so a new engine can be added and
    // made usable in one action; it is stored under its own derived setting.
    if (body.api_key && body.api_key.trim()) {
      await setIntegrationSetting(customKeyEnv(entry.id), body.api_key.trim());
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: `Save failed: ${e?.message}` });
    return;
  }

  res.json({ success: true, data: getProvider(entry.id) ?? null });
});

/**
 * DELETE /v1/ai/providers/:id — remove a custom engine and its key.
 *
 * Refused while a task still points at the engine: deleting it would leave that
 * task resolving to a provider that no longer exists, and the failure would
 * surface later as an unexplained 503 on an unrelated feature.
 */
router.delete("/v1/ai/providers/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  if (BUILTIN_PROVIDER_IDS.includes(id)) {
    res.status(400).json({ success: false, error: "Built-in providers cannot be removed." });
    return;
  }
  if (!customProviders().some((p) => p.id === id)) {
    res.status(404).json({ success: false, error: `Unknown engine "${id}"` });
    return;
  }

  const inUse = resolveAllTasks().filter((t) => t.provider === id);
  if (inUse.length > 0) {
    res.status(409).json({
      success: false,
      error: `Still used by: ${inUse.map((t) => t.task).join(", ")}. Repoint those tasks first.`,
    });
    return;
  }

  try {
    await saveCustomProviders(readCustomProviderInputs().filter((p) => p?.id !== id));
    // Clear the credentials too — a key left behind for a removed engine is a
    // live secret nothing references.
    await setIntegrationSetting(customKeyEnv(id), "");
    await setIntegrationSetting(customBaseUrlEnv(id), "");
  } catch (e: any) {
    res.status(500).json({ success: false, error: `Save failed: ${e?.message}` });
    return;
  }

  res.json({ success: true });
});

/* ────────────────────────────────────────────────────────────────────────────
 * GET /v1/ai/usage?days=30 — the meter
 * ──────────────────────────────────────────────────────────────────────────*/

const MAX_DAYS = 365;

router.get("/v1/ai/usage", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const raw = Number(req.query["days"] ?? 30);
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), MAX_DAYS) : 30;

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const summary = await usageSummary(from, to);
    res.json({ success: true, data: { days, ...summary } });
  } catch (e: any) {
    // The meter table is additive and may not exist yet on an instance that has
    // not run 0058. Report that plainly instead of 500-ing the settings page.
    res.status(503).json({
      success: false,
      error: `Usage metering is unavailable: ${e?.message ?? "unknown error"}`,
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * POST /v1/ai/reset-clients — drop cached vendor clients
 * ──────────────────────────────────────────────────────────────────────────*/

router.post("/v1/ai/reset-clients", async (_req: Request, res: Response): Promise<void> => {
  resetAiClients();
  res.json({ success: true });
});

export default router;
