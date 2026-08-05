import { Router, type IRouter } from "express";
import multer from "multer";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { eq, ilike, and, or, inArray, desc, sql, isNull, SQL } from "drizzle-orm";
import {
  db, serviceHostsTable, accountsTable, bookingServicesTable, bookingsTable,
  workOrdersTable, bookingServicePhotosTable, csTicketsTable, partnerUsersTable,
  partnerPayoutsTable, serviceHostPhotosTable,
} from "@workspace/db";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder, deleteFromCloudinary } from "../utils/cloudinary";
import {
  ListServiceHostsQueryParams,
  CreateServiceHostBody,
  GetServiceHostParams,
  UpdateServiceHostParams,
  DeleteServiceHostParams,
} from "@workspace/api-zod";
import { postPartnerPayoutAccrued, postPartnerPayoutPaid } from "../lib/billing/gl";
import { logAction } from "../utils/auditLog";

import { keywordCondition, accountIdsByName } from "../lib/listSearch";
const router: IRouter = Router();

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const num = (v: unknown): number => Number(v ?? 0);

// The admin form posts every field it renders, so untouched date inputs arrive as
// "" — which Postgres rejects for a `date` column ("invalid input syntax"). Blank
// text is likewise a blank, not a value. Normalise before the write.
const blankToNull = (v: unknown): string | null => (typeof v === "string" && v.trim() === "" ? null : (v as string | null));

/** specialties (auto-dispatch) is not in the generated zod schema — read it off the raw body. */
function normalizeSpecialties(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean);
}

/** Shared shaping for POST/PUT: blank dates → null, blank notes → null, specialties merged in. */
function shapeHostWrite(data: Record<string, unknown>, body: any): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const k of ["from_date", "to_date", "description"]) {
    if (k in out) out[k] = blankToNull(out[k]);
  }
  const specialties = normalizeSpecialties(body?.specialties);
  if (specialties) out["specialties"] = specialties;
  return out;
}

// service_hosts.id → this host's booking_service ids (jobs) — the join spine for
// photos and job earnings.
async function hostBookingServiceIds(hostId: number): Promise<number[]> {
  const rows = await db.select({ id: bookingServicesTable.id }).from(bookingServicesTable).where(eq(bookingServicesTable.service_id, hostId));
  return rows.map((r) => r.id);
}
// service_hosts.account_id → partner_user ids (service_host portal) — for CS tickets.
async function hostPartnerUserIds(accountId: number | null): Promise<number[]> {
  if (!accountId) return [];
  const rows = await db.select({ id: partnerUsersTable.id }).from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.account_id, accountId), eq(partnerUsersTable.portal_type, "service_host")));
  return rows.map((r) => r.id);
}

router.get("/v1/service-hosts", async (req, res): Promise<void> => {
  const parsed = ListServiceHostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, status } = parsed.data;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(serviceHostsTable.status, status));
  if (search) {
    conditions.push(keywordCondition(
      search,
      [serviceHostsTable.name, serviceHostsTable.description],
      [{ column: serviceHostsTable.account_id, ids: await accountIdsByName(search) }],
    ));
  }
  const rows = await db
    .select()
    .from(serviceHostsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(serviceHostsTable.created_at);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [account] = row.account_id
        ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
        : [null];
      return { ...row, account_name: account?.name ?? null };
    })
  );
  res.json(enriched);
});

router.post("/v1/service-hosts", async (req, res): Promise<void> => {
  const parsed = CreateServiceHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const values = shapeHostWrite({ ...parsed.data, name: parsed.data.name.trim() }, req.body) as typeof serviceHostsTable.$inferInsert;
  const [row] = await db.insert(serviceHostsTable).values(values).returning();
  const [account] = row.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
    : [null];
  res.status(201).json({ ...row, account_name: account?.name ?? null });
});

