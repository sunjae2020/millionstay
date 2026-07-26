import { Router, type IRouter } from "express";
import { eq, ne, ilike, and, between, gte, lte, SQL, or, isNull, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingDocumentsTable,
  bookingServicesTable,
  accountsTable,
  contactsTable,
  spacesTable,
  propertiesTable,
  spaceBlockedDatesTable,
  contractsTable,
  recurringSchedulesTable,
  contractProductsTable,
  contractLineItemsTable,
  accommodationCatalogTable,
  bookingServicePhotosTable,
} from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { getRateToAud } from "../lib/rateSnapshot";
import { createBookingRecurringSchedule } from "../lib/billing/bookingSchedule";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  ListBookingsQueryParams,
  CreateBookingBody,
  GetBookingParams,
  UpdateBookingParams,
  DeleteBookingParams,
  CancelBookingBody,
  ExtendBookingBody,
  CreateBookingDocumentBody,
  RejectBookingDocumentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildBookingResponse(booking: typeof bookingsTable.$inferSelect) {
  const [account] = booking.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, booking.account_id))
    : [null];
  const [contact] = booking.contact_id
    ? await db.select().from(contactsTable).where(eq(contactsTable.id, booking.contact_id))
    : [null];
  const [space] = booking.space_id
    ? await db.select().from(spacesTable).where(eq(spacesTable.id, booking.space_id))
    : [null];
  const [property] = space?.property_id
    ? await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id))
    : [null];

  return {
    ...booking,
    account_name: account?.name ?? null,
    contact_name: contact ? `${contact.first_name} ${contact.last_name}`.trim() : null,
    space_name: space?.name ?? null,
    space_type: space?.space_type ?? null,
    booking_mode: space?.booking_mode ?? null,
    property_address: property ? `${property.address ?? ""} ${property.city ?? ""}`.trim() : null,
  };
}

async function generateBookingRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(ilike(bookingsTable.booking_ref, `MS-${year}-%`))
    .orderBy(bookingsTable.id);
  const count = rows.length + 1;
  return `MS-${year}-${String(count).padStart(5, "0")}`;
}

