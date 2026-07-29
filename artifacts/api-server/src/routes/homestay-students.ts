// Homestay STUDENT application — public intake (Phase 3).
//
// A student (or guardian, for under-18s) submits an application. We create a
// homestay_student_requests row, then a signing request (Phase 2 e-signature)
// for the student (+ guardian if minor) to e-sign the application / T&C. The
// applicant is redirected to /sign/:token to complete the signature. Matching
// is admin-brokered (Phase 5), so no portal login is created here.
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db, homestayStudentRequestsTable, homestayHostApplicationsTable, homestayHostAvailabilityTable, accountsTable, usersTable } from "@workspace/db";
import { generateStudentRef } from "../lib/homestayRef.js";
import { createSigningRequest, type SignerSpec } from "../services/contractSigning.js";
import { sendApplicationAck } from "../services/applicationDocs.js";
import { studentApplicationToDoc } from "../lib/documents/applicationPdf.js";
import { normalizeLang } from "../lib/documents/i18n.js";
import { sendLeadNotificationEmail } from "../lib/email.js";
import { logAction } from "../utils/auditLog.js";
import { rankHosts } from "../lib/homestay/matching.js";
import { attachRationales } from "../lib/homestay/matchRationale.js";
import { sendStudentPortalInvite } from "../lib/homestay/studentPortalInvite.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { formatFirstName, formatLastName } from "../lib/nameFormat.js";

const STUDENT_ENTITY = "homestay_student_request";

// Ops queue states (see schema + docs/proposals/HOMESTAY_WORKFLOW.md §6).
// Exported so the external API (Google Sheets integration) validates against the
// same single source of truth.
export const STUDENT_STATUSES = [
  "Draft", "Submitted", "UnderReview", "Matching", "Proposed",
  "Confirmed", "Placed", "Completed", "Cancelled", "Rejected",
] as const;

export const homestayStudentPublicRouter: IRouter = Router();

// Whole years between a YYYY-MM-DD date of birth and today. Returns null if the
// date is unparseable.
function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

