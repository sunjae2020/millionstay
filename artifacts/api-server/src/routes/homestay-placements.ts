// Homestay PLACEMENT — admin-brokered match → contract → payment spine.
//
// A placement links an Approved host family to a student request once ops picks a
// match. Lifecycle:
//   Proposed → HostAccepted → AwaitingPayment → Active → Ending → Completed
//   (+ Cancelled | Terminated)
// The placement contract is signed via the generic e-signature system
// (context_type='placement_contract'); a signed contract advances HostAccepted →
// AwaitingPayment (handled in routes/contract-signing.ts).
//
// Mounted behind requireAuth by routes/index.ts. Money columns are numeric →
// strings; wrap writes in String(), reads in Number().
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, ilike, sql } from "drizzle-orm";
import {
  db,
  homestayPlacementsTable,
  homestayPlacementPaymentsTable,
  homestayHostApplicationsTable,
  homestayStudentRequestsTable,
  homestayHostAvailabilityTable,
  paymentInfoTable,
  agentCommissionLedgerTable,
  accountsTable,
} from "@workspace/db";
import { Resend } from "resend";
import { generatePlacementRef } from "../lib/homestayRef.js";
import { formatPersonName } from "../lib/nameFormat.js";
import { createSigningRequest, signingBaseUrl, type SignerSpec } from "../services/contractSigning.js";
import { sendHomestayHostEmail } from "../lib/email.js";
import { notifyPlacementProposed, notifyPlacementActivated, notifyPaymentReminder } from "../lib/homestay/notify.js";
import { logAction } from "../utils/auditLog.js";
import { getStripe } from "./stripe.js";
import { getHomestayBillingSettings, saveHomestayBillingSettings, type HomestayBillingSettings } from "../lib/homestay/billingSettings.js";
import { resolveTemplate, renderString } from "../lib/documents/templateEngine.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { createBookingForPlacement } from "../lib/homestay/placementBooking.js";
import { createPlacementInvoice, createExtensionInvoice } from "../lib/homestay/placementInvoice.js";
import { createCommissionForPlacement, approveCommission, markCommissionPaid } from "../lib/homestay/commission.js";
import { postPlacementPaymentPaid } from "../lib/billing/gl";
import { createRentScheduleForPlacement } from "../lib/homestay/rentSchedule.js";

const ENTITY = "homestay_placement";

const PLACEMENT_STATUSES = [
  "Proposed", "HostAccepted", "AwaitingPayment", "Active", "Ending", "Completed", "Cancelled", "Terminated",
] as const;
type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

// Statuses that free the host's capacity (placement no longer occupies a room).
const RELEASING = new Set<PlacementStatus>(["Cancelled", "Terminated", "Completed"]);

export const homestayPlacementAdminRouter: IRouter = Router();

/** Adjust a host's occupied count (best-effort; only if an availability row exists). */
async function adjustOccupied(hostApplicationId: number, delta: number): Promise<void> {
  const [avail] = await db.select().from(homestayHostAvailabilityTable)
    .where(eq(homestayHostAvailabilityTable.host_application_id, hostApplicationId)).limit(1);
  if (!avail) return;
  const next = Math.max(0, (avail.occupied ?? 0) + delta);
  await db.update(homestayHostAvailabilityTable)
    .set({ occupied: next })
    .where(eq(homestayHostAvailabilityTable.id, avail.id));
}

/** Mirror placement status onto the linked student request's ops queue. */
async function syncStudentStatus(studentRequestId: number, placementStatus: PlacementStatus): Promise<void> {
  const map: Partial<Record<PlacementStatus, string>> = {
    Proposed: "Proposed",
    HostAccepted: "Confirmed",
    AwaitingPayment: "Confirmed",
    Active: "Placed",
    Completed: "Completed",
    Cancelled: "Matching",
    Terminated: "Matching",
  };
  const studentStatus = map[placementStatus];
  if (!studentStatus) return;
  await db.update(homestayStudentRequestsTable)
    .set({ status: studentStatus, updated_at: new Date() })
    .where(eq(homestayStudentRequestsTable.id, studentRequestId));
}

