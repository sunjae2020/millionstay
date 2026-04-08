import { Router, type IRouter } from "express";
import { eq, and, asc, desc, inArray, gte, lte, or } from "drizzle-orm";
import {
  db,
  spacesTable,
  propertiesTable,
  spaceOptionMapsTable,
  spaceAvailabilityTable,
  bookingsTable,
  spaceImagesTable,
  spaceOptionsTable,
  accommodationCatalogTable,
  serviceCatalogTable,
} from "@workspace/db";

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function productMinDays(period: number | null, unit: string | null): number | null {
  if (!period) return null;
  switch ((unit ?? "").toLowerCase()) {
    case "nights": return period;
    case "weeks":  return period * 7;
    case "months": return period * 30;
    default:       return period * 7;
  }
}

const router: IRouter = Router();

/* ───────────────────────────────────────────────────────
   GET /api/v1/public/spaces
   Query params: city, min_price, max_price, start_date, end_date
──────────────────────────────────────────────────────── */
router.get("/v1/public/spaces", async (req, res): Promise<void> => {
  const { city, min_price, max_price, start_date, end_date } = req.query as Record<string, string>;

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
      parent_space_id: spacesTable.parent_space_id,
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

  // Filter by city
  let filtered = city
    ? spaces.filter((s) => s.property_city?.toLowerCase().includes(city.toLowerCase()))
    : spaces;

  // Filter by price
  if (min_price) filtered = filtered.filter((s) => Number(s.base_weekly_price) >= Number(min_price));
  if (max_price) filtered = filtered.filter((s) => Number(s.base_weekly_price) <= Number(max_price));

  const spaceIds = filtered.map((s) => s.id);
  const parentIds = [...new Set(filtered.map((s) => s.parent_space_id).filter((id): id is number => id != null))];
  const allRelevantIds = [...new Set([...spaceIds, ...parentIds])];

  // If date range provided, check availability + minimum stay
  let unavailableIds = new Set<number>();
  if (start_date && end_date && spaceIds.length > 0) {
    const requestedDays = daysBetween(start_date, end_date);

    // 1. Manual blocks (space_availability table)
    const blocked = await db
      .select({ space_id: spaceAvailabilityTable.space_id })
      .from(spaceAvailabilityTable)
      .where(
        and(
          inArray(spaceAvailabilityTable.space_id, spaceIds),
          eq(spaceAvailabilityTable.is_available, false),
          gte(spaceAvailabilityTable.date, start_date),
          lte(spaceAvailabilityTable.date, end_date),
        ),
      );

    // 2. Already-booked spaces (Confirmed / Pending / Active overlap)
    const bookedSpaces = await db
      .select({ space_id: bookingsTable.space_id })
      .from(bookingsTable)
      .where(
        and(
          inArray(bookingsTable.space_id as any, spaceIds),
          or(
            and(
              lte(bookingsTable.check_in_date as any, end_date),
              gte(bookingsTable.check_out_date as any, start_date),
            ),
          ),
          inArray(bookingsTable.booking_status, ["Confirmed", "Pending", "Active"]),
        ),
      );

    unavailableIds = new Set([
      ...blocked.map((b) => b.space_id),
      ...bookedSpaces.map((b) => b.space_id).filter((id): id is number => id != null),
    ]);

    if (unavailableIds.size > 0) {
      filtered = filtered.filter((s) => !unavailableIds.has(s.id));
    }

    // 3. Minimum stay filter — products & promotions
    //    Fetch active products for remaining spaces to determine effective minimum
    const remainingIds = filtered.map((s) => s.id);
    if (remainingIds.length > 0) {
      const products = await db
        .select({
          space_id: accommodationCatalogTable.space_id,
          min_contract_period: accommodationCatalogTable.min_contract_period,
          min_contract_period_unit: accommodationCatalogTable.min_contract_period_unit,
        })
        .from(accommodationCatalogTable)
        .where(
          and(
            inArray(accommodationCatalogTable.space_id, remainingIds),
            eq(accommodationCatalogTable.status, "Active"),
          ),
        );

      // Build per-space minimum days map from products
      const productMinBySpace = new Map<number, number>();
      for (const p of products) {
        if (!p.space_id) continue;
        const days = productMinDays(p.min_contract_period, p.min_contract_period_unit);
        if (days == null) continue;
        const cur = productMinBySpace.get(p.space_id);
        // Use the LOWEST product minimum (most permissive plan available)
        if (cur == null || days < cur) productMinBySpace.set(p.space_id, days);
      }

      filtered = filtered.filter((s) => {
        // Effective minimum: lowest product min if products exist, else space.min_stay_weeks * 7
        const effectiveMin = productMinBySpace.has(s.id)
          ? productMinBySpace.get(s.id)!
          : (s.min_stay_weeks ?? 4) * 7;
        return requestedDays >= effectiveMin;
      });
    }
  }

  const [allImages, allOptionMaps] = await Promise.all([
    allRelevantIds.length > 0
      ? db.select().from(spaceImagesTable)
          .where(and(
            inArray(spaceImagesTable.space_id, allRelevantIds),
            eq(spaceImagesTable.is_primary, true),
          ))
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

  const data = filtered.map((s) => {
    let primary = primaryBySpace.get(s.id);
    let imageFromParent = false;
    if (!primary && s.parent_space_id) {
      primary = primaryBySpace.get(s.parent_space_id);
      if (primary) imageFromParent = true;
    }
    return {
      ...s,
      primary_image: primary?.file_url ?? null,
      primary_thumbnail: primary?.thumbnail_url ?? null,
      image_from_parent: imageFromParent,
      space_options: optionsBySpace.get(s.id) ?? [],
    };
  });

  res.json({ success: true, data, meta: { total: data.length } });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/public/spaces/:id
──────────────────────────────────────────────────────── */
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
      parent_space_id: spacesTable.parent_space_id,
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

  const [ownImages, optionMaps, pricingTiers] = await Promise.all([
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
        id: accommodationCatalogTable.id,
        name: accommodationCatalogTable.name,
        price: accommodationCatalogTable.price,
        min_contract_period: accommodationCatalogTable.min_contract_period,
        min_contract_period_unit: accommodationCatalogTable.min_contract_period_unit,
        bond_amount: accommodationCatalogTable.bond_amount,
        admin_fee: accommodationCatalogTable.admin_fee,
        cleaning_fee: accommodationCatalogTable.cleaning_fee,
      })
      .from(accommodationCatalogTable)
      .where(and(
        eq(accommodationCatalogTable.space_id, spaceId),
        eq(accommodationCatalogTable.status, "Active"),
      ))
      .orderBy(asc(accommodationCatalogTable.price)),
  ]);

  let images = ownImages;
  let imagesFromParent = false;

  if (images.length === 0 && space.parent_space_id) {
    const parentImages = await db.select().from(spaceImagesTable)
      .where(eq(spaceImagesTable.space_id, space.parent_space_id))
      .orderBy(desc(spaceImagesTable.is_primary), asc(spaceImagesTable.display_order));

    if (parentImages.length > 0) {
      images = parentImages;
      imagesFromParent = true;
    }
  }

  res.json({
    success: true,
    data: {
      ...space,
      images,
      images_from_parent: imagesFromParent,
      space_options: optionMaps.filter((o) => o.name),
      products: pricingTiers,
    },
  });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/public/spaces/:id/availability
   Query: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
──────────────────────────────────────────────────────── */
router.get("/v1/public/spaces/:id/availability", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const { start_date, end_date } = req.query as Record<string, string>;
  if (!start_date || !end_date) {
    res.status(400).json({ error: "start_date and end_date are required (YYYY-MM-DD)" });
    return;
  }

  // Get blocked dates from space_availability table
  const blockedDates = await db
    .select({
      date: spaceAvailabilityTable.date,
      is_available: spaceAvailabilityTable.is_available,
      block_reason: spaceAvailabilityTable.block_reason,
    })
    .from(spaceAvailabilityTable)
    .where(
      and(
        eq(spaceAvailabilityTable.space_id, spaceId),
        gte(spaceAvailabilityTable.date, start_date),
        lte(spaceAvailabilityTable.date, end_date),
      ),
    );

  // Get confirmed bookings that overlap the date range
  const overlappingBookings = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      booking_status: bookingsTable.booking_status,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.space_id, spaceId),
        or(
          and(
            lte(bookingsTable.check_in_date as any, end_date),
            gte(bookingsTable.check_out_date as any, start_date),
          ),
        ),
        inArray(bookingsTable.booking_status, ["Confirmed", "Pending", "Active"]),
        eq(bookingsTable.status, "Active"),
      ),
    );

  // Determine overall availability
  const manuallyBlocked = blockedDates.filter((d) => !d.is_available);
  const isAvailable = manuallyBlocked.length === 0 && overlappingBookings.length === 0;

  res.json({
    success: true,
    data: {
      space_id: spaceId,
      start_date,
      end_date,
      is_available: isAvailable,
      blocked_dates: manuallyBlocked.map((d) => ({
        date: d.date,
        reason: d.block_reason ?? "Unavailable",
      })),
      booked_periods: overlappingBookings.map((b) => ({
        booking_ref: b.booking_ref,
        check_in: b.check_in_date,
        check_out: b.check_out_date,
        status: b.booking_status,
      })),
    },
  });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/public/properties
