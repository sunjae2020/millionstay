import { Router, type IRouter } from "express";
import multer from "multer";
import crypto from "crypto";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  db,
  bookingsTable,
  conditionReportsTable,
  conditionReportItemsTable,
  conditionReportPhotosTable,
  conditionReportResponsesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { logAction } from "../utils/auditLog";

const ENTITY = "condition_report";
const PHASES = ["move_in", "interim", "move_out"] as const;
const AREA_KEYS = ["door", "floor", "living", "kitchen", "bathroom", "balcony", "bedroom", "other"];
const RATINGS = ["good", "fair", "damaged"];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function generateReportRef(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(conditionReportsTable)
    .where(sql`EXTRACT(YEAR FROM ${conditionReportsTable.created_at}) = ${year}`);
  const seq = ((result[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  return `CR-${year}-${seq}`;
}

// Load a report with its items, photos and responses assembled for the client.
async function loadReportDetail(reportId: number) {
  const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, reportId)).limit(1);
  if (!report) return null;
  const items = await db
    .select()
    .from(conditionReportItemsTable)
    .where(eq(conditionReportItemsTable.condition_report_id, reportId))
    .orderBy(conditionReportItemsTable.sort_order, conditionReportItemsTable.id);
  const photos = await db
    .select()
    .from(conditionReportPhotosTable)
    .where(eq(conditionReportPhotosTable.condition_report_id, reportId));
  const itemIds = items.map((i) => i.id);
  const responses = itemIds.length
    ? await db.select().from(conditionReportResponsesTable).where(inArray(conditionReportResponsesTable.item_id, itemIds))
    : [];
  return {
    ...report,
    items: items.map((it) => ({
      ...it,
      photos: photos.filter((p) => p.item_id === it.id),
      responses: responses.filter((r) => r.item_id === it.id),
    })),
    photos: photos.filter((p) => p.item_id == null),
  };
}

/* ═══════════════════════════════════════════════════════════
   ADMIN ROUTER  (/api/v1/…, gated by requireAuth)
═══════════════════════════════════════════════════════════ */
const adminRouter: IRouter = Router();
adminRouter.use("/v1", requireAuth);

// List reports for a booking.
adminRouter.get("/v1/bookings/:bookingId/condition-reports", async (req, res): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const rows = await db
      .select()
      .from(conditionReportsTable)
      .where(eq(conditionReportsTable.booking_id, bookingId))
      .orderBy(desc(conditionReportsTable.created_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Create a draft report (optionally with initial items).
adminRouter.post("/v1/bookings/:bookingId/condition-reports", async (req, res): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const [booking] = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!booking) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Booking not found" } }); return; }

    const phase = PHASES.includes(req.body?.phase) ? req.body.phase : "move_in";
    const report_ref = await generateReportRef();
    const [report] = await db
      .insert(conditionReportsTable)
      .values({
        report_ref,
        booking_id: bookingId,
        phase,
        status: "draft",
        title: typeof req.body?.title === "string" ? req.body.title : null,
        summary: typeof req.body?.summary === "string" ? req.body.summary : null,
        created_by: (req as any).user?.id ?? null,
        audit_trail: [{ event: "created", at: new Date().toISOString(), actor: (req as any).user?.id ?? null }],
      })
      .returning();

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length) {
      await db.insert(conditionReportItemsTable).values(
        items.map((it: any, idx: number) => ({
          condition_report_id: report!.id,
          area_key: AREA_KEYS.includes(it?.area_key) ? it.area_key : "other",
          label: typeof it?.label === "string" && it.label.trim() ? it.label.trim() : "Item",
          description: typeof it?.description === "string" ? it.description : null,
          condition_rating: RATINGS.includes(it?.condition_rating) ? it.condition_rating : null,
          sort_order: Number.isFinite(it?.sort_order) ? Number(it.sort_order) : idx,
        })),
      );
    }
    void logAction({ entityType: ENTITY, entityId: report!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { report_ref, phase, items: items.length } });
    res.status(201).json({ success: true, data: await loadReportDetail(report!.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Report detail.
adminRouter.get("/v1/condition-reports/:id", async (req, res): Promise<void> => {
  try {
    const detail = await loadReportDetail(Number(req.params.id));
    if (!detail) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } }); return; }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Edit a draft (title/summary only).
adminRouter.patch("/v1/condition-reports/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } }); return; }
    if (report.status !== "draft") { res.status(409).json({ success: false, error: { code: "NOT_DRAFT", message: "Only draft reports can be edited" } }); return; }
    const patch: any = {};
    if (typeof req.body?.title === "string") patch.title = req.body.title;
    if (typeof req.body?.summary === "string") patch.summary = req.body.summary;
    if (Object.keys(patch).length) await db.update(conditionReportsTable).set(patch).where(eq(conditionReportsTable.id, id));
    res.json({ success: true, data: await loadReportDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Add an item to a draft.
adminRouter.post("/v1/condition-reports/:id/items", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } }); return; }
    if (report.status !== "draft") { res.status(409).json({ success: false, error: { code: "NOT_DRAFT", message: "Only draft reports accept new items" } }); return; }
    const [item] = await db
      .insert(conditionReportItemsTable)
      .values({
        condition_report_id: id,
        area_key: AREA_KEYS.includes(req.body?.area_key) ? req.body.area_key : "other",
        label: typeof req.body?.label === "string" && req.body.label.trim() ? req.body.label.trim() : "Item",
        description: typeof req.body?.description === "string" ? req.body.description : null,
        condition_rating: RATINGS.includes(req.body?.condition_rating) ? req.body.condition_rating : null,
        sort_order: Number.isFinite(req.body?.sort_order) ? Number(req.body.sort_order) : 0,
      })
      .returning();
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Upload an evidence photo (admin). content_hash = sha256 of the bytes.
adminRouter.post("/v1/condition-reports/:id/upload-photo", upload.single("image"), async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } }); return; }
    if (!req.file) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No file provided" } }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } }); return; }
    const hash = sha256(req.file.buffer);
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("condition") });
    const itemId = Number.isFinite(Number(req.body?.item_id)) && req.body?.item_id ? Number(req.body.item_id) : null;
    const [photo] = await db
      .insert(conditionReportPhotosTable)
      .values({
        condition_report_id: id,
        item_id: itemId,
        file_url: result.secure_url,
        thumbnail_url: result.thumbnail_url ?? null,
        cloudinary_id: result.public_id ?? null,
        caption: typeof req.body?.caption === "string" ? req.body.caption : null,
        content_hash: hash,
        taken_at: new Date(),
        uploaded_by_type: "admin",
        uploaded_by_id: (req as any).user?.id ?? null,
      })
      .returning();
    res.status(201).json({ success: true, data: photo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err.message } });
  }
});