/** Enrich a placement row with host + student display fields for the admin UI. */
async function enrich(p: typeof homestayPlacementsTable.$inferSelect) {
  const [host] = await db.select().from(homestayHostApplicationsTable)
    .where(eq(homestayHostApplicationsTable.id, p.host_application_id)).limit(1);
  const [student] = await db.select().from(homestayStudentRequestsTable)
    .where(eq(homestayStudentRequestsTable.id, p.student_request_id)).limit(1);
  return {
    ...p,
    host_name: host ? formatPersonName(host.first_name, host.last_name) : null,
    host_email: host?.email ?? null,
    host_suburb: host?.suburb ?? null,
    student_name: student ? formatPersonName(student.student_first_name, student.student_last_name) : null,
    student_email: student?.student_email ?? student?.guardian_email ?? null,
    student_is_minor: student?.is_minor ?? false,
  };
}

// ── List ─────────────────────────────────────────────────────────────────────
homestayPlacementAdminRouter.get("/v1/homestay-placements", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const { limit, offset, page, q } = parsePageParams(req.query);
    const conds = [isNull(homestayPlacementsTable.deleted_at)];
    if (status && status !== "all") conds.push(eq(homestayPlacementsTable.status, status));
    if (q) conds.push(ilike(homestayPlacementsTable.placement_ref, `%${q}%`));
    const whereExpr = and(...conds);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(homestayPlacementsTable)
      .where(whereExpr);
    const rows = await db.select().from(homestayPlacementsTable)
      .where(whereExpr)
      .orderBy(desc(homestayPlacementsTable.created_at))
      .limit(limit)
      .offset(offset);
    const data = await Promise.all(rows.map(enrich));
    res.json({ success: true, data, meta: pageMeta(total ?? 0, { limit, offset, page }) });
  } catch (e) {
    console.error("[homestay-placements] list failed:", e);
    res.status(500).json({ error: "Failed to list placements" });
  }
});

// ── Detail ───────────────────────────────────────────────────────────────────
homestayPlacementAdminRouter.get("/v1/homestay-placements/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const payments = await db.select().from(homestayPlacementPaymentsTable)
    .where(eq(homestayPlacementPaymentsTable.placement_id, id))
    .orderBy(desc(homestayPlacementPaymentsTable.created_at));
  res.json({ success: true, placement: await enrich(row), payments });
});

