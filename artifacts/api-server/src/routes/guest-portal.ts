import { Router, type IRouter } from "express";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  db,
  guestUsersTable,
  guestEmergencyContactsTable,
  bookingsTable,
  spacesTable,
  propertiesTable,
  invoicesTable,
  accountsTable,
} from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { sendBookingConfirmation } from "../lib/email";

const router: IRouter = Router();

// All guest portal routes require guest auth (scoped to /v1/guest/* only)
router.use("/v1/guest", requireGuestAuth);

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
      special_requests,
    } = req.body as {
      space_id: number;
      check_in_date: string;
      check_out_date: string;
      num_guests?: number;
      customer_notes?: string;
      special_requests?: string;
    };
    const notes = customer_notes ?? special_requests ?? null;

    if (!space_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, error: "space_id, check_in_date, check_out_date are required" });
      return;
    }

    // Verify space exists and is active, join property for email
    const [spaceRow] = await db
      .select({
        id: spacesTable.id,
        name: spacesTable.name,
        base_weekly_price: spacesTable.base_weekly_price,
        property_name: propertiesTable.name,
        property_address: propertiesTable.address,
        property_city: propertiesTable.city,
      })
      .from(spacesTable)
      .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
      .where(and(eq(spacesTable.id, space_id), eq(spacesTable.status, "Active")))
      .limit(1);

    if (!spaceRow) {
      res.status(404).json({ success: false, error: "Space not found or unavailable" });
      return;
    }

    // Fetch guest info for email
    const [guestUser] = await db
      .select({ first_name: guestUsersTable.first_name, last_name: guestUsersTable.last_name, email: guestUsersTable.email })
      .from(guestUsersTable)
      .where(eq(guestUsersTable.account_id, guest.account_id))
      .limit(1);

    // Generate booking reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const booking_ref = `GBK-${timestamp}-${random}`;

    // Calculate stay weeks for email
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const stayMs = new Date(check_out_date).getTime() - new Date(check_in_date).getTime();
    const stayWeeks = Math.max(1, Math.round(stayMs / msPerWeek));
    const isLongTerm = stayWeeks >= 4;

    const [newBooking] = await db
      .insert(bookingsTable)
      .values({
        booking_ref,
        account_id: guest.account_id,
        space_id,
        check_in_date,
        check_out_date,
        stay_weeks: stayWeeks,
        num_guests: num_guests ?? 1,
        customer_notes: notes,
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

    // Send confirmation email (non-blocking, fail silently)
    if (guestUser?.email) {
      const guestName = [guestUser.first_name, guestUser.last_name].filter(Boolean).join(" ") || "Guest";
      const propertyAddress = [spaceRow.property_address, spaceRow.property_city].filter(Boolean).join(", ") || "Melbourne";
      sendBookingConfirmation({
        to: guestUser.email,
        guestName,
        bookingRef: booking_ref,
        spaceName: spaceRow.name ?? "Room",
        propertyAddress,
        checkIn: check_in_date,
        checkOut: check_out_date,
        weeklyRate: spaceRow.base_weekly_price ? Number(spaceRow.base_weekly_price) : null,
        isLongTerm,
      }).catch(() => {/* fail silently */});
    }

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

  // Include invoices for this booking
  const invoices = await db
    .select({
      id: invoicesTable.id,
      invoice_ref: invoicesTable.invoice_ref,
      amount: invoicesTable.amount,
      currency: invoicesTable.currency,
      status: invoicesTable.status,
      due_date: invoicesTable.due_date,
      paid_at: invoicesTable.paid_at,
      payment_method: invoicesTable.payment_method,
      description: invoicesTable.description,
      created_at: invoicesTable.created_at,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.booking_id, bookingId))
    .orderBy(asc(invoicesTable.id));

  res.json({ success: true, data: { ...booking, invoices } });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/invoices — 내 결제 현황
──────────────────────────────────────────────────────── */
router.get("/v1/guest/invoices", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  const invoices = await db
    .select({
      id: invoicesTable.id,
      invoice_ref: invoicesTable.invoice_ref,
      amount: invoicesTable.amount,
      currency: invoicesTable.currency,
      status: invoicesTable.status,
      due_date: invoicesTable.due_date,
      paid_at: invoicesTable.paid_at,
      payment_method: invoicesTable.payment_method,
      description: invoicesTable.description,
      notes: invoicesTable.notes,
      created_at: invoicesTable.created_at,
      booking_id: invoicesTable.booking_id,
      booking_ref: bookingsTable.booking_ref,
      space_name: spacesTable.name,
      property_address: propertiesTable.address,
    })
    .from(invoicesTable)
    .leftJoin(bookingsTable, eq(invoicesTable.booking_id, bookingsTable.id))
    .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(eq(invoicesTable.account_id, guest.account_id))
    .orderBy(asc(invoicesTable.due_date));

  res.json({ success: true, data: invoices, meta: { total: invoices.length } });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/invoices/:id — 단일 인보이스 (영수증)
──────────────────────────────────────────────────────── */
router.get("/v1/guest/invoices/:id", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  const invId = Number(req.params.id);

  const [inv] = await db
    .select({
      id: invoicesTable.id,
      invoice_ref: invoicesTable.invoice_ref,
      amount: invoicesTable.amount,
      currency: invoicesTable.currency,
      status: invoicesTable.status,
      due_date: invoicesTable.due_date,
      paid_at: invoicesTable.paid_at,
      payment_method: invoicesTable.payment_method,
      description: invoicesTable.description,
      notes: invoicesTable.notes,
      created_at: invoicesTable.created_at,
      booking_id: invoicesTable.booking_id,
      contract_id: invoicesTable.contract_id,
      booking_ref: bookingsTable.booking_ref,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      space_name: spacesTable.name,
      property_address: propertiesTable.address,
      property_city: propertiesTable.city,
      property_state: propertiesTable.state,
    })
    .from(invoicesTable)
    .leftJoin(bookingsTable, eq(invoicesTable.booking_id, bookingsTable.id))
    .leftJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(and(
      eq(invoicesTable.id, invId),
      eq(invoicesTable.account_id, guest.account_id),
    ))
    .limit(1);

  if (!inv) {
    res.status(404).json({ success: false, error: "Invoice not found" });
    return;
  }

  const guestProfile = await db
    .select({
      first_name: guestUsersTable.first_name,
      last_name: guestUsersTable.last_name,
      email: guestUsersTable.email,
    })
    .from(guestUsersTable)
    .where(eq(guestUsersTable.id, guest.id))
    .limit(1)
    .then(r => r[0] ?? null);

  res.json({ success: true, data: { ...inv, guest: guestProfile } });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/profile — 내 프로필 (전체)
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
      nationality: guestUsersTable.nationality,
      date_of_birth: guestUsersTable.date_of_birth,
      gender: guestUsersTable.gender,
      university: guestUsersTable.university,
      department: guestUsersTable.department,
      student_id: guestUsersTable.student_id,
      study_year: guestUsersTable.study_year,
      bank_name: guestUsersTable.bank_name,
      bank_account_name: guestUsersTable.bank_account_name,
      bank_bsb: guestUsersTable.bank_bsb,
      bank_account_number: guestUsersTable.bank_account_number,
      preferred_payment_method: guestUsersTable.preferred_payment_method,
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

  const emergencyContacts = await db
    .select()
    .from(guestEmergencyContactsTable)
    .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id))
    .orderBy(asc(guestEmergencyContactsTable.id));

  res.json({ success: true, data: { ...profile, emergency_contacts: emergencyContacts } });
});