// Publish — freeze the item set into published_snapshot + content_hash, make it
// visible to the tenant. This is the tamper-evidence anchor (H-201 pattern).
adminRouter.post("/v1/condition-reports/:id/publish", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const detail = await loadReportDetail(id);
    if (!detail) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } }); return; }
    if (detail.status !== "draft") { res.status(409).json({ success: false, error: { code: "NOT_DRAFT", message: "Report already published" } }); return; }
    if (!detail.items.length) { res.status(400).json({ success: false, error: { code: "NO_ITEMS", message: "Add at least one item before publishing" } }); return; }

    const capturedAt = new Date().toISOString();
    const snapshot = {
      capturedAt,
      items: detail.items.map((it: any) => ({
        id: it.id,
        area_key: it.area_key,
        label: it.label,
        description: it.description,
        condition_rating: it.condition_rating,
        photos: it.photos.map((p: any) => ({ id: p.id, file_url: p.file_url, content_hash: p.content_hash })),
      })),
    };
    const content_hash = sha256(JSON.stringify(snapshot));
    const auditTrail = Array.isArray(detail.audit_trail) ? detail.audit_trail : [];
    await db
      .update(conditionReportsTable)
      .set({
        status: "published",
        published_at: new Date(),
        published_snapshot: snapshot,
        content_hash,
        audit_trail: [...auditTrail, { event: "published", at: capturedAt, actor: (req as any).user?.id ?? null, content_hash }],
      })
      .where(eq(conditionReportsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status: "published", content_hash } });
    res.json({ success: true, data: await loadReportDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Finalize — close the report after tenant response (agree or dispute-resolved).
adminRouter.post("/v1/condition-reports/:id/finalize", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } }); return; }
    const auditTrail = Array.isArray(report.audit_trail) ? report.audit_trail : [];
    await db
      .update(conditionReportsTable)
      .set({
        status: "finalized",
        finalized_at: new Date(),
        audit_trail: [...auditTrail, { event: "finalized", at: new Date().toISOString(), actor: (req as any).user?.id ?? null }],
      })
      .where(eq(conditionReportsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status: "finalized" } });
    res.json({ success: true, data: await loadReportDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/* ═══════════════════════════════════════════════════════════
   GUEST ROUTER  (/api/v1/guest/…, requireGuestAuth)
═══════════════════════════════════════════════════════════ */
const guestRouter: IRouter = Router();
guestRouter.use("/v1/guest", requireGuestAuth);

// Verify a booking belongs to the authenticated guest's account.
async function guestOwnsBooking(guestAccountId: number | null, bookingId: number): Promise<boolean> {
  if (!guestAccountId) return false;
  const [row] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.account_id, guestAccountId)))
    .limit(1);
  return !!row;
}

