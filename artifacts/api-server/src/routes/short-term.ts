// Short-term accommodation application — public intake + admin ops queue.
//
// Mirrors the homestay STUDENT flow (routes/homestay-students.ts): a public
// submission creates a short_term_applications row, then a signing request
// (context_type='short_term_app') for the applicant to e-sign at /sign/:token.
// On submission we also send the applicant a "received" acknowledgment email
// (gated by Settings → Application Emails → short_term) and notify ops.
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { keywordCondition } from "../lib/listSearch";
import { db, shortTermApplicationsTable, usersTable } from "@workspace/db";
import { generateShortTermRef } from "../lib/homestayRef.js";
import { createSigningRequest, type SignerSpec } from "../services/contractSigning.js";
import { sendApplicationAck } from "../services/applicationDocs.js";
import { shortTermApplicationToDoc } from "../lib/documents/applicationPdf.js";
import { normalizeLang } from "../lib/documents/i18n.js";
import { sendLeadNotificationEmail } from "../lib/email.js";
import { logAction } from "../utils/auditLog.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { formatFirstName, formatLastName, formatPersonName } from "../lib/nameFormat.js";

const SHORT_TERM_ENTITY = "short_term_application";

// Ops queue states — parity with the student request queue, trimmed to the
// short-stay lifecycle (no matching step).
export const SHORT_TERM_STATUSES = [
  "Draft", "Submitted", "UnderReview", "Confirmed", "Placed", "Completed", "Cancelled", "Rejected",
] as const;

export const shortTermPublicRouter: IRouter = Router();

shortTermPublicRouter.post("/v1/public/short-term-applications", async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, any>;
    const first_name = formatFirstName(body.first_name);
    const last_name = formatLastName(body.last_name);
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!first_name || !last_name) {
      res.status(400).json({ success: false, error: "first_name and last_name are required" });
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ success: false, error: "A valid email is required" });
      return;
    }
    if (!body.terms_accepted) {
      res.status(400).json({ success: false, error: "You must accept the Terms & Conditions" });
      return;
    }

    const guests = body.guests !== undefined && body.guests !== null && body.guests !== ""
      ? Number(body.guests) : null;
    const prefsIn = body.preferences && typeof body.preferences === "object" ? body.preferences : {};
    const now = new Date();

    const request_ref = await generateShortTermRef();
    const [row] = await db.insert(shortTermApplicationsTable).values({
      request_ref,
      status: "Submitted",
      first_name,
      last_name,
      email,
      phone: body.phone ?? null,
      nationality: body.nationality ?? null,
      check_in: body.check_in ?? null,
      check_out: body.check_out ?? null,
      guests: guests != null && !Number.isNaN(guests) ? guests : null,
      preferred_area: body.preferred_area ?? null,
      property_type: body.property_type ?? null,
      preferences: prefsIn,
      terms_accepted: true,
      terms_accepted_at: now,
    }).returning();

    // E-signature request — the applicant draws their signature at /sign/:token.
    const applicantName = formatPersonName(first_name, last_name);
    const signers: SignerSpec[] = [
      { role: "applicant", name: applicantName, email, required: true },
    ];
    const signing = await createSigningRequest({ contextType: "short_term_app", contextId: row!.id, signers });

    // Applicant acknowledgment — gated by Settings → Application Emails (short_term).
    void sendApplicationAck({
      type: "short_term",
      to: email,
      toName: applicantName,
      appTypeLabel: "Short-term Accommodation Application",
      ref: request_ref,
      buildDoc: () => shortTermApplicationToDoc(row!, undefined, { signed: false, lang: normalizeLang(req.body?.lang) }),
    }).catch((e) => console.error("[short-term] ack email failed:", e));

    // Ops notification — best-effort, never blocks the response.
    const adminTo = process.env.LEAD_NOTIFICATION_EMAIL;
    if (adminTo) {
      void sendLeadNotificationEmail({
        leadRef: request_ref,
        inquiryType: "Short-term Accommodation Application",
        firstName: first_name,
        lastName: last_name,
        email,
        phone: body.phone ?? null,
        message: `New short-term accommodation application (${request_ref})`,
        description: null,
      }).catch((e) => console.error("[short-term] admin notify failed:", e));
    }

    res.status(201).json({ success: true, request_ref, signing_token: signing.token });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ success: false, error: "Duplicate entry" }); return; }
    console.error("[short-term] submit failed:", err);
    res.status(500).json({ success: false, error: "Failed to submit application" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN — ops review queue. requireAuth is applied by the parent router
   (mounted in routes/index.ts under /api/v1).
   ═══════════════════════════════════════════════════════════════════════════ */
export const shortTermAdminRouter: IRouter = Router();

shortTermAdminRouter.get("/v1/short-term-applications", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const { limit, offset, page, q } = parsePageParams(req.query);
    const conds = [isNull(shortTermApplicationsTable.deleted_at)];
    if (status && status !== "all") conds.push(eq(shortTermApplicationsTable.status, status));
    if (q) conds.push(keywordCondition(
      q,
      [
        shortTermApplicationsTable.email, shortTermApplicationsTable.phone,
        shortTermApplicationsTable.request_ref, shortTermApplicationsTable.nationality,
      ],
      [],
      [{ first: shortTermApplicationsTable.first_name, last: shortTermApplicationsTable.last_name }],
    ));
    const whereExpr = and(...conds);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(shortTermApplicationsTable)
      .where(whereExpr);
    const rows = await db.select().from(shortTermApplicationsTable)
      .where(whereExpr)
      .orderBy(desc(shortTermApplicationsTable.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ success: true, data: rows, meta: pageMeta(total ?? 0, { limit, offset, page }) });
  } catch (e) {
    console.error("[short-term-admin] list failed:", e);
    res.status(500).json({ error: "Failed to list short-term applications" });
  }
});

shortTermAdminRouter.get("/v1/short-term-applications/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(shortTermApplicationsTable)
    .where(eq(shortTermApplicationsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  let assigned_staff_name: string | null = null;
  if (row.assigned_staff_user_id != null) {
    const [u] = await db.select({ first_name: usersTable.first_name, last_name: usersTable.last_name })
      .from(usersTable).where(eq(usersTable.id, row.assigned_staff_user_id));
    if (u) assigned_staff_name = formatPersonName(u.first_name, u.last_name) || null;
  }
  res.json({ success: true, request: { ...row, assigned_staff_name } });
});

shortTermAdminRouter.post("/v1/short-term-applications/:id/status", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "").trim();
  if (!SHORT_TERM_STATUSES.includes(status as (typeof SHORT_TERM_STATUSES)[number])) {
    res.status(400).json({ error: `status must be one of: ${SHORT_TERM_STATUSES.join(", ")}` });
    return;
  }
  const reviewer = (req as any).user?.id;
  const set: Record<string, unknown> = { status, reviewed_by: reviewer ?? null, reviewed_at: new Date() };
  if (req.body?.notes !== undefined) set.notes = req.body.notes === "" ? null : String(req.body.notes);
  const [row] = await db.update(shortTermApplicationsTable).set(set)
    .where(eq(shortTermApplicationsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: SHORT_TERM_ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: reviewer ?? null, newValue: { status } });
  res.json({ success: true, request: row });
});
