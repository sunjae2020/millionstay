import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, ne, and, or, ilike, desc, asc, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  bookingServicePhotosTable,
  spacesTable,
  propertiesTable,
  serviceHostsTable,
  accountsTable,
  invoicesTable,
  contactsTable,
  workOrdersTable,
  workOrderPhotosTable,
  documentsTable,
} from "@workspace/db";
import { requireServiceHostAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { isCloudinaryConfigured, uploadToCloudinary, uploadPrivateToCloudinary, generateSignedUrl, deleteFromCloudinary, cldFolder } from "../utils/cloudinary";
import { buildPhotoWatermark, loadPhotoWatermarkContext, watermarkedPhotoUrl } from "../lib/workOrders/photoWatermark";
import { parsePageParams, pageMeta } from "../utils/pagination";
import { decodeUploadFilename } from "../lib/uploadFilename";

const router: IRouter = Router();
const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const MAX_JOB_PHOTOS = 10;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_JOB_PHOTOS },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_PHOTO_MIME.has(file.mimetype.toLowerCase())) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Only image files are allowed.`));
  },
});

// SECURITY: every /v1/service-host/* route requires service-host auth.
router.use("/v1/service-host", requireServiceHostAuth);

async function getHostServiceIds(accountId: number): Promise<number[]> {
  const hosts = await db
    .select({ id: serviceHostsTable.id })
    .from(serviceHostsTable)
    .where(and(eq(serviceHostsTable.account_id, accountId), eq(serviceHostsTable.status, "Active")));
  return hosts.map((h) => h.id);
}

/* ─────────────────────────────────────────────
   WORK ORDERS — partner-dispatched maintenance jobs (Phase 3)
   The partner sees ONLY work orders dispatched to one of their service hosts.
───────────────────────────────────────────── */

// Load a work order and verify it is dispatched to the calling partner.
async function loadOwnedWorkOrder(accountId: number, workOrderId: number) {
  const hostIds = await getHostServiceIds(accountId);
  if (!hostIds.length) return null;
  const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, workOrderId)).limit(1);
  if (!wo || wo.service_host_id == null || !hostIds.includes(wo.service_host_id)) return null;
  return wo;
}

// GET /api/v1/service-host/work-orders — my dispatched jobs.
router.get("/v1/service-host/work-orders", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const hostIds = await getHostServiceIds(partner.account_id);
    if (!hostIds.length) { res.json({ success: true, data: [] }); return; }
    const rows = await db
      .select()
      .from(workOrdersTable)
      .where(and(inArray(workOrdersTable.service_host_id, hostIds), isNull(workOrdersTable.deleted_at)))
      .orderBy(desc(workOrdersTable.dispatched_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// POST /acknowledge — partner accepts the dispatch (stops the SLA clock).
router.post("/v1/service-host/work-orders/:id/acknowledge", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const wo = await loadOwnedWorkOrder(partner.account_id, Number(req.params.id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
    if (wo.acknowledged_at) { res.json({ success: true, data: wo }); return; }
    const now = new Date();
    const onTime = wo.sla_ack_due_at ? now <= new Date(wo.sla_ack_due_at) : true;
    const [updated] = await db.update(workOrdersTable)
      .set({ acknowledged_at: now, sla_status: onTime ? "met" : "acknowledged", updated_at: now })
      .where(eq(workOrdersTable.id, wo.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// POST /start and /complete — partner progresses the job.
async function partnerTransition(req: any, res: any, from: string[] | null, to: string, stamp?: "completed") {
  try {
    const partner = req.partner as PartnerAuthPayload;
    const wo = await loadOwnedWorkOrder(partner.account_id, Number(req.params.id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
    if (from && !from.includes(wo.status)) { res.status(409).json({ success: false, error: { code: "BAD_STATE", message: `Cannot move from ${wo.status}` } }); return; }
    const set: any = { status: to, updated_at: new Date() };
    if (stamp === "completed") set.completed_at = new Date();
    const [updated] = await db.update(workOrdersTable).set(set).where(eq(workOrdersTable.id, wo.id)).returning();
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
}
router.post("/v1/service-host/work-orders/:id/start", (req, res) => partnerTransition(req, res, ["Open"], "InProgress"));
router.post("/v1/service-host/work-orders/:id/complete", (req, res) => partnerTransition(req, res, ["InProgress", "Open"], "Completed", "completed"));

// PATCH notes — partner records what they did on the job.
router.patch("/v1/service-host/work-orders/:id/notes", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const wo = await loadOwnedWorkOrder(partner.account_id, Number(req.params.id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
    const notes = typeof req.body?.notes === "string" ? req.body.notes : null;
    const [updated] = await db.update(workOrdersTable)
      .set({ notes, updated_at: new Date() })
      .where(eq(workOrdersTable.id, wo.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// GET photos — service result / before-after evidence for one of my work orders.
router.get("/v1/service-host/work-orders/:id/photos", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const wo = await loadOwnedWorkOrder(partner.account_id, Number(req.params.id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
    const rows = await db.select().from(workOrderPhotosTable)
      .where(eq(workOrderPhotosTable.work_order_id, wo.id))
      .orderBy(desc(workOrderPhotosTable.id));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// POST photo — partner uploads a service-result photo (kind: before|after).
const MAX_WO_PHOTOS = 20;
router.post(
  "/v1/service-host/work-orders/:id/photos",
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) { res.status(400).json({ success: false, error: { code: "UPLOAD_ERROR", message: err.message } }); return; }
      next();
    });
  },
  async (req, res): Promise<void> => {
    let publicId: string | null = null;
    try {
      const partner = (req as any).partner as PartnerAuthPayload;
      const wo = await loadOwnedWorkOrder(partner.account_id, Number(req.params.id));
      if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
      if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } }); return; }
      const file = req.file as Express.Multer.File | undefined;
      if (!file) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No image provided" } }); return; }

      const existing = await db.select({ id: workOrderPhotosTable.id }).from(workOrderPhotosTable).where(eq(workOrderPhotosTable.work_order_id, wo.id));
      if (existing.length >= MAX_WO_PHOTOS) { res.status(400).json({ success: false, error: { code: "MAX_REACHED", message: `Maximum of ${MAX_WO_PHOTOS} photos already uploaded` } }); return; }

      const caption = typeof req.body?.caption === "string" && req.body.caption.trim() ? req.body.caption.trim() : null;
      // 관리자 업로드와 같은 워터마크를 태운다 — 파트너가 올린 사진도 그대로
      // 청구 증빙으로 쓰이므로 출처가 이미지 안에 남아야 한다.
      const place = await loadPhotoWatermarkContext(wo.id);
      const uploaded = await uploadToCloudinary(file.buffer, { folder: cldFolder("work-orders") });
      publicId = uploaded.public_id;
      const url = watermarkedPhotoUrl(uploaded, buildPhotoWatermark(place, caption));
      const kind = req.body?.kind === "before" ? "before" : "after";
      const [row] = await db.insert(workOrderPhotosTable).values({
        work_order_id: wo.id,
        url,
        kind,
        uploaded_by_type: "partner",
        caption,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err: any) {
      if (publicId) { try { await deleteFromCloudinary(publicId); } catch {} }
      res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err?.message ?? "Upload failed" } });
    }
  },
);

// DELETE photo — remove one of my work-order photos.
router.delete("/v1/service-host/work-orders/:id/photos/:photoId", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const wo = await loadOwnedWorkOrder(partner.account_id, Number(req.params.id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
    const [photo] = await db.select().from(workOrderPhotosTable)
      .where(and(eq(workOrderPhotosTable.id, Number(req.params.photoId)), eq(workOrderPhotosTable.work_order_id, wo.id)))
      .limit(1);
    if (!photo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Photo not found" } }); return; }
    await db.delete(workOrderPhotosTable).where(eq(workOrderPhotosTable.id, photo.id));
    // Best-effort Cloudinary cleanup (public_id not stored → derive from URL).
    const m = photo.url.match(/\/upload\/(?:.*?\/)?v\d+\/(.+)\.[^./]+$/);
    if (m?.[1]) { try { await deleteFromCloudinary(m[1]); } catch {} }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/* ─────────────────────────────────────────────
   DOCUMENTS — partner document folder (문서 관리함)
   Each partner stores/reads their own documents (contracts, invoices,
   manuals, reports). Files live in Cloudinary as `authenticated` assets and
   are served only via short-lived signed URLs. Rows in the shared `documents`
   table are scoped to the partner via entity_type='service_host'.
───────────────────────────────────────────── */

const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
]);
const DOC_TYPES = new Set(["contract", "invoice", "report", "manual", "other"]);
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_MIME.has(file.mimetype.toLowerCase())) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Only PDF and image files are allowed.`));
  },
});