homestayStudentPublicRouter.post("/v1/public/homestay-student-requests", async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, any>;
    const student_first_name = formatFirstName(body.student_first_name);
    const student_last_name = formatLastName(body.student_last_name);
    const date_of_birth = String(body.date_of_birth ?? "").trim();

    if (!student_first_name || !student_last_name || !date_of_birth) {
      res.status(400).json({ success: false, error: "student_first_name, student_last_name and date_of_birth are required" });
      return;
    }

    // Age is computed server-side (authoritative) — never trust the client flag.
    const age = ageFromDob(date_of_birth);
    if (age == null || age < 0 || age > 120) {
      res.status(400).json({ success: false, error: "A valid date of birth is required" });
      return;
    }
    const is_minor = age < 18;

    const guardian_name = String(body.guardian_name ?? "").trim();
    const guardian_email = String(body.guardian_email ?? "").trim().toLowerCase();
    if (is_minor && (!guardian_name || !guardian_email)) {
      res.status(400).json({ success: false, error: "Students under 18 must provide a guardian name and email" });
      return;
    }

    if (!body.terms_accepted) {
      res.status(400).json({ success: false, error: "You must accept the Terms & Conditions" });
      return;
    }

    const student_email = String(body.student_email ?? "").trim().toLowerCase() || null;
    const now = new Date();

    const request_ref = await generateStudentRef();
    const [row] = await db.insert(homestayStudentRequestsTable).values({
      request_ref,
      status: "Submitted",
      submitted_by: "student",
      student_first_name,
      student_last_name,
      student_email,
      student_phone: body.student_phone ?? null,
      date_of_birth,
      is_minor,
      gender: body.gender ?? null,
      nationality: body.nationality ?? null,
      guardian_name: is_minor ? guardian_name : (guardian_name || null),
      guardian_email: is_minor ? guardian_email : (guardian_email || null),
      guardian_phone: body.guardian_phone ?? null,
      guardian_relationship: body.guardian_relationship ?? null,
      guardian_consent_at: is_minor ? now : null,
      preferences: body.preferences && typeof body.preferences === "object" ? body.preferences : {},
      terms_accepted: true,
      terms_accepted_at: now,
    }).returning();

    // Signers: the student, plus the guardian for under-18s. The signer email
    // falls back to the guardian's when the student has none.
    const studentName = `${student_first_name} ${student_last_name}`.trim();
    const signers: SignerSpec[] = [
      { role: "student", name: studentName, email: student_email ?? guardian_email ?? "", required: true },
    ];
    if (is_minor) {
      signers.push({ role: "guardian", name: guardian_name, email: guardian_email, required: true });
    }
    const signing = await createSigningRequest({ contextType: "student_app", contextId: row!.id, signers });

    // Applicant acknowledgment — gated by Settings → Application Emails
    // (homestay_student). For minors the guardian's email is used as the
    // recipient when the student has none. Attaches the application PDF when
    // attach_pdf is enabled. Best-effort, never blocks the response.
    const ackTo = student_email ?? guardian_email;
    if (ackTo) {
      void sendApplicationAck({
        type: "homestay_student",
        to: ackTo,
        toName: is_minor ? (guardian_name || studentName) : studentName,
        appTypeLabel: "Student Application",
        ref: request_ref,
        buildDoc: () => studentApplicationToDoc(row!, undefined, { signed: false, lang: normalizeLang(req.body?.lang) }),
      }).catch((e) => console.error("[homestay-student] ack email failed:", e));
    }

    // Ops notification — best-effort, never blocks the response.
    const adminTo = process.env.LEAD_NOTIFICATION_EMAIL;
    if (adminTo) {
      void sendLeadNotificationEmail({
        leadRef: request_ref,
        inquiryType: "Homestay Student Application",
        firstName: student_first_name,
        lastName: student_last_name,
        email: student_email ?? guardian_email ?? "",
        phone: body.student_phone ?? null,
        message: `New homestay student application (${request_ref})${is_minor ? " — minor, guardian signature required" : ""}`,
        description: null,
      }).catch((e) => console.error("[homestay-student] admin notify failed:", e));
    }

    res.status(201).json({
      success: true,
      request_ref,
      is_minor,
      signing_token: signing.token,
    });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ success: false, error: "Duplicate entry" }); return; }
    console.error("[homestay-student] submit failed:", err);
    res.status(500).json({ success: false, error: "Failed to submit application" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN — ops review/matching queue. requireAuth is applied by the parent
   router (mounted in routes/index.ts under /api/v1). Mirrors the host
   application admin router in routes/homestay.ts.
   ═══════════════════════════════════════════════════════════════════════════ */
export const homestayStudentAdminRouter: IRouter = Router();

// List requests, newest first. Optional ?q= (ref/name/email) and ?status=.
homestayStudentAdminRouter.get("/v1/homestay-student-requests", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const { limit, offset, page, q } = parsePageParams(req.query);
    const conds = [isNull(homestayStudentRequestsTable.deleted_at)];
    if (status && status !== "all") conds.push(eq(homestayStudentRequestsTable.status, status));
    if (q) conds.push(or(
      ilike(homestayStudentRequestsTable.student_first_name, `%${q}%`),
      ilike(homestayStudentRequestsTable.student_last_name, `%${q}%`),
      ilike(homestayStudentRequestsTable.student_email, `%${q}%`),
      ilike(homestayStudentRequestsTable.request_ref, `%${q}%`),
    )!);
    const whereExpr = and(...conds);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(homestayStudentRequestsTable)
      .where(whereExpr);
    const rows = await db.select().from(homestayStudentRequestsTable)
      .where(whereExpr)
      .orderBy(desc(homestayStudentRequestsTable.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ success: true, data: rows, meta: pageMeta(total ?? 0, { limit, offset, page }) });
  } catch (e) {
    console.error("[homestay-student-admin] list failed:", e);
    res.status(500).json({ error: "Failed to list student requests" });
  }
});

// Single request (full record, incl. preferences JSONB). Augmented with
// human-readable names for the assignment fields (mapped agent account +
// assigned ops staff) so the UI can prefill the assignment pickers.
homestayStudentAdminRouter.get("/v1/homestay-student-requests/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(homestayStudentRequestsTable)
    .where(eq(homestayStudentRequestsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  let agent_account_name: string | null = null;
  if (row.agent_account_id != null) {
    const [acc] = await db.select({ name: accountsTable.name }).from(accountsTable)
      .where(eq(accountsTable.id, row.agent_account_id));
    agent_account_name = acc?.name ?? null;
  }

  let assigned_staff_name: string | null = null;
  if (row.assigned_staff_user_id != null) {
    const [u] = await db.select({ first_name: usersTable.first_name, last_name: usersTable.last_name })
      .from(usersTable).where(eq(usersTable.id, row.assigned_staff_user_id));
    if (u) assigned_staff_name = `${u.first_name} ${u.last_name}`.trim() || null;
  }

  res.json({ success: true, request: { ...row, agent_account_name, assigned_staff_name } });
});

// Advance the request through the ops queue + record ops notes. Stamps the
// reviewer/time on every transition.
homestayStudentAdminRouter.post("/v1/homestay-student-requests/:id/status", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "").trim();
  if (!STUDENT_STATUSES.includes(status as (typeof STUDENT_STATUSES)[number])) {
    res.status(400).json({ error: `status must be one of: ${STUDENT_STATUSES.join(", ")}` });
    return;
  }
  const reviewer = (req as any).user?.id;
  const set: Record<string, unknown> = { status, reviewed_by: reviewer ?? null, reviewed_at: new Date() };
  if (req.body?.notes !== undefined) set.notes = req.body.notes === "" ? null : String(req.body.notes);
  const [row] = await db.update(homestayStudentRequestsTable).set(set)
    .where(eq(homestayStudentRequestsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: STUDENT_ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: reviewer ?? null, newValue: { status } });
  res.json({ success: true, request: row });
});

