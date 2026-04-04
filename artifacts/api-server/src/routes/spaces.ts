import { Router, type IRouter } from "express";
import { eq, ilike, and, inArray, SQL } from "drizzle-orm";
import { db, spacesTable, propertiesTable, spacePoliciesTable, spaceOptionMapsTable, spaceBlockedDatesTable } from "@workspace/db";
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
  const params = GetSpaceAvailabilityParams.safeParse(req.params);
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

  const blockedDates = await db
    .select()
    .from(spaceBlockedDatesTable)
    .where(eq(spaceBlockedDatesTable.space_id, params.data.id));

  const blockedSet = new Set(blockedDates.map((d) => d.date));

  const today = new Date();
  const days: { date: string; status: string }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      status: blockedSet.has(dateStr) ? "blocked" : "available",
    });
  }

  res.json(GetSpaceAvailabilityResponse.parse(days));
});

router.post("/v1/spaces/:id/availability/block", async (req, res): Promise<void> => {
  const params = BlockSpaceAvailabilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = BlockSpaceAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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

  const { dates, action } = parsed.data;

  if (action === "block") {
    const existing = await db
      .select()
      .from(spaceBlockedDatesTable)
      .where(eq(spaceBlockedDatesTable.space_id, params.data.id));
    const existingDates = new Set(existing.map((d) => d.date));
    const newDates = dates.filter((d) => !existingDates.has(d));
    if (newDates.length > 0) {
      await db.insert(spaceBlockedDatesTable).values(
        newDates.map((d) => ({ space_id: params.data.id, date: d }))
      );
    }
  } else if (action === "unblock") {
    for (const d of dates) {
      await db
        .delete(spaceBlockedDatesTable)
        .where(
          and(
            eq(spaceBlockedDatesTable.space_id, params.data.id),
            eq(spaceBlockedDatesTable.date, d)
          )
        );
    }
  }

  const blockedDates = await db
    .select()
    .from(spaceBlockedDatesTable)
    .where(eq(spaceBlockedDatesTable.space_id, params.data.id));
  const blockedSet = new Set(blockedDates.map((d) => d.date));

  const today = new Date();
  const days: { date: string; status: string }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      status: blockedSet.has(dateStr) ? "blocked" : "available",
    });
  }

  res.json(BlockSpaceAvailabilityResponse.parse(days));
});

export default router;