/* ───────────────────────────────────────────────────────
   PUT /api/v1/guest/profile — 프로필 수정 (전체)
──────────────────────────────────────────────────────── */
router.put("/v1/guest/profile", async (req, res): Promise<void> => {
  const guest = (req as any).guest;

  try {
    const {
      first_name, last_name, phone, nationality, date_of_birth, gender,
      university, department, student_id, study_year,
      bank_name, bank_account_name, bank_bsb, bank_account_number, preferred_payment_method,
    } = req.body as Record<string, string | undefined>;

    const [updated] = await db
      .update(guestUsersTable)
      .set({
        first_name: first_name ?? undefined,
        last_name: last_name ?? undefined,
        phone: phone ?? undefined,
        nationality: nationality ?? undefined,
        date_of_birth: date_of_birth ?? undefined,
        gender: gender ?? undefined,
        university: university ?? undefined,
        department: department ?? undefined,
        student_id: student_id ?? undefined,
        study_year: study_year ?? undefined,
        bank_name: bank_name ?? undefined,
        bank_account_name: bank_account_name ?? undefined,
        bank_bsb: bank_bsb ?? undefined,
        bank_account_number: bank_account_number ?? undefined,
        preferred_payment_method: preferred_payment_method ?? undefined,
      })
      .where(eq(guestUsersTable.id, guest.id))
      .returning();

    // Also update account name if provided
    if (guest.account_id && (first_name || last_name)) {
      const fullName = [
        first_name ?? updated?.first_name,
        last_name ?? updated?.last_name,
      ].filter(Boolean).join(" ");
      if (fullName) {
        await db.update(accountsTable).set({ name: fullName }).where(eq(accountsTable.id, guest.account_id));
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/emergency-contacts
──────────────────────────────────────────────────────── */
router.get("/v1/guest/emergency-contacts", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  const contacts = await db
    .select()
    .from(guestEmergencyContactsTable)
    .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id))
    .orderBy(asc(guestEmergencyContactsTable.id));
  res.json({ success: true, data: contacts });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/guest/emergency-contacts
──────────────────────────────────────────────────────── */
router.post("/v1/guest/emergency-contacts", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  try {
    const { name, relationship, phone, email, is_primary } = req.body as {
      name: string;
      relationship?: string;
      phone?: string;
      email?: string;
      is_primary?: boolean;
    };
    if (!name) {
      res.status(400).json({ success: false, error: "Name is required" });
      return;
    }
    if (is_primary) {
      await db.update(guestEmergencyContactsTable)
        .set({ is_primary: false })
        .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id));
    }
    const [created] = await db.insert(guestEmergencyContactsTable).values({
      guest_user_id: guest.id,
      name,
      relationship: relationship ?? null,
      phone: phone ?? null,
      email: email ?? null,
      is_primary: is_primary ?? false,
    }).returning();
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create emergency contact" });
  }
});

/* ───────────────────────────────────────────────────────
   PUT /api/v1/guest/emergency-contacts/:id
──────────────────────────────────────────────────────── */
router.put("/v1/guest/emergency-contacts/:id", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  const contactId = Number(req.params.id);
  try {
    const { name, relationship, phone, email, is_primary } = req.body as {
      name?: string;
      relationship?: string;
      phone?: string;
      email?: string;
      is_primary?: boolean;
    };
    const [existing] = await db.select({ id: guestEmergencyContactsTable.id })
      .from(guestEmergencyContactsTable)
      .where(and(
        eq(guestEmergencyContactsTable.id, contactId),
        eq(guestEmergencyContactsTable.guest_user_id, guest.id),
      )).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: "Contact not found" });
      return;
    }
    if (is_primary) {
      await db.update(guestEmergencyContactsTable)
        .set({ is_primary: false })
        .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id));
    }
    const [updated] = await db.update(guestEmergencyContactsTable)
      .set({
        name: name ?? undefined,
        relationship: relationship ?? undefined,
        phone: phone ?? undefined,
        email: email ?? undefined,
        is_primary: is_primary ?? undefined,
      })
      .where(and(
        eq(guestEmergencyContactsTable.id, contactId),
        eq(guestEmergencyContactsTable.guest_user_id, guest.id),
      )).returning();
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update emergency contact" });
  }
});