// ── Create (Proposed) ────────────────────────────────────────────────────────
homestayPlacementAdminRouter.post("/v1/homestay-placements", async (req, res): Promise<void> => {
  try {
    const b = req.body as Record<string, any>;
    const host_application_id = Number(b.host_application_id);
    const student_request_id = Number(b.student_request_id);
    if (!host_application_id || !student_request_id) {
      res.status(400).json({ error: "host_application_id and student_request_id are required" });
      return;
    }
    const [host] = await db.select().from(homestayHostApplicationsTable)
      .where(eq(homestayHostApplicationsTable.id, host_application_id)).limit(1);
    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, student_request_id)).limit(1);
    if (!host || !student) { res.status(404).json({ error: "Host or student not found" }); return; }
    if (host.status !== "Approved") { res.status(409).json({ error: "Host family must be Approved before placement" }); return; }

    // Guard against an already-active placement for this student.
    const existing = await db.select().from(homestayPlacementsTable)
      .where(and(eq(homestayPlacementsTable.student_request_id, student_request_id), isNull(homestayPlacementsTable.deleted_at)));
    if (existing.some((p) => !["Cancelled", "Terminated", "Completed"].includes(p.status))) {
      res.status(409).json({ error: "This student already has an active placement" });
      return;
    }

    const now = new Date();
    const placement_ref = await generatePlacementRef();
    // Fees fall back to the global homestay-billing defaults when the caller
    // omits them, so the org standard (set once in Settings) is authoritative.
    const billing = await getHomestayBillingSettings();
    const [row] = await db.insert(homestayPlacementsTable).values({
      placement_ref,
      host_application_id,
      student_request_id,
      agent_account_id: b.agent_account_id ?? student.agent_account_id ?? null,
      status: "Proposed",
      move_in_date: b.move_in_date ?? null,
      move_out_date: b.move_out_date ?? null,
      placement_fee: String(b.placement_fee ?? billing.default_placement_fee),
      deposit: String(b.deposit ?? billing.default_deposit),
      monthly_fee: String(b.monthly_fee ?? "0"),
      currency: b.currency ?? "AUD",
      proposed_at: now,
    }).returning();

    await adjustOccupied(host_application_id, +1);
    await syncStudentStatus(student_request_id, "Proposed");

    // Auto-create the operational/financial booking spine for this match
    // (best-effort — a placement is still valid if the booking can't be made).
    let bookingId: number | null = null;
    try {
      bookingId = await createBookingForPlacement({ placement: row!, student, host });
    } catch (e) {
      console.error("[homestay] auto-booking failed:", e);
    }

    // Notify the host (best-effort).
    void sendHomestayHostEmail({
      to: host.email, toName: host.first_name, applicationRef: placement_ref, kind: "placement_proposed",
    }).catch((e) => console.error("[homestay-placements] host notify failed:", e));

    // Notify the student + guardian of the match (best-effort).
    void notifyPlacementProposed({
      studentEmail: student.student_email,
      guardianEmail: student.guardian_email,
      studentName: formatPersonName(student.student_first_name, student.student_last_name),
      placementRef: placement_ref,
    }).catch((e) => console.error("[homestay-placements] student notify failed:", e));

    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { placement_ref, status: "Proposed" } });
    res.status(201).json({ success: true, placement: { ...(await enrich(row!)), booking_id: bookingId } });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Duplicate placement" }); return; }
    console.error("[homestay-placements] create failed:", err);
    res.status(500).json({ error: "Failed to create placement" });
  }
});

// ── Host accepts the match ───────────────────────────────────────────────────
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/host-accept", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(homestayPlacementsTable)
    .set({ status: "HostAccepted", host_accepted_at: new Date(), updated_at: new Date() })
    .where(and(eq(homestayPlacementsTable.id, id), eq(homestayPlacementsTable.status, "Proposed")))
    .returning();
  if (!row) { res.status(409).json({ error: "Placement is not in Proposed state" }); return; }
  await syncStudentStatus(row.student_request_id, "HostAccepted");
  void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status: "HostAccepted" } });
  res.json({ success: true, placement: await enrich(row) });
});

