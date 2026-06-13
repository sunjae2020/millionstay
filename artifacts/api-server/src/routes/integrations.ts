import { Router, type IRouter } from "express";
import { v2 as cloudinary } from "cloudinary";
import Stripe from "stripe";
import { Resend } from "resend";
import type { Request, Response } from "express";
import { db, integrationSettings } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const ALLOWED_KEYS = [
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
];

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
  // Prefer process.env (covers Replit secrets + runtime updates)
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

  const stripeConfigured = !!stripeKey;
  const cloudinaryConfigured = !!(cloudName && cloudApiKey && cloudApiSecret);
  const resendConfigured = !!resendKey;
  const aiConfigured = !!anthropicKey;
  // Default to enabled when the toggle has never been saved.
  const widgetEnabled = widgetEnabledRaw !== "false";

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
        configured: aiConfigured,
        masked_key: maskKey(anthropicKey),
        model: aiConfigured ? (process.env["CHAT_MODEL"] || "claude-sonnet-4-6") : null,
        widget_enabled: widgetEnabled,
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
  const emailFrom = await getEnvVar("EMAIL_FROM") ?? "onboarding@resend.dev";
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
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      from: emailFrom,
      to: [to_email],
      subject: "MillionStay — Resend Test Email",
      html: "<p>This is a test email from MillionStay Admin. Resend is connected successfully.</p>",
    });
    res.json({ success: true, message_id: result.data?.id ?? null });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message ?? "Resend connection failed" });
  }
});

router.post("/v1/integrations/anthropic/test", async (_req: Request, res: Response): Promise<void> => {
  const key = await getEnvVar("ANTHROPIC_API_KEY");
  if (!key) {
    res.status(400).json({ success: false, error: "ANTHROPIC_API_KEY not configured" });
    return;
  }
  try {
    const { getAnthropic, CHAT_MODEL } = await import("../lib/chat/anthropic");
    const client = getAnthropic();
    // Minimal 1-token round-trip to validate the key + model.
    await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    res.json({ success: true, model: CHAT_MODEL });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message ?? "Anthropic connection failed" });
  }
});

router.post("/v1/integrations/update-env", async (req: Request, res: Response): Promise<void> => {
  const { key, value } = req.body as { key?: string; value?: string };

  if (!key || !ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ success: false, error: "Invalid environment key" });
    return;
  }

  const trimmedValue = (value ?? "").trim();

  // Update process.env immediately for this server process
  if (trimmedValue) {
    process.env[key] = trimmedValue;
  } else {
    delete process.env[key];
  }

  // Persist to DB so it survives server restarts
  try {
    await db
      .insert(integrationSettings)
      .values({ key, value: trimmedValue, updated_at: new Date() })
      .onConflictDoUpdate({
        target: integrationSettings.key,
        set: { value: trimmedValue, updated_at: new Date() },
      });
  } catch (e: any) {
    res.status(500).json({ success: false, error: `DB save failed: ${e?.message}` });
    return;
  }

  res.json({ success: true, key, updated: true });
});

export default router;
