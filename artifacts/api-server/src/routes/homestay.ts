import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { eq, and, isNull, desc, ilike, or, inArray, sql } from "drizzle-orm";
import {
  db,
  homestayHostApplicationsTable,
  accountsTable,
  partnerUsersTable,
  documentsTable,
  propertiesTable,
  spacesTable,
  suburbsTable,
} from "@workspace/db";
import { generateHomestayRef } from "../lib/homestayRef.js";
import { signPartnerJWT, requireHomestayAuth, invalidatePartnerCache, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth.js";
import { createSigningRequest } from "../services/contractSigning.js";
import { sendHomestayHostEmail, sendLeadNotificationEmail } from "../lib/email.js";
import { isCloudinaryConfigured, uploadToCloudinary } from "../utils/cloudinary.js";
import { logAction } from "../utils/auditLog.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";

const HOMESTAY_ENTITY = "homestay_host_application";

const BCRYPT_COST = 10;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Fields a host may write on their application (whitelist — never trust raw body).
const APPLICATION_FIELDS = [
  "first_name", "last_name", "email", "phone", "date_of_birth", "gender", "nationality",
  "cultural_background", "address", "suburb", "heard_about",
  "residents", "smoking_in_home", "smoke_outside_allowed", "drink_in_home", "guest_drink_allowed",
  "has_pets", "pet_types", "pet_notes", "building_type", "home_features", "rooms",
  "pref_student_gender", "pref_student_age", "host_under_18", "packages_offered", "dietary", "dietary_notes",
  "welcome_message", "profile_description", "emergency_contact", "extra_contact", "host_referral",
  "agreement_accepted", "signature_name",
] as const;

function pickApplication(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of APPLICATION_FIELDS) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

// Strip sensitive/internal fields before returning an application to a host.
function publicView(app: typeof homestayHostApplicationsTable.$inferSelect) {
  const { reviewed_by, approval_notes, ...rest } = app;
  return rest;
}

type RoomRow = { name?: string; bed_type?: string; bath_type?: string; has_lock?: boolean; comments?: string };

// Rough occupancy hint from the bed type (twin/bunk/double+ sleep two).
function bedOccupancy(bedType?: string): number {
  const b = (bedType ?? "").toLowerCase();
  return /twin|bunk|double|queen|king|triple/.test(b) ? 2 : 1;
}

// On approval, materialise the host's homestay listing: one property for the
// home + one space per advertised room, classified space_type='Homestay'.
// Spaces start 'Inactive' (hidden) and only go 'Active' when the host turns on
// their landing page (requires Approved) — so approval alone never exposes them.
// Idempotent: if a property already exists for the host account, do nothing.
async function ensureHomestayListings(app: typeof homestayHostApplicationsTable.$inferSelect): Promise<void> {
  if (!app.account_id) return;
  const [existing] = await db.select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.owner_account_id, app.account_id), isNull(propertiesTable.deleted_at)))
    .limit(1);
  if (existing) return; // already provisioned

  // Best-effort suburb match (application stores suburb as free text).
  let suburb_id: number | null = null;
  if (app.suburb) {
    const [s] = await db.select({ id: suburbsTable.id }).from(suburbsTable)
      .where(ilike(suburbsTable.name, app.suburb)).limit(1);
    suburb_id = s?.id ?? null;
  }

  const [property] = await db.insert(propertiesTable).values({
    name: `${app.first_name} ${app.last_name}`.trim() + " — Homestay",
    address: app.address ?? null,
    suburb_id,
    owner_account_id: app.account_id,
    approval_status: "Approved",
    description: app.profile_description ?? null,
  }).returning({ id: propertiesTable.id });

  const rooms = (app.rooms as RoomRow[] | null) ?? [];
  const list = rooms.length ? rooms : [{ name: "Homestay Room" }];
  await db.insert(spacesTable).values(
    list.map((r, i) => ({
      name: r.name?.trim() || `Homestay Room ${i + 1}`,
      space_type: "Homestay",
      max_occupancy: bedOccupancy(r.bed_type),
      base_currency: "AUD",
      description: r.comments ?? null,
      status: "Inactive", // hidden until the host activates their landing page
      property_id: property!.id,
      landlord_account_id: app.account_id,
    })),
  );
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: app.id, action: "AUTO_CREATED", newValue: { property_id: property!.id, rooms: list.length } });
}