// ── Generic status transition (ops) ──────────────────────────────────────────
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/status", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "").trim() as PlacementStatus;
  if (!PLACEMENT_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${PLACEMENT_STATUSES.join(", ")}` });
    return;
  }
  const [prev] = await db.select().from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, id)).limit(1);
  if (!prev) { res.status(404).json({ error: "Not found" }); return; }

  const set: Record<string, unknown> = { status, updated_at: new Date() };
  if (status === "Active" && !prev.confirmed_at) set.confirmed_at = new Date();
  const [row] = await db.update(homestayPlacementsTable).set(set)
    .where(eq(homestayPlacementsTable.id, id)).returning();

  // Release host capacity when the placement ends/cancels.
  if (RELEASING.has(status) && !RELEASING.has(prev.status as PlacementStatus)) {
    await adjustOccupied(row!.host_application_id, -1);
  }
  await syncStudentStatus(row!.student_request_id, status);
  void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status } });
  res.json({ success: true, placement: await enrich(row!) });
});

// ── Generate + send the placement contract for e-signature ───────────────────
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/contract", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (!["HostAccepted", "AwaitingPayment", "Proposed"].includes(row.status)) {
      res.status(409).json({ error: "Placement must be Proposed/HostAccepted before issuing the contract" });
      return;
    }
    const [host] = await db.select().from(homestayHostApplicationsTable)
      .where(eq(homestayHostApplicationsTable.id, row.host_application_id)).limit(1);
    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, row.student_request_id)).limit(1);
    if (!host || !student) { res.status(404).json({ error: "Host or student missing" }); return; }

    const signers: SignerSpec[] = [
      {
        role: "student",
        name: `${student.student_first_name} ${student.student_last_name}`.trim(),
        email: student.student_email ?? student.guardian_email ?? "",
        required: true,
      },
      { role: "host", name: `${host.first_name} ${host.last_name}`.trim(), email: host.email, required: true },
    ];
    if (student.is_minor) {
      signers.splice(1, 0, { role: "guardian", name: student.guardian_name ?? "Guardian", email: student.guardian_email ?? "", required: true });
    }

    const signing = await createSigningRequest({ contextType: "placement_contract", contextId: id, signers });
    void logAction({ entityType: ENTITY, entityId: id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { signing_request: signing.id, kind: "placement_contract" } });
    res.status(201).json({
      success: true,
      signing_token: signing.token,
      signing_url: `${signingBaseUrl()}/sign/${signing.token}`,
    });
  } catch (err) {
    console.error("[homestay-placements] contract failed:", err);
    res.status(500).json({ error: "Failed to create placement contract" });
  }
});

// ── Generate an itemized, booking-linked invoice from the placement ──────────
// Builds a Draft invoice + line items (placement fee, deposit, first month, and
// any priced placement services). Idempotent per placement (see lib).
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/invoice", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid placement id" }); return; }
    const invoice = await createPlacementInvoice(id);
    void logAction({ entityType: ENTITY, entityId: id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { invoice_id: invoice.id, invoice_ref: invoice.invoice_ref, kind: "placement_invoice" } });
    res.status(201).json({ success: true, invoice });
  } catch (err: any) {
    const msg = err?.message ?? "Failed to create placement invoice";
    if (/not found/i.test(msg)) { res.status(404).json({ error: msg }); return; }
    console.error("[homestay-placements] invoice failed:", err);
    res.status(500).json({ error: "Failed to create placement invoice" });
  }
});

// Extend a placement's stay and bill the extra period as an itemized,
// booking-linked invoice (weekly-equivalent of the monthly fee × extra weeks).
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/extend", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid placement id" }); return; }
    const newMoveOut = String(req.body?.new_move_out_date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newMoveOut)) { res.status(400).json({ error: "new_move_out_date must be YYYY-MM-DD" }); return; }
    const invoice = await createExtensionInvoice(id, newMoveOut);
    void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { extended_to: newMoveOut, invoice_id: invoice?.id ?? null } });
    res.status(201).json({ success: true, invoice });
  } catch (err: any) {
    const msg = err?.message ?? "Failed to extend placement";
    if (/not found/i.test(msg)) { res.status(404).json({ error: msg }); return; }
    if (/must be after|no move-in/i.test(msg)) { res.status(400).json({ error: msg }); return; }
    console.error("[homestay-placements] extend failed:", err);
    res.status(500).json({ error: "Failed to extend placement" });
  }
});

// ── Billing settings (global defaults) ───────────────────────────────────────
homestayPlacementAdminRouter.get("/v1/homestay-billing-settings", async (_req, res): Promise<void> => {
  res.json({ data: await getHomestayBillingSettings() });
});
homestayPlacementAdminRouter.put("/v1/homestay-billing-settings", async (req, res): Promise<void> => {
  try {
    const b = req.body as Partial<HomestayBillingSettings>;
    await saveHomestayBillingSettings({
      cycle_weeks: Number(b.cycle_weeks),
      default_method: b.default_method === "bank_transfer" ? "bank_transfer" : "card",
      surcharge_pct: Number(b.surcharge_pct),
      lead_days: Number(b.lead_days),
      default_placement_fee: Number(b.default_placement_fee),
      default_deposit: Number(b.default_deposit),
    });
    void logAction({ entityType: "homestay_billing_settings", entityId: 1, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: b });
    res.json({ data: await getHomestayBillingSettings() });
  } catch (err) {
    console.error("[homestay-placements] save billing settings failed:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// ── Per-placement billing override ───────────────────────────────────────────
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/billing", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const weeks = req.body?.billing_cycle_weeks;
  const method = req.body?.billing_method;
  const [row] = await db.update(homestayPlacementsTable).set({
    billing_cycle_weeks: weeks === null || weeks === undefined || weeks === "" ? null : Math.max(1, Math.min(52, Math.round(Number(weeks)))),
    billing_method: method === "card" || method === "bank_transfer" ? method : null,
    updated_at: new Date(),
  }).where(eq(homestayPlacementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, placement: await enrich(row) });
});

// ── Create a charge (PENDING — not sent) ─────────────────────────────────────
// Records a homestay_placement_payments row but does NOT collect payment. Ops
// (or the cron) creates pending charges; sending/collecting is a separate step
// (POST /homestay-placement-payments/:id/send). method/surcharge default to the
// global billing settings (+ per-placement override).
//   upfront base = placement_fee + deposit (requires AwaitingPayment)
//   monthly base = monthly_fee per cycle  (requires Active)
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/charge", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const kind = String(req.body?.kind ?? "upfront");
    if (!["upfront", "monthly"].includes(kind)) { res.status(400).json({ error: "kind must be upfront|monthly" }); return; }

    const [row] = await db.select().from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (kind === "upfront" && row.status !== "AwaitingPayment") {
      res.status(409).json({ error: "Upfront payment requires AwaitingPayment (sign the contract first)" }); return;
    }
    if (kind === "monthly" && row.status !== "Active") {
      res.status(409).json({ error: "Monthly charges require an Active placement" }); return;
    }

    const settings = await getHomestayBillingSettings();
    const method = ["card", "bank_transfer"].includes(String(req.body?.method))
      ? String(req.body.method)
      : (row.billing_method || settings.default_method);

    const base = kind === "upfront" ? Number(row.placement_fee) + Number(row.deposit) : Number(row.monthly_fee);
    if (!(base > 0)) { res.status(400).json({ error: "Nothing to charge for this kind" }); return; }
    const surcharge = method === "card" ? Math.round(base * (settings.surcharge_pct / 100) * 100) / 100 : 0;
    const total = Math.round((base + surcharge) * 100) / 100;
    const currency = row.currency || "AUD";

    let payment_info_id: number | null = null;
    let bank = null;
    if (method === "bank_transfer") {
      [bank] = await db.select().from(paymentInfoTable)
        .where(and(eq(paymentInfoTable.payment_type, "BankTransfer"), eq(paymentInfoTable.status, "Active"), isNull(paymentInfoTable.deleted_at)))
        .limit(1);
      payment_info_id = bank?.id ?? null;
    }

    const [pay] = await db.insert(homestayPlacementPaymentsTable).values({
      placement_id: id, kind, method, status: "pending",
      base_amount: String(base), surcharge_amount: String(surcharge), amount: String(total), currency,
      payment_info_id,
      period_start: req.body?.period_start ?? null, period_end: req.body?.period_end ?? null,
    }).returning();

    void logAction({ entityType: ENTITY, entityId: id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { payment_id: pay!.id, kind, method, base, surcharge, total } });
    res.status(201).json({ success: true, payment: pay, method, bank });
  } catch (err) {
    console.error("[homestay-placements] charge failed:", err);
    res.status(500).json({ error: "Failed to create charge" });
  }
});

// ── Send / collect a pending charge ──────────────────────────────────────────
//   card: create a Stripe Checkout link, email the student, return the URL.
//   bank_transfer: return the active bank account details to relay.
homestayPlacementAdminRouter.post("/v1/homestay-placement-payments/:paymentId/send", async (req, res): Promise<void> => {
  try {
    const paymentId = Number(req.params.paymentId);
    const [pay] = await db.select().from(homestayPlacementPaymentsTable).where(eq(homestayPlacementPaymentsTable.id, paymentId)).limit(1);
    if (!pay) { res.status(404).json({ error: "Charge not found" }); return; }
    if (pay.status !== "pending") { res.status(409).json({ error: "Charge is not pending" }); return; }
    const [row] = await db.select().from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, pay.placement_id)).limit(1);
    if (!row) { res.status(404).json({ error: "Placement not found" }); return; }

    if (pay.method === "bank_transfer") {
      const [bank] = await db.select().from(paymentInfoTable)
        .where(and(eq(paymentInfoTable.payment_type, "BankTransfer"), eq(paymentInfoTable.status, "Active"), isNull(paymentInfoTable.deleted_at)))
        .limit(1);
      res.json({ success: true, method: "bank_transfer", bank: bank ?? null });
      return;
    }

    // card → Stripe Checkout link + email the student
    const stripe = getStripe();
    if (!stripe) { res.status(503).json({ error: "Stripe is not configured" }); return; }
    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, row.student_request_id)).limit(1);
    const studentEmail = student?.student_email || student?.guardian_email || null;
    const webBase = (process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com").replace(/\/+$/, "");
    const label = pay.kind === "upfront"
      ? `Homestay ${row.placement_ref} — deposit + placement fee (incl. card fee)`
      : `Homestay ${row.placement_ref} — rent ${pay.period_start ?? ""} (incl. card fee)`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: (pay.currency || "AUD").toLowerCase(), product_data: { name: label }, unit_amount: Math.round(Number(pay.amount) * 100) }, quantity: 1 }],
      metadata: { placement_payment_id: String(pay.id), placement_id: String(row.id), placement_ref: row.placement_ref, kind: pay.kind },
      customer_email: studentEmail || undefined,
      success_url: `${webBase}/payment-result?status=success&ref=${encodeURIComponent(row.placement_ref)}`,
      cancel_url: `${webBase}/payment-result?status=cancelled&ref=${encodeURIComponent(row.placement_ref)}`,
    });

    if (studentEmail && process.env.RESEND_API_KEY && session.url) {
      const vars = {
        ref: row.placement_ref,
        name: student ? `${student.student_first_name} ${student.student_last_name}`.trim() : "there",
        amount: `${pay.currency} ${Number(pay.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
        period: pay.period_start ?? "",
        pay_url: session.url,
      };
      const tpl = await resolveTemplate({ kind: "email", key: "homestay.payment_due", locale: "en" });
      const subject = tpl ? renderString(tpl.subject || `Homestay payment due (${row.placement_ref})`, vars) : `Homestay payment due (${row.placement_ref})`;
      const inner = tpl ? renderString(tpl.bodyHtml, vars)
        : `<p>Hi ${vars.name}, your homestay payment of <strong>${vars.amount}</strong> is due. <a href="${vars.pay_url}">Pay now</a>. Ref: ${vars.ref}.</p>`;
      const html = `<!DOCTYPE html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border:1px solid #eee;border-radius:14px;padding:28px;">${inner}</div></div></body></html>`;
      try { await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM ?? "MillionStay <noreply@contact.millionstay.com>", to: [studentEmail], subject, html }); } catch (e) { console.error("[homestay-placements] send email failed:", e); }
    }

    void logAction({ entityType: ENTITY, entityId: row.id, action: "PAYMENT", actorId: (req as any).user?.id ?? null, newValue: { payment_id: pay.id, sent: true, stripe_session: session.id } });
    res.json({ success: true, method: "card", url: session.url, emailed: !!studentEmail });
  } catch (err) {
    console.error("[homestay-placements] send charge failed:", err);
    res.status(500).json({ error: "Failed to send charge" });
  }
});