// GET /api/v1/service-host/documents — list my documents (newest first).
router.get("/v1/service-host/documents", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const hostIds = await getHostServiceIds(partner.account_id);
    if (!hostIds.length) { res.json({ success: true, data: [] }); return; }
    const rows = await db
      .select({
        id: documentsTable.id,
        doc_type: documentsTable.doc_type,
        file_name: documentsTable.file_name,
        file_size: documentsTable.file_size,
        mime_type: documentsTable.mime_type,
        created_at: documentsTable.created_at,
      })
      .from(documentsTable)
      .where(and(
        eq(documentsTable.entity_type, "service_host"),
        inArray(documentsTable.entity_id, hostIds),
        isNull(documentsTable.deleted_at),
      ))
      .orderBy(desc(documentsTable.created_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// POST /api/v1/service-host/documents — upload a document.
router.post(
  "/v1/service-host/documents",
  (req, res, next) => {
    uploadDoc.single("file")(req, res, (err) => {
      if (err) { res.status(400).json({ success: false, error: { code: "UPLOAD_ERROR", message: err.message } }); return; }
      next();
    });
  },
  async (req, res): Promise<void> => {
    let publicId: string | null = null;
    try {
      const partner = (req as any).partner as PartnerAuthPayload;
      const hostIds = await getHostServiceIds(partner.account_id);
      if (!hostIds.length) { res.status(403).json({ success: false, error: { code: "NO_HOST", message: "No active service host profile" } }); return; }

      if (!isCloudinaryConfigured()) {
        res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "File upload not configured" } });
        return;
      }
      const file = req.file as Express.Multer.File | undefined;
      if (!file) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No file provided" } }); return; }

      const docType = String((req.body?.doc_type ?? "other")).toLowerCase();
      if (!DOC_TYPES.has(docType)) { res.status(400).json({ success: false, error: { code: "INVALID_TYPE", message: `doc_type must be one of: ${[...DOC_TYPES].join(", ")}` } }); return; }
      const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : decodeUploadFilename(file.originalname);

      const uploaded = await uploadPrivateToCloudinary(file.buffer, { folder: cldFolder("partner-documents"), resource_type: "auto" });
      publicId = uploaded.public_id;

      // Default retention: 7 years (Australian APP 11 record-keeping default).
      const retentionUntil = new Date();
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

      const [row] = await db.insert(documentsTable).values({
        entity_type: "service_host",
        entity_id: hostIds[0]!,
        doc_type: docType,
        file_name: title,
        file_size: uploaded.bytes ?? file.size,
        mime_type: file.mimetype,
        cloudinary_public_id: uploaded.public_id,
        uploaded_by: partner.id ?? null,
        uploaded_by_type: "partner",
        retention_until: retentionUntil,
      }).returning({
        id: documentsTable.id,
        doc_type: documentsTable.doc_type,
        file_name: documentsTable.file_name,
        file_size: documentsTable.file_size,
        mime_type: documentsTable.mime_type,
        created_at: documentsTable.created_at,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err: any) {
      if (publicId) { try { await deleteFromCloudinary(publicId); } catch {} }
      res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err?.message ?? "Upload failed" } });
    }
  },
);

