import { Router, type IRouter } from "express";
import { eq, ilike, and, inArray, gte, lte, SQL } from "drizzle-orm";
import { db, spacesTable, propertiesTable, spacePoliciesTable, spaceOptionMapsTable, spaceBlockedDatesTable, spaceAvailabilityTable } from "@workspace/db";
import { logAction } from "../utils/auditLog";
import {
  ListSpacesQueryParams,
  CreateSpaceBody,
  GetSpaceParams,
  GetSpaceResponse,
  UpdateSpaceParams,
  UpdateSpaceBody,
  UpdateSpaceResponse,
  DeleteSpaceParams,
  ListSpacesResponse,
  GetSpaceAvailabilityParams,
  GetSpaceAvailabilityResponse,
  BlockSpaceAvailabilityParams,
  BlockSpaceAvailabilityBody,
  BlockSpaceAvailabilityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSpaceOptionIds(spaceId: number): Promise<number[]> {
  const maps = await db
    .select()
    .from(spaceOptionMapsTable)
    .where(eq(spaceOptionMapsTable.space_id, spaceId));
  return maps.map((m) => m.space_option_id);
}

async function buildSpaceResponse(space: typeof spacesTable.$inferSelect) {
  const [propertyRow] = space.property_id
    ? await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id))
    : [null];

  const [policyRow] = space.space_policy_id
    ? await db.select().from(spacePoliciesTable).where(eq(spacePoliciesTable.id, space.space_policy_id))
    : [null];

  const [parentRow] = space.parent_space_id
    ? await db.select().from(spacesTable).where(eq(spacesTable.id, space.parent_space_id))
    : [null];

  const optionIds = await getSpaceOptionIds(space.id);

  return {
    ...space,
    property_name: propertyRow?.name ?? null,
    parent_space_name: parentRow?.name ?? null,
    policy_name: policyRow?.name ?? null,
    space_option_ids: optionIds,
  };
}

router.get("/v1/spaces", async (req, res): Promise<void> => {
  const parsed = ListSpacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { space_type, status, property_id, booking_mode, search } = parsed.data;

  const conditions: SQL[] = [];
  if (space_type) conditions.push(eq(spacesTable.space_type, space_type));
  if (status) conditions.push(eq(spacesTable.status, status));
  if (property_id) conditions.push(eq(spacesTable.property_id, property_id));
  if (booking_mode) conditions.push(eq(spacesTable.booking_mode, booking_mode));
  if (search) conditions.push(ilike(spacesTable.name, `%${search}%`));

  const rows = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      space_type: spacesTable.space_type,
      status: spacesTable.status,
      booking_mode: spacesTable.booking_mode,
      property_id: spacesTable.property_id,
      property_name: propertiesTable.name,
      parent_space_id: spacesTable.parent_space_id,
      space_policy_id: spacesTable.space_policy_id,
      policy_name: spacePoliciesTable.name,
      created_at: spacesTable.created_at,
      updated_at: spacesTable.updated_at,
    })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(spacePoliciesTable, eq(spacesTable.space_policy_id, spacePoliciesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(spacesTable.created_at);

  const spaceIds = rows.map((r) => r.id);
  const allMaps = spaceIds.length > 0
    ? await db.select().from(spaceOptionMapsTable).where(inArray(spaceOptionMapsTable.space_id, spaceIds))
    : [];

  const result = rows.map((row) => ({
    ...row,
    parent_space_name: null as string | null,
    space_option_ids: allMaps.filter((m) => m.space_id === row.id).map((m) => m.space_option_id),
  }));

  res.json(ListSpacesResponse.parse(result));
});

router.post("/v1/spaces", async (req, res): Promise<void> => {
  const parsed = CreateSpaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { space_option_ids, ...spaceData } = parsed.data;

  const [space] = await db.insert(spacesTable).values(spaceData).returning();

  if (space_option_ids && space_option_ids.length > 0) {
    await db.insert(spaceOptionMapsTable).values(
      space_option_ids.map((optId) => ({ space_id: space.id, space_option_id: optId }))
    );
  }

  const full = await buildSpaceResponse(space);
  res.status(201).json(GetSpaceResponse.parse(full));
});

router.get("/v1/spaces/:id", async (req, res): Promise<void> => {
  const params = GetSpaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [space] = await db
    .select()
    .from(spacesTable)
    .where(eq(spacesTable.id, params.data.id));

  if (!space) {
    res.status(404).json({ error: "Space not found" });
    return;
  }

  const full = await buildSpaceResponse(space);
  res.json(GetSpaceResponse.parse(full));
});