// ── Mark a bank-transfer charge as paid (ops) ────────────────────────────────
homestayPlacementAdminRouter.post("/v1/homestay-placement-payments/:paymentId/mark-paid", async (req, res): Promise<void> => {
  try {
    const paymentId = Number(req.params.paymentId);
    const now = new Date();
    const [pay] = await db.update(homestayPlacementPaymentsTable)
      .set({ status: "paid", paid_at: now })
      .where(and(eq(homestayPlacementPaymentsTable.id, paymentId), eq(homestayPlacementPaymentsTable.status, "pending")))
      .returning();
    if (!pay) { res.status(409).json({ error: "Charge not found or not pending" }); return; }
    // An upfront payment activates the placement (same as the card webhook).
    if (pay.kind === "upfront") {
      const [pl] = await db.update(homestayPlacementsTable)
        .set({ status: "Active", confirmed_at: now, updated_at: now })
        .where(and(eq(homestayPlacementsTable.id, pay.placement_id), eq(homestayPlacementsTable.status, "AwaitingPayment")))
        .returning();
      if (pl) {
        await db.update(homestayStudentRequestsTable).set({ status: "Placed", updated_at: now }).where(eq(homestayStudentRequestsTable.id, pl.student_request_id));
        if (!pl.next_billing_date && Number(pl.monthly_fee) > 0) {
          await db.update(homestayPlacementsTable).set({ next_billing_date: pl.move_in_date || now.toISOString().slice(0, 10) }).where(eq(homestayPlacementsTable.id, pl.id));
        }
        // Accrue the agent commission on activation (best-effort, idempotent).
        try { await createCommissionForPlacement(pl.id); } catch (e) { console.error("[homestay] commission accrual failed:", e); }
        // Set up unified monthly-rent billing on the booking (best-effort, idempotent).
        try { await createRentScheduleForPlacement(pl.id); } catch (e) { console.error("[homestay] rent schedule failed:", e); }
        // Notify the student + guardian of activation (best-effort).
        try {
          const [stu] = await db.select().from(homestayStudentRequestsTable)
            .where(eq(homestayStudentRequestsTable.id, pl.student_request_id)).limit(1);
          if (stu) {
            void notifyPlacementActivated({
              studentEmail: stu.student_email,
              guardianEmail: stu.guardian_email,
              studentName: formatPersonName(stu.student_first_name, stu.student_last_name),
              placementRef: pl.placement_ref,
              moveInDate: pl.move_in_date,
            }).catch((e) => console.error("[homestay-placements] activation notify failed:", e));
          }
        } catch (e) { console.error("[homestay-placements] activation notify load failed:", e); }
      }
    }
    // Book the payment to the GL (best-effort, idempotent). Deposit portion of an
    // upfront payment → Deposits Held (2100); remainder → revenue.
    {
      let deposit = 0;
      if (pay.kind === "upfront") {
        const [plDep] = await db.select({ deposit: homestayPlacementsTable.deposit }).from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, pay.placement_id)).limit(1);
        deposit = Number(plDep?.deposit ?? 0);
      }
      void postPlacementPaymentPaid({ paymentId: pay.id, kind: pay.kind, amount: Number(pay.amount), deposit, currency: pay.currency, paidAt: now.toISOString() });
    }
    void logAction({ entityType: ENTITY, entityId: pay.placement_id, action: "PAYMENT", actorId: (req as any).user?.id ?? null, newValue: { payment_id: paymentId, method: "bank_transfer", status: "paid" } });
    res.json({ success: true, payment: pay });
  } catch (err) {
    console.error("[homestay-placements] mark-paid failed:", err);
    res.status(500).json({ error: "Failed to mark paid" });
  }
});

