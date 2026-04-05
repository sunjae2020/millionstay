import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, SQL, asc, inArray } from "drizzle-orm";
import {
  db,
  productCatalogTable,
  productGroupsTable,
  productTypesTable,
  spacesTable,
  accountsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/v1/products", async (req, res): Promise<void> => {
  try {
    const { q, product_group_id, product_type_id, is_active, limit = "100", offset = "0" } = req.query as Record<string, string>;

    const conditions: SQL[] = [];
    if (q) {
      conditions.push(
        sql`(${ilike(productCatalogTable.name, `%${q}%`)} OR ${ilike(productCatalogTable.item_description, `%${q}%`)})`
      );
    }
    if (product_group_id) conditions.push(eq(productCatalogTable.product_group_id, Number(product_group_id)));
    if (product_type_id) conditions.push(eq(productCatalogTable.product_type_id, Number(product_type_id)));
    if (is_active === "true") conditions.push(eq(productCatalogTable.status, "Active"));
    if (is_active === "false") conditions.push(eq(productCatalogTable.status, "Inactive"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(productCatalogTable)
        .where(where)
        .orderBy(asc(productCatalogTable.name))
        .limit(Number(limit))
        .offset(Number(offset)),
      db.select({ count: sql<number>`count(*)::int` }).from(productCatalogTable).where(where),
    ]);

    const groupIds = [...new Set(rows.map(r => r.product_group_id).filter(Boolean))] as number[];
    const typeIds = [...new Set(rows.map(r => r.product_type_id).filter(Boolean))] as number[];
    const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
    const providerIds = [...new Set(rows.map(r => r.product_provider_account_id).filter(Boolean))] as number[];

    const [groups, types, spaces, providers] = await Promise.all([
      groupIds.length ? db.select().from(productGroupsTable).where(inArray(productGroupsTable.id, groupIds)) : [],
      typeIds.length ? db.select().from(productTypesTable).where(inArray(productTypesTable.id, typeIds)) : [],
      spaceIds.length ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds)) : [],
      providerIds.length ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, providerIds)) : [],
    ]);

    const groupMap = Object.fromEntries(groups.map(g => [g.id, g.name]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]));
    const spaceMap = Object.fromEntries(spaces.map(s => [s.id, s.name]));
    const providerMap = Object.fromEntries(providers.map(a => [a.id, a.name]));

    const data = rows.map(r => ({
      ...r,
      group_name: r.product_group_id ? groupMap[r.product_group_id] ?? null : null,
      type_name: r.product_type_id ? typeMap[r.product_type_id] ?? null : null,
      space_name: r.space_id ? spaceMap[r.space_id] ?? null : null,
      provider_name: r.product_provider_account_id ? providerMap[r.product_provider_account_id] ?? null : null,
    }));

    res.json({ success: true, data, meta: { total: count, limit: Number(limit), offset: Number(offset) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list products" });
  }
});

router.get("/v1/products/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(productCatalogTable).where(eq(productCatalogTable.id, id));
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

router.post("/v1/products", async (req, res): Promise<void> => {
  try {
    const { name, price, product_group_id, ...rest } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(productCatalogTable).values({ name, price, product_group_id, ...rest }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/v1/products/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, ...updates } = req.body;
    const [row] = await db.update(productCatalogTable).set(updates).where(eq(productCatalogTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.patch("/v1/products/:id/deactivate", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.update(productCatalogTable).set({ status: "Inactive" }).where(eq(productCatalogTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate product" });
  }
});

export default router;
