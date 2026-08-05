/**
 * Marketing lists / segments.
 *
 * `static` lists hold explicit membership rows; `dynamic` lists store a filter
 * and resolve at read time. Both answer through lib/marketing/audience.ts so the
 * count shown here and the set a campaign actually mails can never diverge.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, marketingListsTable, prospectListMembersTable, prospectsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { logAction } from "../utils/auditLog";
import { resolveListMembers, type FilterCriteria } from "../lib/marketing/audience";

const router: IRouter = Router();
const ENTITY = "marketing_list";

const ListBody = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  list_type: z.enum(["static", "dynamic"]).default("static"),
  filter_criteria: z.record(z.string(), z.unknown()).nullish(),
  owner_user_id: z.number().int().nullish(),
});

/** Keep `member_count` honest after any membership change. */
async function refreshMemberCount(listId: number): Promise<number> {
  const members = await resolveListMembers(listId);
  await db
    .update(marketingListsTable)
    .set({ member_count: members.length, updated_at: new Date() })
    .where(eq(marketingListsTable.id, listId));
  return members.length;
}

router.get("/v1/marketing/lists", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(marketingListsTable)
      .where(and(deletedFilter(marketingListsTable.deleted_at, req)))
      .orderBy(desc(marketingListsTable.updated_at));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list marketing lists" });
  }
});

router.post("/v1/marketing/lists", async (req, res): Promise<void> => {
  const parsed = ListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db
      .insert(marketingListsTable)
      .values({
        ...parsed.data,
        filter_criteria: (parsed.data.filter_criteria ?? null) as Record<string, unknown> | null,
        owner_user_id: parsed.data.owner_user_id ?? null,
      })
      .returning();
    // A dynamic list has members the moment it exists — return the resolved count,
    // not the zero the insert wrote, or the UI shows an empty new segment.
    const count = row!.list_type === "dynamic" ? await refreshMemberCount(row!.id) : 0;
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", newValue: { name: row!.name } });
    res.status(201).json({ success: true, data: { ...row, member_count: count } });
  } catch {
    res.status(500).json({ error: "Failed to create list" });
  }
});

router.get("/v1/marketing/lists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [row] = await db.select().from(marketingListsTable).where(eq(marketingListsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const members = await resolveListMembers(id);
    res.json({ success: true, data: { ...row, members, member_count: members.length } });
  } catch {
    res.status(500).json({ error: "Failed to load list" });
  }
});

router.patch("/v1/marketing/lists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ListBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db
      .update(marketingListsTable)
      .set({ ...parsed.data, filter_criteria: parsed.data.filter_criteria as Record<string, unknown> | undefined, updated_at: new Date() })
      .where(eq(marketingListsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const count = await refreshMemberCount(id);
    void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: parsed.data });
    res.json({ success: true, data: { ...row, member_count: count } });
  } catch {
    res.status(500).json({ error: "Failed to update list" });
  }
});

const listsSoftDelete = {
  table: marketingListsTable,
  idColumn: marketingListsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
  onPurge: async (ids: number[]) => {
    await db.delete(prospectListMembersTable).where(inArray(prospectListMembersTable.list_id, ids));
  },
};

router.post("/v1/marketing/lists/bulk-delete", makeBulkDelete(listsSoftDelete));
router.post("/v1/marketing/lists/bulk-restore", makeBulkRestore(listsSoftDelete));

router.delete("/v1/marketing/lists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .update(marketingListsTable)
    .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
    .where(eq(marketingListsTable.id, id));
  void logAction({ entityType: ENTITY, entityId: id, action: "DELETE" });
  res.json({ success: true });
});

// ── Membership (static lists) ───────────────────────────────────────────────

router.post("/v1/marketing/lists/:id/members", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ prospect_ids: z.array(z.number().int()).min(1) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    const [list] = await db.select().from(marketingListsTable).where(eq(marketingListsTable.id, id)).limit(1);
    if (!list) { res.status(404).json({ error: "Not found" }); return; }
    if (list.list_type === "dynamic") {
      res.status(400).json({ error: "A dynamic list's membership comes from its filter" });
      return;
    }
    await db
      .insert(prospectListMembersTable)
      .values(body.data.prospect_ids.map((pid) => ({ list_id: id, prospect_id: pid })))
      .onConflictDoNothing();
    const count = await refreshMemberCount(id);
    res.json({ success: true, data: { member_count: count } });
  } catch {
    res.status(500).json({ error: "Failed to add members" });
  }
});

router.delete("/v1/marketing/lists/:id/members/:pid", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const pid = Number(req.params.pid);
  if (!Number.isFinite(id) || !Number.isFinite(pid)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .delete(prospectListMembersTable)
    .where(and(eq(prospectListMembersTable.list_id, id), eq(prospectListMembersTable.prospect_id, pid)));
  const count = await refreshMemberCount(id);
  res.json({ success: true, data: { member_count: count } });
});

/** Recompute a dynamic segment (or re-count a static one) on demand. */
router.post("/v1/marketing/lists/:id/refresh", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const count = await refreshMemberCount(id);
    res.json({ success: true, data: { member_count: count } });
  } catch {
    res.status(500).json({ error: "Failed to refresh list" });
  }
});

/** Count a filter without saving it — the segment builder's live preview. */
router.post("/v1/marketing/lists/preview", async (req, res): Promise<void> => {
  const criteria = (req.body ?? {}) as FilterCriteria;
  try {
    const { criteriaConditions } = await import("../lib/marketing/audience");
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospectsTable)
      .where(and(...criteriaConditions(criteria)));
    res.json({ success: true, data: { count: row?.count ?? 0 } });
  } catch {
    res.status(500).json({ error: "Failed to preview segment" });
  }
});

export default router;