// Load a document owned by the calling partner.
async function loadOwnedDocument(accountId: number, docId: string) {
  const hostIds = await getHostServiceIds(accountId);
  if (!hostIds.length) return null;
  const [doc] = await db.select().from(documentsTable).where(and(
    eq(documentsTable.id, docId),
    eq(documentsTable.entity_type, "service_host"),
    isNull(documentsTable.deleted_at),
  )).limit(1);
  if (!doc || doc.entity_id == null || !hostIds.includes(doc.entity_id)) return null;
  return doc;
}

// GET /api/v1/service-host/documents/:id/download — short-lived signed URL.
router.get("/v1/service-host/documents/:id/download", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const doc = await loadOwnedDocument(partner.account_id, String(req.params.id));
    if (!doc || !doc.cloudinary_public_id) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } }); return; }
    const url = generateSignedUrl(doc.cloudinary_public_id, 300);
    res.json({ success: true, data: { url } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// DELETE /api/v1/service-host/documents/:id — soft-delete + remove the asset.
router.delete("/v1/service-host/documents/:id", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const doc = await loadOwnedDocument(partner.account_id, String(req.params.id));
    if (!doc) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } }); return; }
    await db.update(documentsTable).set({ deleted_at: new Date(), updated_at: new Date() }).where(eq(documentsTable.id, doc.id));
    if (doc.cloudinary_public_id) { try { await deleteFromCloudinary(doc.cloudinary_public_id); } catch {} }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/* GET /api/v1/service-host/dashboard */
