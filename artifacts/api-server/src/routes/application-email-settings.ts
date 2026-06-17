// Admin settings — application acknowledgment emails.
//
// GET/PUT the per-application-type rules controlling whether the applicant gets
// a "we received your application" email and whether the application PDF is
// attached. Backed by the integration_settings KV (key `application_emails`).
// Mounted under the requireAuth-guarded admin router (routes/index.ts).
import { Router, type IRouter } from "express";
import { z } from "zod";
import { logAction } from "../utils/auditLog.js";
import {
  APPLICATION_TYPES,
  getApplicationEmailSettings,
  saveApplicationEmailSettings,
} from "../lib/applicationEmails.js";

const router: IRouter = Router();

const RuleSchema = z.object({
  send_ack_email: z.boolean(),
  attach_pdf: z.boolean(),
});

// Every application type is optional in the body — only the supplied types are
// updated; defaults fill the rest (saveApplicationEmailSettings normalises).
const BodySchema = z.object(
  Object.fromEntries(APPLICATION_TYPES.map((t) => [t, RuleSchema.optional()])),
).strip();

router.get("/v1/application-email-settings", async (_req, res): Promise<void> => {
  res.json({ success: true, settings: await getApplicationEmailSettings() });
});

router.put("/v1/application-email-settings", async (req, res): Promise<void> => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.message }); return; }
  try {
    const settings = await saveApplicationEmailSettings(parsed.data);
    await logAction({ entityType: "application_email_settings", entityId: 1, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: settings }).catch(() => {});
    res.json({ success: true, settings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: `Save failed: ${e?.message}` });
  }
});

export default router;
