import { Router, type IRouter } from "express";
import { v2 as cloudinary } from "cloudinary";
import Stripe from "stripe";
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";
import type { Request, Response } from "express";

const router: IRouter = Router();

function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 12) return key.slice(0, 4) + "...";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

router.get("/v1/integrations/status", async (_req: Request, res: Response): Promise<void> => {
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const cloudApiKey = process.env["CLOUDINARY_API_KEY"];
  const cloudApiSecret = process.env["CLOUDINARY_API_SECRET"];
  const resendKey = process.env["RESEND_API_KEY"];
  const emailFrom = process.env["EMAIL_FROM"];

  const stripeConfigured = !!stripeKey;
  const cloudinaryConfigured = !!(cloudName && cloudApiKey && cloudApiSecret);
  const resendConfigured = !!resendKey;

  let stripeMode: string | null = null;
  let stripeError: string | null = null;
  if (stripeConfigured) {
    stripeMode = stripeKey!.startsWith("sk_live") ? "live" : "test";
  }

  let cloudinaryStorageMb: string | null = null;
  let cloudinaryPlan: string | null = null;
  let cloudinaryError: string | null = null;
  if (cloudinaryConfigured) {
    try {
      cloudinary.config({ cloud_name: cloudName, api_key: cloudApiKey, api_secret: cloudApiSecret });
      const usage = await (cloudinary.api as any).usage();
      cloudinaryStorageMb = (usage.storage.usage / 1024 / 1024).toFixed(1);
      cloudinaryPlan = usage.plan ?? "free";
    } catch (e: any) {
      cloudinaryError = e?.message ?? "Connection failed";
    }
  }

  res.json({
    success: true,
    data: {
      stripe: {
        configured: stripeConfigured,
        mode: stripeMode,
        masked_key: maskKey(stripeKey),
        error: stripeError,
      },
      cloudinary: {
        configured: cloudinaryConfigured,
        cloud_name: cloudName ?? null,
        plan: cloudinaryPlan,
        storage_mb: cloudinaryStorageMb,
        error: cloudinaryError,
      },
      resend: {
        configured: resendConfigured,
        from_email: emailFrom ?? null,
        masked_key: maskKey(resendKey),
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
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
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
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const cloudApiKey = process.env["CLOUDINARY_API_KEY"];
  const cloudApiSecret = process.env["CLOUDINARY_API_SECRET"];
  if (!cloudName || !cloudApiKey || !cloudApiSecret) {
    res.status(400).json({ success: false, error: "Cloudinary credentials not configured" });
    return;
  }
  try {
    cloudinary.config({ cloud_name: cloudName, api_key: cloudApiKey, api_secret: cloudApiSecret });
    await (cloudinary.api as any).ping();
    const usage = await (cloudinary.api as any).usage();
    res.json({
      success: true,
      plan: usage.plan ?? "free",
      storage_mb: (usage.storage.usage / 1024 / 1024).toFixed(1),
      credits_used: usage.credits?.usage ?? 0,
    });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message ?? "Cloudinary connection failed" });
  }
});

router.post("/v1/integrations/resend/test", async (req: Request, res: Response): Promise<void> => {
  const resendKey = process.env["RESEND_API_KEY"];
  const emailFrom = process.env["EMAIL_FROM"] ?? "onboarding@resend.dev";
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

router.post("/v1/integrations/update-env", async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user as { role?: string } | undefined;
  if (!user || user.role !== "Super Admin") {
    res.status(403).json({ success: false, error: "SuperAdmin role required" });
    return;
  }

  const { key, value } = req.body as { key?: string; value?: string };
  const ALLOWED_KEYS = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ];

  if (!key || !ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ success: false, error: "Invalid environment key" });
    return;
  }

  process.env[key] = value ?? "";

  try {
    const envPath = path.resolve(process.cwd(), "../../.env");
    let content = "";
    if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    const newLine = `${key}=${value ?? ""}`;
    if (idx >= 0) lines[idx] = newLine;
    else lines.push(newLine);
    fs.writeFileSync(envPath, lines.join("\n"), "utf-8");
  } catch {
    // .env write not critical
  }

  res.json({ success: true, key, updated: true });
});

export default router;