router.get("/v1/service-host/dashboard", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;

    const [account] = await db
      .select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);

    const hostIds = await getHostServiceIds(accountId);

    let totalJobs = 0;
    let pendingJobs = 0;
    let completedJobs = 0;
    let totalEarnings = 0;
    let recentJobs: any[] = [];

    if (hostIds.length > 0) {
      const services = await db
        .select({
          id: bookingServicesTable.id,
          booking_id: bookingServicesTable.booking_id,
          name: bookingServicesTable.name,
          service_type: bookingServicesTable.service_type,
          quantity: bookingServicesTable.quantity,
          unit_price: bookingServicesTable.unit_price,
          total_price: bookingServicesTable.total_price,
          status: bookingServicesTable.status,
          billing_trigger: bookingServicesTable.billing_trigger,
          created_at: bookingServicesTable.created_at,
        })
        .from(bookingServicesTable)
        .where(
          and(
            inArray(bookingServicesTable.service_id, hostIds),
            ne(bookingServicesTable.status, "Deleted")
          )
        )
        .orderBy(desc(bookingServicesTable.created_at))
        .limit(100);

      totalJobs = services.length;
      completedJobs = services.filter((s) => s.billing_trigger === "at_checkout").length;
      pendingJobs = totalJobs - completedJobs;
      totalEarnings = services.reduce((sum, s) => sum + parseFloat(s.total_price ?? "0"), 0);

      // Enrich recent 5 jobs with booking info
      const recent = services.slice(0, 5);
      if (recent.length > 0) {
        const bookingIds = [...new Set(recent.map((s) => s.booking_id))];
        const bookings = await db
          .select({
            id: bookingsTable.id,
            booking_ref: bookingsTable.booking_ref,
            check_in_date: bookingsTable.check_in_date,
            check_out_date: bookingsTable.check_out_date,
            booking_status: bookingsTable.booking_status,
            space_id: bookingsTable.space_id,
          })
          .from(bookingsTable)
          .where(inArray(bookingsTable.id, bookingIds));

        const bookingMap = Object.fromEntries(bookings.map((b) => [b.id, b]));
        recentJobs = recent.map((s) => ({
          ...s,
          booking: bookingMap[s.booking_id] ?? null,
        }));
      }
    }

    res.json({
      success: true,
      data: {
        account_name: account?.name ?? "—",
        stats: {
          total_jobs: totalJobs,
          pending_jobs: pendingJobs,
          completed_jobs: completedJobs,
          total_earnings: totalEarnings.toFixed(2),
        },
        recent_jobs: recentJobs,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/jobs */
router.get("/v1/service-host/jobs", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;
    const { limit, offset, page, q } = parsePageParams(req.query);
    const hostIds = await getHostServiceIds(accountId);

    if (hostIds.length === 0) {
      res.json({ success: true, data: [], meta: pageMeta(0, { limit, offset, page }) });
      return;
    }

    // Join booking + property so search (job name / booking ref / property) and
    // paging happen in the DB rather than over the whole result set.
    const conds = [
      inArray(bookingServicesTable.service_id, hostIds),
      ne(bookingServicesTable.status, "Deleted"),
    ];
    if (q) {
      conds.push(
        or(
          ilike(bookingServicesTable.name, `%${q}%`),
          ilike(bookingsTable.booking_ref, `%${q}%`),
          ilike(propertiesTable.name, `%${q}%`),
        )!,
      );
    }
    const whereExpr = and(...conds);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(bookingServicesTable)
      .leftJoin(bookingsTable, eq(bookingServicesTable.booking_id, bookingsTable.id))
      .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
      .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
      .where(whereExpr);

    const services = await db
      .select({
        id: bookingServicesTable.id,
        booking_id: bookingServicesTable.booking_id,
        service_id: bookingServicesTable.service_id,
        name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type,
        quantity: bookingServicesTable.quantity,
        unit_price: bookingServicesTable.unit_price,
        total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency,
        billing_trigger: bookingServicesTable.billing_trigger,
        frequency: bookingServicesTable.frequency,
        notes: bookingServicesTable.notes,
        status: bookingServicesTable.status,
        created_at: bookingServicesTable.created_at,
      })
      .from(bookingServicesTable)
      .leftJoin(bookingsTable, eq(bookingServicesTable.booking_id, bookingsTable.id))
      .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
      .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
      .where(whereExpr)
      .orderBy(desc(bookingServicesTable.created_at))
      .limit(limit)
      .offset(offset);

    if (services.length === 0) {
      res.json({ success: true, data: [], meta: pageMeta(total ?? 0, { limit, offset, page }) });
      return;
    }

    const bookingIds = [...new Set(services.map((s) => s.booking_id))];
    const bookings = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        space_id: bookingsTable.space_id,
        account_id: bookingsTable.account_id,
      })
      .from(bookingsTable)
      .where(inArray(bookingsTable.id, bookingIds));

    const spaceIds = [...new Set(bookings.map((b) => b.space_id).filter(Boolean))] as number[];
    let spaces: any[] = [];
    if (spaceIds.length > 0) {
      spaces = await db
        .select({
          id: spacesTable.id,
          name: spacesTable.name,
          property_id: spacesTable.property_id,
        })
        .from(spacesTable)
        .where(inArray(spacesTable.id, spaceIds));
    }

    const propertyIds = [...new Set(spaces.map((s) => s.property_id).filter(Boolean))] as number[];
    let properties: any[] = [];
    if (propertyIds.length > 0) {
      properties = await db
        .select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address })
        .from(propertiesTable)
        .where(inArray(propertiesTable.id, propertyIds));
    }

    const spaceMap = Object.fromEntries(spaces.map((s) => [s.id, s]));
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
    const bookingMap = Object.fromEntries(
      bookings.map((b) => {
        const space = spaceMap[b.space_id ?? 0];
        const property = propertyMap[space?.property_id ?? 0];
        return [b.id, { ...b, space, property }];
      })
    );

    const enriched = services.map((s) => ({
      ...s,
      booking: bookingMap[s.booking_id] ?? null,
    }));

    res.json({ success: true, data: enriched, meta: pageMeta(total ?? 0, { limit, offset, page }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* Helper: verify a job (booking_service) belongs to the logged-in service host */
async function verifyJobAccess(accountId: number, jobId: number) {
  const hostIds = await getHostServiceIds(accountId);
  if (hostIds.length === 0) return null;
  const [job] = await db
    .select()
    .from(bookingServicesTable)
    .where(and(
      eq(bookingServicesTable.id, jobId),
      inArray(bookingServicesTable.service_id, hostIds),
      ne(bookingServicesTable.status, "Deleted"),
    ))
    .limit(1);
  return job ?? null;
}

/* GET /api/v1/service-host/jobs/:id  — job detail with photos */
router.get("/v1/service-host/jobs/:id", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const jobId = Number(req.params.id);
    if (!jobId) { res.status(400).json({ success: false, error: { code: "INVALID_ID", message: "Invalid job id" } }); return; }

    const job = await verifyJobAccess(partner.account_id, jobId);
    if (!job) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found" } }); return; }

    const [booking] = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        space_id: bookingsTable.space_id,
        customer_notes: bookingsTable.customer_notes,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, job.booking_id));

    let space: any = null;
    let property: any = null;
    if (booking?.space_id) {
      const [s] = await db.select().from(spacesTable).where(eq(spacesTable.id, booking.space_id));
      space = s ?? null;
      if (space?.property_id) {
        const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id));
        property = p ?? null;
      }
    }

    const photos = await db
      .select()
      .from(bookingServicePhotosTable)
      .where(eq(bookingServicePhotosTable.booking_service_id, jobId))
      .orderBy(asc(bookingServicePhotosTable.created_at));

    res.json({
      success: true,
      data: {
        ...job,
        booking: booking ?? null,
        space,
        property,
        photos,
        max_photos: MAX_JOB_PHOTOS,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to load job" } });
  }
});