function calcStayDetails(checkIn: string, checkOut: string, weeklyRate: string | null | undefined) {
  const cin = new Date(checkIn);
  const cout = new Date(checkOut);
  const nights = Math.round((cout.getTime() - cin.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = parseFloat((nights / 7).toFixed(2));
  const total = weeklyRate ? parseFloat((weeks * parseFloat(weeklyRate)).toFixed(2)) : null;
  return { stay_nights: nights, stay_weeks: String(weeks), total_rent: total ? String(total) : null };
}

function getDatesInRange(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const cin = new Date(checkIn);
  const cout = new Date(checkOut);
  const cur = new Date(cin);
  while (cur < cout) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function checkOverbooking(spaceId: number, checkIn: string, checkOut: string, excludeBookingId?: number) {
  if (!checkIn || !checkOut) return { blocked: false, dates: [] };
  const dates = getDatesInRange(checkIn, checkOut);
  const rows = await db
    .select()
    .from(spaceBlockedDatesTable)
    .where(
      and(
        eq(spaceBlockedDatesTable.space_id, spaceId),
        or(...dates.map((d) => eq(spaceBlockedDatesTable.date, d)))
      )
    );
  const blockedDates = rows.map((r) => r.date);
  return { blocked: blockedDates.length > 0, dates: blockedDates };
}

class BlockConflictError extends Error {
  constructor(public conflictDates: string[]) {
    super("BLOCK_CONFLICT");
  }
}

/**
 * Atomically claim every night in [checkIn, checkOut) for a space. The
 * (space_id, date) unique constraint (H-301) turns each insert into a
 * first-come claim: if any date is already blocked by another booking, the
 * whole claim is rolled back and { claimedAll:false, conflictDates } is
 * returned so the caller can reject with 409 instead of double-booking.
 */
async function blockDatesForBooking(
  spaceId: number,
  checkIn: string,
  checkOut: string,
): Promise<{ claimedAll: boolean; conflictDates: string[] }> {
  const dates = getDatesInRange(checkIn, checkOut);
  if (dates.length === 0) return { claimedAll: true, conflictDates: [] };
  try {
    return await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(spaceBlockedDatesTable)
        .values(dates.map((d) => ({ space_id: spaceId, date: d })))
        .onConflictDoNothing()
        .returning({ date: spaceBlockedDatesTable.date });
      const claimed = new Set(inserted.map((r) => r.date));
      const conflictDates = dates.filter((d) => !claimed.has(d));
      // Abort the tx so a partial claim never becomes visible to other bookings.
      if (conflictDates.length > 0) throw new BlockConflictError(conflictDates);
      return { claimedAll: true, conflictDates: [] as string[] };
    });
  } catch (e) {
    if (e instanceof BlockConflictError) return { claimedAll: false, conflictDates: e.conflictDates };
    throw e;
  }
}

async function unblockDatesForBooking(spaceId: number, checkIn: string, checkOut: string) {
  const dates = getDatesInRange(checkIn, checkOut);
  if (dates.length === 0) return;
  for (const d of dates) {
    await db
      .delete(spaceBlockedDatesTable)
      .where(and(eq(spaceBlockedDatesTable.space_id, spaceId), eq(spaceBlockedDatesTable.date, d)));
  }
}

router.get("/v1/bookings", async (req, res): Promise<void> => {
  const parsed = ListBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { booking_status, booking_source, space_id, account_id, check_in_from, check_in_to, search, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(bookingsTable.deleted_at, req)];
  if (booking_status) conditions.push(eq(bookingsTable.booking_status, booking_status));
  if (booking_source) conditions.push(eq(bookingsTable.booking_source, booking_source));
  if (space_id) conditions.push(eq(bookingsTable.space_id, space_id));
  if (account_id) conditions.push(eq(bookingsTable.account_id, account_id));
  if (status) conditions.push(eq(bookingsTable.status, status));
  if (check_in_from) conditions.push(gte(bookingsTable.check_in_date, check_in_from));
  if (check_in_to) conditions.push(lte(bookingsTable.check_in_date, check_in_to));

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(and(...conditions))
    .orderBy(bookingsTable.created_at);

  const enriched = await Promise.all(rows.map(buildBookingResponse));

  let filtered = enriched;
  if (search) {
    const s = search.toLowerCase();
    filtered = enriched.filter(
      (b) =>
        b.booking_ref.toLowerCase().includes(s) ||
        (b.account_name ?? "").toLowerCase().includes(s) ||
        (b.contact_name ?? "").toLowerCase().includes(s)
    );
  }

  res.json(filtered);
});

router.post("/v1/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;

  if (data.space_id && data.check_in_date && data.check_out_date) {
    const { blocked, dates } = await checkOverbooking(data.space_id, data.check_in_date, data.check_out_date);
    if (blocked) {
      res.status(409).json({
        error: "SPACE_NOT_AVAILABLE",
        message: `Space is unavailable on: ${dates.join(", ")}`,
        blocked_dates: dates,
      });
      return;
    }
  }

  const booking_ref = await generateBookingRef();
  const stayDetails = (data.check_in_date && data.check_out_date)
    ? calcStayDetails(data.check_in_date, data.check_out_date, data.agreed_weekly_rate)
    : {};

  const [account] = data.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, data.account_id))
    : [null];
  const [contact] = data.contact_id
    ? await db.select().from(contactsTable).where(eq(contactsTable.id, data.contact_id))
    : [null];
  const contactName = contact ? `${contact.first_name}_${contact.last_name}`.replace(/\s+/g, "_") : "Guest";
  const name = `GuestBook_${contactName}_${new Date().toISOString().slice(0, 10)}`;

  const exchange_rate_to_aud = await getRateToAud((data as any).currency ?? "AUD");
  const [row] = await db
    .insert(bookingsTable)
    .values({ ...data, ...stayDetails, booking_ref, name, booking_status: "Draft", exchange_rate_to_aud })
    .returning();
  res.status(201).json(await buildBookingResponse(row));
});

