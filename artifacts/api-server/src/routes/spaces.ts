import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, ilike, and, inArray, gte, lte, isNull, desc, SQL, sql, asc } from "drizzle-orm";
import { parseListPage, parseSortParams, buildOrderBy, sendList, type SortMap } from "../utils/pagination.js";
import { alias } from "drizzle-orm/pg-core";
import { db, spacesTable, propertiesTable, spacePoliciesTable, spaceOptionMapsTable, spaceBlockedDatesTable, spaceAvailabilityTable, spaceServiceCatalogTable, serviceCatalogTable, accountsTable, spaceDefectsTable } from "@workspace/db";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
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

import { keywordCondition, propertyIdsByName, accountIdsByName } from "../lib/listSearch";
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

/** 정렬 허용 컬럼 — SpaceList 의 SORTABLE_KEYS 와 1:1. */
const SPACE_SORT: SortMap = {
  name: spacesTable.name,
  status: spacesTable.status,
  space_type: spacesTable.space_type,
  booking_mode: spacesTable.booking_mode,
  exclusive_area_m2: spacesTable.exclusive_area_m2,
  created_at: spacesTable.created_at,
  updated_at: spacesTable.updated_at,
  property_name: propertiesTable.name,
  policy_name: spacePoliciesTable.name,
  owner_name: accountsTable.name,
  parent_space_name: sql`(select ps.name from spaces ps where ps.id = ${spacesTable.parent_space_id})`,
};

router.get("/v1/spaces", async (req, res): Promise<void> => {
  const parsed = ListSpacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { space_type, status, property_id, booking_mode, search } = parsed.data;

  const conditions: SQL[] = [deletedFilter(spacesTable.deleted_at, req)];
  if (space_type) conditions.push(eq(spacesTable.space_type, space_type));
  if (status) conditions.push(eq(spacesTable.status, status));
  if (property_id) conditions.push(eq(spacesTable.property_id, property_id));
  if (booking_mode) conditions.push(eq(spacesTable.booking_mode, booking_mode));
  // 세대명만 훑던 검색을 유형명·설명과 소속 매물/임대인 이름까지 넓힌다.
  if (search) {
    const [propertyIds, accountIds] = await Promise.all([propertyIdsByName(search), accountIdsByName(search)]);
    conditions.push(keywordCondition(
      search,
      [spacesTable.name, spacesTable.custom_type_name, spacesTable.description],
      [
        { column: spacesTable.property_id, ids: propertyIds },
        { column: spacesTable.landlord_account_id, ids: accountIds },
      ],
    ));
  }
  // 층별 조회(관리대장이 층 단위로 돌아간다).
  const { floor_number } = req.query as Record<string, string>;
  if (floor_number) conditions.push(eq(spacesTable.floor_number, Number(floor_number)));

  // 상위 공간(타입 마스터) 필터. 서버 페이징 이후에는 클라이언트가 로드된 행에서
  // 거를 수 없으므로 서버가 받는다.
  const parentSpaceId = Number((req.query as Record<string, string>).parent_space_id);
  if (Number.isFinite(parentSpaceId) && parentSpaceId > 0) {
    conditions.push(eq(spacesTable.parent_space_id, parentSpaceId));
  }

  const { limit, offset, page } = parseListPage(req.query);
  const sort = parseSortParams(req.query, SPACE_SORT);

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
      custom_type_name: spacesTable.custom_type_name,
      space_policy_id: spacesTable.space_policy_id,
      policy_name: spacePoliciesTable.name,
      landlord_account_id: spacesTable.landlord_account_id,
      owner_name: accountsTable.name,
      exclusive_area_m2: spacesTable.exclusive_area_m2,
      created_at: spacesTable.created_at,
      updated_at: spacesTable.updated_at,
    })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(spacePoliciesTable, eq(spacesTable.space_policy_id, spacePoliciesTable.id))
    .leftJoin(accountsTable, eq(spacesTable.landlord_account_id, accountsTable.id))
    .where(and(...conditions))
    .orderBy(...buildOrderBy(SPACE_SORT, sort, spacesTable.id, [asc(spacesTable.created_at)]))
    .limit(limit).offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spacesTable)
    .where(and(...conditions));

  const spaceIds = rows.map((r) => r.id);
  const allMaps = spaceIds.length > 0
    ? await db.select().from(spaceOptionMapsTable).where(inArray(spaceOptionMapsTable.space_id, spaceIds))
    : [];

  const parentIds = [...new Set(rows.map((r) => r.parent_space_id).filter((id): id is number => id != null))];
  const parentRows = parentIds.length > 0
    ? await db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, parentIds))
    : [];
  const parentNameById = new Map(parentRows.map((p) => [p.id, p.name]));

  const result = rows.map((row) => ({
    ...row,
    parent_space_name: row.parent_space_id != null ? parentNameById.get(row.parent_space_id) ?? null : null,
    space_option_ids: allMaps.filter((m) => m.space_id === row.id).map((m) => m.space_option_id),
  }));

  sendList(res, ListSpacesResponse.parse(result), count ?? 0, { limit, offset, page });
});