/* POST /api/v1/service-host/jobs/:id/photos — upload up to MAX_JOB_PHOTOS total */
router.post(
  "/v1/service-host/jobs/:id/photos",
  requireServiceHostAuth,
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) { res.status(400).json({ success: false, error: { code: "UPLOAD_ERROR", message: err.message } }); return; }
      next();
    });
  },
  async (req, res): Promise<void> => {
    try {
      const partner = (req as any).partner as PartnerAuthPayload;
      const jobId = Number(req.params.id);
      if (!jobId) { res.status(400).json({ success: false, error: { code: "INVALID_ID", message: "Invalid job id" } }); return; }

      const job = await verifyJobAccess(partner.account_id, jobId);
      if (!job) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found" } }); return; }

      if (!isCloudinaryConfigured()) {
        res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } });
        return;
      }

      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No files provided" } }); return; }
      if (files.length > MAX_JOB_PHOTOS) {
        res.status(400).json({ success: false, error: { code: "TOO_MANY", message: `Cannot upload more than ${MAX_JOB_PHOTOS} files at once` } });
        return;
      }

      // Upload all files to Cloudinary first
      const uploads: Array<{ secure_url: string; thumbnail_url: string | null; public_id: string }> = [];
      try {
        for (const file of files) {
          const uploaded = await uploadToCloudinary(file.buffer, { folder: cldFolder("jobs") });
          uploads.push(uploaded);
        }
      } catch (uploadErr: any) {
        // Cleanup partial uploads
        for (const u of uploads) { try { await deleteFromCloudinary(u.public_id); } catch {} }
        res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: uploadErr?.message ?? "Cloudinary upload failed" } });
        return;
      }

      // Atomically reserve & insert with row lock to prevent exceeding MAX_JOB_PHOTOS
      let results: any[] = [];
      let limitError: { code: string; message: string } | null = null;
      try {
        await db.transaction(async (tx) => {
          // Lock the parent booking_service row to serialize concurrent uploads
          await tx.execute(sql`SELECT id FROM booking_services WHERE id = ${jobId} FOR UPDATE`);
          const existing = await tx
            .select({ id: bookingServicePhotosTable.id })
            .from(bookingServicePhotosTable)
            .where(eq(bookingServicePhotosTable.booking_service_id, jobId));
          const remaining = MAX_JOB_PHOTOS - existing.length;
          if (remaining <= 0) {
            limitError = { code: "MAX_REACHED", message: `Maximum of ${MAX_JOB_PHOTOS} photos already uploaded` };
            throw new Error("LIMIT");
          }
          if (uploads.length > remaining) {
            limitError = { code: "TOO_MANY", message: `Can only upload ${remaining} more photo(s); current total is ${existing.length}/${MAX_JOB_PHOTOS}` };
            throw new Error("LIMIT");
          }
          for (const uploaded of uploads) {
            const [inserted] = await tx.insert(bookingServicePhotosTable).values({
              booking_service_id: jobId,
              file_url: uploaded.secure_url,
              thumbnail_url: uploaded.thumbnail_url,
              cloudinary_id: uploaded.public_id,
              caption: null,
              uploaded_by_type: "partner",
              uploaded_by_id: partner.id ?? null,
            }).returning();
            results.push(inserted);
          }
        });
      } catch (txErr) {
        // Cleanup Cloudinary uploads if DB tx aborted
        for (const u of uploads) { try { await deleteFromCloudinary(u.public_id); } catch {} }
        if (limitError) {
          res.status(400).json({ success: false, error: limitError });
          return;
        }
        throw txErr;
      }

      res.status(201).json({ success: true, data: results });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err?.message ?? "Upload failed" } });
    }
  }
);