router.get("/v1/service-hosts/:id", async (req, res): Promise<void> => {
  const parsed = GetServiceHostParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.select().from(serviceHostsTable).where(eq(serviceHostsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [account] = row.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
    : [null];
  res.json({ ...row, account_name: account?.name ?? null });
});

router.put("/v1/service-hosts/:id", async (req, res): Promise<void> => {
  const paramParsed = UpdateServiceHostParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) { res.status(400).json({ error: paramParsed.error.message }); return; }
  // PUT is a partial update: reuse the Create schema but make every field optional
  // so callers can update e.g. only `specialties` without re-sending `name`.
  const bodyParsed = CreateServiceHostBody.partial().safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  if (bodyParsed.data.name !== undefined && !bodyParsed.data.name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const updateSet = shapeHostWrite(bodyParsed.data, req.body);
  const [row] = await db.update(serviceHostsTable).set(updateSet).where(eq(serviceHostsTable.id, paramParsed.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [account] = row.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
    : [null];
  res.json({ ...row, account_name: account?.name ?? null });
});

router.delete("/v1/service-hosts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteServiceHostParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(serviceHostsTable).set({ status: "Deleted" }).where(eq(serviceHostsTable.id, parsed.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════
   SERVICE HOST DETAIL — sub-resources for the admin detail tabs (#4)
   Jobs & earnings · Photos · CS tickets · Partner payouts (GL-backed)
═══════════════════════════════════════════════════════════ */

// GET /:id/jobs — this host's service jobs (booking_services) + dispatched work orders.
router.get("/v1/service-hosts/:id/jobs", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const jobs = await db
      .select({
        id: bookingServicesTable.id, booking_id: bookingServicesTable.booking_id,
        booking_ref: bookingsTable.booking_ref, service_name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type, total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency, status: bookingServicesTable.status,
        created_at: bookingServicesTable.created_at,
      })
      .from(bookingServicesTable)
      .leftJoin(bookingsTable, eq(bookingsTable.id, bookingServicesTable.booking_id))
      .where(eq(bookingServicesTable.service_id, id))
      .orderBy(desc(bookingServicesTable.id));
    const workOrders = await db
      .select({
        id: workOrdersTable.id, order_ref: workOrdersTable.order_ref, title: workOrdersTable.title,
        category: workOrdersTable.category, status: workOrdersTable.status, cost: workOrdersTable.cost,
        currency: workOrdersTable.currency, sla_status: workOrdersTable.sla_status,
        dispatched_at: workOrdersTable.dispatched_at, completed_at: workOrdersTable.completed_at,
      })
      .from(workOrdersTable)
      .where(and(eq(workOrdersTable.service_host_id, id), isNull(workOrdersTable.deleted_at)))
      .orderBy(desc(workOrdersTable.id));
    res.json({ data: { jobs, work_orders: workOrders } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/photos — job photos (booking_service_photos) merged with photos
// uploaded straight onto the host from the admin detail tab.
router.get("/v1/service-hosts/:id/photos", async (req, res): Promise<void> => {
  try {
    const hostId = Number(req.params.id);
    const bsIds = await hostBookingServiceIds(hostId);
    const jobPhotos = bsIds.length
      ? await db.select().from(bookingServicePhotosTable)
          .where(inArray(bookingServicePhotosTable.booking_service_id, bsIds))
          .orderBy(desc(bookingServicePhotosTable.id))
      : [];
    const own = await db.select().from(serviceHostPhotosTable)
      .where(eq(serviceHostPhotosTable.service_host_id, hostId))
      .orderBy(desc(serviceHostPhotosTable.id));
    // `source` lets the UI offer delete only on host-owned photos — job photos
    // belong to the booking evidence trail and must not be removed from here.
    res.json({
      data: [
        ...own.map((p) => ({ ...p, source: "host" as const })),
        ...jobPhotos.map((p) => ({ ...p, source: "job" as const })),
      ],
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /:id/photos — upload a photo onto the host. Accepts either a multipart
// `image` file (→ Cloudinary) or a JSON body with an existing `url`.
router.post("/v1/service-hosts/:id/photos", photoUpload.single("image"), async (req, res): Promise<void> => {
  try {
    const hostId = Number(req.params.id);
    const [host] = await db.select({ id: serviceHostsTable.id }).from(serviceHostsTable).where(eq(serviceHostsTable.id, hostId)).limit(1);
    if (!host) { res.status(404).json({ error: "Service host not found" }); return; }

    let url: string | null = typeof req.body?.url === "string" && req.body.url.trim() ? req.body.url.trim() : null;
    let cloudinaryId: string | null = null;
    let thumbnailUrl: string | null = null;
    if (!url && req.file) {
      if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image upload is not configured" }); return; }
      const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("service-hosts") });
      url = result.secure_url;
      cloudinaryId = result.public_id ?? null;
      thumbnailUrl = result.secure_url.replace("/upload/", "/upload/c_fill,w_400,h_400/");
    }
    if (!url) { res.status(400).json({ error: "Provide an image file or a url." }); return; }

    const [row] = await db.insert(serviceHostPhotosTable).values({
      service_host_id: hostId,
      file_url: url,
      thumbnail_url: thumbnailUrl,
      cloudinary_id: cloudinaryId,
      caption: typeof req.body?.caption === "string" && req.body.caption.trim() ? req.body.caption.trim() : null,
      uploaded_by_type: "admin",
      uploaded_by_id: (req as any).user?.id ?? null,
    }).returning();
    void logAction({ entityType: "service_host", entityId: hostId, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { photo_id: row!.id } });
    res.status(201).json({ data: row });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /:id/photos/:photoId — host-owned photos only (job photos are evidence).
router.delete("/v1/service-hosts/:id/photos/:photoId", async (req, res): Promise<void> => {
  try {
    const [row] = await db.delete(serviceHostPhotosTable)
      .where(and(
        eq(serviceHostPhotosTable.id, Number(req.params.photoId)),
        eq(serviceHostPhotosTable.service_host_id, Number(req.params.id)),
      )).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.cloudinary_id) { try { await deleteFromCloudinary(row.cloudinary_id); } catch { /* asset may already be gone */ } }
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/cs-tickets — tickets this host opened (via its partner users) PLUS
// customer tickets that turned into a work order dispatched to this host. Without
// the second half the tab is empty for every host that never used the portal,
// even when it is actively working the tickets.
router.get("/v1/service-hosts/:id/cs-tickets", async (req, res): Promise<void> => {
  try {
    const hostId = Number(req.params.id);
    const [host] = await db.select({ account_id: serviceHostsTable.account_id }).from(serviceHostsTable).where(eq(serviceHostsTable.id, hostId)).limit(1);
    const puIds = await hostPartnerUserIds(host?.account_id ?? null);
    const woRows = await db.select({ id: workOrdersTable.id }).from(workOrdersTable)
      .where(and(eq(workOrdersTable.service_host_id, hostId), isNull(workOrdersTable.deleted_at)));
    const woIds = woRows.map((r) => r.id);
    if (!puIds.length && !woIds.length) { res.json({ data: [] }); return; }

    const where: SQL[] = [];
    if (puIds.length) where.push(inArray(csTicketsTable.partner_user_id, puIds));
    if (woIds.length) where.push(inArray(csTicketsTable.work_order_id, woIds));
    const tickets = await db.select({
      id: csTicketsTable.id, ticket_ref: csTicketsTable.ticket_ref, subject: csTicketsTable.subject,
      category: csTicketsTable.category, status: csTicketsTable.status, priority: csTicketsTable.priority,
      work_order_id: csTicketsTable.work_order_id, requester_type: csTicketsTable.requester_type,
      created_at: csTicketsTable.created_at,
    }).from(csTicketsTable)
      .where(and(isNull(csTicketsTable.deleted_at), where.length > 1 ? or(...where)! : where[0]!))
      .orderBy(desc(csTicketsTable.id));
    res.json({ data: tickets });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/payouts — payout ledger + earnings summary.
router.get("/v1/service-hosts/:id/payouts", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const payouts = await db.select().from(partnerPayoutsTable)
      .where(eq(partnerPayoutsTable.service_host_id, id)).orderBy(desc(partnerPayoutsTable.id));
    // Revenue this host generated (customer price on their jobs).
    const bs = await db.select({ total: bookingServicesTable.total_price }).from(bookingServicesTable).where(eq(bookingServicesTable.service_id, id));
    const revenue = bs.reduce((s, r) => s + num(r.total), 0);
    const sum = (st: string) => payouts.filter((p) => p.status === st).reduce((s, p) => s + num(p.amount), 0);
    res.json({
      data: payouts,
      summary: {
        revenue_generated: Math.round(revenue * 100) / 100,
        payout_accrued: Math.round(sum("Accrued") * 100) / 100,
        payout_approved: Math.round(sum("Approved") * 100) / 100,
        payout_paid: Math.round(sum("Paid") * 100) / 100,
        outstanding: Math.round((sum("Accrued") + sum("Approved")) * 100) / 100,
      },
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

async function nextPayoutRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(partnerPayoutsTable)
    .where(sql`EXTRACT(YEAR FROM ${partnerPayoutsTable.created_at}) = ${year}`);
  return `PP-${year}-${String((rows[0]?.count ?? 0) + 1).padStart(5, "0")}`;
}

// POST /:id/payouts — record a payout owed to the host; posts the GL accrual.
router.post("/v1/service-hosts/:id/payouts", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [host] = await db.select().from(serviceHostsTable).where(eq(serviceHostsTable.id, id)).limit(1);
    if (!host) { res.status(404).json({ error: "Service host not found" }); return; }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) { res.status(400).json({ error: "amount must be a positive number" }); return; }
    const payout_ref = await nextPayoutRef();
    const [row] = await db.insert(partnerPayoutsTable).values({
      payout_ref, service_host_id: id,
      source_type: ["work_order", "booking_service", "manual"].includes(req.body?.source_type) ? req.body.source_type : "manual",
      source_id: Number.isFinite(Number(req.body?.source_id)) && req.body?.source_id ? Number(req.body.source_id) : null,
      description: typeof req.body?.description === "string" ? req.body.description : null,
      amount: String(Math.round(amount * 100) / 100),
      currency: typeof req.body?.currency === "string" ? req.body.currency : DEFAULT_CURRENCY,
      status: "Accrued",
      created_by: (req as any).user?.id ?? null,
    }).returning();
    const postingKey = `partner_payout_accrued:${row!.id}`;
    void postPartnerPayoutAccrued({ id: row!.id, amount, currency: row!.currency });
    await db.update(partnerPayoutsTable).set({ posting_key: postingKey }).where(eq(partnerPayoutsTable.id, row!.id));
    void logAction({ entityType: "partner_payout", entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { payout_ref, amount } });
    res.status(201).json({ success: true, data: row });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Approve / mark-paid / cancel a payout.
router.post("/v1/partner-payouts/:pid/approve", async (req, res): Promise<void> => {
  try {
    const [row] = await db.update(partnerPayoutsTable).set({ status: "Approved", approved_at: new Date(), updated_at: new Date() })
      .where(and(eq(partnerPayoutsTable.id, Number(req.params.pid)), eq(partnerPayoutsTable.status, "Accrued"))).returning();
    if (!row) { res.status(409).json({ error: "Not found or not Accrued" }); return; }
    void logAction({ entityType: "partner_payout", entityId: row.id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { status: "Approved" } });
    res.json({ success: true, data: row });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.post("/v1/partner-payouts/:pid/mark-paid", async (req, res): Promise<void> => {
  try {
    const [row] = await db.update(partnerPayoutsTable).set({ status: "Paid", paid_at: new Date(), updated_at: new Date() })
      .where(and(eq(partnerPayoutsTable.id, Number(req.params.pid)), eq(partnerPayoutsTable.status, "Approved"))).returning();
    if (!row) { res.status(409).json({ error: "Not found or not Approved" }); return; }
    void postPartnerPayoutPaid({ id: row.id, amount: num(row.amount), currency: row.currency });
    void logAction({ entityType: "partner_payout", entityId: row.id, action: "PAYMENT", actorId: (req as any).user?.id ?? null, newValue: { status: "Paid" } });
    res.json({ success: true, data: row });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
