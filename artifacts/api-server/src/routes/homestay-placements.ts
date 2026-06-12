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
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  homestayPlacementsTable,
  homestayHostApplicationsTable,
  homestayStudentRequestsTable,
  homestayHostAvailabilityTable,
} from "@workspace/db";
import { generatePlacementRef } from "../lib/homestayRef.js";
import { createSigningRequest, signingBaseUrl, type SignerSpec } from "../services/contractSigning.js";
import { sendHomestayHostEmail } from "../lib/email.js";
import { logAction } from "../utils/auditLog.js";

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
    host_name: host ? `${host.first_name} ${host.last_name}`.trim() : null,
    host_email: host?.email ?? null,
    host_suburb: host?.suburb ?? null,
    student_name: student ? `${student.student_first_name} ${student.student_last_name}`.trim() : null,
    student_email: student?.student_email ?? student?.guardian_email ?? null,
    student_is_minor: student?.is_minor ?? false,
  };
}

// ── List ─────────────────────────────────────────────────────────────────────
homestayPlacementAdminRouter.get("/v1/homestay-placements", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const conds = [isNull(homestayPlacementsTable.deleted_at)];
    if (status && status !== "all") conds.push(eq(homestayPlacementsTable.status, status));
    const rows = await db.select().from(homestayPlacementsTable)
      .where(and(...conds)).orderBy(desc(homestayPlacementsTable.created_at));
    const data = await Promise.all(rows.map(enrich));
    res.json({ success: true, data, meta: { total: data.length } });
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
  res.json({ success: true, placement: await enrich(row) });
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
    const [row] = await db.insert(homestayPlacementsTable).values({
      placement_ref,
      host_application_id,
      student_request_id,
      agent_account_id: b.agent_account_id ?? student.agent_account_id ?? null,
      status: "Proposed",
      move_in_date: b.move_in_date ?? null,
      move_out_date: b.move_out_date ?? null,
      placement_fee: String(b.placement_fee ?? "0"),
      deposit: String(b.deposit ?? "0"),
      monthly_fee: String(b.monthly_fee ?? "0"),
      currency: b.currency ?? "AUD",
      proposed_at: now,
    }).returning();

    await adjustOccupied(host_application_id, +1);
    await syncStudentStatus(student_request_id, "Proposed");

    // Notify the host (best-effort).
    void sendHomestayHostEmail({
      to: host.email, toName: host.first_name, applicationRef: placement_ref, kind: "placement_proposed",
    }).catch((e) => console.error("[homestay-placements] host notify failed:", e));

    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { placement_ref, status: "Proposed" } });
    res.status(201).json({ success: true, placement: await enrich(row!) });
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
