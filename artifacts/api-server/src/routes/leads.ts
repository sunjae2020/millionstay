import { Router, type IRouter } from "express";
import { eq, ilike, and, or, isNull, inArray, SQL } from "drizzle-orm";
import { db, leadsTable, suburbsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  ListLeadsQueryParams,
  CreateLeadBody,
  GetLeadParams,
  UpdateLeadParams,
  UpdateLeadBody,
  DeleteLeadParams,
  ConvertLeadBody,
} from "@workspace/api-zod";
import { insertLeadWithGeneratedRef } from "../lib/leadRef.js";
import { formatFirstName, formatLastName } from "../lib/nameFormat.js";

import { keywordCondition } from "../lib/listSearch";
const router: IRouter = Router();

/** Canonical person-name casing on write — see lib/nameFormat.ts. */
function normalizeNames<T extends { first_name?: string | null; last_name?: string | null }>(data: T): T {
  const out = { ...data };
  if (typeof out.first_name === "string") out.first_name = formatFirstName(out.first_name);
  if (typeof out.last_name === "string") out.last_name = formatLastName(out.last_name);
  return out;
}

router.get("/v1/leads", async (req, res): Promise<void> => {
  const parsed = ListLeadsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, lead_status, lead_source, nationality, preferred_space_type, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(leadsTable.deleted_at, req)];
  if (lead_status) conditions.push(eq(leadsTable.lead_status, lead_status));
  if (lead_source) conditions.push(eq(leadsTable.lead_source, lead_source));
  if (nationality) conditions.push(eq(leadsTable.nationality, nationality));
  if (preferred_space_type) conditions.push(eq(leadsTable.preferred_space_type, preferred_space_type));
  if (status) conditions.push(eq(leadsTable.status, status));
  // 이름·연락처에 더해 문의번호와 문의 내용으로도 찾는다.
  if (search) {
    conditions.push(keywordCondition(
      search,
      [
        leadsTable.email, leadsTable.phone, leadsTable.lead_ref,
        leadsTable.nationality, leadsTable.lead_source, leadsTable.message,
      ],
      [],
      [{ first: leadsTable.first_name, last: leadsTable.last_name }],
    ));
  }

  const rows = await db
    .select({
      id: leadsTable.id,
      lead_ref: leadsTable.lead_ref,
      first_name: leadsTable.first_name,
      last_name: leadsTable.last_name,
      email: leadsTable.email,
      phone: leadsTable.phone,
      nationality: leadsTable.nationality,
      lead_source: leadsTable.lead_source,
      lead_status: leadsTable.lead_status,
      inquiry_type: leadsTable.inquiry_type,
      message: leadsTable.message,
      preferred_space_type: leadsTable.preferred_space_type,
      preferred_check_in_date: leadsTable.preferred_check_in_date,
      preferred_duration_weeks: leadsTable.preferred_duration_weeks,
      preferred_suburb_id: leadsTable.preferred_suburb_id,
      budget_min: leadsTable.budget_min,
      budget_max: leadsTable.budget_max,
      budget_currency: leadsTable.budget_currency,
      converted_booking_id: leadsTable.converted_booking_id,
      converted_at: leadsTable.converted_at,
      assigned_to: leadsTable.assigned_to,
      description: leadsTable.description,
      manual_input: leadsTable.manual_input,
      status: leadsTable.status,
      created_at: leadsTable.created_at,
      updated_at: leadsTable.updated_at,
      preferred_suburb_name: suburbsTable.name,
    })
    .from(leadsTable)
    .leftJoin(suburbsTable, eq(leadsTable.preferred_suburb_id, suburbsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(leadsTable.created_at);

  res.json(rows);
});

router.post("/v1/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const inserted = await insertLeadWithGeneratedRef(normalizeNames(parsed.data));
  const [row] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, inserted.id))
    .limit(1);
  res.status(201).json(row);
});

router.get("/v1/leads/:id", async (req, res): Promise<void> => {
  const parsed = GetLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = await db
    .select({
      id: leadsTable.id,
      lead_ref: leadsTable.lead_ref,
      first_name: leadsTable.first_name,
      last_name: leadsTable.last_name,
      email: leadsTable.email,
      phone: leadsTable.phone,
      nationality: leadsTable.nationality,
      lead_source: leadsTable.lead_source,
      lead_status: leadsTable.lead_status,
      inquiry_type: leadsTable.inquiry_type,
      message: leadsTable.message,
      preferred_space_type: leadsTable.preferred_space_type,
      preferred_check_in_date: leadsTable.preferred_check_in_date,
      preferred_duration_weeks: leadsTable.preferred_duration_weeks,
      preferred_suburb_id: leadsTable.preferred_suburb_id,
      budget_min: leadsTable.budget_min,
      budget_max: leadsTable.budget_max,
      budget_currency: leadsTable.budget_currency,
      converted_booking_id: leadsTable.converted_booking_id,
      converted_at: leadsTable.converted_at,
      assigned_to: leadsTable.assigned_to,
      description: leadsTable.description,
      manual_input: leadsTable.manual_input,
      status: leadsTable.status,
      created_at: leadsTable.created_at,
      updated_at: leadsTable.updated_at,
      preferred_suburb_name: suburbsTable.name,
    })
    .from(leadsTable)
    .leftJoin(suburbsTable, eq(leadsTable.preferred_suburb_id, suburbsTable.id))
    .where(eq(leadsTable.id, parsed.data.id));
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

router.put("/v1/leads/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateLeadParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateLeadBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(leadsTable)
    .set({ ...normalizeNames(bodyParsed.data), updated_at: new Date() })
    .where(eq(leadsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

const leadsSoftDelete = {
  table: leadsTable,
  idColumn: leadsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/leads/bulk-delete", makeBulkDelete(leadsSoftDelete));
router.post("/v1/leads/bulk-restore", makeBulkRestore(leadsSoftDelete));

router.delete("/v1/leads/:id", async (req, res): Promise<void> => {
  const parsed = DeleteLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(leadsTable).where(eq(leadsTable.id, parsed.data.id));
  } else {
    await db.update(leadsTable)
      .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
      .where(eq(leadsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

router.patch("/v1/leads/:id/convert", async (req, res): Promise<void> => {
  const paramsParsed = GetLeadParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = ConvertLeadBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, paramsParsed.data.id));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (lead.lead_status === "ConvertedToBooking") {
    res.status(400).json({ error: "Lead already converted" }); return;
  }

  const year = new Date().getFullYear();
  const bookingRef = `BK-${year}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

  const [updated] = await db.update(leadsTable)
    .set({
      lead_status: "ConvertedToBooking",
      converted_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(leadsTable.id, paramsParsed.data.id))
    .returning();

  res.json({
    booking_ref: bookingRef,
    lead_ref: updated!.lead_ref,
  });
});

router.patch("/v1/leads/:id/mark-lost", async (req, res): Promise<void> => {
  const parsed = GetLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(leadsTable)
    .set({ lead_status: "Lost", updated_at: new Date() })
    .where(eq(leadsTable.id, parsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