// ── Payment reminder (ops-triggered) ─────────────────────────────────────────
// Emails the student (CC guardian) a reminder for the latest PENDING charge on a
// placement. Best-effort email; payUrl is omitted (regenerating a Stripe session
// is out of scope — this is purely a nudge). 404 if placement/charge missing.
homestayPlacementAdminRouter.post("/v1/homestay-placements/:id/payment-reminder", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid placement id" }); return; }
    const [pl] = await db.select().from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, id)).limit(1);
    if (!pl) { res.status(404).json({ error: "Placement not found" }); return; }

    const [charge] = await db.select().from(homestayPlacementPaymentsTable)
      .where(and(eq(homestayPlacementPaymentsTable.placement_id, id), eq(homestayPlacementPaymentsTable.status, "pending")))
      .orderBy(desc(homestayPlacementPaymentsTable.created_at))
      .limit(1);
    if (!charge) { res.status(404).json({ error: "No pending charge to remind about" }); return; }

    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, pl.student_request_id)).limit(1);

    const emailed = await notifyPaymentReminder({
      studentEmail: student?.student_email ?? null,
      guardianEmail: student?.guardian_email ?? null,
      studentName: student ? formatPersonName(student.student_first_name, student.student_last_name) : null,
      placementRef: pl.placement_ref,
      amount: Number(charge.amount),
      currency: charge.currency || "AUD",
    });

    void logAction({ entityType: ENTITY, entityId: id, action: "PAYMENT", actorId: (req as any).user?.id ?? null, newValue: { payment_id: charge.id, kind: "payment_reminder", emailed } });
    res.json({ success: true, emailed });
  } catch (err) {
    console.error("[homestay-placements] payment-reminder failed:", err);
    res.status(500).json({ error: "Failed to send payment reminder" });
  }
});

