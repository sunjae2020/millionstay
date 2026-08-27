import { Router, type IRouter } from "express";
import { v2 as cloudinary } from "cloudinary";
import Stripe from "stripe";
import type { Request, Response } from "express";
import { db, integrationSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emailSender, resendClient, escapeHtml } from "../lib/email.js";
import { resolveEmailBrand } from "../lib/emailBrand.js";
import { allProviders, apiKeyOf, capabilitiesOf, isProviderConfigured, providerEnvKeys } from "../lib/ai/providers.js";
import { taskModelEnvKeys } from "../lib/ai/tasks.js";
import { resetAiClients, resolveAllTasks } from "../lib/ai/client.js";

const router: IRouter = Router();

/**
 * Keys an admin may set from the Integrations page.
 *
 * A FUNCTION, not a constant: the AI provider list is partly runtime data
 * (custom engines live in AI_CUSTOM_PROVIDERS), so a whitelist frozen at import
 * time would reject the key of any engine registered after boot.
 */
function allowedKeys(): string[] {
  return [
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "LEAD_NOTIFICATION_EMAIL",
    "ANTHROPIC_API_KEY",
    "CHAT_WIDGET_ENABLED",
    "RECURRING_INVOICES_ENABLED",
    // Korean monthly-lease rent automation (contract-driven, no booking needed):
    // generates each Active lease's monthly rent invoice and flags overdue ones.
    "LEASE_RENT_INVOICES_ENABLED",
    // Per-tenant module toggle. When "false", the admin hides the Homestay
    // intake workflow (applications / student requests / placements). Each
    // tenant has its own DB, so this row is inherently per-instance. Defaults
    // to enabled when unset, so homestay tenants are unaffected.
    "HOMESTAY_MODULE_ENABLED",
    // ── AI vendors ──────────────────────────────────────────────────────────
    // One key (and optional base URL) per provider in lib/ai/providers.ts, plus
    // one model override per task in lib/ai/tasks.ts. Derived from those two
    // registries rather than listed by hand, so adding a provider or a task
    // cannot leave its key un-settable from the admin.
    ...providerEnvKeys(),
    // The custom-engine roster itself, so an admin can register a new engine.
    "AI_CUSTOM_PROVIDERS",
    ...taskModelEnvKeys(),
    // Per-instance capability widening + price-table corrections (JSON blobs).
    "AI_CAPABILITY_OVERRIDES",
    "AI_PRICE_OVERRIDES",
  ];
}

function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 12) return key.slice(0, 4) + "...";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

async function loadSettingsFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(integrationSettings);
    for (const row of rows) {
      if (row.value) {
        process.env[row.key] = row.value;
      }
    }
  } catch {
    // DB might not be ready yet
  }
}