router.get("/v1/bookings/calendar", async (req, res): Promise<void> => {
  const { start, end } = req.query as Record<string, string>;
  const startDate = start || new Date().toISOString().slice(0, 10);
  const endDate = end || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  try {
    const bookings = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        space_id: bookingsTable.space_id,
        contact_id: bookingsTable.contact_id,
      })
      .from(bookingsTable)
      .where(
        and(
          lte(bookingsTable.check_in_date, endDate),
          gte(bookingsTable.check_out_date, startDate),
        )
      );

    const spaceIds = [...new Set(bookings.map(b => b.space_id).filter(Boolean))] as number[];
    const spaces = spaceIds.length
      ? await db.select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id }).from(spacesTable).where(or(...spaceIds.map(id => eq(spacesTable.id, id))))
      : [];
    const propertyIds = [...new Set(spaces.map(s => s.property_id).filter(Boolean))] as number[];
    const props = propertyIds.length
      ? await db.select({ id: propertiesTable.id, name: propertiesTable.name }).from(propertiesTable).where(or(...propertyIds.map(id => eq(propertiesTable.id, id))))
      : [];
    const propMap = Object.fromEntries(props.map(p => [p.id, p.name]));
    const contactIds = [...new Set(bookings.map(b => b.contact_id).filter(Boolean))] as number[];
    const contacts = contactIds.length
      ? await db.select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name }).from(contactsTable).where(or(...contactIds.map(id => eq(contactsTable.id, id))))
      : [];
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()]));

    const spaceRows = spaces.map(s => ({
      id: s.id,
      name: s.name,
      property_name: propMap[s.property_id!] ?? null,
      bookings: bookings
        .filter(b => b.space_id === s.id && !["Cancelled"].includes(b.booking_status))
        .map(b => ({
          id: b.id,
          booking_ref: b.booking_ref,
          booking_status: b.booking_status,
          check_in_date: b.check_in_date,
          check_out_date: b.check_out_date,
          guest_name: b.contact_id ? (contactMap[b.contact_id] ?? null) : null,
        })),
    })).filter(s => s.bookings.length > 0 || spaceIds.includes(s.id));

    res.json({ start: startDate, end: endDate, spaces: spaceRows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

router.get("/v1/bookings/today/arrivals", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const bookings = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.check_in_date, today), eq(bookingsTable.booking_status, "Confirmed")));
    const enriched = await Promise.all(bookings.map(b => buildBookingResponse(b)));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch arrivals" });
  }
});

router.get("/v1/bookings/today/departures", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const bookings = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.check_out_date, today), eq(bookingsTable.booking_status, "Active")));
    const enriched = await Promise.all(bookings.map(b => buildBookingResponse(b)));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch departures" });
  }
});

router.get("/v1/bookings/:id", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildBookingResponse(row));
});

router.put("/v1/bookings/:id", async (req, res): Promise<void> => {
  const paramParsed = UpdateBookingParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) { res.status(400).json({ error: paramParsed.error.message }); return; }
  const bodyParsed = CreateBookingBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, paramParsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["Draft", "Confirmed"].includes(existing.booking_status)) {
    res.status(400).json({ error: "Can only update Draft or Confirmed bookings" });
    return;
  }

  const data = bodyParsed.data;
  if (data.space_id && data.check_in_date && data.check_out_date) {
    const { blocked, dates } = await checkOverbooking(data.space_id, data.check_in_date, data.check_out_date);
    if (blocked) {
      res.status(409).json({ error: "SPACE_NOT_AVAILABLE", message: `Space is unavailable on: ${dates.join(", ")}`, blocked_dates: dates });
      return;
    }
  }

  const stayDetails = (data.check_in_date && data.check_out_date)
    ? calcStayDetails(data.check_in_date, data.check_out_date, data.agreed_weekly_rate ?? existing.agreed_weekly_rate)
    : {};

  const [row] = await db.update(bookingsTable).set({ ...data, ...stayDetails }).where(eq(bookingsTable.id, paramParsed.data.id)).returning();
  res.json(await buildBookingResponse(row));
});