// Flip every homestay space owned by this host account between public/hidden.
async function setHomestaySpacesActive(accountId: number | null, active: boolean): Promise<void> {
  if (!accountId) return;
  const props = await db.select({ id: propertiesTable.id }).from(propertiesTable)
    .where(eq(propertiesTable.owner_account_id, accountId));
  const propIds = props.map((p) => p.id);
  if (!propIds.length) return;
  await db.update(spacesTable)
    .set({ status: active ? "Active" : "Inactive" })
    .where(and(inArray(spacesTable.property_id, propIds), eq(spacesTable.space_type, "Homestay")));
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC — online application submission (no auth)
   ═══════════════════════════════════════════════════════════════════════════ */
export const homestayPublicRouter: IRouter = Router();

homestayPublicRouter.post("/v1/public/homestay-host-applications", async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, any>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const first_name = String(body.first_name ?? "").trim();
    const last_name = String(body.last_name ?? "").trim();

    if (!email || !first_name || !last_name) {
      res.status(400).json({ success: false, error: "first_name, last_name and email are required" });
      return;
    }
    if (password.length < 12) {
      res.status(400).json({ success: false, error: "Password must be at least 12 characters" });
      return;
    }
    // Draft mode: save progress with a login but skip the agreement gate — the host
    // finalises later via POST /v1/homestay/submit.
    const isDraft = body.draft === true;
    if (!isDraft && !body.agreement_accepted) {
      res.status(400).json({ success: false, error: "You must accept the host agreement" });
      return;
    }

    // One portal login per email.
    const [existingUser] = await db.select({ id: partnerUsersTable.id })
      .from(partnerUsersTable).where(eq(partnerUsersTable.email, email)).limit(1);
    if (existingUser) {
      res.status(409).json({ success: false, error: "An account with this email already exists. Please log in." });
      return;
    }

    // 1) Account (container) + 2) partner_user (host portal login, active immediately)
    const [account] = await db.insert(accountsTable).values({
      name: `${first_name} ${last_name}`.trim(),
      account_type: "HomestayHost",
      account_email: email,
      phone1: body.phone ?? null,
      status: "Active",
    }).returning({ id: accountsTable.id });

    const password_hash = await bcrypt.hash(password, BCRYPT_COST);
    const [user] = await db.insert(partnerUsersTable).values({
      account_id: account!.id,
      portal_type: "homestay",
      email,
      password_hash,
      first_name,
      last_name,
      phone: body.phone ?? null,
      is_active: true,
    }).returning({ id: partnerUsersTable.id });

    // 3) Application
    const fields = pickApplication(body);
    const application_ref = await generateHomestayRef();
    const [appRow] = await db.insert(homestayHostApplicationsTable).values({
      ...fields,
      application_ref,
      email,
      first_name,
      last_name,
      status: isDraft ? "Draft" : "Submitted",
      account_id: account!.id,
      partner_user_id: user!.id,
      agreement_accepted: !!body.agreement_accepted,
      agreement_accepted_at: body.agreement_accepted ? new Date() : null,
    } as any).returning();

    // 4) Auto-login token (portal works regardless of approval)
    const token = signPartnerJWT({ id: user!.id, email, account_id: account!.id, portal_type: "homestay" });

    // 4b) E-signature request — submitted hosts draw their signature at /sign/:token
    // (parity with the student flow). Drafts skip this until they finalise.
    let signing_token: string | null = null;
    if (!isDraft) {
      try {
        const signing = await createSigningRequest({
          contextType: "host_app",
          contextId: appRow!.id,
          signers: [{ role: "host", name: `${first_name} ${last_name}`.trim(), email, required: true }],
        });
        signing_token = signing.token;
      } catch (e) {
        console.error("[homestay] signing request creation failed:", e);
      }
    }

    // 5) Emails — best-effort, never block. Skipped for Drafts (not yet submitted).
    if (!isDraft) {
      void sendHomestayHostEmail({ to: email, toName: first_name, applicationRef: application_ref, kind: "received" })
        .catch((e) => console.error("[homestay] received email failed:", e));
      const adminTo = process.env.LEAD_NOTIFICATION_EMAIL;
      if (adminTo) {
        void sendLeadNotificationEmail({
          leadRef: application_ref, inquiryType: "Homestay Host Application",
          firstName: first_name, lastName: last_name, email, phone: body.phone ?? null,
          message: `New homestay host application (${application_ref})`, description: null,
        }).catch((e) => console.error("[homestay] admin notify failed:", e));
      }
    }

    void logAction({ entityType: HOMESTAY_ENTITY, entityId: appRow!.id, action: "CREATE", actorId: user!.id, actorEmail: email, newValue: { application_ref, status: isDraft ? "Draft" : "Submitted" } });

    res.status(201).json({ success: true, application_ref, token, signing_token, application: publicView(appRow!) });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ success: false, error: "Duplicate entry" }); return; }
    console.error("[homestay] submit failed:", err);
    res.status(500).json({ success: false, error: "Failed to submit application" });
  }
});

