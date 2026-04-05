import { Router, type IRouter } from "express";
import { eq, ilike, and, between, gte, lte, SQL, or } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingDocumentsTable,
  accountsTable,
  contactsTable,
  spacesTable,
  propertiesTable,
  spaceBlockedDatesTable,
} from "@workspace/db";
import { logAction } from "../utils/auditLog";
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
    property_address: property ? `${property.address ?? ""} ${property.suburb ?? ""}`.trim() : null,
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

async function blockDatesForBooking(spaceId: number, checkIn: string, checkOut: string) {
  const dates = getDatesInRange(checkIn, checkOut);
  if (dates.length === 0) return;
  await db.insert(spaceBlockedDatesTable).values(
    dates.map((d) => ({ space_id: spaceId, date: d }))
  ).onConflictDoNothing();
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
  const conditions: SQL[] = [];
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
    .where(conditions.length ? and(...conditions) : undefined)
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

  const [row] = await db
    .insert(bookingsTable)
    .values({ ...data, ...stayDetails, booking_ref, name, booking_status: "Draft" })
    .returning();
  res.status(201).json(await buildBookingResponse(row));
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

router.delete("/v1/bookings/:id", async (req, res): Promise<void> => {
  const parsed = DeleteBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.booking_status !== "Draft") {
    res.status(400).json({ error: "Can only delete Draft bookings" });
    return;
  }
  await db.update(bookingsTable).set({ status: "Deleted" }).where(eq(bookingsTable.id, parsed.data.id));
  res.json({ ok: true });
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
    await blockDatesForBooking(existing.space_id, existing.check_in_date, existing.check_out_date);
  }
  const [row] = await db.update(bookingsTable).set({ booking_status: "Confirmed" }).where(eq(bookingsTable.id, parsed.data.id)).returning();
  await logAction({ entityType: "booking", entityId: parsed.data.id, action: "STATUS_CHANGE", oldValue: { status: existing.booking_status }, newValue: { status: "Confirmed" } });
  res.json(await buildBookingResponse(row));
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
    await blockDatesForBooking(existing.space_id, existing.check_in_date, newCheckOut);
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