async function getEnvVar(key: string): Promise<string | undefined> {
  // Prefer process.env (covers host secrets + runtime updates)
  const envVal = process.env[key];
  if (envVal) return envVal;
  // Fallback: check DB
  try {
    const rows = await db.select().from(integrationSettings).where(eq(integrationSettings.key, key));
    if (rows[0]?.value) {
      process.env[key] = rows[0].value;
      return rows[0].value;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export { loadSettingsFromDb };

/**
 * Persist one setting to `integration_settings` AND apply it to this process.
 *
 * Shared with the AI operations router so that both paths update process.env and
 * the DB in the same order. Callers are responsible for authorising the key —
 * the allowedKeys() guard lives on the HTTP route, not here.
 */
export async function setIntegrationSetting(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) {
    process.env[key] = trimmed;
  } else {
    delete process.env[key];
  }
  await db
    .insert(integrationSettings)
    .values({ key, value: trimmed, updated_at: new Date() })
    .onConflictDoUpdate({
      target: integrationSettings.key,
      set: { value: trimmed, updated_at: new Date() },
    });
  // A changed key or base URL must not keep hitting the old endpoint.
  resetAiClients();
}

router.get("/v1/integrations/status", async (_req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.removeHeader("ETag");

  const stripeKey = await getEnvVar("STRIPE_SECRET_KEY");
  const cloudName = await getEnvVar("CLOUDINARY_CLOUD_NAME");
  const cloudApiKey = await getEnvVar("CLOUDINARY_API_KEY");
  const cloudApiSecret = await getEnvVar("CLOUDINARY_API_SECRET");
  const resendKey = await getEnvVar("RESEND_API_KEY");
  const emailFrom = await getEnvVar("EMAIL_FROM");
  // Recipient that receives "Operations team" copies of signed applications and
  // new-lead/application alerts. Read by resolveRecipients() + the lead notifiers.
  const opsEmail = await getEnvVar("LEAD_NOTIFICATION_EMAIL");
  const anthropicKey = await getEnvVar("ANTHROPIC_API_KEY");
  const widgetEnabledRaw = await getEnvVar("CHAT_WIDGET_ENABLED");
  const homestayModuleRaw = await getEnvVar("HOMESTAY_MODULE_ENABLED");

  const stripeConfigured = !!stripeKey;
  const cloudinaryConfigured = !!(cloudName && cloudApiKey && cloudApiSecret);
  const resendConfigured = !!resendKey;
  const aiConfigured = !!anthropicKey;
  // Default to enabled when the toggle has never been saved.
  const widgetEnabled = widgetEnabledRaw !== "false";

  // Resolved once: the status payload reports each task's provider and model,
  // and both the AI block and the broken-task list read from the same snapshot.
  const taskResolutions = resolveAllTasks();
  const chatResolution = taskResolutions.find((t) => t.task === "chat")!;
  const csResolution = taskResolutions.find((t) => t.task === "cs_translate")!;

  const maskedCloudApiKey = maskKey(cloudApiKey);
  const maskedCloudApiSecret = maskKey(cloudApiSecret);

  const stripeMode = stripeConfigured
    ? stripeKey!.startsWith("sk_live") ? "live" : "test"
    : null;

  res.json({
    success: true,
    data: {
      stripe: {
        configured: stripeConfigured,
        mode: stripeMode,
        masked_key: maskKey(stripeKey),
        error: null,
      },
      cloudinary: {
        configured: cloudinaryConfigured,
        cloud_name: cloudName ?? null,
        masked_api_key: maskedCloudApiKey,
        masked_api_secret: maskedCloudApiSecret,
        plan: null,
        storage_mb: null,
        error: null,
      },
      resend: {
        configured: resendConfigured,
        from_email: emailFrom ?? null,
        ops_email: opsEmail ?? null,
        masked_key: maskKey(resendKey),
        error: null,
      },
      ai: {
        // `configured` stays Anthropic-specific: it is the fallback every task
        // resolves to, so losing that key breaks AI regardless of the others.
        configured: aiConfigured,
        masked_key: maskKey(anthropicKey),
        model: chatResolution.modelRef,
        cs_translate_model: csResolution.modelRef,
        widget_enabled: widgetEnabled,
        // One row per vendor for the Integrations card. Values are masked; the
        // full roster + capabilities + task assignments come from /v1/ai/overview.
        providers: allProviders().map(({ id, label, keyEnv, consoleUrl, custom }) => ({
          id,
          label,
          key_env: keyEnv,
          console_url: consoleUrl,
          custom,
          configured: isProviderConfigured(id),
          masked_key: maskKey(apiKeyOf(id)),
          supports: capabilitiesOf(id),
          // Tasks currently pointed at this vendor — the "who uses what" answer
          // an admin needs before rotating or removing a key.
          task_count: taskResolutions.filter((t) => t.provider === id).length,
        })),
        // Any task whose provider is missing a key or a required capability.
        broken_tasks: taskResolutions
          .filter((t) => !t.provider_configured || t.missing_capabilities.length > 0)
          .map((t) => ({
            task: t.task,
            provider: t.provider,
            model: t.model,
            provider_configured: t.provider_configured,
            missing_capabilities: t.missing_capabilities,
          })),
        error: null,
      },
      maps: {
        provider: "OpenStreetMap",
        configured: true,
        note: "No API key required",
      },
      ical: {
        provider: "iCal Sync",
        configured: false,
        note: "Configure iCal URLs on each Space",
      },
      billing: {
        recurring_invoices_enabled: (await getEnvVar("RECURRING_INVOICES_ENABLED")) === "true",
        lease_rent_invoices_enabled: (await getEnvVar("LEASE_RENT_INVOICES_ENABLED")) === "true",
      },
      modules: {
        // Enabled unless explicitly turned off, so tenants that never set it
        // (e.g. the homestay-carrying MillionStay instance) keep the menus.
        homestay_enabled: homestayModuleRaw !== "false",
      },
    },
  });
});

router.post("/v1/integrations/stripe/test", async (_req: Request, res: Response): Promise<void> => {
  const stripeKey = await getEnvVar("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    res.status(400).json({ success: false, error: "STRIPE_SECRET_KEY not configured" });
    return;
  }
  try {
    const stripe = new Stripe(stripeKey);
    await stripe.paymentIntents.list({ limit: 1 });
    res.json({
      success: true,
      mode: stripeKey.startsWith("sk_live") ? "live" : "test",
      account: "MillionStay",
    });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message ?? "Stripe connection failed" });
  }
});