router.put("/v1/spaces/:id", async (req, res): Promise<void> => {
  const params = UpdateSpaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSpaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { space_option_ids, ...spaceData } = parsed.data;

  const [space] = await db
    .update(spacesTable)
    .set({ ...spaceData, updated_at: new Date() })
    .where(eq(spacesTable.id, params.data.id))
    .returning();

  if (!space) {
    res.status(404).json({ error: "Space not found" });
    return;
  }

  if (space_option_ids !== undefined) {
    await db.delete(spaceOptionMapsTable).where(eq(spaceOptionMapsTable.space_id, space.id));
    if (space_option_ids.length > 0) {
      await db.insert(spaceOptionMapsTable).values(
        space_option_ids.map((optId) => ({ space_id: space.id, space_option_id: optId }))
      );
    }
  }

  const full = await buildSpaceResponse(space);
  res.json(UpdateSpaceResponse.parse(full));
});

router.delete("/v1/spaces/:id", async (req, res): Promise<void> => {
  const params = DeleteSpaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [space] = await db
    .delete(spacesTable)
    .where(eq(spacesTable.id, params.data.id))
    .returning();

  if (!space) {
    res.status(404).json({ error: "Space not found" });
    return;
  }

  await db.delete(spaceOptionMapsTable).where(eq(spaceOptionMapsTable.space_id, space.id));
  await db.delete(spaceBlockedDatesTable).where(eq(spaceBlockedDatesTable.space_id, space.id));

  res.sendStatus(204);
});

router.get("/v1/spaces/:id/availability", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const today = new Date();
  const fromStr = (req.query.from as string) ?? today.toISOString().slice(0, 10);
  const toDefault = new Date(today);
  toDefault.setDate(today.getDate() + 30);
  const toStr = (req.query.to as string) ?? toDefault.toISOString().slice(0, 10);

  const records = await db.select().from(spaceAvailabilityTable)
    .where(and(
      eq(spaceAvailabilityTable.space_id, spaceId),
      gte(spaceAvailabilityTable.date, fromStr),
      lte(spaceAvailabilityTable.date, toStr),
    ));
  const recordMap = new Map(records.map(r => [r.date, r]));

  const calendar: { date: string; is_available: boolean; block_reason: string | null; booking_id: number | null }[] = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const rec = recordMap.get(dateStr);
    calendar.push({
      date: dateStr,
      is_available: rec ? rec.is_available : true,
      block_reason: rec?.block_reason ?? null,
      booking_id: rec?.booking_id ?? null,
    });
  }

  const available_count = calendar.filter(c => c.is_available).length;
  const blocked_count = calendar.filter(c => !c.is_available).length;

  res.json({
    success: true,
    data: {
      space_id: spaceId,
      space_name: space.name,
      from: fromStr,
      to: toStr,
      calendar,
      available_count,
      blocked_count,
    },
  });
});

router.post("/v1/spaces/:id/availability/block", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const { dates, reason = "Manual" } = req.body as { dates?: string[]; reason?: string };
  if (!Array.isArray(dates) || dates.length === 0) {
    res.status(400).json({ error: "dates array is required" }); return;
  }

  for (const date of dates) {
    await db.insert(spaceAvailabilityTable)
      .values({ space_id: spaceId, date, is_available: false, block_reason: reason })
      .onConflictDoUpdate({
        target: [spaceAvailabilityTable.space_id, spaceAvailabilityTable.date],
        set: { is_available: false, block_reason: reason },
      });
  }

  await logAction({ entityType: "space", entityId: spaceId, action: "BLOCK", newValue: { dates, reason } });

  res.json({ success: true, blocked_count: dates.length });
});

router.post("/v1/spaces/:id/availability/unblock", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const { dates } = req.body as { dates?: string[] };
  if (!Array.isArray(dates) || dates.length === 0) {
    res.status(400).json({ error: "dates array is required" }); return;
  }

  for (const date of dates) {
    await db.insert(spaceAvailabilityTable)
      .values({ space_id: spaceId, date, is_available: true, block_reason: null, booking_id: null })
      .onConflictDoUpdate({
        target: [spaceAvailabilityTable.space_id, spaceAvailabilityTable.date],
        set: { is_available: true, block_reason: null, booking_id: null },
      });
  }

  await logAction({ entityType: "space", entityId: spaceId, action: "UNBLOCK", newValue: { dates } });

  res.json({ success: true, unblocked_count: dates.length });
});

export default router;
