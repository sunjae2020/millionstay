import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, SQL, asc, inArray } from "drizzle-orm";
import {
  db,
  accommodationCatalogTable,
  accommodationServiceCatalogTable,
  serviceCatalogTable,
  productGroupsTable,
  productTypesTable,
  spacesTable,
  accountsTable,
  promotionsTable,
} from "@workspace/db";

import { keywordCondition } from "../lib/listSearch";
const router: IRouter = Router();

router.get("/v1/accommodations", async (req, res): Promise<void> => {
  try {
    const { q, product_group_id, product_type_id, promotion_id, is_active, limit = "100", offset = "0" } = req.query as Record<string, string>;

    const conditions: SQL[] = [];
    if (q) {
      // 상품명·설명에 더해 상품 태그로도 찾는다.
      conditions.push(keywordCondition(q, [
        accommodationCatalogTable.name,
        accommodationCatalogTable.item_description,
        accommodationCatalogTable.product_tag,
      ]));
    }
    if (product_group_id) conditions.push(eq(accommodationCatalogTable.product_group_id, Number(product_group_id)));
    if (product_type_id) conditions.push(eq(accommodationCatalogTable.product_type_id, Number(product_type_id)));
    if (promotion_id) conditions.push(eq(accommodationCatalogTable.promotion_id, Number(promotion_id)));
    if (is_active === "true") conditions.push(eq(accommodationCatalogTable.status, "Active"));
    if (is_active === "false") conditions.push(eq(accommodationCatalogTable.status, "Inactive"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(accommodationCatalogTable)
        .where(where)
        .orderBy(asc(accommodationCatalogTable.name))
        .limit(Number(limit))
        .offset(Number(offset)),
      db.select({ count: sql<number>`count(*)::int` }).from(accommodationCatalogTable).where(where),
    ]);

    const groupIds = [...new Set(rows.map(r => r.product_group_id).filter(Boolean))] as number[];
    const typeIds = [...new Set(rows.map(r => r.product_type_id).filter(Boolean))] as number[];
    const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
    const providerIds = [...new Set(rows.map(r => r.product_provider_account_id).filter(Boolean))] as number[];
    const promoIds = [...new Set(rows.map(r => r.promotion_id).filter(Boolean))] as number[];
    const accIds = rows.map(r => r.id);

    const [groups, types, spaces, providers, promos, svcRows] = await Promise.all([
      groupIds.length ? db.select().from(productGroupsTable).where(inArray(productGroupsTable.id, groupIds)) : [],
      typeIds.length ? db.select().from(productTypesTable).where(inArray(productTypesTable.id, typeIds)) : [],
      spaceIds.length ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds)) : [],
      providerIds.length ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, providerIds)) : [],
      promoIds.length ? db.select({ id: promotionsTable.id, name: promotionsTable.name, valid_from: promotionsTable.valid_from, valid_to: promotionsTable.valid_to }).from(promotionsTable).where(inArray(promotionsTable.id, promoIds)) : [],
      accIds.length ? db.select({
        accommodation_id: accommodationServiceCatalogTable.accommodation_id,
        service_name: serviceCatalogTable.name,
        is_mandatory: accommodationServiceCatalogTable.is_mandatory,
      })
        .from(accommodationServiceCatalogTable)
        .innerJoin(serviceCatalogTable, eq(accommodationServiceCatalogTable.service_id, serviceCatalogTable.id))
        .where(inArray(accommodationServiceCatalogTable.accommodation_id, accIds)) : [],
    ]);

    const groupMap = Object.fromEntries(groups.map(g => [g.id, g.name]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]));
    const spaceMap = Object.fromEntries(spaces.map(s => [s.id, s.name]));
    const providerMap = Object.fromEntries(providers.map(a => [a.id, a.name]));
    const promoMap = Object.fromEntries(promos.map(p => [p.id, { name: p.name, valid_from: p.valid_from, valid_to: p.valid_to }]));
    const svcMap: Record<number, string[]> = {};
    for (const s of svcRows as Array<{ accommodation_id: number; service_name: string; is_mandatory: boolean }>) {
      if (!s.is_mandatory) continue;
      if (!svcMap[s.accommodation_id]) svcMap[s.accommodation_id] = [];
      svcMap[s.accommodation_id].push(s.service_name);
    }

    const data = rows.map(r => ({
      ...r,
      group_name: r.product_group_id ? groupMap[r.product_group_id] ?? null : null,
      type_name: r.product_type_id ? typeMap[r.product_type_id] ?? null : null,
      space_name: r.space_id ? spaceMap[r.space_id] ?? null : null,
      provider_name: r.product_provider_account_id ? providerMap[r.product_provider_account_id] ?? null : null,
      promotion_name: r.promotion_id ? promoMap[r.promotion_id]?.name ?? null : null,
      promotion_valid_from: r.promotion_id ? promoMap[r.promotion_id]?.valid_from ?? null : null,
      promotion_valid_to: r.promotion_id ? promoMap[r.promotion_id]?.valid_to ?? null : null,
      packed_services: svcMap[r.id] ?? [],
    }));

    res.json({ success: true, data, meta: { total: count, limit: Number(limit), offset: Number(offset) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list products" });
  }
});