const bookingsSoftDelete = {
  table: bookingsTable,
  idColumn: bookingsTable.id,
};

router.post("/v1/bookings/bulk-delete", makeBulkDelete(bookingsSoftDelete));
router.post("/v1/bookings/bulk-restore", makeBulkRestore(bookingsSoftDelete));

router.delete("/v1/bookings/:id", async (req, res): Promise<void> => {
  const parsed = DeleteBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  } else {
    await db.update(bookingsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(bookingsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

router.patch("/v1/bookings/:id/submit", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.booking_status !== "Draft") {
    res.status(400).json({ error: "Only Draft bookings can be submitted" });
    return;
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "PendingPayment" }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  res.json(await buildBookingResponse(row));
});

router.patch("/v1/bookings/:id/confirm", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["PendingApproval", "PendingPayment"].includes(existing.booking_status)) {
    res.status(400).json({ error: "Only PendingApproval or PendingPayment bookings can be confirmed" });
    return;
  }
  if (existing.space_id && existing.check_in_date && existing.check_out_date) {
    const claim = await blockDatesForBooking(existing.space_id, existing.check_in_date, existing.check_out_date);
    if (!claim.claimedAll) {
      res.status(409).json({ error: "Space is already booked for one or more of these dates", dates: claim.conflictDates });
      return;
    }
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "Confirmed" }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  await logAction({ entityType: "booking", entityId: parsed.data.id, action: "STATUS_CHANGE", oldValue: { status: existing.booking_status }, newValue: { status: "Confirmed" } });

  // Auto-generate contract if not already exists
  let contractId: number | null = null;
  const existingContracts = await db.select({ id: contractsTable.id }).from(contractsTable).where(eq(contractsTable.booking_id, parsed.data.id));
  if (existingContracts.length === 0 && existing.account_id) {
    // Build terms text
    const [space] = existing.space_id ? await db.select().from(spacesTable).where(eq(spacesTable.id, existing.space_id)) : [null];
    const [property] = space?.property_id ? await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id)) : [null];
    const [tenantAccount] = await db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(eq(accountsTable.id, existing.account_id));
    const services = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.booking_id, parsed.data.id));

    const weeklyRate = parseFloat(existing.agreed_weekly_rate ?? "0");
    const totalRent = parseFloat(existing.total_rent ?? "0");
    const bondAmount = weeklyRate * 4;
    const advanceAmount = weeklyRate * 2;

    const serviceLines = services.length > 0
      ? services.map(s => `  - ${s.name} (x${s.quantity}): ${existing.currency} ${s.total_price}`).join("\n")
      : "  (No additional services)";

    const termsText = [
      "ACCOMMODATION TENANCY AGREEMENT",
      "═══════════════════════════════════════════════════════",
      "",
      "PROPERTY DETAILS",
      `  Property    : ${property?.name ?? "—"} — ${property?.address ?? "—"}, ${property?.city ?? ""} ${property?.state ?? ""}`.trim(),
      `  Space/Room  : ${space?.name ?? "—"} (${space?.space_type ?? "—"})`,
      "",
      "PARTIES",
      `  Tenant      : ${tenantAccount?.name ?? "—"}`,
      `  Landlord    : MillionStay Pty Ltd`,
      "",
      "TENANCY PERIOD",
      `  Start Date  : ${existing.check_in_date ?? "—"}`,
      `  End Date    : ${existing.check_out_date ?? "—"}`,
      `  Duration    : ${existing.stay_weeks ?? "—"} weeks (${existing.stay_nights ?? "—"} nights)`,
      "",
      "FINANCIAL TERMS",
      `  Currency            : ${existing.currency ?? "AUD"}`,
      `  Weekly Rent         : ${existing.currency} ${weeklyRate.toFixed(2)}`,
      `  Total Rent          : ${existing.currency} ${totalRent.toFixed(2)}`,
      `  Security Bond       : ${existing.currency} ${bondAmount.toFixed(2)} (4 weeks rent)`,
      `  Advance Payment     : ${existing.currency} ${advanceAmount.toFixed(2)} (2 weeks rent)`,
      "",
      "ADDITIONAL SERVICES",
      serviceLines,
      "",
      "PAYMENT SCHEDULE",
      `  Rent is payable biweekly in advance.`,
      `  First payment due on check-in date: ${existing.check_in_date ?? "—"}`,
      `  Subsequent payments due every 2 weeks thereafter.`,
      "",
      "GENERAL CONDITIONS",
      "  1. The tenant agrees to maintain the property in good condition.",
      "  2. The bond will be returned within 14 days after vacating, subject to inspection.",
      "  3. Any damage beyond normal wear and tear will be deducted from the bond.",
      "  4. The tenant must give 2 weeks notice prior to vacating.",
      "  5. Subletting is not permitted without prior written consent.",
      "",
      `Generated on: ${new Date().toISOString().slice(0, 10)}`,
      `Booking Reference: ${existing.booking_ref}`,
    ].join("\n");

    const year = new Date().getFullYear();
    const countRows = await db.select({ id: contractsTable.id }).from(contractsTable).where(ilike(contractsTable.contract_ref, `MS-C-${year}-%`));
    const contractRef = `MS-C-${year}-${String(countRows.length + 1).padStart(5, "0")}`;

    const [newContract] = await db.insert(contractsTable).values({
      contract_ref: contractRef,
      booking_id: parsed.data.id,
      product_id: existing.product_id ?? null,
      contract_product_id: existing.contract_product_id ?? null,
      tenant_account_id: existing.account_id,
      space_id: existing.space_id ?? null,
      start_date: existing.check_in_date ?? null,
      end_date: existing.check_out_date ?? null,
      weekly_rate: weeklyRate,
      total_rent: totalRent,
      bond_amount: bondAmount,
      advance_amount: advanceAmount,
      currency: existing.currency ?? "AUD",
      exchange_rate_to_aud: await getRateToAud(existing.currency ?? "AUD"),
      status: "Draft",
      terms_text: termsText,
    }).returning();

    contractId = newContract.id;

    // ── Auto-populate contract_line_items ──────────────────────────────────
    // Determine billing_frequency: product_id (accommodation_catalog) → contract_product_id fallback
    let rentBillingFreq = "Biweekly";
    if (existing.product_id) {
      const [prod] = await db.select({ billing_frequency: accommodationCatalogTable.billing_frequency })
        .from(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, existing.product_id));
      if (prod?.billing_frequency) rentBillingFreq = prod.billing_frequency;
    } else if (existing.contract_product_id) {
      const [cp] = await db.select({ billing_frequency: contractProductsTable.billing_frequency })
        .from(contractProductsTable).where(eq(contractProductsTable.id, existing.contract_product_id));
      if (cp?.billing_frequency) rentBillingFreq = cp.billing_frequency;
    }

    const rentUnitPrice = (() => {
      if (rentBillingFreq === "Weekly") return weeklyRate;
      if (rentBillingFreq === "Biweekly") return weeklyRate * 2;
      return parseFloat((weeklyRate * (52 / 12)).toFixed(2));
    })();

    // 1. Rent line item
    await db.insert(contractLineItemsTable).values({
      contract_id: newContract.id,
      item_type: "Rent",
      name: rentBillingFreq === "Monthly" ? "Monthly Rent" : rentBillingFreq === "Biweekly" ? "Fortnightly Rent" : "Weekly Rent",
      billing_trigger: "recurring",
      billing_frequency: rentBillingFreq,
      unit_price: String(rentUnitPrice),
      quantity: 1,
      total_price: String(rentUnitPrice),
      currency: existing.currency ?? "AUD",
      gst_included: true,
      status: "Active",
    });

    // 2. Service line items from booking_services
    for (const svc of services) {
      const trigger = svc.service_type === "scheduled" ? "recurring" : "at_activation";
      await db.insert(contractLineItemsTable).values({
        contract_id: newContract.id,
        item_type: "Service",
        name: svc.name,
        billing_trigger: trigger,
        billing_frequency: svc.service_type === "scheduled" ? (svc.frequency ?? null) : null,
        unit_price: String(svc.unit_price),
        quantity: svc.quantity ?? 1,
        total_price: String(svc.total_price),
        currency: svc.currency ?? existing.currency ?? "AUD",
        gst_included: true,
        service_id: svc.service_id ?? null,
        notes: svc.notes ?? null,
        status: "Active",
      });
    }

    await logAction({ entityType: "contract", entityId: newContract.id, action: "AUTO_CREATED", newValue: { contract_ref: contractRef, booking_ref: existing.booking_ref } });
  } else if (existingContracts.length > 0) {
    contractId = existingContracts[0].id;
  }

  // Best-effort: auto-create a PendingApproval recurring rent schedule for
  // recurring-style stays. Must never change the response or throw.
  try {
    await createBookingRecurringSchedule(row.id);
  } catch (e) {
    console.error("[bookings] auto recurring schedule failed:", e);
  }

  const bookingResponse = await buildBookingResponse(row);
  res.json({ ...bookingResponse, contract_id: contractId });
});