/* PATCH /api/v1/service-host/jobs/:id — update status / notes */
const ALLOWED_JOB_STATUSES = new Set(["Active", "Processing", "Completed", "Cancelled"]);
router.patch("/v1/service-host/jobs/:id", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const jobId = Number(req.params.id);
    if (!jobId) { res.status(400).json({ success: false, error: { code: "INVALID_ID", message: "Invalid job id" } }); return; }

    const job = await verifyJobAccess(partner.account_id, jobId);
    if (!job) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found" } }); return; }

    const body = (req.body ?? {}) as { status?: string; notes?: string | null };
    const updates: { status?: string; notes?: string | null } = {};
    if (typeof body.status === "string") {
      if (!ALLOWED_JOB_STATUSES.has(body.status)) {
        res.status(400).json({ success: false, error: { code: "INVALID_STATUS", message: `Status must be one of: ${[...ALLOWED_JOB_STATUSES].join(", ")}` } });
        return;
      }
      updates.status = body.status;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes === null || body.notes === "" ? null : String(body.notes).slice(0, 5000);
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: { code: "NO_CHANGES", message: "No status or notes provided" } });
      return;
    }
    const hostIds = await getHostServiceIds(partner.account_id);
    const [updated] = await db
      .update(bookingServicesTable)
      .set(updates)
      .where(and(
        eq(bookingServicesTable.id, jobId),
        inArray(bookingServicesTable.service_id, hostIds),
        ne(bookingServicesTable.status, "Deleted"),
      ))
      .returning();
    if (!updated) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found or no longer accessible" } });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to update job" } });
  }
});