/**
 * 상위 공간(타입 마스터) 필터 선택지. 서버 페이징 이후로는 한 페이지의 행에서
 * 뽑을 수 없어서 전체 데이터에서 한 번에 뽑는다(계약의 /facets 와 같은 취지).
 * 반드시 "/v1/spaces/:id" 보다 먼저 선언할 것.
 */
router.get("/v1/spaces/facets", async (req, res): Promise<void> => {
  const child = alias(spacesTable, "child");
  const rows = await db
    .selectDistinct({ id: spacesTable.id, name: spacesTable.name })
    .from(spacesTable)
    .innerJoin(child, eq(child.parent_space_id, spacesTable.id))
    .where(and(deletedFilter(spacesTable.deleted_at, req), isNull(child.deleted_at)))
    .orderBy(asc(spacesTable.name));
  res.json({ parents: rows });
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

const spaceSoftDelete = {
  table: spacesTable,
  idColumn: spacesTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
  onPurge: async (ids: number[]) => {
    await db.delete(spaceOptionMapsTable).where(inArray(spaceOptionMapsTable.space_id, ids));
    await db.delete(spaceBlockedDatesTable).where(inArray(spaceBlockedDatesTable.space_id, ids));
  },
};

router.post("/v1/spaces/bulk-delete", makeBulkDelete(spaceSoftDelete));
router.post("/v1/spaces/bulk-restore", makeBulkRestore(spaceSoftDelete));

router.delete("/v1/spaces/:id", async (req, res): Promise<void> => {
  const params = DeleteSpaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(spaceOptionMapsTable).where(eq(spaceOptionMapsTable.space_id, params.data.id));
    await db.delete(spaceBlockedDatesTable).where(eq(spaceBlockedDatesTable.space_id, params.data.id));
    await db.delete(spacesTable).where(eq(spacesTable.id, params.data.id));
  } else {
    await db.update(spacesTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(spacesTable.id, params.data.id));
  }
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

/* ── Space Services (space_service_catalog) ─────────────────────── */

/* GET /v1/spaces/:id/services — list services assigned to a space */
router.get("/v1/spaces/:id/services", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  try {
    const rows = await db
      .select({
        id: spaceServiceCatalogTable.id,
        space_id: spaceServiceCatalogTable.space_id,
        service_id: spaceServiceCatalogTable.service_id,
        is_mandatory: spaceServiceCatalogTable.is_mandatory,
        custom_price: spaceServiceCatalogTable.custom_price,
        sort_order: spaceServiceCatalogTable.sort_order,
        service_name: serviceCatalogTable.name,
        service_type: serviceCatalogTable.service_type,
        base_price: serviceCatalogTable.base_price,
        currency: serviceCatalogTable.currency,
        billing_trigger: serviceCatalogTable.billing_trigger,
        is_optional: serviceCatalogTable.is_optional,
        status: serviceCatalogTable.status,
      })
      .from(spaceServiceCatalogTable)
      .innerJoin(serviceCatalogTable, eq(spaceServiceCatalogTable.service_id, serviceCatalogTable.id))
      .where(eq(spaceServiceCatalogTable.space_id, spaceId))
      .orderBy(spaceServiceCatalogTable.sort_order, serviceCatalogTable.name);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list space services" });
  }
});

/* POST /v1/spaces/:id/services — add a service to a space */
router.post("/v1/spaces/:id/services", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const { service_id, is_mandatory = false, custom_price, sort_order = 0 } = req.body as {
    service_id: number;
    is_mandatory?: boolean;
    custom_price?: number | null;
    sort_order?: number;
  };

  if (!service_id) { res.status(400).json({ error: "service_id is required" }); return; }

  try {
    const [existing] = await db
      .select()
      .from(spaceServiceCatalogTable)
      .where(and(eq(spaceServiceCatalogTable.space_id, spaceId), eq(spaceServiceCatalogTable.service_id, service_id)));

    if (existing) {
      res.status(409).json({ error: "This service is already assigned to the space" });
      return;
    }

    const [row] = await db
      .insert(spaceServiceCatalogTable)
      .values({ space_id: spaceId, service_id, is_mandatory, custom_price: custom_price ?? null, sort_order })
      .returning();

    await logAction({ entityType: "space", entityId: spaceId, action: "ADD_SERVICE", newValue: { service_id } });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add service to space" });
  }
});

/* PUT /v1/spaces/:id/services/:mapId — update mapping (mandatory / custom_price / sort_order) */
router.put("/v1/spaces/:id/services/:mapId", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const mapId = Number(req.params.mapId);
  if (!spaceId || !mapId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const { is_mandatory, custom_price, sort_order } = req.body as {
    is_mandatory?: boolean;
    custom_price?: number | null;
    sort_order?: number;
  };

  try {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (is_mandatory !== undefined) updates.is_mandatory = is_mandatory;
    if (custom_price !== undefined) updates.custom_price = custom_price;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const [row] = await db
      .update(spaceServiceCatalogTable)
      .set(updates)
      .where(and(eq(spaceServiceCatalogTable.id, mapId), eq(spaceServiceCatalogTable.space_id, spaceId)))
      .returning();

    if (!row) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update space service" });
  }
});

/* DELETE /v1/spaces/:id/services/:mapId — remove a service from a space */
router.delete("/v1/spaces/:id/services/:mapId", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const mapId = Number(req.params.mapId);
  if (!spaceId || !mapId) { res.status(400).json({ error: "Invalid ids" }); return; }

  try {
    const [deleted] = await db
      .delete(spaceServiceCatalogTable)
      .where(and(eq(spaceServiceCatalogTable.id, mapId), eq(spaceServiceCatalogTable.space_id, spaceId)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Mapping not found" }); return; }
    await logAction({ entityType: "space", entityId: spaceId, action: "REMOVE_SERVICE", newValue: { map_id: mapId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove service from space" });
  }
});

/* ── 하자 이력 (space_defects) ───────────────────────────────────────
   Per-unit defect history. 소유자명 / 호수 / TYPE are derived from the space
   (and its landlord account) on read, so the ledger can't drift from the unit
   master; only the defect-specific fields are stored. */

const defectUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/** The read-only identity strip shown above the defect table. */
async function getSpaceDefectContext(spaceId: number) {
  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) return null;
  const [owner] = space.landlord_account_id
    ? await db.select({ id: accountsTable.id, name: accountsTable.name })
        .from(accountsTable).where(eq(accountsTable.id, space.landlord_account_id))
    : [null];
  const [parent] = space.parent_space_id
    ? await db.select({ name: spacesTable.name }).from(spacesTable).where(eq(spacesTable.id, space.parent_space_id))
    : [null];
  return {
    space_id: space.id,
    owner_account_id: owner?.id ?? null,
    owner_name: owner?.name ?? null,
    unit_name: space.name,
    // Metheim models unit *types* as parent spaces, so the parent name is the
    // truest TYPE label; fall back to the space's own type fields.
    type_label: parent?.name ?? space.custom_type_name ?? space.space_type ?? null,
  };
}

function defectPhotoUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((u): u is string => typeof u === "string") : [];
}

/* GET /v1/spaces/:id/defects — defect rows + the derived 소유자명/호수/TYPE strip */
router.get("/v1/spaces/:id/defects", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const context = await getSpaceDefectContext(spaceId);
  if (!context) { res.status(404).json({ error: "Space not found" }); return; }

  const rows = await db.select().from(spaceDefectsTable)
    .where(and(eq(spaceDefectsTable.space_id, spaceId), eq(spaceDefectsTable.status, "Active")))
    .orderBy(desc(spaceDefectsTable.id));

  res.json({ success: true, data: rows, context, meta: { total: rows.length } });
});

/* POST /v1/spaces/:id/defects — record a defect */
router.post("/v1/spaces/:id/defects", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const b = req.body ?? {};
  if (!b.defect_category && !b.detail_item) {
    res.status(400).json({ error: "defect_category or detail_item is required" });
    return;
  }

  const [row] = await db.insert(spaceDefectsTable).values({
    space_id: spaceId,
    defect_category: b.defect_category ?? "",
    has_furniture_install: Boolean(b.has_furniture_install),
    has_registration: Boolean(b.has_registration),
    has_outdoor_unit_socket: Boolean(b.has_outdoor_unit_socket),
    has_toilet_fixing_issue: Boolean(b.has_toilet_fixing_issue),
    detail_item: b.detail_item ?? "",
    description: b.description ?? "",
    progress_status: b.progress_status || "접수",
    vendor_name: b.vendor_name ?? "",
    photo_urls: defectPhotoUrls(b.photo_urls),
    status: "Active",
  }).returning();

  await logAction({ entityType: "space", entityId: spaceId, action: "ADD_DEFECT", newValue: { defect_id: row?.id } });
  res.status(201).json({ success: true, data: row });
});

/* PATCH /v1/spaces/:id/defects/:defectId */
router.patch("/v1/spaces/:id/defects/:defectId", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const defectId = Number(req.params.defectId);
  if (!spaceId || !defectId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const b = req.body ?? {};
  const [row] = await db.update(spaceDefectsTable).set({
    ...(b.defect_category !== undefined && { defect_category: b.defect_category }),
    ...(b.has_furniture_install !== undefined && { has_furniture_install: Boolean(b.has_furniture_install) }),
    ...(b.has_registration !== undefined && { has_registration: Boolean(b.has_registration) }),
    ...(b.has_outdoor_unit_socket !== undefined && { has_outdoor_unit_socket: Boolean(b.has_outdoor_unit_socket) }),
    ...(b.has_toilet_fixing_issue !== undefined && { has_toilet_fixing_issue: Boolean(b.has_toilet_fixing_issue) }),
    ...(b.detail_item !== undefined && { detail_item: b.detail_item }),
    ...(b.description !== undefined && { description: b.description }),
    ...(b.progress_status !== undefined && { progress_status: b.progress_status }),
    ...(b.vendor_name !== undefined && { vendor_name: b.vendor_name }),
    ...(b.photo_urls !== undefined && { photo_urls: defectPhotoUrls(b.photo_urls) }),
    updated_at: new Date(),
  }).where(and(eq(spaceDefectsTable.id, defectId), eq(spaceDefectsTable.space_id, spaceId))).returning();

  if (!row) { res.status(404).json({ error: "Defect not found" }); return; }
  res.json({ success: true, data: row });
});

/* DELETE /v1/spaces/:id/defects/:defectId — soft delete */
router.delete("/v1/spaces/:id/defects/:defectId", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const defectId = Number(req.params.defectId);
  if (!spaceId || !defectId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const [row] = await db.update(spaceDefectsTable)
    .set({ status: "Deleted", updated_at: new Date() })
    .where(and(eq(spaceDefectsTable.id, defectId), eq(spaceDefectsTable.space_id, spaceId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Defect not found" }); return; }

  await logAction({ entityType: "space", entityId: spaceId, action: "REMOVE_DEFECT", newValue: { defect_id: defectId } });
  res.json({ success: true });
});

/* POST /v1/spaces/:id/defects/:defectId/photos — multipart `image`, appended to photo_urls */
router.post("/v1/spaces/:id/defects/:defectId/photos", defectUpload.single("image"), async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const defectId = Number(req.params.defectId);
  if (!spaceId || !defectId) { res.status(400).json({ error: "Invalid ids" }); return; }

  try {
    const [existing] = await db.select().from(spaceDefectsTable)
      .where(and(eq(spaceDefectsTable.id, defectId), eq(spaceDefectsTable.space_id, spaceId)));
    if (!existing) { res.status(404).json({ error: "Defect not found" }); return; }

    let url: string | null = typeof req.body?.url === "string" ? req.body.url : null;
    if (!url && req.file) {
      if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image upload not configured" }); return; }
      const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("defects") });
      url = result.secure_url;
    }
    if (!url) { res.status(400).json({ error: "Provide an image file or a url" }); return; }

    const [row] = await db.update(spaceDefectsTable)
      .set({ photo_urls: [...defectPhotoUrls(existing.photo_urls), url], updated_at: new Date() })
      .where(eq(spaceDefectsTable.id, defectId))
      .returning();
    res.status(201).json({ success: true, data: row, url });
  } catch (err) {
    console.error("[spaces] defect photo upload failed:", err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

/* DELETE /v1/spaces/:id/defects/:defectId/photos — body { url }, detaches one photo.
   The Cloudinary asset is left in place (defect evidence is kept for audit). */
router.delete("/v1/spaces/:id/defects/:defectId/photos", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const defectId = Number(req.params.defectId);
  const url = String(req.body?.url ?? "");
  if (!spaceId || !defectId || !url) { res.status(400).json({ error: "Invalid ids or url" }); return; }

  const [existing] = await db.select().from(spaceDefectsTable)
    .where(and(eq(spaceDefectsTable.id, defectId), eq(spaceDefectsTable.space_id, spaceId)));
  if (!existing) { res.status(404).json({ error: "Defect not found" }); return; }

  const [row] = await db.update(spaceDefectsTable)
    .set({ photo_urls: defectPhotoUrls(existing.photo_urls).filter((u) => u !== url), updated_at: new Date() })
    .where(eq(spaceDefectsTable.id, defectId))
    .returning();
  res.json({ success: true, data: row });
});

export default router;