// NOTE: Homestay is an admin-brokered MATCHING product (see
// docs/proposals/HOMESTAY_WORKFLOW.md) — host families are matched to students
// by the ops team, NOT browsed by the public. There is intentionally NO public
// host directory and homestay spaces are excluded from the public self-serve
// search (see routes/public.ts). Host profiles surface only inside the homestay
// matching tools (admin) and the student-facing matched proposal.

/* ═══════════════════════════════════════════════════════════════════════════
   HOST PORTAL — requireHomestayAuth (login works regardless of approval)
   ═══════════════════════════════════════════════════════════════════════════ */
export const homestayPortalRouter: IRouter = Router();
homestayPortalRouter.use("/v1/homestay", requireHomestayAuth);

async function loadMyApplication(partner: PartnerAuthPayload) {
  const [app] = await db.select().from(homestayHostApplicationsTable)
    .where(and(eq(homestayHostApplicationsTable.partner_user_id, partner.id), isNull(homestayHostApplicationsTable.deleted_at)))
    .limit(1);
  return app ?? null;
}

// Current host's application + status
homestayPortalRouter.get("/v1/homestay/me", async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  const docs = await db.select().from(documentsTable)
    .where(and(
      eq(documentsTable.entity_type, "HomestayHostApplication"),
      eq(documentsTable.entity_id, app.id),
      isNull(documentsTable.deleted_at),
    ));
  res.json({ success: true, application: publicView(app), documents: docs });
});

// Update own application (only while not yet approved/rejected)
homestayPortalRouter.put("/v1/homestay/me", async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  if (["Approved", "Rejected"].includes(app.status)) {
    res.status(409).json({ success: false, error: "Application is finalised and can no longer be edited" });
    return;
  }
  const updates = pickApplication(req.body as Record<string, unknown>);
  const [row] = await db.update(homestayHostApplicationsTable)
    .set(updates).where(eq(homestayHostApplicationsTable.id, app.id)).returning();
  res.json({ success: true, application: publicView(row!) });
});

// Upload a document (e.g. WWCC, ID, proof of residence, room photos)
homestayPortalRouter.post("/v1/homestay/documents", upload.single("file"), async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  const file = (req as any).file as { buffer: Buffer; originalname: string; size: number; mimetype: string } | undefined;
  if (!file) { res.status(400).json({ success: false, error: "file is required" }); return; }
  if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: "File storage not configured" }); return; }
  const doc_type = String((req.body as any).doc_type ?? "Other").slice(0, 32);

  const uploaded = await uploadToCloudinary(file.buffer, { folder: `homestay/${app.id}` });
  const [doc] = await db.insert(documentsTable).values({
    entity_type: "HomestayHostApplication",
    entity_id: app.id,
    doc_type,
    file_name: file.originalname.slice(0, 255),
    file_size: file.size,
    mime_type: file.mimetype.slice(0, 100),
    cloudinary_public_id: uploaded.public_id,
    uploaded_by: partner.id,
    uploaded_by_type: "PartnerUser",
  } as any).returning();

  // Mark any matching requested-doc as fulfilled.
  const requested = (app.requested_docs as Array<{ doc_type: string; fulfilled?: boolean }> | null) ?? [];
  if (requested.some((d) => d.doc_type === doc_type && !d.fulfilled)) {
    const next = requested.map((d) => d.doc_type === doc_type ? { ...d, fulfilled: true } : d);
    await db.update(homestayHostApplicationsTable).set({ requested_docs: next })
      .where(eq(homestayHostApplicationsTable.id, app.id));
  }
  res.status(201).json({ success: true, document: doc });
});

// Toggle public landing-page exposure — ONLY allowed once Approved.
homestayPortalRouter.post("/v1/homestay/landing/activate", async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  if (app.status !== "Approved") {
    res.status(403).json({ success: false, error: "Landing page can only be activated after approval" });
    return;
  }
  const active = req.body?.active !== false; // default true
  const [row] = await db.update(homestayHostApplicationsTable)
    .set({ landing_active: active }).where(eq(homestayHostApplicationsTable.id, app.id)).returning();
  // Toggle the host's homestay spaces Active/Inactive in lockstep (matching-tool
  // inventory; homestay is excluded from the public self-serve search regardless).
  try { await setHomestaySpacesActive(app.account_id, active); }
  catch (e) { console.error("[homestay] space activation toggle failed:", e); }
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: app.id, action: "UPDATE", actorId: partner.id, actorEmail: partner.email, newValue: { landing_active: active } });
  res.json({ success: true, landing_active: row!.landing_active });
});