// Assignment — map the application's agent to a real Agent account and assign an
// ops staff member. Only the fields present in the body are touched (undefined =
// leave as-is, null = clear).
homestayStudentAdminRouter.post("/v1/homestay-student-requests/:id/assignment", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;
  const set: Record<string, unknown> = {};
  if (body.agent_account_id !== undefined) {
    set.agent_account_id = body.agent_account_id === null ? null : Number(body.agent_account_id);
  }
  if (body.assigned_staff_user_id !== undefined) {
    set.assigned_staff_user_id = body.assigned_staff_user_id === null ? null : Number(body.assigned_staff_user_id);
  }
  if (Object.keys(set).length === 0) {
    res.status(400).json({ error: "No assignment fields provided" });
    return;
  }
  const actor = (req as any).user?.id;
  const [row] = await db.update(homestayStudentRequestsTable).set(set)
    .where(eq(homestayStudentRequestsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: STUDENT_ENTITY, entityId: id, action: "UPDATE", actorId: actor ?? null, newValue: { assignment: set } });
  res.json({ success: true, request: row });
});

// AI-assisted host recommendations (Phase 5b). Deterministic scoring engine
// filters + ranks approved hosts against the student's conditions; Claude adds a
// best-effort rationale per candidate. Read-only — generating suggestions has no
// side effects. ?limit=5 caps the shortlist, ?rationale=0 skips the LLM call.
homestayStudentAdminRouter.get("/v1/homestay-student-requests/:id/host-suggestions", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
    const wantRationale = String(req.query.rationale ?? "1") !== "0";

    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, id));
    if (!student) { res.status(404).json({ error: "Not found" }); return; }

    // Approved, non-deleted hosts + their availability row (left join — a host
    // with no availability row is treated as available by the matching engine).
    const rows = await db.select({
      host: homestayHostApplicationsTable,
      availability: homestayHostAvailabilityTable,
    })
      .from(homestayHostApplicationsTable)
      .leftJoin(
        homestayHostAvailabilityTable,
        eq(homestayHostAvailabilityTable.host_application_id, homestayHostApplicationsTable.id),
      )
      .where(and(
        eq(homestayHostApplicationsTable.status, "Approved"),
        isNull(homestayHostApplicationsTable.deleted_at),
      ));

    const ranked = rankHosts(student, rows).slice(0, limit);
    const { suggestions, ai_used } = wantRationale
      ? await attachRationales(student, ranked)
      : { suggestions: ranked, ai_used: false };

    // Read-only — no audit entry (audit log is reserved for mutations).
    res.json({ success: true, suggestions, ai_used });
  } catch (err) {
    console.error("[homestay-student-admin] host-suggestions failed:", err);
    res.status(500).json({ error: "Failed to generate host suggestions" });
  }
});

// Student portal login provisioning (ops-triggered). Provisions (or reuses) a
// guest_users login for the placed student and emails a set-password link,
// reusing the existing guest password-reset token flow. The student can then
// access the guest portal (/portal/*) to view their booking, invoices and
// payments. Requires the student to have an email and an account_id (set when
// the placement/booking is created).
homestayStudentAdminRouter.post("/v1/homestay-student-requests/:id/portal-invite", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const actor = (req as any).user?.id;
  try {
    const result = await sendStudentPortalInvite(id);
    void logAction({ entityType: STUDENT_ENTITY, entityId: id, action: "UPDATE", actorId: actor ?? null, newValue: { portal_invite: true } });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send portal invite";
    if (/not found/i.test(msg)) {
      res.status(404).json({ success: false, error: msg });
      return;
    }
    if (/no email|no account/i.test(msg)) {
      res.status(400).json({ success: false, error: msg });
      return;
    }
    console.error("[homestay-student-admin] portal-invite failed:", err);
    res.status(500).json({ success: false, error: "Failed to send portal invite" });
  }
});