router.get("/v1/accommodations/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const [group] = row.product_group_id
      ? await db.select().from(productGroupsTable).where(eq(productGroupsTable.id, row.product_group_id)) : [];
    const [type] = row.product_type_id
      ? await db.select().from(productTypesTable).where(eq(productTypesTable.id, row.product_type_id)) : [];
    const [space] = row.space_id
      ? await db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(eq(spacesTable.id, row.space_id)) : [];
    const [provider] = row.product_provider_account_id
      ? await db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(eq(accountsTable.id, row.product_provider_account_id)) : [];

    res.json({
      ...row,
      group_name: group?.name ?? null,
      type_name: type?.name ?? null,
      space_name: space?.name ?? null,
      provider_name: provider?.name ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get product" });
  }
});

router.post("/v1/accommodations", async (req, res): Promise<void> => {
  try {
    const { name, price, product_group_id, ...rest } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(accommodationCatalogTable).values({ name, price, product_group_id, ...rest }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/v1/accommodations/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, ...updates } = req.body;
    const [row] = await db.update(accommodationCatalogTable).set(updates).where(eq(accommodationCatalogTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.patch("/v1/accommodations/:id/deactivate", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.update(accommodationCatalogTable).set({ status: "Inactive" }).where(eq(accommodationCatalogTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate product" });
  }
});

router.delete("/v1/accommodations/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
    const [deleted] = await db.delete(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

/* ── Accommodation Product Services (accommodation_service_catalog) ── */

/* GET /v1/accommodations/:id/services */
router.get("/v1/accommodations/:id/services", async (req, res): Promise<void> => {
  const accId = Number(req.params.id);
  if (!accId) { res.status(400).json({ error: "Invalid accommodation id" }); return; }
  try {
    const rows = await db
      .select({
        id: accommodationServiceCatalogTable.id,
        accommodation_id: accommodationServiceCatalogTable.accommodation_id,
        service_id: accommodationServiceCatalogTable.service_id,
        is_mandatory: accommodationServiceCatalogTable.is_mandatory,
        custom_price: accommodationServiceCatalogTable.custom_price,
        sort_order: accommodationServiceCatalogTable.sort_order,
        service_name: serviceCatalogTable.name,
        service_type: serviceCatalogTable.service_type,
        base_price: serviceCatalogTable.base_price,
        currency: serviceCatalogTable.currency,
        billing_trigger: serviceCatalogTable.billing_trigger,
        is_optional: serviceCatalogTable.is_optional,
        status: serviceCatalogTable.status,
      })
      .from(accommodationServiceCatalogTable)
      .innerJoin(serviceCatalogTable, eq(accommodationServiceCatalogTable.service_id, serviceCatalogTable.id))
      .where(eq(accommodationServiceCatalogTable.accommodation_id, accId))
      .orderBy(asc(accommodationServiceCatalogTable.sort_order), asc(serviceCatalogTable.name));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to list accommodation services" });
  }
});

/* POST /v1/accommodations/:id/services */
router.post("/v1/accommodations/:id/services", async (req, res): Promise<void> => {
  const accId = Number(req.params.id);
  if (!accId) { res.status(400).json({ error: "Invalid accommodation id" }); return; }
  const { service_id, is_mandatory = false, custom_price, sort_order = 0 } = req.body as {
    service_id: number; is_mandatory?: boolean; custom_price?: number | null; sort_order?: number;
  };
  if (!service_id) { res.status(400).json({ error: "service_id is required" }); return; }
  try {
    const [existing] = await db.select().from(accommodationServiceCatalogTable)
      .where(and(eq(accommodationServiceCatalogTable.accommodation_id, accId), eq(accommodationServiceCatalogTable.service_id, service_id)));
    if (existing) { res.status(409).json({ error: "Service already assigned to this product" }); return; }
    const [row] = await db.insert(accommodationServiceCatalogTable)
      .values({ accommodation_id: accId, service_id, is_mandatory, custom_price: custom_price ?? null, sort_order })
      .returning();
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ error: "Failed to add service to accommodation" });
  }
});

/* PUT /v1/accommodations/:id/services/:mapId */
router.put("/v1/accommodations/:id/services/:mapId", async (req, res): Promise<void> => {
  const accId = Number(req.params.id);
  const mapId = Number(req.params.mapId);
  if (!accId || !mapId) { res.status(400).json({ error: "Invalid ids" }); return; }
  const { is_mandatory, custom_price, sort_order } = req.body as {
    is_mandatory?: boolean; custom_price?: number | null; sort_order?: number;
  };
  try {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (is_mandatory !== undefined) updates.is_mandatory = is_mandatory;
    if (custom_price !== undefined) updates.custom_price = custom_price;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const [row] = await db.update(accommodationServiceCatalogTable).set(updates)
      .where(and(eq(accommodationServiceCatalogTable.id, mapId), eq(accommodationServiceCatalogTable.accommodation_id, accId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ error: "Failed to update accommodation service" });
  }
});

/* DELETE /v1/accommodations/:id/services/:mapId */
router.delete("/v1/accommodations/:id/services/:mapId", async (req, res): Promise<void> => {
  const accId = Number(req.params.id);
  const mapId = Number(req.params.mapId);
  if (!accId || !mapId) { res.status(400).json({ error: "Invalid ids" }); return; }
  try {
    const [deleted] = await db.delete(accommodationServiceCatalogTable)
      .where(and(eq(accommodationServiceCatalogTable.id, mapId), eq(accommodationServiceCatalogTable.accommodation_id, accId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove service from accommodation" });
  }
});

/* ── Lookup endpoint (used by booking/contract selectors) ── */

router.get("/v1/lookup/products", async (req, res): Promise<void> => {
  try {
    const { q, space_id } = req.query as Record<string, string>;
    const conditions: SQL[] = [eq(accommodationCatalogTable.status, "Active")];
    if (q) conditions.push(ilike(accommodationCatalogTable.name, `%${q}%`));
    if (space_id) conditions.push(eq(accommodationCatalogTable.space_id, Number(space_id)));

    const rows = await db
      .select({
        id: accommodationCatalogTable.id,
        name: accommodationCatalogTable.name,
        weekly_rate: accommodationCatalogTable.weekly_rate,
        price: accommodationCatalogTable.price,
        billing_frequency: accommodationCatalogTable.billing_frequency,
        bond_weeks: accommodationCatalogTable.bond_weeks,
        advance_weeks: accommodationCatalogTable.advance_weeks,
        currency: accommodationCatalogTable.currency,
        gst_included: accommodationCatalogTable.gst_included,
        space_id: accommodationCatalogTable.space_id,
        status: accommodationCatalogTable.status,
      })
      .from(accommodationCatalogTable)
      .where(and(...conditions))
      .orderBy(asc(accommodationCatalogTable.name))
      .limit(100);

    res.json(rows.map(r => ({
      ...r,
      display: `${r.name}${r.billing_frequency ? ` (${r.billing_frequency})` : ""}`,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to lookup products" });
  }
});

export default router;
