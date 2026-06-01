import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, spacesTable } from "@workspace/db";
import { logAction } from "../utils/auditLog.js";

/**
 * OTA channel integration — Stage 1 (iCal export) admin endpoints.
 *
 * Manages the per-space secret token that authorizes the public outbound
 * availability feed served at
 *   GET /api/v1/public/spaces/:id/calendar/:token.ics
 *
 * Mounted under the main router (behind requireAuth).
 */
const router: IRouter = Router();

/** Resolve the public base URL for building absolute feed links. */
function publicBaseUrl(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const fromEnv = process.env.PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = req.get("host") ?? "localhost";
  return `${req.protocol}://${host}`;
}

function feedUrl(req: any, spaceId: number, token: string): string {
  return `${publicBaseUrl(req)}/api/v1/public/spaces/${spaceId}/calendar/${token}.ics`;
}

/* ───────────────────────────────────────────────────────
   GET /api/v1/spaces/:id/calendar-feed
   Returns the current iCal export feed status for a space.
──────────────────────────────────────────────────────── */
router.get("/v1/spaces/:id/calendar-feed", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({ id: spacesTable.id, ical_export_token: spacesTable.ical_export_token })
    .from(spacesTable)
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const hasToken = !!space.ical_export_token;
  res.json({
    success: true,
    data: {
      space_id: spaceId,
      has_token: hasToken,
      feed_url: hasToken ? feedUrl(req, spaceId, space.ical_export_token!) : null,
    },
  });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/spaces/:id/calendar-feed/token
   Generate (or rotate) the secret token and return the feed URL.
   Rotating invalidates the previous URL.
──────────────────────────────────────────────────────── */
router.post("/v1/spaces/:id/calendar-feed/token", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({ id: spacesTable.id })
    .from(spacesTable)
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const token = randomBytes(24).toString("base64url"); // ~32 url-safe chars
  await db.update(spacesTable).set({ ical_export_token: token }).where(eq(spacesTable.id, spaceId));

  await logAction({ entityType: "space", entityId: spaceId, action: "UPDATE", newValue: { ical_export_token: "rotated" } });

  res.status(201).json({
    success: true,
    data: { space_id: spaceId, feed_url: feedUrl(req, spaceId, token) },
  });
});

/* ───────────────────────────────────────────────────────
   DELETE /api/v1/spaces/:id/calendar-feed/token
   Revoke the export feed (clears the token; existing URL stops working).
──────────────────────────────────────────────────────── */
router.delete("/v1/spaces/:id/calendar-feed/token", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({ id: spacesTable.id })
    .from(spacesTable)
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  await db.update(spacesTable).set({ ical_export_token: null }).where(eq(spacesTable.id, spaceId));
  await logAction({ entityType: "space", entityId: spaceId, action: "UPDATE", newValue: { ical_export_token: "revoked" } });

  res.json({ success: true });
});

export default router;