// GET /bookings/:id/contract — fetch the contract linked to this booking
router.get("/v1/bookings/:id/contract", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const contracts = await db.select().from(contractsTable).where(eq(contractsTable.booking_id, id));
  if (contracts.length === 0) { res.json(null); return; }
  res.json(contracts[0]);
});

// GET /bookings/:id/services — list services for this booking
router.get("/v1/bookings/:id/services", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(bookingServicesTable)
    .where(and(eq(bookingServicesTable.booking_id, id), ne(bookingServicesTable.status, "Deleted")));
  res.json({ data: rows, meta: { total: rows.length } });
});

// POST /bookings/:id/services — add a service to this booking
router.post("/v1/bookings/:id/services", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { name, service_id, service_type, quantity, unit_price, currency, billing_trigger, frequency, notes } = req.body;
  if (!name || !unit_price) { res.status(400).json({ error: "name and unit_price are required" }); return; }
  const qty = Number(quantity ?? 1);
  const price = parseFloat(unit_price);
  const [row] = await db.insert(bookingServicesTable).values({
    booking_id: id,
    service_id: service_id ?? null,
    name,
    service_type: service_type ?? "one_time",
    quantity: qty,
    unit_price: String(price.toFixed(2)),
    total_price: String((price * qty).toFixed(2)),
    currency: currency ?? "AUD",
    billing_trigger: billing_trigger ?? "at_booking",
    frequency: frequency ?? null,
    notes: notes ?? null,
  }).returning();
  res.status(201).json(row);
});