// WWCC / insurance compliance — host may set/update any time.
homestayPortalRouter.put("/v1/homestay/compliance", async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  const b = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (Array.isArray(b.wwcc_records)) {
    updates.wwcc_records = b.wwcc_records.slice(0, 20).map((w: any) => ({
      name: String(w.name ?? "").slice(0, 120),
      wwcc_number: String(w.wwcc_number ?? "").slice(0, 60),
      expiry_date: w.expiry_date ?? null,
      verified: !!w.verified,
    }));
  }
  for (const k of ["insurance_provider", "insurance_policy_no", "insurance_expiry"]) {
    if (b[k] !== undefined) updates[k] = b[k] === "" ? null : String(b[k]).slice(0, 120);
  }
  if (!Object.keys(updates).length) { res.status(400).json({ success: false, error: "Nothing to update" }); return; }
  const [row] = await db.update(homestayHostApplicationsTable).set(updates)
    .where(eq(homestayHostApplicationsTable.id, app.id)).returning();
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: app.id, action: "UPDATE", actorId: partner.id, actorEmail: partner.email, newValue: { compliance: Object.keys(updates) } });
  res.json({ success: true, application: publicView(row!) });
});

// Bank payout details — collected only AFTER approval (sensitive PII).
homestayPortalRouter.put("/v1/homestay/bank", async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  if (app.status !== "Approved") {
    res.status(403).json({ success: false, error: "Bank details can only be added after approval" });
    return;
  }
  const b = req.body ?? {};
  const updates: Record<string, unknown> = {};
  for (const k of ["bank_name", "bank_account_name", "bank_bsb", "bank_account_number", "bank_swift"]) {
    if (b[k] !== undefined) updates[k] = b[k] === "" ? null : String(b[k]).slice(0, 120);
  }
  if (!Object.keys(updates).length) { res.status(400).json({ success: false, error: "Nothing to update" }); return; }
  const [row] = await db.update(homestayHostApplicationsTable).set(updates)
    .where(eq(homestayHostApplicationsTable.id, app.id)).returning();
  // Audit which bank fields changed — never log the values themselves (PII).
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: app.id, action: "UPDATE", actorId: partner.id, actorEmail: partner.email, newValue: { bank_updated: Object.keys(updates) } });
  res.json({ success: true, application: publicView(row!) });
});

// Finalise a Draft application → Submitted (requires agreement acceptance).
homestayPortalRouter.post("/v1/homestay/submit", async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const app = await loadMyApplication(partner);
  if (!app) { res.status(404).json({ success: false, error: "No application found" }); return; }
  if (app.status !== "Draft") {
    res.status(409).json({ success: false, error: "Only a Draft application can be submitted" });
    return;
  }
  if (!app.agreement_accepted && req.body?.agreement_accepted !== true) {
    res.status(400).json({ success: false, error: "You must accept the host agreement" });
    return;
  }
  const [row] = await db.update(homestayHostApplicationsTable)
    .set({ status: "Submitted", agreement_accepted: true, agreement_accepted_at: new Date(), signature_name: req.body?.signature_name ?? app.signature_name })
    .where(eq(homestayHostApplicationsTable.id, app.id)).returning();
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: app.id, action: "STATUS_CHANGE", actorId: partner.id, actorEmail: partner.email, newValue: { status: "Submitted" } });
  void sendHomestayHostEmail({ to: row!.email, toName: row!.first_name, applicationRef: row!.application_ref, kind: "received" })
    .catch((e) => console.error("[homestay] submit email failed:", e));
  res.json({ success: true, application: publicView(row!) });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN — requireAuth applied by the parent router (mounted in routes/index.ts)
   ═══════════════════════════════════════════════════════════════════════════ */
export const homestayAdminRouter: IRouter = Router();

