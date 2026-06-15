import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, and, gte, lte, isNull, inArray, desc, sql, type SQL } from "drizzle-orm";
import {
  db,
  bookingsTable,
  spacesTable,
  spaceAvailabilityTable,
  contractProductsTable,
  tasksTable,
  homestayStudentRequestsTable,
} from "@workspace/db";
import { requireApiKey, requireScope, type ApiClient } from "../middlewares/requireApiKey";
import { logAction } from "../utils/auditLog";
import { STUDENT_STATUSES } from "./homestay-students";
import { generateStudentRef } from "../lib/homestayRef";
import { formatFirstName, formatLastName } from "../lib/nameFormat";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXTERNAL API — mounted at /api/ext/v1
//
// Authenticated with an issued API Key + Secret (see requireApiKey). Every route
// declares the scope it needs. Response shapes are deliberately curated and
// stable — they are NOT the internal admin shapes and must stay backwards
// compatible for third-party consumers.
// ─────────────────────────────────────────────────────────────────────────────
const router: IRouter = Router();

// Every /ext/v1 route requires a valid credential first.
router.use(requireApiKey);

function genBookingRef(): string {
  return `EXT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// ─── Bookings ────────────────────────────────────────────────────────────────

function bookingView(r: typeof bookingsTable.$inferSelect) {
  return {
    id: r.id,
    booking_ref: r.booking_ref,
    name: r.name,
    booking_status: r.booking_status,
    space_id: r.space_id,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    stay_nights: r.stay_nights,
    num_guests: r.num_guests,
    agreed_weekly_rate: r.agreed_weekly_rate,
    total_rent: r.total_rent,
    currency: r.currency,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

router.get("/v1/bookings", requireScope("bookings:read"), async (req, res): Promise<void> => {
  const conds: SQL[] = [isNull(bookingsTable.deleted_at)];
  const { booking_status, space_id, check_in_from, check_in_to } = req.query;
  if (typeof booking_status === "string") conds.push(eq(bookingsTable.booking_status, booking_status));
  if (typeof space_id === "string" && space_id) conds.push(eq(bookingsTable.space_id, Number(space_id)));
  if (typeof check_in_from === "string") conds.push(gte(bookingsTable.check_in_date, check_in_from));
  if (typeof check_in_to === "string") conds.push(lte(bookingsTable.check_in_date, check_in_to));

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(and(...conds))
    .orderBy(desc(bookingsTable.created_at))
    .limit(200);
  res.json(rows.map(bookingView));
});

router.get("/v1/bookings/:id", requireScope("bookings:read"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const [row] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, id), isNull(bookingsTable.deleted_at)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(bookingView(row));
});

router.post("/v1/bookings", requireScope("bookings:write"), async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (b.space_id !== undefined && !Number.isInteger(Number(b.space_id))) {
    res.status(400).json({ error: "space_id must be an integer" });
    return;
  }
  const [row] = await db
    .insert(bookingsTable)
    .values({
      booking_ref: genBookingRef(),
      name: typeof b.name === "string" ? b.name : null,
      space_id: b.space_id != null ? Number(b.space_id) : null,
      check_in_date: typeof b.check_in_date === "string" ? b.check_in_date : null,
      check_out_date: typeof b.check_out_date === "string" ? b.check_out_date : null,
      num_guests: b.num_guests != null ? Number(b.num_guests) : 1,
      agreed_weekly_rate: b.agreed_weekly_rate != null ? String(b.agreed_weekly_rate) : null,
      currency: typeof b.currency === "string" ? b.currency : "AUD",
      customer_notes: typeof b.customer_notes === "string" ? b.customer_notes : null,
      booking_status: typeof b.booking_status === "string" ? b.booking_status : "Draft",
      booking_source: "external_api",
    })
    .returning();
  res.status(201).json(bookingView(row!));
});

router.patch("/v1/bookings/:id", requireScope("bookings:write"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const b = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (typeof b.booking_status === "string") updates.booking_status = b.booking_status;
  if (typeof b.name === "string") updates.name = b.name;
  if (typeof b.check_in_date === "string") updates.check_in_date = b.check_in_date;
  if (typeof b.check_out_date === "string") updates.check_out_date = b.check_out_date;
  if (b.num_guests != null) updates.num_guests = Number(b.num_guests);
  if (b.agreed_weekly_rate != null) updates.agreed_weekly_rate = String(b.agreed_weekly_rate);
  if (typeof b.customer_notes === "string") updates.customer_notes = b.customer_notes;

  const [row] = await db
    .update(bookingsTable)
    .set(updates)
    .where(and(eq(bookingsTable.id, id), isNull(bookingsTable.deleted_at)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(bookingView(row));
});

// ─── Spaces & availability ───────────────────────────────────────────────────

router.get("/v1/spaces", requireScope("availability:read"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      space_type: spacesTable.space_type,
      max_occupancy: spacesTable.max_occupancy,
      booking_mode: spacesTable.booking_mode,
      property_id: spacesTable.property_id,
      status: spacesTable.status,
    })
    .from(spacesTable)
    .where(isNull(spacesTable.deleted_at))
    .orderBy(spacesTable.name)
    .limit(500);
  res.json(rows);
});

router.get("/v1/spaces/:id/availability", requireScope("availability:read"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const conds: SQL[] = [eq(spaceAvailabilityTable.space_id, id)];
  const { from, to } = req.query;
  if (typeof from === "string") conds.push(gte(spaceAvailabilityTable.date, from));
  if (typeof to === "string") conds.push(lte(spaceAvailabilityTable.date, to));

  const rows = await db
    .select({
      date: spaceAvailabilityTable.date,
      is_available: spaceAvailabilityTable.is_available,
      block_reason: spaceAvailabilityTable.block_reason,
      source: spaceAvailabilityTable.source,
    })
    .from(spaceAvailabilityTable)
    .where(and(...conds))
    .orderBy(spaceAvailabilityTable.date);
  res.json({ space_id: id, availability: rows });
});

function parseDates(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: string[] = [];
  for (const d of input) {
    if (typeof d !== "string" || Number.isNaN(new Date(d).getTime())) return null;
    out.push(d);
  }
  return out;
}

router.post("/v1/spaces/:id/availability/block", requireScope("availability:write"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const dates = parseDates(req.body?.dates);
  if (!dates) { res.status(400).json({ error: "dates must be a non-empty array of YYYY-MM-DD strings" }); return; }
  const reason = typeof req.body?.block_reason === "string" ? req.body.block_reason : "Blocked via API";

  for (const date of dates) {
    await db
      .insert(spaceAvailabilityTable)
      .values({ space_id: id, date, is_available: false, block_reason: reason, source: "channel_api" })
      .onConflictDoUpdate({
        target: [spaceAvailabilityTable.space_id, spaceAvailabilityTable.date],
        set: { is_available: false, block_reason: reason, source: "channel_api" },
      });
  }
  res.json({ space_id: id, blocked: dates });
});

router.post("/v1/spaces/:id/availability/unblock", requireScope("availability:write"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const dates = parseDates(req.body?.dates);
  if (!dates) { res.status(400).json({ error: "dates must be a non-empty array of YYYY-MM-DD strings" }); return; }

  await db
    .update(spaceAvailabilityTable)
    .set({ is_available: true, block_reason: null, source: "channel_api" })
    .where(and(eq(spaceAvailabilityTable.space_id, id), inArray(spaceAvailabilityTable.date, dates)));
  res.json({ space_id: id, unblocked: dates });
});

// ─── Pricing ─────────────────────────────────────────────────────────────────

router.get("/v1/pricing", requireScope("pricing:read"), async (req, res): Promise<void> => {
  const conds: SQL[] = [isNull(contractProductsTable.deleted_at)];
  const { space_id } = req.query;
  if (typeof space_id === "string" && space_id) conds.push(eq(contractProductsTable.space_id, Number(space_id)));

  const rows = await db
    .select({
      id: contractProductsTable.id,
      name: contractProductsTable.name,
      space_id: contractProductsTable.space_id,
      product_type: contractProductsTable.product_type,
      status: contractProductsTable.status,
      weekly_rate: contractProductsTable.weekly_rate,
      monthly_rate: contractProductsTable.monthly_rate,
      effective_weekly_rate: contractProductsTable.effective_weekly_rate,
      currency: contractProductsTable.currency,
      bond_amount: contractProductsTable.bond_amount,
      cleaning_fee: contractProductsTable.cleaning_fee,
      admin_fee: contractProductsTable.admin_fee,
      min_stay_weeks: contractProductsTable.min_stay_weeks,
      max_stay_weeks: contractProductsTable.max_stay_weeks,
    })
    .from(contractProductsTable)
    .where(and(...conds))
    .orderBy(contractProductsTable.name)
    .limit(500);
  res.json(rows);
});

// ─── Tasks (work progress) ───────────────────────────────────────────────────

function taskView(r: typeof tasksTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    task_status: r.task_status,
    priority: r.priority,
    task_category: r.task_category,
    booking_id: r.booking_id,
    start_date: r.start_date,
    due_date: r.due_date,
    completed_at: r.completed_at,
    description: r.description,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

router.get("/v1/tasks", requireScope("tasks:read"), async (req, res): Promise<void> => {
  const conds: SQL[] = [isNull(tasksTable.deleted_at)];
  const { task_status, booking_id } = req.query;
  if (typeof task_status === "string") conds.push(eq(tasksTable.task_status, task_status));
  if (typeof booking_id === "string" && booking_id) conds.push(eq(tasksTable.booking_id, Number(booking_id)));

  const rows = await db
    .select()
    .from(tasksTable)
    .where(and(...conds))
    .orderBy(desc(tasksTable.created_at))
    .limit(200);
  res.json(rows.map(taskView));
});

router.get("/v1/tasks/:id", requireScope("tasks:read"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const [row] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), isNull(tasksTable.deleted_at)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(taskView(row));
});

router.post("/v1/tasks", requireScope("tasks:write"), async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (typeof b.name !== "string" || !b.name.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db
    .insert(tasksTable)
    .values({
      name: b.name.trim(),
      subject: typeof b.subject === "string" ? b.subject : null,
      description: typeof b.description === "string" ? b.description : null,
      task_status: typeof b.task_status === "string" ? b.task_status : "Todo",
      priority: typeof b.priority === "string" ? b.priority : "Medium",
      task_category: typeof b.task_category === "string" ? b.task_category : null,
      booking_id: b.booking_id != null ? Number(b.booking_id) : null,
      due_date: typeof b.due_date === "string" ? b.due_date : null,
      manual_input: true,
    })
    .returning();
  res.status(201).json(taskView(row!));
});

router.patch("/v1/tasks/:id", requireScope("tasks:write"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "invalid id" }); return; }
  const b = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (typeof b.task_status === "string") {
    updates.task_status = b.task_status;
    // Stamp completion time when the external app marks a task Done.
    if (b.task_status === "Done") updates.completed_at = new Date();
  }
  if (typeof b.priority === "string") updates.priority = b.priority;
  if (typeof b.subject === "string") updates.subject = b.subject;
  if (typeof b.description === "string") updates.description = b.description;
  if (typeof b.due_date === "string") updates.due_date = b.due_date;

  const [row] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, id), isNull(tasksTable.deleted_at)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(taskView(row));
});

// ─── Homestay student requests (Google Sheets integration) ───────────────────
//
// A bound Google Apps Script keeps an ops spreadsheet in sync:
//   • homestay:read  — pull the request list to seed/refresh the sheet
//   • homestay:write — push an edited row back (status + ops notes only)
// Student/guardian PII is intentionally NOT writable from the sheet — only the
// ops-managed fields (status, notes) round-trip. Matching by request_ref keeps
// the sheet's human-readable column as the join key.

const STUDENT_ENTITY = "homestay_student_request";

function studentRequestView(r: typeof homestayStudentRequestsTable.$inferSelect) {
  const prefs = (r.preferences ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    request_ref: r.request_ref,
    status: r.status,
    student_first_name: r.student_first_name,
    student_last_name: r.student_last_name,
    student_email: r.student_email,
    student_phone: r.student_phone,
    nationality: r.nationality,
    is_minor: r.is_minor,
    // A curated, read-only slice of preferences so the sheet has useful context.
    suburb: prefs.suburb ?? null,
    school: prefs.school ?? null,
    move_in_date: prefs.move_in_date ?? null,
    duration_weeks: prefs.duration_weeks ?? null,
    // Round-trippable ops fields.
    notes: r.notes,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

router.get("/v1/homestay-student-requests", requireScope("homestay:read"), async (req, res): Promise<void> => {
  const conds: SQL[] = [isNull(homestayStudentRequestsTable.deleted_at)];
  const { status } = req.query;
  if (typeof status === "string" && status && status !== "all") {
    conds.push(eq(homestayStudentRequestsTable.status, status));
  }
  const rows = await db
    .select()
    .from(homestayStudentRequestsTable)
    .where(and(...conds))
    .orderBy(desc(homestayStudentRequestsTable.created_at))
    .limit(500);
  res.json(rows.map(studentRequestView));
});

router.patch("/v1/homestay-student-requests/by-ref/:ref", requireScope("homestay:write"), async (req, res): Promise<void> => {
  const ref = String(req.params.ref ?? "").trim();
  if (!ref) { res.status(400).json({ error: "request_ref is required" }); return; }

  const b = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date() };
  let statusChange: string | null = null;

  if (b.status !== undefined) {
    const status = String(b.status).trim();
    if (!STUDENT_STATUSES.includes(status as (typeof STUDENT_STATUSES)[number])) {
      res.status(400).json({ error: `status must be one of: ${STUDENT_STATUSES.join(", ")}` });
      return;
    }
    updates.status = status;
    updates.reviewed_at = new Date();
    statusChange = status;
  }
  if (b.notes !== undefined) updates.notes = b.notes === "" || b.notes === null ? null : String(b.notes);

  // Only updated_at present → nothing editable was supplied.
  if (Object.keys(updates).length === 1) {
    res.status(400).json({ error: "Nothing to update — supply 'status' and/or 'notes'" });
    return;
  }

  const [row] = await db
    .update(homestayStudentRequestsTable)
    .set(updates)
    .where(and(eq(homestayStudentRequestsTable.request_ref, ref), isNull(homestayStudentRequestsTable.deleted_at)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const client = (req as any).apiClient as ApiClient | undefined;
  void logAction({
    entityType: STUDENT_ENTITY,
    entityId: row.id,
    action: statusChange ? "STATUS_CHANGE" : "UPDATE",
    actorId: null,
    actorEmail: `integration:google_sheets${client ? `:${client.name}` : ""}`,
    newValue: { status: updates.status, notes: updates.notes },
  });

  res.json(studentRequestView(row));
});

// Whole years between a YYYY-MM-DD date of birth and today (null if unparseable).
function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Create a homestay student request from an external source (Google Sheets
// import of Time Study applications). UNLIKE the public intake endpoint, this
// has NO side effects — no e-signature request, no notification email. It is an
// admin-side bulk import: status "Submitted", submitted_by "agent". Idempotent
// via `external_ref` (stored at preferences.import.ref) so re-running the sheet
// push never creates duplicates.
router.post("/v1/homestay-student-requests", requireScope("homestay:write"), async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const first = formatFirstName(b.student_first_name);
  const last = formatLastName(b.student_last_name);
  if (!first || !last) {
    res.status(400).json({ error: "student_first_name and student_last_name are required" });
    return;
  }

  const externalRef = b.external_ref != null ? String(b.external_ref).trim() : "";
  const client = (req as any).apiClient as ApiClient | undefined;

  // Idempotency — skip if a request was already imported with this external_ref.
  if (externalRef) {
    const [dup] = await db
      .select({ id: homestayStudentRequestsTable.id, request_ref: homestayStudentRequestsTable.request_ref })
      .from(homestayStudentRequestsTable)
      .where(and(
        isNull(homestayStudentRequestsTable.deleted_at),
        sql`${homestayStudentRequestsTable.preferences} -> 'import' ->> 'ref' = ${externalRef}`,
      ))
      .limit(1);
    if (dup) { res.json({ created: false, duplicate: true, id: dup.id, request_ref: dup.request_ref }); return; }
  }

  const dob = String(b.date_of_birth ?? "").trim();
  const age = dob ? ageFromDob(dob) : null;
  const is_minor = age != null && age >= 0 && age < 18;

  const basePrefs = b.preferences && typeof b.preferences === "object" ? b.preferences : {};
  // Referring agent name (sheet "Agent name") — stored in the SAME shape the
  // public student form uses (`preferences.agent = { agent_name, ... }`) so the
  // admin list renders it uniformly. Explicit body field wins over any nested
  // `preferences.agent`.
  const agentName = b.agent != null ? String(b.agent).trim() : "";
  const preferences = {
    ...basePrefs,
    ...(agentName ? { agent: { ...(typeof (basePrefs as any).agent === "object" ? (basePrefs as any).agent : {}), agent_name: agentName } } : {}),
    import: { source: "google_sheets", ref: externalRef || null, client: client?.name ?? null },
  };

  const request_ref = await generateStudentRef();
  const [row] = await db.insert(homestayStudentRequestsTable).values({
    request_ref,
    status: "Submitted",
    submitted_by: "agent",
    student_first_name: first,
    student_last_name: last,
    student_email: String(b.student_email ?? "").trim().toLowerCase() || null,
    student_phone: b.student_phone ? String(b.student_phone) : null,
    date_of_birth: dob || null,
    is_minor,
    gender: b.gender ? String(b.gender) : null,
    nationality: b.nationality ? String(b.nationality) : null,
    guardian_name: b.guardian_name ? String(b.guardian_name) : null,
    guardian_email: b.guardian_email ? String(b.guardian_email).trim().toLowerCase() : null,
    guardian_phone: b.guardian_phone ? String(b.guardian_phone) : null,
    guardian_relationship: b.guardian_relationship ? String(b.guardian_relationship) : null,
    preferences,
    terms_accepted: false,
  }).returning();

  void logAction({
    entityType: STUDENT_ENTITY,
    entityId: row!.id,
    action: "CREATE",
    actorId: null,
    actorEmail: `integration:google_sheets${client ? `:${client.name}` : ""}`,
    newValue: { request_ref, external_ref: externalRef || null },
  });

  res.status(201).json({ created: true, id: row!.id, request_ref });
});

export default router;
