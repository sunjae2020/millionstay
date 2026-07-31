import { Router, type IRouter } from "express";
import { eq, ilike, and, isNull, inArray, SQL } from "drizzle-orm";
import { db, propertiesTable, suburbsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  ListPropertiesQueryParams,
  CreatePropertyBody,
  GetPropertyParams,
  GetPropertyResponse,
  UpdatePropertyParams,
  UpdatePropertyBody,
  UpdatePropertyResponse,
  DeletePropertyParams,
  ListPropertiesResponse,
  UpdatePropertyStatusParams,
  UpdatePropertyStatusBody,
  UpdatePropertyStatusResponse,
} from "@workspace/api-zod";

import { keywordCondition, accountIdsByName } from "../lib/listSearch";
const router: IRouter = Router();

router.get("/v1/properties", async (req, res): Promise<void> => {
  const parsed = ListPropertiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { approval_status, owner_account_id, suburb_id, search } = parsed.data;

  const conditions: SQL[] = [deletedFilter(propertiesTable.deleted_at, req)];
  if (approval_status) conditions.push(eq(propertiesTable.approval_status, approval_status));
  if (owner_account_id) conditions.push(eq(propertiesTable.owner_account_id, owner_account_id));
  if (suburb_id) conditions.push(eq(propertiesTable.suburb_id, suburb_id));
  // 매물명에 더해 주소·도시·우편번호·설명과 소유주 계정 이름으로도 찾는다.
  if (search) {
    conditions.push(keywordCondition(
      search,
      [
        propertiesTable.name, propertiesTable.address, propertiesTable.lot_address,
        propertiesTable.city, propertiesTable.postcode, propertiesTable.description,
      ],
      [{ column: propertiesTable.owner_account_id, ids: await accountIdsByName(search) }],
    ));
  }

  const rows = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      approval_status: propertiesTable.approval_status,
      owner_account_id: propertiesTable.owner_account_id,
      suburb_id: propertiesTable.suburb_id,
      suburb_name: suburbsTable.name,
      created_at: propertiesTable.created_at,
      updated_at: propertiesTable.updated_at,
    })
    .from(propertiesTable)
    .leftJoin(suburbsTable, eq(propertiesTable.suburb_id, suburbsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(propertiesTable.created_at);

  const result = rows.map((r) => ({
    ...r,
    owner_account_name: null,
  }));

  res.json(ListPropertiesResponse.parse(result));
});

router.post("/v1/properties", async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [property] = await db.insert(propertiesTable).values(parsed.data).returning();

  const suburbRow = property.suburb_id
    ? await db.select().from(suburbsTable).where(eq(suburbsTable.id, property.suburb_id)).then((r) => r[0])
    : null;

  res.status(201).json(
    GetPropertyResponse.parse({
      ...property,
      suburb_name: suburbRow?.name ?? null,
      owner_account_name: null,
    })
  );
});

router.get("/v1/properties/:id", async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      address2: propertiesTable.address2,
      city: propertiesTable.city,
      state: propertiesTable.state,
      postcode: propertiesTable.postcode,
      country_code: propertiesTable.country_code,
      lat: propertiesTable.lat,
      lng: propertiesTable.lng,
      approval_status: propertiesTable.approval_status,
      owner_account_id: propertiesTable.owner_account_id,
      suburb_id: propertiesTable.suburb_id,
      suburb_name: suburbsTable.name,
      description: propertiesTable.description,
      // Land/building registry (등기부 표시) — fills the 부동산의 표식 table on
      // a Korean lease agreement's 별지.
      lot_address: propertiesTable.lot_address,
      building_use: propertiesTable.building_use,
      building_structure: propertiesTable.building_structure,
      land_category: propertiesTable.land_category,
      land_area_m2: propertiesTable.land_area_m2,
      land_right_type: propertiesTable.land_right_type,
      created_at: propertiesTable.created_at,
      updated_at: propertiesTable.updated_at,
    })
    .from(propertiesTable)
    .leftJoin(suburbsTable, eq(propertiesTable.suburb_id, suburbsTable.id))
    .where(eq(propertiesTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  res.json(
    GetPropertyResponse.parse({
      ...rows[0],
      owner_account_name: null,
    })
  );
});

router.put("/v1/properties/:id", async (req, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [property] = await db
    .update(propertiesTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();

  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const suburbRow = property.suburb_id
    ? await db.select().from(suburbsTable).where(eq(suburbsTable.id, property.suburb_id)).then((r) => r[0])
    : null;

  res.json(
    UpdatePropertyResponse.parse({
      ...property,
      suburb_name: suburbRow?.name ?? null,
      owner_account_name: null,
    })
  );
});

const propertiesSoftDelete = {
  table: propertiesTable,
  idColumn: propertiesTable.id,
};

router.post("/v1/properties/bulk-delete", makeBulkDelete(propertiesSoftDelete));
router.post("/v1/properties/bulk-restore", makeBulkRestore(propertiesSoftDelete));

router.delete("/v1/properties/:id", async (req, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
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
    await db.delete(propertiesTable).where(eq(propertiesTable.id, params.data.id));
    res.sendStatus(204);
    return;
  }
  await db.update(propertiesTable).set({ deleted_at: new Date() }).where(eq(propertiesTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/v1/properties/:id/status", async (req, res): Promise<void> => {
  const params = UpdatePropertyStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePropertyStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [property] = await db
    .update(propertiesTable)
    .set({ approval_status: parsed.data.approval_status, updated_at: new Date() })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();

  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const suburbRow = property.suburb_id
    ? await db.select().from(suburbsTable).where(eq(suburbsTable.id, property.suburb_id)).then((r) => r[0])
    : null;

  res.json(
    UpdatePropertyStatusResponse.parse({
      ...property,
      suburb_name: suburbRow?.name ?? null,
      owner_account_name: null,
    })
  );
});

export default router;