/* ───────────────────────────────────────────────────────
   DELETE /api/v1/guest/emergency-contacts/:id
──────────────────────────────────────────────────────── */
router.delete("/v1/guest/emergency-contacts/:id", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  const contactId = Number(req.params.id);
  try {
    const [deleted] = await db.delete(guestEmergencyContactsTable)
      .where(and(
        eq(guestEmergencyContactsTable.id, contactId),
        eq(guestEmergencyContactsTable.guest_user_id, guest.id),
      )).returning({ id: guestEmergencyContactsTable.id });
    if (!deleted) {
      res.status(404).json({ success: false, error: "Contact not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete emergency contact" });
  }
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/guest/payment/confirm — 결제 확인
──────────────────────────────────────────────────────── */
router.post("/v1/guest/payment/confirm", async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  const { booking_id, amount, payment_method = "bank_transfer" } = req.body as {
    booking_id: number;
    amount?: number;
    payment_method?: string;
  };

  if (!booking_id) {
    res.status(400).json({ success: false, error: "booking_id is required" });
    return;
  }

  try {
    // Verify the booking belongs to this guest
    const [booking] = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        account_id: bookingsTable.account_id,
        space_id: bookingsTable.space_id,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
        total_rent: bookingsTable.total_rent,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.id, booking_id),
          eq(bookingsTable.account_id, guest.account_id),
        ),
      )
      .limit(1);

    if (!booking) {
      res.status(404).json({ success: false, error: "Booking not found" });
      return;
    }

    if (booking.booking_status === "Cancelled") {
      res.status(400).json({ success: false, error: "Cannot pay a cancelled booking" });
      return;
    }

    // Generate invoice ref
    const year = new Date().getFullYear();
    const existingInvRows = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(eq(invoicesTable.booking_id, booking_id));

    // Only create an invoice if none exists for this booking
    let invoice;
    if (existingInvRows.length === 0) {
      const allInvRows = await db.select({ id: invoicesTable.id }).from(invoicesTable);
      const invCount = allInvRows.length + 1;
      const invoice_ref = `MS-INV-${year}-${String(invCount).padStart(5, "0")}`;
      const invoiceAmount = amount ?? (booking.total_rent ? Number(booking.total_rent) : 0);

      const [newInvoice] = await db
        .insert(invoicesTable)
        .values({
          invoice_ref,
          booking_id: booking.id,
          account_id: booking.account_id ?? undefined,
          amount: invoiceAmount,
          currency: "AUD",
          status: payment_method === "bank_transfer" ? "Sent" : "Paid",
          paid_at: payment_method === "bank_transfer" ? null : new Date(),
          payment_method,
          description: `Booking payment — ${booking.booking_ref}`,
        })
        .returning();
      invoice = newInvoice;
    } else {
      // Update existing invoice to paid if card payment
      if (payment_method !== "bank_transfer") {
        const [updated] = await db
          .update(invoicesTable)
          .set({ status: "Paid", paid_at: new Date(), payment_method })
          .where(eq(invoicesTable.booking_id, booking_id))
          .returning();
        invoice = updated;
      } else {
        const [existing] = await db
          .select()
          .from(invoicesTable)
          .where(eq(invoicesTable.booking_id, booking_id))
          .limit(1);
        invoice = existing;
      }
    }

    // Update booking status
    const newStatus = payment_method === "bank_transfer" ? "PendingApproval" : "PendingApproval";
    await db
      .update(bookingsTable)
      .set({ booking_status: newStatus })
      .where(eq(bookingsTable.id, booking_id));

    res.json({
      success: true,
      data: {
        booking_ref: booking.booking_ref,
        invoice_ref: invoice?.invoice_ref,
        invoice_id: invoice?.id,
        amount: invoice?.amount,
        currency: invoice?.currency ?? "AUD",
        status: invoice?.status,
        payment_method,
        paid_at: invoice?.paid_at,
        message: payment_method === "bank_transfer"
          ? "Bank transfer initiated. Booking will be confirmed once payment is received."
          : "Payment recorded. Our team will review and confirm your booking shortly.",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Payment confirmation failed" });
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