// DELETE /bookings/:id/services/:svcId — remove a service
router.delete("/v1/bookings/:id/services/:svcId", async (req, res): Promise<void> => {
  const svcId = Number(req.params.svcId);
  await db.update(bookingServicesTable).set({ status: "Deleted" }).where(eq(bookingServicesTable.id, svcId));
  res.json({ ok: true });
});

// PATCH /bookings/:id/services/:svcId — admin update service status/notes
const ADMIN_ALLOWED_SVC_STATUSES = new Set(["Active", "Processing", "Completed", "Cancelled"]);
router.patch("/v1/bookings/:id/services/:svcId", async (req, res): Promise<void> => {
  const bookingId = Number(req.params.id);
  const svcId = Number(req.params.svcId);
  if (!bookingId || !svcId) { res.status(400).json({ error: "Invalid id" }); return; }
  const [svc] = await db
    .select({ id: bookingServicesTable.id })
    .from(bookingServicesTable)
    .where(and(eq(bookingServicesTable.id, svcId), eq(bookingServicesTable.booking_id, bookingId)));
  if (!svc) { res.status(404).json({ error: "Service not found for this booking" }); return; }
  const body = (req.body ?? {}) as { status?: string; notes?: string | null };
  const updates: { status?: string; notes?: string | null } = {};
  if (typeof body.status === "string") {
    if (!ADMIN_ALLOWED_SVC_STATUSES.has(body.status)) {
      res.status(400).json({ error: `Status must be one of: ${[...ADMIN_ALLOWED_SVC_STATUSES].join(", ")}` });
      return;
    }
    updates.status = body.status;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes === null || body.notes === "" ? null : String(body.notes).slice(0, 5000);
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No changes provided" }); return; }
  const [updated] = await db.update(bookingServicesTable).set(updates).where(eq(bookingServicesTable.id, svcId)).returning();
  res.json({ success: true, data: updated });
});

// GET /bookings/:id/services/:svcId/photos — admin view of service host photos
router.get("/v1/bookings/:id/services/:svcId/photos", async (req, res): Promise<void> => {
  const bookingId = Number(req.params.id);
  const svcId = Number(req.params.svcId);
  if (!bookingId || !svcId) { res.status(400).json({ error: "Invalid id" }); return; }
  const [svc] = await db
    .select({ id: bookingServicesTable.id })
    .from(bookingServicesTable)
    .where(and(eq(bookingServicesTable.id, svcId), eq(bookingServicesTable.booking_id, bookingId)));
  if (!svc) { res.status(404).json({ error: "Service not found for this booking" }); return; }
  const photos = await db
    .select()
    .from(bookingServicePhotosTable)
    .where(eq(bookingServicePhotosTable.booking_service_id, svcId))
    .orderBy(bookingServicePhotosTable.created_at);
  res.json({ success: true, data: photos });
});

router.patch("/v1/bookings/:id/reject", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const bodyParsed = CancelBookingBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.booking_status !== "PendingApproval") {
    res.status(400).json({ error: "Only PendingApproval bookings can be rejected" });
    return;
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "Cancelled", cancellation_reason: bodyParsed.data.reason, cancelled_at: new Date() }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  await logAction({ entityType: "booking", entityId: parsed.data.id, action: "STATUS_CHANGE", oldValue: { status: "PendingApproval" }, newValue: { status: "Cancelled", reason: bodyParsed.data.reason } });
  res.json(await buildBookingResponse(row));
});