// List published/finalized reports for one of my bookings.
guestRouter.get("/v1/guest/bookings/:bookingId/condition-reports", async (req, res): Promise<void> => {
  try {
    const guest = (req as any).guest;
    const bookingId = Number(req.params.bookingId);
    if (!(await guestOwnsBooking(guest?.account_id ?? null, bookingId))) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Booking not found" } });
      return;
    }
    const rows = await db
      .select()
      .from(conditionReportsTable)
      .where(and(eq(conditionReportsTable.booking_id, bookingId), inArray(conditionReportsTable.status, ["published", "tenant_agreed", "disputed", "finalized"])))
      .orderBy(desc(conditionReportsTable.created_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Report detail (must own the booking; drafts stay hidden).
guestRouter.get("/v1/guest/condition-reports/:id", async (req, res): Promise<void> => {
  try {
    const guest = (req as any).guest;
    const detail = await loadReportDetail(Number(req.params.id));
    if (!detail || detail.status === "draft" || !(await guestOwnsBooking(guest?.account_id ?? null, detail.booking_id))) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Tenant responds to an item: agreed | disputed. Any dispute flips the report.
guestRouter.post("/v1/guest/condition-report-items/:itemId/respond", async (req, res): Promise<void> => {
  try {
    const guest = (req as any).guest;
    const itemId = Number(req.params.itemId);
    const decision = req.body?.decision === "disputed" ? "disputed" : req.body?.decision === "agreed" ? "agreed" : null;
    if (!decision) { res.status(400).json({ success: false, error: { code: "BAD_DECISION", message: "decision must be agreed or disputed" } }); return; }

    const [item] = await db.select().from(conditionReportItemsTable).where(eq(conditionReportItemsTable.id, itemId)).limit(1);
    if (!item) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Item not found" } }); return; }
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, item.condition_report_id)).limit(1);
    if (!report || !(await guestOwnsBooking(guest?.account_id ?? null, report.booking_id))) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Item not found" } });
      return;
    }
    // Open for tenant responses until the admin finalizes. `tenant_agreed` is
    // included so a tenant who agreed can still change to a dispute (and back)
    // right up until finalization — only `finalized`/`draft` lock responses.
    if (!["published", "disputed", "tenant_agreed"].includes(report.status)) {
      res.status(409).json({ success: false, error: { code: "NOT_OPEN", message: "Report is not open for responses" } });
      return;
    }

    // Upsert the tenant's decision for this item (one response per item).
    await db.delete(conditionReportResponsesTable).where(eq(conditionReportResponsesTable.item_id, itemId));
    await db.insert(conditionReportResponsesTable).values({
      item_id: itemId,
      decision,
      comment: typeof req.body?.comment === "string" ? req.body.comment : null,
    });

    // Recompute report status: disputed if any dispute, tenant_agreed once every
    // item has an agreement, else stays published.
    const items = await db.select({ id: conditionReportItemsTable.id }).from(conditionReportItemsTable).where(eq(conditionReportItemsTable.condition_report_id, report.id));
    const responses = await db.select().from(conditionReportResponsesTable).where(inArray(conditionReportResponsesTable.item_id, items.map((i) => i.id)));
    const anyDisputed = responses.some((r) => r.decision === "disputed");
    const allAgreed = items.length > 0 && items.every((it) => responses.find((r) => r.item_id === it.id)?.decision === "agreed");
    const nextStatus = anyDisputed ? "disputed" : allAgreed ? "tenant_agreed" : "published";
    const auditTrail = Array.isArray(report.audit_trail) ? report.audit_trail : [];
    await db
      .update(conditionReportsTable)
      .set({
        status: nextStatus,
        tenant_responded_at: new Date(),
        audit_trail: [...auditTrail, { event: `tenant_${decision}`, at: new Date().toISOString(), item_id: itemId }],
      })
      .where(eq(conditionReportsTable.id, report.id));
    res.json({ success: true, data: await loadReportDetail(report.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Tenant uploads dispute evidence (hashed, uploaded_by_type='tenant').
guestRouter.post("/v1/guest/condition-reports/:id/upload-photo", upload.single("image"), async (req, res): Promise<void> => {
  try {
    const guest = (req as any).guest;
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report || report.status === "draft" || !(await guestOwnsBooking(guest?.account_id ?? null, report.booking_id))) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Report not found" } });
      return;
    }
    if (!req.file) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No file provided" } }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } }); return; }
    const hash = sha256(req.file.buffer);
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("condition") });
    const itemId = Number.isFinite(Number(req.body?.item_id)) && req.body?.item_id ? Number(req.body.item_id) : null;
    const [photo] = await db
      .insert(conditionReportPhotosTable)
      .values({
        condition_report_id: id,
        item_id: itemId,
        file_url: result.secure_url,
        thumbnail_url: result.thumbnail_url ?? null,
        cloudinary_id: result.public_id ?? null,
        caption: typeof req.body?.caption === "string" ? req.body.caption : null,
        content_hash: hash,
        taken_at: new Date(),
        uploaded_by_type: "tenant",
        uploaded_by_id: guest?.id ?? null,
      })
      .returning();
    res.status(201).json({ success: true, data: photo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err.message } });
  }
});

export { adminRouter as conditionReportsAdminRouter, guestRouter as conditionReportsGuestRouter };