// ── Agent commission ledger (accrued on activation; Pending→Approved→Paid) ───
homestayPlacementAdminRouter.get("/v1/homestay-commissions", async (req, res): Promise<void> => {
  try {
    const statusFilter = typeof req.query["status"] === "string" ? String(req.query["status"]) : null;
    const rows = await db
      .select({
        id: agentCommissionLedgerTable.id,
        placement_id: agentCommissionLedgerTable.placement_id,
        agent_account_id: agentCommissionLedgerTable.agent_account_id,
        agent_name: accountsTable.name,
        base_amount: agentCommissionLedgerTable.base_amount,
        fixed_component: agentCommissionLedgerTable.fixed_component,
        percentage_component: agentCommissionLedgerTable.percentage_component,
        amount: agentCommissionLedgerTable.amount,
        currency: agentCommissionLedgerTable.currency,
        status: agentCommissionLedgerTable.status,
        approved_at: agentCommissionLedgerTable.approved_at,
        paid_at: agentCommissionLedgerTable.paid_at,
        created_at: agentCommissionLedgerTable.created_at,
      })
      .from(agentCommissionLedgerTable)
      .leftJoin(accountsTable, eq(accountsTable.id, agentCommissionLedgerTable.agent_account_id))
      .where(statusFilter ? eq(agentCommissionLedgerTable.status, statusFilter) : undefined)
      .orderBy(desc(agentCommissionLedgerTable.id));
    res.json({ data: rows });
  } catch (err) {
    console.error("[homestay-placements] list commissions failed:", err);
    res.status(500).json({ error: "Failed to list commissions" });
  }
});

