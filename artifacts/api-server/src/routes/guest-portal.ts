import { Router, type IRouter } from "express";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  db,
  guestUsersTable,
  bookingsTable,
  spacesTable,
  propertiesTable,
  invoicesTable,
  accountsTable,
} from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";

const router: IRouter = Router();

// All routes require guest auth
router.use(requireGuestAuth);

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/bookings — 내 예약 목록
──────────────────────────────────────────────────────── */
router.get("/v1/guest/bookings", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  const bookings = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      stay_weeks: bookingsTable.stay_weeks,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
      num_guests: bookingsTable.num_guests,
      customer_notes: bookingsTable.customer_notes,
      created_at: bookingsTable.created_at,
      space_name: spacesTable.name,
      space_type: spacesTable.space_type,
      property_name: propertiesTable.name,
      property_city: propertiesTable.city,
      property_address: propertiesTable.address,
    })
    .from(bookingsTable)
    .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(
      and(
        eq(bookingsTable.account_id, guest.account_id),
        eq(bookingsTable.status, "Active"),
      ),
    )
    .orderBy(desc(bookingsTable.created_at));

  res.json({ success: true, data: bookings, meta: { total: bookings.length } });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/guest/bookings — 예약 문의 생성
──────────────────────────────────────────────────────── */
router.post("/v1/guest/bookings", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  try {
    const {
      space_id,
      check_in_date,
      check_out_date,
      num_guests,
      customer_notes,
    } = req.body as {
      space_id: number;
      check_in_date: string;
      check_out_date: string;
      num_guests?: number;
      customer_notes?: string;
    };

    if (!space_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, error: "space_id, check_in_date, check_out_date are required" });
      return;
    }

    // Verify space exists and is active
    const [space] = await db
      .select({ id: spacesTable.id, base_weekly_price: spacesTable.base_weekly_price })
      .from(spacesTable)
      .where(and(eq(spacesTable.id, space_id), eq(spacesTable.status, "Active")))
      .limit(1);

    if (!space) {
      res.status(404).json({ success: false, error: "Space not found or unavailable" });
      return;
    }

    // Generate booking reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const booking_ref = `GBK-${timestamp}-${random}`;

    const [newBooking] = await db
      .insert(bookingsTable)
      .values({
        booking_ref,
        account_id: guest.account_id,
        space_id,
        check_in_date,
        check_out_date,
        num_guests: num_guests ?? 1,
        customer_notes: customer_notes ?? null,
        booking_status: "Pending",
        booking_source: "Guest Portal",
        status: "Active",
      })
      .returning({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        created_at: bookingsTable.created_at,
      });

    res.status(201).json({ success: true, data: newBooking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create booking" });
  }
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/bookings/:id — 예약 상세
──────────────────────────────────────────────────────── */
router.get("/v1/guest/bookings/:id", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  const bookingId = Number(req.params.id);

  const [booking] = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      stay_weeks: bookingsTable.stay_weeks,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
      num_guests: bookingsTable.num_guests,
      customer_notes: bookingsTable.customer_notes,
      cancellation_reason: bookingsTable.cancellation_reason,
      created_at: bookingsTable.created_at,
      space_name: spacesTable.name,
      space_type: spacesTable.space_type,
      property_name: propertiesTable.name,
      property_city: propertiesTable.city,
      property_address: propertiesTable.address,
      property_state: propertiesTable.state,
    })
    .from(bookingsTable)
    .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(
      and(
        eq(bookingsTable.id, bookingId),
        eq(bookingsTable.account_id, guest.account_id),
      ),
    )
    .limit(1);

  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }

  res.json({ success: true, data: booking });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/invoices — 내 결제 현황
──────────────────────────────────────────────────────── */
router.get("/v1/guest/invoices", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.account_id, guest.account_id),
        eq(invoicesTable.status, "Active"),
      ),
    )
    .orderBy(desc(invoicesTable.created_at));

  res.json({ success: true, data: invoices, meta: { total: invoices.length } });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/profile — 내 프로필
──────────────────────────────────────────────────────── */
router.get("/v1/guest/profile", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  const [profile] = await db
    .select({
      id: guestUsersTable.id,
      email: guestUsersTable.email,
      first_name: guestUsersTable.first_name,
      last_name: guestUsersTable.last_name,
      phone: guestUsersTable.phone,
      account_id: guestUsersTable.account_id,
      created_at: guestUsersTable.created_at,
    })
    .from(guestUsersTable)
    .where(eq(guestUsersTable.id, guest.id))
    .limit(1);

  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found" });
    return;
  }

  // Get account details if exists
  let account = null;
  if (profile.account_id) {
    const [acc] = await db
      .select({
        name: accountsTable.name,
        account_email: accountsTable.account_email,
        phone1: accountsTable.phone1,
        address_line1: accountsTable.address_line1,
        address_suburb: accountsTable.address_suburb,
        address_state: accountsTable.address_state,
        address_postcode: accountsTable.address_postcode,
        address_country: accountsTable.address_country,
      })
      .from(accountsTable)
      .where(eq(accountsTable.id, profile.account_id))
      .limit(1);
    account = acc ?? null;
  }

  res.json({ success: true, data: { ...profile, account } });
});

/* ───────────────────────────────────────────────────────
   PUT /api/v1/guest/profile — 프로필 수정
──────────────────────────────────────────────────────── */
router.put("/v1/guest/profile", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  try {
    const { first_name, last_name, phone } = req.body as {
      first_name?: string;
      last_name?: string;
      phone?: string;
    };

    const [updated] = await db
      .update(guestUsersTable)
      .set({
        first_name: first_name ?? undefined,
        last_name: last_name ?? undefined,
        phone: phone ?? undefined,
      })
      .where(eq(guestUsersTable.id, guest.id))
      .returning({
        id: guestUsersTable.id,
        email: guestUsersTable.email,
        first_name: guestUsersTable.first_name,
        last_name: guestUsersTable.last_name,
        phone: guestUsersTable.phone,
      });

    // Also update account name if provided
    if (guest.account_id && (first_name || last_name)) {
      const [currentGuest] = await db
        .select({ first_name: guestUsersTable.first_name, last_name: guestUsersTable.last_name })
        .from(guestUsersTable)
        .where(eq(guestUsersTable.id, guest.id))
        .limit(1);

      const fullName = [
        first_name ?? currentGuest?.first_name,
        last_name ?? currentGuest?.last_name,
      ].filter(Boolean).join(" ");

      if (fullName) {
        await db
          .update(accountsTable)
          .set({ name: fullName })
          .where(eq(accountsTable.id, guest.account_id));
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/documents
   Returns booking documents for this guest's bookings
──────────────────────────────────────────────────────── */
router.get("/v1/guest/documents", requireGuestAuth, async (req, res): Promise<void> => {
  const guest = (req as any).guest as { id: number; email: string; account_id: number | null };
  try {
    const guestBookings = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .leftJoin(guestUsersTable, eq(guestUsersTable.account_id, bookingsTable.account_id as any))
      .where(eq(guestUsersTable.id, guest.id));

    res.json({ success: true, data: [], meta: { total: 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch documents" });
  }
});

export default router;