──────────────────────────────────────────────────────── */
router.get("/v1/public/properties", async (_req, res): Promise<void> => {
  const properties = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      city: propertiesTable.city,
      state: propertiesTable.state,
      postcode: propertiesTable.postcode,
      country: propertiesTable.country_code,
      lat: propertiesTable.lat,
      lng: propertiesTable.lng,
      description: propertiesTable.description,
      approval_status: propertiesTable.approval_status,
    })
    .from(propertiesTable)
    .orderBy(asc(propertiesTable.name));

  const allSpaces = await db
    .select({ property_id: spacesTable.property_id })
    .from(spacesTable)
    .where(eq(spacesTable.status, "Active"));

  const spacesCountByProperty = new Map<number, number>();
  for (const s of allSpaces) {
    if (s.property_id) {
      spacesCountByProperty.set(s.property_id, (spacesCountByProperty.get(s.property_id) ?? 0) + 1);
    }
  }

  const data = properties
    .filter((p) => p.approval_status === "Approved" || true) // show all; landing page can filter
    .map((p) => ({
      ...p,
      active_spaces: spacesCountByProperty.get(p.id) ?? 0,
    }));

  res.json({ success: true, data, meta: { total: data.length } });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/public/services
   Returns optional services for display on booking page
──────────────────────────────────────────────────────── */
router.get("/v1/public/services", async (req, res): Promise<void> => {
  try {
    const services = await db
      .select({
        id: serviceCatalogTable.id,
        name: serviceCatalogTable.name,
        description: serviceCatalogTable.description,
        service_type: serviceCatalogTable.service_type,
        base_price: serviceCatalogTable.base_price,
        currency: serviceCatalogTable.currency,
        is_optional: serviceCatalogTable.is_optional,
        is_refundable: serviceCatalogTable.is_refundable,
        billing_trigger: serviceCatalogTable.billing_trigger,
        requires_scheduling: serviceCatalogTable.requires_scheduling,
        scheduling_notes: serviceCatalogTable.scheduling_notes,
        sort_order: serviceCatalogTable.sort_order,
      })
      .from(serviceCatalogTable)
      .where(and(
        eq(serviceCatalogTable.status, "Active"),
        eq(serviceCatalogTable.display_on_booking_page, true),
        eq(serviceCatalogTable.is_optional, true),
      ))
      .orderBy(asc(serviceCatalogTable.sort_order), asc(serviceCatalogTable.name));

    res.json({ success: true, data: services });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

export default router;