router.patch("/v1/bookings/:id/check-in", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.booking_status !== "Confirmed") {
    res.status(400).json({ error: "Only Confirmed bookings can be checked in" });
    return;
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "Active" }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  await logAction({ entityType: "booking", entityId: parsed.data.id, action: "STATUS_CHANGE", oldValue: { status: "Confirmed" }, newValue: { status: "Active" } });
  res.json(await buildBookingResponse(row));
});

router.patch("/v1/bookings/:id/check-out", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.booking_status !== "Active") {
    res.status(400).json({ error: "Only Active bookings can be checked out" });
    return;
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "CheckedOut" }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  await logAction({ entityType: "booking", entityId: parsed.data.id, action: "STATUS_CHANGE", oldValue: { status: "Active" }, newValue: { status: "CheckedOut" } });
  res.json(await buildBookingResponse(row));
});

router.patch("/v1/bookings/:id/cancel", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const bodyParsed = CancelBookingBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (["CheckedOut", "Cancelled"].includes(existing.booking_status)) {
    res.status(400).json({ error: "Cannot cancel a completed or already cancelled booking" });
    return;
  }
  if (existing.space_id && existing.check_in_date && existing.check_out_date &&
    ["Confirmed", "Active"].includes(existing.booking_status)) {
    await unblockDatesForBooking(existing.space_id, existing.check_in_date, existing.check_out_date);
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "Cancelled", cancellation_reason: bodyParsed.data.reason, cancelled_at: new Date() }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  await logAction({ entityType: "booking", entityId: parsed.data.id, action: "STATUS_CHANGE", oldValue: { status: existing.booking_status }, newValue: { status: "Cancelled", reason: bodyParsed.data.reason } });
  res.json(await buildBookingResponse(row));
});