homestayPlacementAdminRouter.post("/v1/homestay-commissions/:id/approve", async (req, res): Promise<void> => {
  const row = await approveCommission(Number(req.params.id));
  if (!row) { res.status(409).json({ error: "Commission not found or not Pending" }); return; }
  void logAction({ entityType: "homestay_commission", entityId: row.id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { status: "Approved" } });
  res.json({ success: true, commission: row });
});

homestayPlacementAdminRouter.post("/v1/homestay-commissions/:id/mark-paid", async (req, res): Promise<void> => {
  const row = await markCommissionPaid(Number(req.params.id));
  if (!row) { res.status(409).json({ error: "Commission not found or not Approved" }); return; }
  void logAction({ entityType: "homestay_commission", entityId: row.id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { status: "Paid" } });
  res.json({ success: true, commission: row });
});

// ── Cancel (soft) ────────────────────────────────────────────────────────────
homestayPlacementAdminRouter.delete("/v1/homestay-placements/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [prev] = await db.select().from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, id)).limit(1);
  if (!prev) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(homestayPlacementsTable)
    .set({ status: "Cancelled", deleted_at: new Date(), updated_at: new Date() })
    .where(eq(homestayPlacementsTable.id, id));
  if (!RELEASING.has(prev.status as PlacementStatus)) await adjustOccupied(prev.host_application_id, -1);
  await syncStudentStatus(prev.student_request_id, "Cancelled");
  void logAction({ entityType: ENTITY, entityId: id, action: "DELETE", actorId: (req as any).user?.id ?? null, newValue: { status: "Cancelled" } });
  res.json({ success: true });
});
