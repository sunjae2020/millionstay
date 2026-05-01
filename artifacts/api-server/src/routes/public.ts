import { Router, type IRouter } from "express";
import { eq, and, asc, desc, inArray, gte, lte, or, isNull, ilike, SQL } from "drizzle-orm";
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
  accommodationServiceCatalogTable,
  serviceCatalogTable,
  spaceServiceCatalogTable,
  spacePoliciesTable,
  contractsTable,
  blogPostsTable,
  leadsTable,
  suburbsTable,
  exchangeRatesTable,
} from "@workspace/db";
import { insertLeadWithGeneratedRef } from "../lib/leadRef.js";
import { sendLeadNotificationEmail } from "../lib/email.js";

function notifyLead(row: { lead_ref: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null; message?: string | null; description?: string | null }, inquiryType: string) {
  // Fire-and-forget — never block the response or surface errors to the public.
  void sendLeadNotificationEmail({
    leadRef: row.lead_ref ?? "—",
    inquiryType,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? null,
    message: row.message ?? null,
    description: row.description ?? null,
  }).catch((err) => console.error("[notifyLead] failed:", err));
}

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
   Query params: suburb_id, city, space_type, gender_policy,
                 min_price, max_price, start_date, end_date,
                 limit, offset
──────────────────────────────────────────────────────── */
router.get("/v1/public/spaces", async (req, res): Promise<void> => {
  const {
    city, suburb_id, space_type, gender_policy,
    min_price, max_price, start_date, end_date,
    limit: limitStr = "20", offset: offsetStr = "0",
  } = req.query as Record<string, string>;

  const limit  = Math.min(Number(limitStr)  || 20, 100);
  const offset = Number(offsetStr) || 0;
  const today  = new Date().toISOString().split("T")[0];

  /* ── Step 1: Always-on occupancy exclusions ──────────────────── */
  // Exclude spaces with any active/ongoing booking (check_out hasn't passed)
  // Exclude spaces with any Signed/Active contract that hasn't ended yet
  const [ongoingBookings, ongoingContracts] = await Promise.all([
    db.select({ space_id: bookingsTable.space_id })
      .from(bookingsTable)
      .where(and(
        inArray(bookingsTable.booking_status, ["Confirmed", "Pending", "Active"]),
        gte(bookingsTable.check_out_date as any, today),
        eq(bookingsTable.status, "Active"),
      )),
    db.select({ space_id: contractsTable.space_id })
      .from(contractsTable)
      .where(and(
        inArray(contractsTable.status, ["Signed", "Active"]),
        or(isNull(contractsTable.end_date), gte(contractsTable.end_date as any, today)),
      )),
  ]);

  const alwaysExcluded = new Set<number>([
    ...ongoingBookings.map((r) => r.space_id).filter((id): id is number => id != null),
    ...ongoingContracts.map((r) => r.space_id).filter((id): id is number => id != null),
  ]);

  /* ── Step 2: Build base DB conditions ───────────────────────── */
  // Map frontend space_type values to DB values
  const SPACE_TYPE_MAP: Record<string, string> = {
    EntireSpace: "Whole Property",
    RoomSpace:   "Private Room",
    BedSpace:    "Shared Room",
  };
  const dbSpaceType = space_type ? (SPACE_TYPE_MAP[space_type] ?? space_type) : null;

  const conditions: SQL[] = [eq(spacesTable.status, "Active")];
  if (dbSpaceType) conditions.push(eq(spacesTable.space_type, dbSpaceType));
  if (suburb_id)  conditions.push(eq(propertiesTable.suburb_id, Number(suburb_id)));
  // Gender policy via space_policies join
  if (gender_policy === "FemaleOnly") {
    conditions.push(eq(spacePoliciesTable.lady_only, true));
  } else if (gender_policy === "Mixed") {
    conditions.push(or(isNull(spacePoliciesTable.id), eq(spacePoliciesTable.lady_only, false)) as SQL);
  }

  /* ── Step 3: Fetch all matching spaces ──────────────────────── */
  const allSpaces = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      space_type: spacesTable.space_type,
      booking_mode: spacesTable.booking_mode,
      max_occupancy: spacesTable.max_occupancy,
      base_weekly_price: spacesTable.base_weekly_price,
      base_daily_price: spacesTable.base_daily_price,
      base_currency: spacesTable.base_currency,
      description: spacesTable.description,
      status: spacesTable.status,
      property_id: spacesTable.property_id,
      parent_space_id: spacesTable.parent_space_id,
      property_name: propertiesTable.name,
      property_address: propertiesTable.address,
      property_city: propertiesTable.city,
      property_state: propertiesTable.state,
      property_suburb_id: propertiesTable.suburb_id,
      latitude: propertiesTable.lat,
      longitude: propertiesTable.lng,
      policy_lady_only: spacePoliciesTable.lady_only,
      policy_same_gender: spacePoliciesTable.same_gender,
    })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(spacePoliciesTable, eq(spacesTable.space_policy_id, spacePoliciesTable.id))
    .where(and(...conditions))
    .orderBy(asc(spacesTable.id));

  /* ── Step 4: In-memory filters ─────────────────────────────── */
  let filtered = allSpaces;

  // City text search
  if (city) filtered = filtered.filter((s) => s.property_city?.toLowerCase().includes(city.toLowerCase()));

  // Always-on occupancy exclusion
  filtered = filtered.filter((s) => !alwaysExcluded.has(s.id));

  // Price range
  if (min_price) filtered = filtered.filter((s) => Number(s.base_weekly_price) >= Number(min_price));
  if (max_price) filtered = filtered.filter((s) => Number(s.base_weekly_price) <= Number(max_price));

  /* ── Step 5: Date-range specific exclusions ─────────────────── */
  if (start_date && end_date && filtered.length > 0) {
    const requestedDays = daysBetween(start_date, end_date);
    const filteredIds = filtered.map((s) => s.id);

    const [blocked, bookedSpaces, contractedSpaces] = await Promise.all([
      // Manual availability blocks
      db.select({ space_id: spaceAvailabilityTable.space_id })
        .from(spaceAvailabilityTable)
        .where(and(
          inArray(spaceAvailabilityTable.space_id, filteredIds),
          eq(spaceAvailabilityTable.is_available, false),
          gte(spaceAvailabilityTable.date, start_date),
          lte(spaceAvailabilityTable.date, end_date),
        )),
      // Overlapping bookings
      db.select({ space_id: bookingsTable.space_id })
        .from(bookingsTable)
        .where(and(
          inArray(bookingsTable.space_id as any, filteredIds),
          or(and(
            lte(bookingsTable.check_in_date as any, end_date),
            gte(bookingsTable.check_out_date as any, start_date),
          )),
          inArray(bookingsTable.booking_status, ["Confirmed", "Pending", "Active"]),
        )),
      // Overlapping contracts
      db.select({ space_id: contractsTable.space_id })
        .from(contractsTable)
        .where(and(
          inArray(contractsTable.space_id as any, filteredIds),
          inArray(contractsTable.status, ["Signed", "Active"]),
          lte(contractsTable.start_date as any, end_date),
          or(isNull(contractsTable.end_date), gte(contractsTable.end_date as any, start_date)),
        )),
    ]);

    const dateUnavailable = new Set<number>([
      ...blocked.map((b) => b.space_id),
      ...bookedSpaces.map((b) => b.space_id).filter((id): id is number => id != null),
      ...contractedSpaces.map((c) => c.space_id).filter((id): id is number => id != null),
    ]);

    filtered = filtered.filter((s) => !dateUnavailable.has(s.id));

    // Minimum contract period check
    if (filtered.length > 0) {
      const remainingIds = filtered.map((s) => s.id);
      const products = await db
        .select({
          space_id: accommodationCatalogTable.space_id,
          min_contract_period: accommodationCatalogTable.min_contract_period,
          min_contract_period_unit: accommodationCatalogTable.min_contract_period_unit,
        })
        .from(accommodationCatalogTable)
        .where(and(
          inArray(accommodationCatalogTable.space_id, remainingIds),
          eq(accommodationCatalogTable.status, "Active"),
        ));

      const productMinBySpace = new Map<number, number>();
      for (const p of products) {
        if (!p.space_id) continue;
        const days = productMinDays(p.min_contract_period, p.min_contract_period_unit);
        if (days == null) continue;
        const cur = productMinBySpace.get(p.space_id);
        // Use the lowest minimum (most permissive plan)
        if (cur == null || days < cur) productMinBySpace.set(p.space_id, days);
      }

      filtered = filtered.filter((s) => {
        const effectiveMin = productMinBySpace.has(s.id) ? productMinBySpace.get(s.id)! : 1;
        return requestedDays >= effectiveMin;
      });
    }
  }

  /* ── Step 6: Total count + pagination ───────────────────────── */
  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  /* ── Step 7: Fetch images + options for paginated results ────── */
  const paginatedIds = paginated.map((s) => s.id);
  const parentIds = [...new Set(paginated.map((s) => s.parent_space_id).filter((id): id is number => id != null))];
  const allRelevantIds = [...new Set([...paginatedIds, ...parentIds])];

  const [allImages, allOptionMaps, mandatoryServiceRows] = await Promise.all([
    allRelevantIds.length > 0
      ? db.select().from(spaceImagesTable)
          .where(and(
            inArray(spaceImagesTable.space_id, allRelevantIds),
            eq(spaceImagesTable.is_primary, true),
          ))
          .orderBy(desc(spaceImagesTable.is_primary))
      : Promise.resolve([]),
    paginatedIds.length > 0
      ? db.select({
            space_id: spaceOptionMapsTable.space_id,
            name: spaceOptionsTable.name,
            display_name: spaceOptionsTable.display_name,
          })
          .from(spaceOptionMapsTable)
          .leftJoin(spaceOptionsTable, eq(spaceOptionMapsTable.space_option_id, spaceOptionsTable.id))
          .where(inArray(spaceOptionMapsTable.space_id, paginatedIds))
      : Promise.resolve([]),
    // Mandatory services: fetch via accommodation product → service mapping
    paginatedIds.length > 0
      ? db.select({
            space_id: accommodationCatalogTable.space_id,
            service_name: serviceCatalogTable.name,
          })
          .from(accommodationCatalogTable)
          .innerJoin(
            accommodationServiceCatalogTable,
            eq(accommodationServiceCatalogTable.accommodation_id, accommodationCatalogTable.id),
          )
          .innerJoin(serviceCatalogTable, eq(accommodationServiceCatalogTable.service_id, serviceCatalogTable.id))
          .where(and(
            inArray(accommodationCatalogTable.space_id, paginatedIds),
            eq(accommodationCatalogTable.status, "Active"),
            eq(accommodationServiceCatalogTable.is_mandatory, true),
            eq(serviceCatalogTable.status, "Active"),
          ))
      : Promise.resolve([]),
  ]);

  const primaryBySpace = new Map<number, (typeof allImages)[number]>();
  for (const img of allImages) {
    if (!primaryBySpace.has(img.space_id)) primaryBySpace.set(img.space_id, img);
  }

  const optionsBySpace = new Map<number, string[]>();
  for (const row of allOptionMaps) {
    const arr = optionsBySpace.get(row.space_id) ?? [];
    const label = row.display_name ?? row.name;
    if (label) arr.push(label);
    optionsBySpace.set(row.space_id, arr);
  }

  // Unique mandatory services per space
  const mandatoryBySpace = new Map<number, string[]>();
  for (const row of mandatoryServiceRows) {
    if (!row.space_id || !row.service_name) continue;
    const arr = mandatoryBySpace.get(row.space_id) ?? [];
    if (!arr.includes(row.service_name)) arr.push(row.service_name);
    mandatoryBySpace.set(row.space_id, arr);
  }

  const data = paginated.map((s) => {
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
      mandatory_services: mandatoryBySpace.get(s.id) ?? [],
    };
  });

  res.json({ success: true, data, meta: { total, limit, offset } });
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
      base_daily_price: spacesTable.base_daily_price,
      base_currency: spacesTable.base_currency,
      description: spacesTable.description,
      status: spacesTable.status,
      floor_number: spacesTable.floor_number,
      floor_area_sqm: spacesTable.floor_area_sqm,
      property_id: spacesTable.property_id,
      parent_space_id: spacesTable.parent_space_id,
      property_name: propertiesTable.name,
      property_address: propertiesTable.address,
      property_address2: propertiesTable.address2,
      property_city: propertiesTable.city,
      property_state: propertiesTable.state,
      property_postcode: propertiesTable.postcode,
      latitude: propertiesTable.lat,
      longitude: propertiesTable.lng,
      privacy_hide_unit_no: spacesTable.privacy_hide_unit_no,
      privacy_hide_street_no: spacesTable.privacy_hide_street_no,
      privacy_map_blur: spacesTable.privacy_map_blur,
    })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  // ── Apply privacy settings ────────────────────────────────────────────────
  // Address masking: hide unit no. or street no. from public display
  function applyAddressPrivacy(address: string | null, address2: string | null): string {
    if (!address) return "";
    let addr = address.trim();
    // Detect unit format: "1/285 La Trobe St" or "Unit 1, 285 La Trobe St"
    const slashMatch = addr.match(/^(\w+)\/(.+)$/);      // "1/285 Street"
    const unitMatch  = addr.match(/^(?:Unit|unit)\s+\S+,?\s*(.+)$/);
    const hasUnit    = !!(slashMatch || unitMatch || address2?.trim());

    if (hasUnit && space.privacy_hide_unit_no) {
      if (slashMatch) {
        addr = slashMatch[2];            // strip "1/" → "285 La Trobe St"
      } else if (unitMatch) {
        addr = unitMatch[1];             // strip "Unit 1, " prefix
      }
      // address2 is already omitted from public response
    } else if (!hasUnit && space.privacy_hide_street_no) {
      // Remove leading street number ("285 La Trobe St" → "La Trobe St")
      addr = addr.replace(/^\d+\w*\s+/, "");
    }
    return addr;
  }

  // Map blur: deterministic offset ~30–40 m using golden-angle rotation
  function applyMapBlur(lat: number | null, lng: number | null, id: number): { lat: number; lng: number } | null {
    if (lat == null || lng == null) return null;
    const BLUR_M = 35;
    const angle  = (id * 137.508) % 360;              // golden angle × id (degrees)
    const rad    = (angle * Math.PI) / 180;
    const dLat   = (BLUR_M * Math.cos(rad)) / 111_000;
    const dLng   = (BLUR_M * Math.sin(rad)) / (111_000 * Math.cos((lat * Math.PI) / 180));
    return { lat: lat + dLat, lng: lng + dLng };
  }

  const publicAddress = applyAddressPrivacy(space.property_address, space.property_address2 ?? null);
  const blurredCoords = space.privacy_map_blur
    ? applyMapBlur(space.latitude ? Number(space.latitude) : null, space.longitude ? Number(space.longitude) : null, spaceId)
    : null;
  const publicLat = space.privacy_map_blur ? blurredCoords?.lat ?? null : (space.latitude ? Number(space.latitude) : null);
  const publicLng = space.privacy_map_blur ? blurredCoords?.lng ?? null : (space.longitude ? Number(space.longitude) : null);

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
      property_address: publicAddress,
      property_address2: undefined,           // never expose raw address2
      latitude: publicLat,
      longitude: publicLng,
      privacy_map_blur: space.privacy_map_blur ?? false,
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
    const { space_id, accommodation_product_id } = req.query as { space_id?: string; accommodation_product_id?: string };
    const spaceId = space_id ? parseInt(space_id, 10) : null;
    const accProductId = accommodation_product_id ? parseInt(accommodation_product_id, 10) : null;

    // Priority 1: accommodation product-level services
    if (accProductId) {
      const accMappings = await db
        .select({
          map_id: accommodationServiceCatalogTable.id,
          is_mandatory: accommodationServiceCatalogTable.is_mandatory,
          custom_price: accommodationServiceCatalogTable.custom_price,
          sort_order: accommodationServiceCatalogTable.sort_order,
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
        })
        .from(accommodationServiceCatalogTable)
        .innerJoin(serviceCatalogTable, eq(accommodationServiceCatalogTable.service_id, serviceCatalogTable.id))
        .where(and(
          eq(accommodationServiceCatalogTable.accommodation_id, accProductId),
          eq(serviceCatalogTable.status, "Active"),
        ))
        .orderBy(asc(accommodationServiceCatalogTable.sort_order), asc(serviceCatalogTable.name));

      if (accMappings.length > 0) {
        const data = accMappings.map(row => ({
          ...row,
          base_price: row.custom_price ?? row.base_price,
        }));
        res.json({ success: true, data, source: "accommodation_product" });
        return;
      }
      // Fall through to space-level if accommodation product has no services defined
    }

    // Priority 2: space-level services
    if (spaceId) {
      const spaceMappings = await db
        .select({
          map_id: spaceServiceCatalogTable.id,
          is_mandatory: spaceServiceCatalogTable.is_mandatory,
          custom_price: spaceServiceCatalogTable.custom_price,
          sort_order: spaceServiceCatalogTable.sort_order,
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
        })
        .from(spaceServiceCatalogTable)
        .innerJoin(serviceCatalogTable, eq(spaceServiceCatalogTable.service_id, serviceCatalogTable.id))
        .where(and(
          eq(spaceServiceCatalogTable.space_id, spaceId),
          eq(serviceCatalogTable.status, "Active"),
        ))
        .orderBy(asc(spaceServiceCatalogTable.sort_order), asc(serviceCatalogTable.name));

      if (spaceMappings.length > 0) {
        const data = spaceMappings.map(row => ({
          ...row,
          // Use custom_price if set, otherwise fall back to base_price
          base_price: row.custom_price ?? row.base_price,
        }));
        res.json({ success: true, data, source: "space" });
        return;
      }
      // Fall through to global catalog if no space-specific services defined
    }

    // Global fallback: all active optional services shown on booking page
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

    res.json({ success: true, data: services, source: "global" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/suburbs
   Public listing of suburbs for guest-side search filters.
   Mounted before requireAuth so the homepage/search page
   can populate suburb dropdowns without authentication.
──────────────────────────────────────────────────────── */
router.get("/v1/suburbs", async (req, res): Promise<void> => {
  const { country_code, state, search } = req.query as Record<string, string>;
  const conditions: SQL[] = [isNull(suburbsTable.deleted_at), eq(suburbsTable.status, "Active")];
  if (country_code) conditions.push(eq(suburbsTable.country_code, country_code));
  if (state) conditions.push(eq(suburbsTable.state, state));
  if (search) {
    conditions.push(or(
      ilike(suburbsTable.name, `%${search}%`),
      ilike(suburbsTable.area_name, `%${search}%`),
    ) as SQL);
  }
  const rows = await db.select().from(suburbsTable).where(and(...conditions)).orderBy(asc(suburbsTable.name));
  res.json({ data: rows });
});

router.get("/v1/public/blog", async (req, res): Promise<void> => {
  const { limit, category } = req.query as Record<string, string>;
  const conditions: SQL[] = [
    isNull(blogPostsTable.deleted_at),
    eq(blogPostsTable.status, "Published"),
  ];
  if (category) conditions.push(eq(blogPostsTable.category, category));
  const rows = await db.select({
    id: blogPostsTable.id,
    title: blogPostsTable.title,
    slug: blogPostsTable.slug,
    excerpt: blogPostsTable.excerpt,
    cover_image_url: blogPostsTable.cover_image_url,
    category: blogPostsTable.category,
    author: blogPostsTable.author,
    published_at: blogPostsTable.published_at,
    created_at: blogPostsTable.created_at,
  })
    .from(blogPostsTable)
    .where(and(...conditions))
    .orderBy(desc(blogPostsTable.published_at))
    .limit(Number(limit) || 20);
  res.json({ data: rows });
});

router.get("/v1/public/blog/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [row] = await db.select().from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, slug), eq(blogPostsTable.status, "Published"), isNull(blogPostsTable.deleted_at)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/public/owner-applications
   Public form for prospective property owners to apply
   to list their property with MillionStay.
──────────────────────────────────────────────────────── */
router.post("/v1/public/owner-applications", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const first_name = String(b.first_name ?? "").trim();
  const last_name = String(b.last_name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const phone = b.phone ? String(b.phone).trim() : null;
  const property_address = b.property_address ? String(b.property_address).trim() : "";
  const property_city = b.property_city ? String(b.property_city).trim() : "";
  const property_type = b.property_type ? String(b.property_type).trim() : "";
  const bedrooms = b.bedrooms !== undefined && b.bedrooms !== null && b.bedrooms !== ""
    ? Number(b.bedrooms) : null;
  const message = b.message ? String(b.message).trim() : "";

  if (!first_name || !last_name) {
    res.status(400).json({ error: "first_name and last_name are required" }); return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "valid email is required" }); return;
  }
  if (!property_address) {
    res.status(400).json({ error: "property_address is required" }); return;
  }

  const descLines = [
    `Property address: ${property_address}`,
    property_city ? `City / Suburb: ${property_city}` : null,
    property_type ? `Property type: ${property_type}` : null,
    bedrooms != null && !Number.isNaN(bedrooms) ? `Bedrooms: ${bedrooms}` : null,
  ].filter(Boolean).join("\n");

  const row = await insertLeadWithGeneratedRef({
    first_name,
    last_name,
    email,
    phone,
    lead_source: "OwnerPortal",
    inquiry_type: "OwnerApplication",
    lead_status: "New",
    message: message || null,
    description: descLines || null,
    manual_input: false,
    status: "Active",
  });

  notifyLead(row, "Owner Application");
  res.status(201).json({ success: true, lead_ref: row.lead_ref, id: row.id });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/public/agent-applications
   Public form for prospective real-estate / leasing agents
   to apply to partner with MillionStay.
──────────────────────────────────────────────────────── */
router.post("/v1/public/agent-applications", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const first_name = String(b.first_name ?? "").trim();
  const last_name = String(b.last_name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const phone = b.phone ? String(b.phone).trim() : null;
  const agency_name = b.agency_name ? String(b.agency_name).trim() : "";
  const license_number = b.license_number ? String(b.license_number).trim() : "";
  const coverage_area = b.coverage_area ? String(b.coverage_area).trim() : "";
  const years_experience = b.years_experience !== undefined && b.years_experience !== null && b.years_experience !== ""
    ? Number(b.years_experience) : null;
  const message = b.message ? String(b.message).trim() : "";

  if (!first_name || !last_name) {
    res.status(400).json({ error: "first_name and last_name are required" }); return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "valid email is required" }); return;
  }

  const desc = [
    agency_name ? `Agency: ${agency_name}` : null,
    license_number ? `License #: ${license_number}` : null,
    coverage_area ? `Coverage area: ${coverage_area}` : null,
    years_experience != null && !Number.isNaN(years_experience) ? `Years experience: ${years_experience}` : null,
  ].filter(Boolean).join("\n");

  const row = await insertLeadWithGeneratedRef({
    first_name, last_name, email, phone,
    lead_source: "AgentPortal",
    inquiry_type: "AgentApplication",
    lead_status: "New",
    message: message || null,
    description: desc || null,
    manual_input: false,
    status: "Active",
  });

  notifyLead(row, "Agent Application");
  res.status(201).json({ success: true, lead_ref: row.lead_ref, id: row.id });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/public/service-host-applications
   Public form for prospective service hosts (cleaners,
   maintenance, linen) to apply to partner with MillionStay.
──────────────────────────────────────────────────────── */
router.post("/v1/public/service-host-applications", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const first_name = String(b.first_name ?? "").trim();
  const last_name = String(b.last_name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const phone = b.phone ? String(b.phone).trim() : null;
  const business_name = b.business_name ? String(b.business_name).trim() : "";
  const abn = b.abn ? String(b.abn).trim() : "";
  const service_types: string[] = Array.isArray(b.service_types)
    ? b.service_types.map((s: unknown) => String(s).trim()).filter(Boolean)
    : (b.service_types ? [String(b.service_types).trim()] : []);
  const service_area = b.service_area ? String(b.service_area).trim() : "";
  const years_experience = b.years_experience !== undefined && b.years_experience !== null && b.years_experience !== ""
    ? Number(b.years_experience) : null;
  const message = b.message ? String(b.message).trim() : "";

  if (!first_name || !last_name) {
    res.status(400).json({ error: "first_name and last_name are required" }); return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "valid email is required" }); return;
  }
  if (service_types.length === 0) {
    res.status(400).json({ error: "at least one service_type is required" }); return;
  }

  const desc = [
    `Services offered: ${service_types.join(", ")}`,
    business_name ? `Business: ${business_name}` : null,
    abn ? `ABN: ${abn}` : null,
    service_area ? `Service area: ${service_area}` : null,
    years_experience != null && !Number.isNaN(years_experience) ? `Years experience: ${years_experience}` : null,
  ].filter(Boolean).join("\n");

  const row = await insertLeadWithGeneratedRef({
    first_name, last_name, email, phone,
    lead_source: "ServiceHostPortal",
    inquiry_type: "ServiceHostApplication",
    lead_status: "New",
    message: message || null,
    description: desc || null,
    manual_input: false,
    status: "Active",
  });

  notifyLead(row, "Service Host Application");
  res.status(201).json({ success: true, lead_ref: row.lead_ref, id: row.id });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/public/contact-inquiries
   General Contact Us form on the marketing website.
──────────────────────────────────────────────────────── */
router.post("/v1/public/contact-inquiries", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const first_name = String(b.first_name ?? "").trim();
  const last_name = String(b.last_name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const phone = b.phone ? String(b.phone).trim() : null;
  const subject = b.subject ? String(b.subject).trim() : "";
  const message = b.message ? String(b.message).trim() : "";

  if (!first_name) {
    res.status(400).json({ error: "first_name is required" }); return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "valid email is required" }); return;
  }
  if (!message) {
    res.status(400).json({ error: "message is required" }); return;
  }

  const desc = subject ? `Subject: ${subject}` : null;

  const row = await insertLeadWithGeneratedRef({
    first_name,
    last_name: last_name || "—",
    email,
    phone,
    lead_source: "Website",
    inquiry_type: "ContactUs",
    lead_status: "New",
    message: message || null,
    description: desc,
    manual_input: false,
    status: "Active",
  });

  notifyLead(row, "Contact Us");
  res.status(201).json({ success: true, lead_ref: row.lead_ref, id: row.id });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/public/student-inquiries
   For Students enquiry form on the marketing website.
──────────────────────────────────────────────────────── */
router.post("/v1/public/student-inquiries", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const phone = b.phone ? String(b.phone).trim() : null;
  const university = b.university ? String(b.university).trim() : "";
  const visa = b.visa ? String(b.visa).trim() : "";
  const message = b.message ? String(b.message).trim() : "";

  if (!name) {
    res.status(400).json({ error: "name is required" }); return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "valid email is required" }); return;
  }

  // Split single name field into first/last on the first space.
  const nameParts = name.split(/\s+/);
  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(" ") || "—";

  const desc = [
    university ? `University: ${university}` : null,
    visa ? `Visa: ${visa}` : null,
  ].filter(Boolean).join("\n") || null;

  const row = await insertLeadWithGeneratedRef({
    first_name,
    last_name,
    email,
    phone,
    lead_source: "Website",
    inquiry_type: "StudentEnquiry",
    lead_status: "New",
    message: message || null,
    description: desc,
    manual_input: false,
    status: "Active",
  });

  notifyLead(row, "Student Enquiry");
  res.status(201).json({ success: true, lead_ref: row.lead_ref, id: row.id });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/public/exchange-rates
   No auth. Returns latest rate per currency, normalised to
   { rate: 1 X = N AUD, inverse: 1 AUD = N X }.
──────────────────────────────────────────────────────── */
router.get("/v1/public/exchange-rates", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(exchangeRatesTable)
    .orderBy(desc(exchangeRatesTable.effective_date), desc(exchangeRatesTable.id));

  // Take the latest row per (from, to) pair
  const latest = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const key = `${r.from_currency}->${r.to_currency}`;
    if (!latest.has(key)) latest.set(key, r);
  }

  const out: Record<string, { rate: number; inverse: number; source: string; effective_date: string }> = {};
  let updatedAt: string | null = null;

  for (const r of latest.values()) {
    const rate = Number(r.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;

    if (r.to_currency === "AUD" && r.from_currency !== "AUD") {
      // 1 from = rate AUD
      out[r.from_currency] = {
        rate,
        inverse: 1 / rate,
        source: r.source,
        effective_date: String(r.effective_date),
      };
    } else if (r.from_currency === "AUD" && r.to_currency !== "AUD") {
      // 1 AUD = rate X  →  1 X = 1/rate AUD
      out[r.to_currency] = {
        rate: 1 / rate,
        inverse: rate,
        source: r.source,
        effective_date: String(r.effective_date),
      };
    }

    const ts = r.updated_at ? new Date(r.updated_at as any).toISOString() : null;
    if (ts && (!updatedAt || ts > updatedAt)) updatedAt = ts;
  }

  // AUD always present at 1:1
  out["AUD"] = { rate: 1, inverse: 1, source: "system", effective_date: new Date().toISOString().slice(0, 10) };

  res.json({
    success: true,
    data: {
      baseCurrency: "AUD",
      updatedAt,
      rates: out,
    },
  });
});

export default router;