router.post("/v1/integrations/cloudinary/test", async (_req: Request, res: Response): Promise<void> => {
  const cloudName = await getEnvVar("CLOUDINARY_CLOUD_NAME");
  const cloudApiKey = await getEnvVar("CLOUDINARY_API_KEY");
  const cloudApiSecret = await getEnvVar("CLOUDINARY_API_SECRET");
  if (!cloudName || !cloudApiKey || !cloudApiSecret) {
    res.status(400).json({ success: false, error: "Cloudinary credentials not configured" });
    return;
  }
  try {
    cloudinary.config({ cloud_name: cloudName, api_key: cloudApiKey, api_secret: cloudApiSecret });
    const pingResult = await (cloudinary.api as any).ping();
    const status = pingResult?.status ?? "ok";

    // Try usage (may fail if API key lacks admin permissions — that's OK)
    let storageMb: string | null = null;
    let plan: string | null = null;
    try {
      const usage = await (cloudinary.api as any).usage();
      storageMb = (usage.storage.usage / 1024 / 1024).toFixed(1);
      plan = usage.plan ?? "free";
    } catch {
      // Non-root keys don't have usage permission — ignore
    }

    res.json({ success: true, status, cloud_name: cloudName, storage_mb: storageMb, plan });
  } catch (e: any) {
    const msg = e?.error?.message ?? e?.message ?? "Cloudinary connection failed";
    res.status(400).json({ success: false, error: msg });
  }
});

router.post("/v1/integrations/resend/test", async (req: Request, res: Response): Promise<void> => {
  const resendKey = await getEnvVar("RESEND_API_KEY");
  // Loads EMAIL_FROM into process.env; emailSender() then applies the same
  // free-mail guard as real sends, so the test mirrors production behaviour.
  await getEnvVar("EMAIL_FROM");
  // The test must look exactly like a real send, sender identity included —
  // that is the thing an operator is checking when they press "test".
  const brand = await resolveEmailBrand();
  const sender = emailSender(brand.name);
  if (!resendKey) {
    res.status(400).json({ success: false, error: "RESEND_API_KEY not configured" });
    return;
  }
  const { to_email } = req.body as { to_email?: string };
  if (!to_email) {
    res.status(400).json({ success: false, error: "to_email is required" });
    return;
  }
  try {
    const resend = resendClient(resendKey)!;
    const result = await resend.emails.send({
      ...sender,
      to: [to_email],
      subject: `${brand.name} — Resend Test Email`,
      html: `<p>This is a test email from ${escapeHtml(brand.name)} Admin. Resend is connected successfully.</p>`,
    });
    res.json({ success: true, message_id: result.data?.id ?? null });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message ?? "Resend connection failed" });
  }
});

/**
 * Legacy single-vendor test, kept because the Integrations card's "Test" button
 * posts here. Per-provider testing lives at POST /v1/ai/providers/:id/test.
 */
router.post("/v1/integrations/anthropic/test", async (_req: Request, res: Response): Promise<void> => {
  const key = await getEnvVar("ANTHROPIC_API_KEY");
  if (!key) {
    res.status(400).json({ success: false, error: "ANTHROPIC_API_KEY not configured" });
    return;
  }
  try {
    const { getAiClient } = await import("../lib/ai/client.js");
    const ai = getAiClient("chat");
    // Minimal 1-token round-trip to validate the key + model.
    await ai.messages.create({ max_tokens: 1, messages: [{ role: "user", content: "ping" }] });
    res.json({ success: true, model: ai.model });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message ?? "Anthropic connection failed" });
  }
});

router.post("/v1/integrations/update-env", async (req: Request, res: Response): Promise<void> => {
  const { key, value } = req.body as { key?: string; value?: string };

  if (!key || !allowedKeys().includes(key)) {
    res.status(400).json({ success: false, error: "Invalid environment key" });
    return;
  }

  const trimmedValue = (value ?? "").trim();

  // Applies to this process AND persists, so the change survives a restart.
  try {
    await setIntegrationSetting(key, trimmedValue);
  } catch (e: any) {
    res.status(500).json({ success: false, error: `DB save failed: ${e?.message}` });
    return;
  }

  res.json({ success: true, key, updated: true });
});

export default router;