router.patch("/v1/bookings/:id/extend", async (req, res): Promise<void> => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const bodyParsed = ExtendBookingBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["Confirmed", "Active"].includes(existing.booking_status)) {
    res.status(400).json({ error: "Only Confirmed or Active bookings can be extended" });
    return;
  }

  const newCheckOut = bodyParsed.data.new_check_out_date;
  if (existing.space_id && existing.check_in_date && existing.check_out_date) {
    await unblockDatesForBooking(existing.space_id, existing.check_in_date, existing.check_out_date);
    const claim = await blockDatesForBooking(existing.space_id, existing.check_in_date, newCheckOut);
    if (!claim.claimedAll) {
      // Extension overlaps another booking — restore the original block and reject.
      await blockDatesForBooking(existing.space_id, existing.check_in_date, existing.check_out_date);
      res.status(409).json({ error: "Extension overlaps dates already booked for this space", dates: claim.conflictDates });
      return;
    }
  }

  const stayDetails = existing.check_in_date
    ? calcStayDetails(existing.check_in_date, newCheckOut, existing.agreed_weekly_rate)
    : {};

  const [row] = await db.update(bookingsTable).set({ check_out_date: newCheckOut, ...stayDetails }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  res.json(await buildBookingResponse(row));
});

router.get("/v1/bookings/:id/documents", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const docs = await db.select().from(bookingDocumentsTable).where(eq(bookingDocumentsTable.booking_id, id)).orderBy(bookingDocumentsTable.created_at);
  res.json(docs);
});

router.post("/v1/bookings/:id/documents", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CreateBookingDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [doc] = await db.insert(bookingDocumentsTable).values({ ...parsed.data, booking_id: id }).returning();
  res.status(201).json(doc);
});

router.patch("/v1/bookings/:id/documents/:doc_id/verify", async (req, res): Promise<void> => {
  const docId = Number(req.params.doc_id);
  const [doc] = await db.update(bookingDocumentsTable).set({ verified_status: "Verified" }).where(eq(bookingDocumentsTable.id, docId)).returning();
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  res.json(doc);
});

router.patch("/v1/bookings/:id/documents/:doc_id/reject", async (req, res): Promise<void> => {
  const docId = Number(req.params.doc_id);
  const parsed = RejectBookingDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [doc] = await db.update(bookingDocumentsTable).set({ verified_status: "Rejected", rejection_reason: parsed.data.rejection_reason }).where(eq(bookingDocumentsTable.id, docId)).returning();
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  res.json(doc);
});

router.get("/v1/lookup/bookings", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [ilike(bookingsTable.booking_ref, `%${q}%`)] : [];
  const rows = await db.select({
    id: bookingsTable.id,
    booking_ref: bookingsTable.booking_ref,
    status: bookingsTable.booking_status,
  })
    .from(bookingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(bookingsTable.id)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.booking_ref} (${r.status})` })));
});

export default router;