homestayAdminRouter.get("/v1/homestay-applications", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const { limit, offset, page, q } = parsePageParams(req.query);
    const conds = [isNull(homestayHostApplicationsTable.deleted_at)];
    if (status && status !== "all") conds.push(eq(homestayHostApplicationsTable.status, status));
    if (q) conds.push(or(
      ilike(homestayHostApplicationsTable.first_name, `%${q}%`),
      ilike(homestayHostApplicationsTable.last_name, `%${q}%`),
      ilike(homestayHostApplicationsTable.email, `%${q}%`),
      ilike(homestayHostApplicationsTable.application_ref, `%${q}%`),
    )!);
    const whereExpr = and(...conds);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(homestayHostApplicationsTable)
      .where(whereExpr);
    const rows = await db.select().from(homestayHostApplicationsTable)
      .where(whereExpr)
      .orderBy(desc(homestayHostApplicationsTable.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ success: true, data: rows, meta: pageMeta(total ?? 0, { limit, offset, page }) });
  } catch (e) {
    console.error("[homestay-admin] list failed:", e);
    res.status(500).json({ error: "Failed to list applications" });
  }
});

homestayAdminRouter.get("/v1/homestay-applications/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [app] = await db.select().from(homestayHostApplicationsTable).where(eq(homestayHostApplicationsTable.id, id));
  if (!app) { res.status(404).json({ error: "Not found" }); return; }
  const docs = await db.select().from(documentsTable).where(and(
    eq(documentsTable.entity_type, "HomestayHostApplication"),
    eq(documentsTable.entity_id, id),
    isNull(documentsTable.deleted_at),
  ));
  res.json({ success: true, application: app, documents: docs });
});

async function setStatus(id: number, status: string, extra: Record<string, unknown>, reviewerId?: number) {
  const [row] = await db.update(homestayHostApplicationsTable)
    .set({ status, reviewed_by: reviewerId ?? null, reviewed_at: new Date(), ...extra })
    .where(eq(homestayHostApplicationsTable.id, id)).returning();
  return row ?? null;
}

homestayAdminRouter.post("/v1/homestay-applications/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reviewer = (req as any).user?.id;
  const row = await setStatus(id, "Approved", { approval_notes: req.body?.notes ?? null }, reviewer);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.partner_user_id) invalidatePartnerCache(row.partner_user_id);
  // Provision the host's property + homestay spaces (hidden until they activate
  // their landing page). Best-effort — never fail the approval on a listing error.
  try { await ensureHomestayListings(row); }
  catch (e) { console.error("[homestay] listing provisioning failed:", e); }
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: reviewer ?? null, newValue: { status: "Approved" } });
  void sendHomestayHostEmail({ to: row.email, toName: row.first_name, applicationRef: row.application_ref, kind: "approved" })
    .catch((e) => console.error("[homestay] approve email failed:", e));
  res.json({ success: true, application: row });
});

homestayAdminRouter.post("/v1/homestay-applications/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reviewer = (req as any).user?.id;
  const row = await setStatus(id, "Rejected", { approval_notes: req.body?.notes ?? null, landing_active: false }, reviewer);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  // Pull any previously-exposed homestay spaces off public search.
  try { await setHomestaySpacesActive(row.account_id, false); }
  catch (e) { console.error("[homestay] space deactivation failed:", e); }
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: reviewer ?? null, newValue: { status: "Rejected" } });
  void sendHomestayHostEmail({ to: row.email, toName: row.first_name, applicationRef: row.application_ref, kind: "rejected", note: req.body?.notes ?? null })
    .catch((e) => console.error("[homestay] reject email failed:", e));
  res.json({ success: true, application: row });
});

homestayAdminRouter.post("/v1/homestay-applications/:id/request-docs", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reviewer = (req as any).user?.id;
  const docs = Array.isArray(req.body?.docs) ? req.body.docs : [];
  if (!docs.length) { res.status(400).json({ error: "docs must be a non-empty array" }); return; }
  const requested_docs = docs.map((d: any) => ({
    doc_type: String(d.doc_type ?? d).slice(0, 32),
    note: d.note ?? null,
    requested_at: new Date().toISOString(),
    fulfilled: false,
  }));
  const row = await setStatus(id, "DocsRequested", { requested_docs }, reviewer);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: HOMESTAY_ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: reviewer ?? null, newValue: { status: "DocsRequested", requested: requested_docs.map((d: any) => d.doc_type) } });
  const noteText = requested_docs.map((d: any) => d.doc_type).join(", ");
  void sendHomestayHostEmail({ to: row.email, toName: row.first_name, applicationRef: row.application_ref, kind: "docs_requested", note: `Requested: ${noteText}` })
    .catch((e) => console.error("[homestay] docs email failed:", e));
  res.json({ success: true, application: row });
});

homestayAdminRouter.put("/v1/homestay-applications/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { id: _id, created_at, deleted_at, ...updates } = req.body ?? {};
  const [row] = await db.update(homestayHostApplicationsTable).set(updates)
    .where(eq(homestayHostApplicationsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, application: row });
});
