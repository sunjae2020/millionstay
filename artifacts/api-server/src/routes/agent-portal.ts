import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, or, desc, sql, ilike, inArray, isNull } from "drizzle-orm";
import {
  db,
  bookingsTable,
  spacesTable,
  propertiesTable,
  contractsTable,
  invoicesTable,
  guestUsersTable,
  accountsTable,
  commissionsTable,
  contactsTable,
  documentsTable,
} from "@workspace/db";
import { requireAgentAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { isCloudinaryConfigured, uploadPrivateToCloudinary, generateSignedUrl, deleteFromCloudinary, cldFolder } from "../utils/cloudinary";
import { parsePageParams, pageMeta, paginateArray } from "../utils/pagination";

const router: IRouter = Router();

// SECURITY: every /v1/agent/* route requires agent auth. Per-route checks are
// kept as defence in depth (any new route inheriting this prefix is auto-protected).
router.use("/v1/agent", requireAgentAuth);

/* ─── helpers ─── */
function maskTenantForAgent(contact: { first_name: string | null; last_name: string | null; email: string | null }) {
  return {
    display_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—",
    email: contact.email ?? "—",
  };
}

/* GET /api/v1/agent/dashboard */
router.get("/v1/agent/dashboard", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const agentAccountId = partner.account_id;

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name, default_commission_id: accountsTable.default_commission_id })
    .from(accountsTable)
    .where(eq(accountsTable.id, agentAccountId))
    .limit(1);

  // Bookings managed by this agent
  const bookings = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
    })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, agentAccountId), eq(bookingsTable.status, "Active")))
    .orderBy(desc(bookingsTable.created_at));

  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => ["Confirmed", "Active"].includes(b.booking_status)).length;
  const totalRent = bookings.reduce((sum, b) => sum + parseFloat(b.total_rent ?? "0"), 0);

  // Commission info
  let commission = null;
  if (account?.default_commission_id) {
    const [comm] = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.id, account.default_commission_id))
      .limit(1);
    commission = comm;
  }

  const commissionEarned =
    commission?.commission_type === "Percentage" && commission.commission_rate
      ? totalRent * (commission.commission_rate / 100)
      : (commission?.commission_amount ?? 0) * totalBookings;

  const commissionRateFor = (rent: number) =>
    commission?.commission_type === "Percentage" && commission.commission_rate
      ? rent * (commission.commission_rate / 100)
      : (commission?.commission_amount ?? 0);

  // Status breakdown — counts per contract status (for the donut chart).
  const STATUS_ORDER = ["Draft", "Confirmed", "Active", "CheckedOut", "Cancelled"];
  const statusCounts: Record<string, number> = {};
  for (const b of bookings) statusCounts[b.booking_status] = (statusCounts[b.booking_status] ?? 0) + 1;
  const status_breakdown = STATUS_ORDER
    .filter((s) => statusCounts[s])
    .map((s) => ({ status: s, count: statusCounts[s]! }));

  // Monthly rent + commission trend — last 6 calendar months keyed by check-in.
  const now = new Date();
  const months: { key: string; label: string; rent: number; commission: number; contracts: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}`,
      rent: 0,
      commission: 0,
      contracts: 0,
    });
  }
  const monthIdx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  for (const b of bookings) {
    if (!b.check_in_date) continue;
    const dt = new Date(b.check_in_date);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIdx[key];
    if (idx === undefined) continue;
    const rent = parseFloat(b.total_rent ?? "0");
    months[idx]!.rent += rent;
    months[idx]!.commission += commissionRateFor(rent);
    months[idx]!.contracts += 1;
  }

  res.json({
    success: true,
    data: {
      account_name: account?.name ?? "—",
      commission,
      stats: {
        total_bookings: totalBookings,
        active_bookings: activeBookings,
        total_rent_managed: totalRent,
        estimated_commission_earned: commissionEarned,
      },
      status_breakdown,
      monthly_trend: months,
      recent_bookings: bookings.slice(0, 5),
    },
  });
});

/* GET /api/v1/agent/bookings — server-side paginated + searchable.
   Query: ?limit=&offset= (or ?page=), ?q= (booking ref / tenant / property / space),
   ?booking_status= (Draft|Confirmed|Active|CheckedOut|Cancelled). */
router.get("/v1/agent/bookings", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const { limit, offset, page, q } = parsePageParams(req.query);
  const statusFilter = typeof req.query.booking_status === "string" ? req.query.booking_status : "";

  const conds = [
    eq(bookingsTable.agent_account_id, partner.account_id),
    eq(bookingsTable.status, "Active"),
  ];
  if (statusFilter) conds.push(eq(bookingsTable.booking_status, statusFilter));
  if (q) {
    conds.push(
      or(
        ilike(bookingsTable.booking_ref, `%${q}%`),
        ilike(contactsTable.first_name, `%${q}%`),
        ilike(contactsTable.last_name, `%${q}%`),
        ilike(contactsTable.email, `%${q}%`),
        ilike(propertiesTable.name, `%${q}%`),
        ilike(spacesTable.name, `%${q}%`),
      )!,
    );
  }
  const whereExpr = and(...conds);

  // Joins let us filter + count + paginate entirely in the DB.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(contactsTable, eq(bookingsTable.contact_id, contactsTable.id))
    .where(whereExpr);

  const rows = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
      space_id: bookingsTable.space_id,
      contact_id: bookingsTable.contact_id,
      space_name: spacesTable.name,
      property_name: propertiesTable.name,
      contact_first: contactsTable.first_name,
      contact_last: contactsTable.last_name,
      contact_email: contactsTable.email,
    })
    .from(bookingsTable)
    .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(contactsTable, eq(bookingsTable.contact_id, contactsTable.id))
    .where(whereExpr)
    .orderBy(desc(bookingsTable.created_at))
    .limit(limit)
    .offset(offset);

  const data = rows.map((r) => ({
    id: r.id,
    booking_ref: r.booking_ref,
    booking_status: r.booking_status,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    agreed_weekly_rate: r.agreed_weekly_rate,
    total_rent: r.total_rent,
    currency: r.currency,
    space_id: r.space_id,
    contact_id: r.contact_id,
    space_name: r.space_name ?? "—",
    property_name: r.property_name ?? "—",
    tenant:
      r.contact_first || r.contact_last || r.contact_email
        ? maskTenantForAgent({ first_name: r.contact_first, last_name: r.contact_last, email: r.contact_email })
        : null,
  }));

  res.json({ success: true, data, meta: pageMeta(total ?? 0, { limit, offset, page }) });
});

/* GET /api/v1/agent/bookings/:id */
router.get("/v1/agent/bookings/:id", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid id" }); return; }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, id), eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")))
    .limit(1);

  if (!booking) { res.status(404).json({ success: false, error: "Booking not found" }); return; }

  const [space] = booking.space_id
    ? await db.select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
        .from(spacesTable).where(eq(spacesTable.id, booking.space_id)).limit(1)
    : [null];
  const [property] = space?.property_id
    ? await db.select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address })
        .from(propertiesTable).where(eq(propertiesTable.id, space.property_id)).limit(1)
    : [null];
  const [contact] = booking.contact_id
    ? await db
        .select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name, email: contactsTable.email })
        .from(contactsTable).where(eq(contactsTable.id, booking.contact_id)).limit(1)
    : [null];

  const [contract] = await db
    .select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref, status: contractsTable.status, start_date: contractsTable.start_date, end_date: contractsTable.end_date })
    .from(contractsTable).where(eq(contractsTable.booking_id, id)).limit(1);

  res.json({
    success: true,
    data: {
      ...booking,
      space_name: space?.name ?? "—",
      property_name: property?.name ?? "—",
      property_address: property?.address ?? "—",
      tenant: contact ? maskTenantForAgent(contact) : null,
      contract: contract ?? null,
    },
  });
});

/* GET /api/v1/agent/properties */
router.get("/v1/agent/properties", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  // Properties that have bookings with this agent
  const agentBookings = await db
    .select({ space_id: bookingsTable.space_id })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")));

  const spaceIds = [...new Set(agentBookings.map(b => b.space_id).filter(Boolean))] as number[];
  if (!spaceIds.length) { res.json({ success: true, data: [] }); return; }

  const spaces = await db
    .select({ id: spacesTable.id, name: spacesTable.name, space_type: spacesTable.space_type, property_id: spacesTable.property_id, status: spacesTable.status })
    .from(spacesTable).where(inArray(spacesTable.id, spaceIds));

  const propertyIds = [...new Set(spaces.map(s => s.property_id).filter(Boolean))] as number[];
  const properties = propertyIds.length
    ? await db
        .select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address, city: propertiesTable.city, state: propertiesTable.state })
        .from(propertiesTable).where(inArray(propertiesTable.id, propertyIds))
    : [];

  const propMap = Object.fromEntries(properties.map(p => [p.id, p]));
  const result = spaces.map(s => ({ ...s, property: s.property_id ? propMap[s.property_id] : null }));
  res.json({ success: true, data: result });
});

/* GET /api/v1/agent/commission */
router.get("/v1/agent/commission", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name, default_commission_id: accountsTable.default_commission_id })
    .from(accountsTable)
    .where(eq(accountsTable.id, partner.account_id))
    .limit(1);

  let commission = null;
  if (account?.default_commission_id) {
    const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, account.default_commission_id)).limit(1);
    commission = comm;
  }

  const bookings = await db
    .select({ total_rent: bookingsTable.total_rent, booking_status: bookingsTable.booking_status, booking_ref: bookingsTable.booking_ref, check_in_date: bookingsTable.check_in_date, check_out_date: bookingsTable.check_out_date })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")))
    .orderBy(desc(bookingsTable.created_at));

  const earningsBreakdown = bookings.map(b => {
    const rentAmount = parseFloat(b.total_rent ?? "0");
    const earned =
      commission?.commission_type === "Percentage" && commission.commission_rate
        ? rentAmount * (commission.commission_rate / 100)
        : commission?.commission_amount ?? 0;
    return {
      booking_ref: b.booking_ref,
      booking_status: b.booking_status,
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date,
      rent_amount: rentAmount,
      commission_earned: earned,
    };
  });

  // Aggregates are computed over ALL bookings; only the breakdown list is paginated.
  const totalEarned = earningsBreakdown.reduce((s, r) => s + r.commission_earned, 0);
  const paidCount = earningsBreakdown.filter(r => ["Active", "CheckedOut"].includes(r.booking_status)).length;

  const { limit, offset, page, q } = parsePageParams(req.query);
  const filtered = q
    ? earningsBreakdown.filter(r => (r.booking_ref ?? "").toLowerCase().includes(q.toLowerCase()))
    : earningsBreakdown;
  const pagedBreakdown = paginateArray(filtered, { limit, offset });

  res.json({
    success: true,
    data: {
      account_name: account?.name ?? "—",
      commission,
      total_earned: totalEarned,
      paid_count: paidCount,
      pending_count: earningsBreakdown.length - paidCount,
      breakdown: pagedBreakdown,
    },
    meta: pageMeta(filtered.length, { limit, offset, page }),
  });
});

/* ─────────────────────────────────────────────
   DOCUMENTS — agent document folder (문서 관리함)
   The agent stores/reads their own documents (contracts, invoices, reports,
   manuals). Files live in Cloudinary as `authenticated` assets and are served
   only via short-lived signed URLs. Rows in the shared `documents` table are
   scoped to the agent via entity_type='agent' + entity_id=account_id.
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

// GET /api/v1/agent/documents — list my documents (newest first).
router.get("/v1/agent/documents", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
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
        eq(documentsTable.entity_type, "agent"),
        eq(documentsTable.entity_id, partner.account_id),
        isNull(documentsTable.deleted_at),
      ))
      .orderBy(desc(documentsTable.created_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// POST /api/v1/agent/documents — upload a document.
router.post(
  "/v1/agent/documents",
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

      if (!isCloudinaryConfigured()) {
        res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "File upload not configured" } });
        return;
      }
      const file = req.file as Express.Multer.File | undefined;
      if (!file) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No file provided" } }); return; }

      const docType = String((req.body?.doc_type ?? "other")).toLowerCase();
      if (!DOC_TYPES.has(docType)) { res.status(400).json({ success: false, error: { code: "INVALID_TYPE", message: `doc_type must be one of: ${[...DOC_TYPES].join(", ")}` } }); return; }
      const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : file.originalname;

      const uploaded = await uploadPrivateToCloudinary(file.buffer, { folder: cldFolder("partner-documents"), resource_type: "auto" });
      publicId = uploaded.public_id;

      // Default retention: 7 years (Australian APP 11 record-keeping default).
      const retentionUntil = new Date();
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

      const [row] = await db.insert(documentsTable).values({
        entity_type: "agent",
        entity_id: partner.account_id,
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

// Load a document owned by the calling agent.
async function loadOwnedAgentDocument(accountId: number, docId: string) {
  const [doc] = await db.select().from(documentsTable).where(and(
    eq(documentsTable.id, docId),
    eq(documentsTable.entity_type, "agent"),
    eq(documentsTable.entity_id, accountId),
    isNull(documentsTable.deleted_at),
  )).limit(1);
  return doc ?? null;
}

// GET /api/v1/agent/documents/:id/download — short-lived signed URL.
router.get("/v1/agent/documents/:id/download", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const doc = await loadOwnedAgentDocument(partner.account_id, String(req.params.id));
    if (!doc || !doc.cloudinary_public_id) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } }); return; }
    const url = generateSignedUrl(doc.cloudinary_public_id, 300);
    res.json({ success: true, data: { url } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// DELETE /api/v1/agent/documents/:id — soft-delete + remove the asset.
router.delete("/v1/agent/documents/:id", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const doc = await loadOwnedAgentDocument(partner.account_id, String(req.params.id));
    if (!doc) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } }); return; }
    await db.update(documentsTable).set({ deleted_at: new Date(), updated_at: new Date() }).where(eq(documentsTable.id, doc.id));
    if (doc.cloudinary_public_id) { try { await deleteFromCloudinary(doc.cloudinary_public_id); } catch {} }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

export default router;
