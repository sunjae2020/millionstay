import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db, spacesTable, propertiesTable, spaceOptionMapsTable, spaceAvailabilityTable } from "@workspace/db";
import { spaceImagesTable } from "@workspace/db";
import { spaceOptionsTable, productCatalogTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/v1/public/spaces", async (_req, res): Promise<void> => {
  const spaces = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      space_type: spacesTable.space_type,
      booking_mode: spacesTable.booking_mode,
      max_occupancy: spacesTable.max_occupancy,
      base_weekly_price: spacesTable.base_weekly_price,
      base_currency: spacesTable.base_currency,
      min_stay_weeks: spacesTable.min_stay_weeks,
      description: spacesTable.description,
      status: spacesTable.status,
      property_id: spacesTable.property_id,
      property_name: propertiesTable.name,
      property_address: propertiesTable.address,
      property_city: propertiesTable.city,
      property_state: propertiesTable.state,
      latitude: propertiesTable.lat,
      longitude: propertiesTable.lng,
    })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(eq(spacesTable.status, "Active"))
    .orderBy(asc(spacesTable.id));

  const spaceIds = spaces.map((s) => s.id);

  const [allImages, allOptionMaps] = await Promise.all([
    spaceIds.length > 0
      ? db.select().from(spaceImagesTable)
          .where(eq(spaceImagesTable.is_primary, true))
          .orderBy(desc(spaceImagesTable.is_primary))
      : Promise.resolve([]),
    spaceIds.length > 0
      ? db.select({
          space_id: spaceOptionMapsTable.space_id,
          name: spaceOptionsTable.name,
        })
          .from(spaceOptionMapsTable)
          .leftJoin(spaceOptionsTable, eq(spaceOptionMapsTable.space_option_id, spaceOptionsTable.id))
      : Promise.resolve([]),
  ]);

  const primaryBySpace = new Map<number, (typeof allImages)[number]>();
  for (const img of allImages) {
    if (!primaryBySpace.has(img.space_id)) primaryBySpace.set(img.space_id, img);
  }

  const optionsBySpace = new Map<number, string[]>();
  for (const row of allOptionMaps) {
    const arr = optionsBySpace.get(row.space_id) ?? [];
    if (row.name) arr.push(row.name);
    optionsBySpace.set(row.space_id, arr);
  }

  const data = spaces.map((s) => {
    const primary = primaryBySpace.get(s.id);
    return {
      ...s,
      primary_image: primary?.file_url ?? null,
      primary_thumbnail: primary?.thumbnail_url ?? null,
      space_options: optionsBySpace.get(s.id) ?? [],
    };
  });

  res.json({ success: true, data, meta: { total: data.length } });
});

router.get("/v1/public/spaces/:id", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      space_type: spacesTable.space_type,
      booking_mode: spacesTable.booking_mode,
      max_occupancy: spacesTable.max_occupancy,
      base_weekly_price: spacesTable.base_weekly_price,
      base_currency: spacesTable.base_currency,
      min_stay_weeks: spacesTable.min_stay_weeks,
      description: spacesTable.description,
      status: spacesTable.status,
      floor_number: spacesTable.floor_number,
      floor_area_sqm: spacesTable.floor_area_sqm,
      property_id: spacesTable.property_id,
      property_name: propertiesTable.name,
      property_address: propertiesTable.address,
      property_city: propertiesTable.city,
      property_state: propertiesTable.state,
      property_postcode: propertiesTable.postcode,
      latitude: propertiesTable.lat,
      longitude: propertiesTable.lng,
    })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const [images, optionMaps, pricingTiers] = await Promise.all([
    db.select().from(spaceImagesTable)
      .where(eq(spaceImagesTable.space_id, spaceId))
      .orderBy(desc(spaceImagesTable.is_primary), asc(spaceImagesTable.display_order)),
    db.select({
      name: spaceOptionsTable.name,
      display_name: spaceOptionsTable.display_name,
      option_category: spaceOptionsTable.category,
    })
      .from(spaceOptionMapsTable)
      .leftJoin(spaceOptionsTable, eq(spaceOptionMapsTable.space_option_id, spaceOptionsTable.id))
      .where(eq(spaceOptionMapsTable.space_id, spaceId)),
    db.select({
      id: productCatalogTable.id,
      name: productCatalogTable.name,
      price: productCatalogTable.price,
      min_contract_period: productCatalogTable.min_contract_period,
      min_contract_period_unit: productCatalogTable.min_contract_period_unit,
    })
      .from(productCatalogTable)
      .where(and(
        eq(productCatalogTable.space_id, spaceId),
        eq(productCatalogTable.is_active, true),
      ))
      .orderBy(asc(productCatalogTable.price)),
  ]);

  res.json({
    success: true,
    data: {
      ...space,
      images,
      space_options: optionMaps.filter((o) => o.name),
      pricing_tiers: pricingTiers,
    },
  });
});

export default router;