/* DELETE /api/v1/service-host/jobs/:id/photos/:photoId */
router.delete("/v1/service-host/jobs/:id/photos/:photoId", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const jobId = Number(req.params.id);
    const photoId = Number(req.params.photoId);
    if (!jobId || !photoId) { res.status(400).json({ success: false, error: { code: "INVALID_ID", message: "Invalid id" } }); return; }

    const job = await verifyJobAccess(partner.account_id, jobId);
    if (!job) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found" } }); return; }

    const [photo] = await db
      .select()
      .from(bookingServicePhotosTable)
      .where(and(eq(bookingServicePhotosTable.id, photoId), eq(bookingServicePhotosTable.booking_service_id, jobId)));
    if (!photo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Photo not found" } }); return; }

    if (photo.cloudinary_id) await deleteFromCloudinary(photo.cloudinary_id);
    await db.delete(bookingServicePhotosTable).where(eq(bookingServicePhotosTable.id, photoId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to delete photo" } });
  }
});

/* GET /api/v1/service-host/schedule */
router.get("/v1/service-host/schedule", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;
    const hostIds = await getHostServiceIds(accountId);

    if (hostIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const services = await db
      .select({
        id: bookingServicesTable.id,
        booking_id: bookingServicesTable.booking_id,
        name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type,
        total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency,
        billing_trigger: bookingServicesTable.billing_trigger,
        status: bookingServicesTable.status,
      })
      .from(bookingServicesTable)
      .where(
        and(
          inArray(bookingServicesTable.service_id, hostIds),
          ne(bookingServicesTable.status, "Deleted")
        )
      );

    if (services.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const bookingIds = [...new Set(services.map((s) => s.booking_id))];
    const bookings = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        space_id: bookingsTable.space_id,
      })
      .from(bookingsTable)
      .where(inArray(bookingsTable.id, bookingIds));

    const spaceIds = [...new Set(bookings.map((b) => b.space_id).filter(Boolean))] as number[];
    let spaces: any[] = [];
    if (spaceIds.length > 0) {
      spaces = await db
        .select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
        .from(spacesTable)
        .where(inArray(spacesTable.id, spaceIds));
    }

    const propertyIds = [...new Set(spaces.map((s) => s.property_id).filter(Boolean))] as number[];
    let properties: any[] = [];
    if (propertyIds.length > 0) {
      properties = await db
        .select({ id: propertiesTable.id, name: propertiesTable.name })
        .from(propertiesTable)
        .where(inArray(propertiesTable.id, propertyIds));
    }

    const spaceMap = Object.fromEntries(spaces.map((s) => [s.id, s]));
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
    const bookingMap = Object.fromEntries(
      bookings.map((b) => {
        const space = spaceMap[b.space_id ?? 0];
        const property = propertyMap[space?.property_id ?? 0];
        return [b.id, { ...b, space_name: space?.name, property_name: property?.name }];
      })
    );

    const schedule = services.map((s) => {
      const booking = bookingMap[s.booking_id];
      return {
        id: s.id,
        service_name: s.name,
        service_type: s.service_type,
        total_price: s.total_price,
        currency: s.currency,
        billing_trigger: s.billing_trigger,
        booking_ref: booking?.booking_ref,
        booking_status: booking?.booking_status,
        check_in_date: booking?.check_in_date,
        check_out_date: booking?.check_out_date,
        space_name: booking?.space_name,
        property_name: booking?.property_name,
        // Scheduled date based on billing trigger
        scheduled_date:
          s.billing_trigger === "at_checkin"
            ? booking?.check_in_date
            : s.billing_trigger === "at_checkout"
            ? booking?.check_out_date
            : booking?.check_in_date,
      };
    });

    // Sort by scheduled_date
    schedule.sort((a, b) => {
      const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const db_ = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return da - db_;
    });

    res.json({ success: true, data: schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/earnings */
router.get("/v1/service-host/earnings", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;
    const hostIds = await getHostServiceIds(accountId);

    if (hostIds.length === 0) {
      res.json({ success: true, data: { total_earned: "0.00", by_service: [], by_booking: [] } });
      return;
    }

    const services = await db
      .select({
        id: bookingServicesTable.id,
        booking_id: bookingServicesTable.booking_id,
        name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type,
        quantity: bookingServicesTable.quantity,
        unit_price: bookingServicesTable.unit_price,
        total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency,
        billing_trigger: bookingServicesTable.billing_trigger,
        created_at: bookingServicesTable.created_at,
      })
      .from(bookingServicesTable)
      .where(
        and(
          inArray(bookingServicesTable.service_id, hostIds),
          ne(bookingServicesTable.status, "Deleted")
        )
      )
      .orderBy(desc(bookingServicesTable.created_at));

    const totalEarned = services.reduce((sum, s) => sum + parseFloat(s.total_price ?? "0"), 0);

    // Group by service name
    const byServiceMap: Record<string, { name: string; count: number; total: number }> = {};
    for (const s of services) {
      if (!byServiceMap[s.name]) {
        byServiceMap[s.name] = { name: s.name, count: 0, total: 0 };
      }
      byServiceMap[s.name].count++;
      byServiceMap[s.name].total += parseFloat(s.total_price ?? "0");
    }
    const byService = Object.values(byServiceMap).sort((a, b) => b.total - a.total);

    // Group by booking
    const bookingIds = [...new Set(services.map((s) => s.booking_id))];
    let bookingInfoMap: Record<number, any> = {};
    if (bookingIds.length > 0) {
      const bookings = await db
        .select({
          id: bookingsTable.id,
          booking_ref: bookingsTable.booking_ref,
          check_in_date: bookingsTable.check_in_date,
          check_out_date: bookingsTable.check_out_date,
          booking_status: bookingsTable.booking_status,
        })
        .from(bookingsTable)
        .where(inArray(bookingsTable.id, bookingIds));
      bookingInfoMap = Object.fromEntries(bookings.map((b) => [b.id, b]));
    }

    const byBookingMap: Record<number, any> = {};
    for (const s of services) {
      if (!byBookingMap[s.booking_id]) {
        const b = bookingInfoMap[s.booking_id];
        byBookingMap[s.booking_id] = {
          booking_id: s.booking_id,
          booking_ref: b?.booking_ref ?? `#${s.booking_id}`,
          check_in_date: b?.check_in_date,
          booking_status: b?.booking_status,
          services: [],
          total: 0,
        };
      }
      byBookingMap[s.booking_id].services.push(s.name);
      byBookingMap[s.booking_id].total += parseFloat(s.total_price ?? "0");
    }
    const byBooking = Object.values(byBookingMap).sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        total_earned: totalEarned.toFixed(2),
        by_service: byService.map((s) => ({ ...s, total: s.total.toFixed(2) })),
        by_booking: byBooking.map((b) => ({ ...b, total: b.total.toFixed(2) })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/profile */
router.get("/v1/service-host/profile", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;

    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);

    const hosts = await db
      .select()
      .from(serviceHostsTable)
      .where(eq(serviceHostsTable.account_id, accountId));

    res.json({ success: true, data: { account, service_hosts: hosts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
