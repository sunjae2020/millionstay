import { Router, type IRouter } from "express";
import { eq, and, or, desc, asc, inArray, isNull } from "drizzle-orm";
import Stripe from "stripe";
import {
  db,
  guestUsersTable,
  guestEmergencyContactsTable,
  bookingsTable,
  spacesTable,
  propertiesTable,
  invoicesTable,
  accountsTable,
  contractsTable,
  recurringSchedulesTable,
  bookingServicesTable,
  marketingConsentsTable,
  documentsTable,
  csTicketsTable,
} from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { sendBookingConfirmation } from "../lib/email";
import { getPrivacyContactEmail } from "../lib/companyContact";
import { logAction } from "../utils/auditLog";
import { getRateToAud } from "../lib/rateSnapshot";
import multer from "multer";
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary, cldFolder } from "../utils/cloudinary";

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
    } else {
      cb(null, true);
    }
  },
});

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
        stay_weeks: String(stayWeeks),
        num_guests: num_guests ?? 1,
        customer_notes: notes,
        booking_status: "Pending",
        booking_source: "Guest Portal",
        status: "Active",
        currency: (spaceRow as any).base_currency ?? "AUD",
        exchange_rate_to_aud: await getRateToAud((spaceRow as any).base_currency ?? "AUD"),
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

  // Include contract linked to this booking (read-only for guest)
  const [contract] = await db
    .select({
      id: contractsTable.id,
      contract_ref: contractsTable.contract_ref,
      status: contractsTable.status,
      start_date: contractsTable.start_date,
      end_date: contractsTable.end_date,
      weekly_rate: contractsTable.weekly_rate,
      total_rent: contractsTable.total_rent,
      bond_amount: contractsTable.bond_amount,
      advance_amount: contractsTable.advance_amount,
      currency: contractsTable.currency,
      document_url: contractsTable.document_url,
      terms_text: contractsTable.terms_text,
      signed_at: contractsTable.signed_at,
      effective_date: contractsTable.effective_date,
    })
    .from(contractsTable)
    .where(eq(contractsTable.booking_id, bookingId))
    .limit(1);

  // Payment schedule (from recurring_schedule for this contract)
  const paymentSchedule = contract
    ? await db
        .select({
          id: recurringSchedulesTable.id,
          schedule_type: recurringSchedulesTable.schedule_type,
          amount: recurringSchedulesTable.amount,
          currency: recurringSchedulesTable.currency,
          next_due_date: recurringSchedulesTable.next_due_date,
          start_date: recurringSchedulesTable.start_date,
          end_date: recurringSchedulesTable.end_date,
          frequency: recurringSchedulesTable.frequency,
          is_active: recurringSchedulesTable.is_active,
        })
        .from(recurringSchedulesTable)
        .where(eq(recurringSchedulesTable.contract_id, contract.id))
        .orderBy(asc(recurringSchedulesTable.next_due_date))
    : [];

  // Booking services
  const services = await db
    .select({
      id: bookingServicesTable.id,
      service_name: bookingServicesTable.name,
      service_type: bookingServicesTable.service_type,
      quantity: bookingServicesTable.quantity,
      unit_price: bookingServicesTable.unit_price,
      total_price: bookingServicesTable.total_price,
      billing_trigger: bookingServicesTable.billing_trigger,
      frequency: bookingServicesTable.frequency,
      notes: bookingServicesTable.notes,
    })
    .from(bookingServicesTable)
    .where(and(eq(bookingServicesTable.booking_id, bookingId), eq(bookingServicesTable.status, "Active")));

  res.json({ success: true, data: { ...booking, invoices, contract: contract ?? null, payment_schedule: paymentSchedule, services } });
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
      company: guestUsersTable.company,
      job_title: guestUsersTable.job_title,
      stay_purpose: guestUsersTable.stay_purpose,
      vehicle_plate: guestUsersTable.vehicle_plate,
      parking_required: guestUsersTable.parking_required,
      bank_name: guestUsersTable.bank_name,
      bank_account_name: guestUsersTable.bank_account_name,
      bank_bsb: guestUsersTable.bank_bsb,
      bank_account_number: guestUsersTable.bank_account_number,
      preferred_payment_method: guestUsersTable.preferred_payment_method,
      avatar_url: guestUsersTable.avatar_url,
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
      company, job_title, stay_purpose, vehicle_plate,
      bank_name, bank_account_name, bank_bsb, bank_account_number, preferred_payment_method,
    } = req.body as Record<string, string | undefined>;
    // Boolean field is handled separately (undefined = leave unchanged).
    const parking_required = (req.body as Record<string, unknown>)["parking_required"];

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
        company: company ?? undefined,
        job_title: job_title ?? undefined,
        stay_purpose: stay_purpose ?? undefined,
        vehicle_plate: vehicle_plate ?? undefined,
        parking_required: typeof parking_required === "boolean" ? parking_required : undefined,
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

    // APP 10/13 — audit the self-correction. Log only WHICH fields changed,
    // never the values, so bank/identity PII never lands in system_logs.
    const changedFields = Object.entries({
      first_name, last_name, phone, nationality, date_of_birth, gender,
      university, department, student_id, study_year,
      company, job_title, stay_purpose, vehicle_plate, parking_required,
      bank_name, bank_account_name, bank_bsb, bank_account_number, preferred_payment_method,
    }).filter(([, v]) => v !== undefined).map(([k]) => k);
    await logAction({
      entityType: "guest_users",
      entityId: guest.id,
      action: "UPDATE",
      actorId: guest.id,
      actorEmail: guest.email ?? null,
      newValue: { event: "PROFILE_SELF_CORRECTION", fields: changedFields },
      ipAddress: req.ip ?? null,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/guest/profile/avatar — 프로필 사진 업로드
──────────────────────────────────────────────────────── */
router.post("/v1/guest/profile/avatar", avatarUpload.single("avatar"), async (req: any, res): Promise<void> => {
  const guest = req.guest;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: "No image file provided" });
    return;
  }

  if (!isCloudinaryConfigured()) {
    res.status(503).json({ success: false, error: "Image upload service not configured" });
    return;
  }

  try {
    const [existing] = await db.select({ avatar_public_id: guestUsersTable.avatar_public_id })
      .from(guestUsersTable).where(eq(guestUsersTable.id, guest.id));

    if (existing?.avatar_public_id) {
      await deleteFromCloudinary(existing.avatar_public_id);
    }

    const result = await uploadToCloudinary(file.buffer, {
      folder: cldFolder("avatars"),
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto:good", fetch_format: "auto" },
      ],
    });

    const [updated] = await db.update(guestUsersTable)
      .set({ avatar_url: result.secure_url, avatar_public_id: result.public_id })
      .where(eq(guestUsersTable.id, guest.id))
      .returning({ avatar_url: guestUsersTable.avatar_url, avatar_public_id: guestUsersTable.avatar_public_id });

    res.json({ success: true, data: { avatar_url: updated?.avatar_url } });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ success: false, error: "Failed to upload avatar" });
  }
});

/* ───────────────────────────────────────────────────────
   DELETE /api/v1/guest/profile/avatar — 프로필 사진 삭제
──────────────────────────────────────────────────────── */
router.delete("/v1/guest/profile/avatar", async (req: any, res): Promise<void> => {
  const guest = req.guest;
  try {
    const [existing] = await db.select({ avatar_public_id: guestUsersTable.avatar_public_id })
      .from(guestUsersTable).where(eq(guestUsersTable.id, guest.id));

    if (existing?.avatar_public_id) {
      await deleteFromCloudinary(existing.avatar_public_id);
    }

    await db.update(guestUsersTable)
      .set({ avatar_url: null, avatar_public_id: null })
      .where(eq(guestUsersTable.id, guest.id));

    res.json({ success: true });
  } catch (err) {
    console.error("Avatar delete error:", err);
    res.status(500).json({ success: false, error: "Failed to delete avatar" });
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
          amount: String(invoiceAmount),
          currency: "AUD",
          exchange_rate_to_aud: "1",
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
   POST /api/v1/guest/payment/create-intent
   Creates a Stripe PaymentIntent for an invoice
──────────────────────────────────────────────────────── */
router.post("/v1/guest/payment/create-intent", requireGuestAuth, async (req, res): Promise<void> => {
  const guest = (req as any).guest as { id: number; email: string; account_id: number | null };
  const { invoice_id } = req.body as { invoice_id: number };

  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  if (!stripeKey) {
    res.status(503).json({ success: false, error: "Stripe is not configured" });
    return;
  }

  if (!invoice_id) {
    res.status(400).json({ success: false, error: "invoice_id is required" });
    return;
  }

  try {
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoice_id))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ success: false, error: "Invoice not found" });
      return;
    }

    // Verify ownership
    const guestAccountId = guest.account_id;
    let hasAccess = false;
    if (guestAccountId && invoice.account_id && guestAccountId === invoice.account_id) {
      hasAccess = true;
    } else if (invoice.booking_id) {
      const [booking] = await db
        .select({ account_id: bookingsTable.account_id })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, invoice.booking_id))
        .limit(1);
      if (booking && booking.account_id === guestAccountId) hasAccess = true;
    }
    if (!hasAccess) {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    if (invoice.status === "Paid") {
      res.status(400).json({ success: false, error: "Invoice is already paid" });
      return;
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
    const amountCents = Math.round(Number(invoice.amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: (invoice.currency ?? "AUD").toLowerCase(),
      metadata: {
        invoice_id: String(invoice.id),
        invoice_ref: invoice.invoice_ref ?? "",
        account_id: String(guest.account_id),
      },
      description: invoice.invoice_ref ?? `Invoice #${invoice.id}`,
      receipt_email: guest.email,
    });

    res.json({
      success: true,
      data: {
        client_secret: paymentIntent.client_secret,
        amount: invoice.amount,
        currency: invoice.currency ?? "AUD",
        invoice_ref: invoice.invoice_ref,
      },
    });
  } catch (err) {
    console.error("[Stripe] create-intent error:", err);
    res.status(500).json({ success: false, error: "Failed to create payment intent" });
  }
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/guest/payment/invoice-confirm
   Confirms bank transfer intent for a specific invoice
──────────────────────────────────────────────────────── */
router.post("/v1/guest/payment/invoice-confirm", requireGuestAuth, async (req, res): Promise<void> => {
  const guest = (req as any).guest as { id: number; email: string; account_id: number | null };
  const { invoice_id, payment_method = "bank_transfer" } = req.body as {
    invoice_id: number;
    payment_method?: string;
  };

  if (!invoice_id) {
    res.status(400).json({ success: false, error: "invoice_id is required" });
    return;
  }

  try {
    // Fetch invoice and verify ownership via booking → account_id
    const [invoice] = await db
      .select({
        id: invoicesTable.id,
        invoice_ref: invoicesTable.invoice_ref,
        amount: invoicesTable.amount,
        currency: invoicesTable.currency,
        status: invoicesTable.status,
        paid_at: invoicesTable.paid_at,
        booking_id: invoicesTable.booking_id,
        account_id: invoicesTable.account_id,
      })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoice_id))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ success: false, error: "Invoice not found" });
      return;
    }

    // Verify ownership: invoice.account_id must match guest's account_id, OR check via booking
    const guestAccountId = guest.account_id;
    const invoiceAccountId = invoice.account_id;
    let hasAccess = false;

    if (guestAccountId && invoiceAccountId && guestAccountId === invoiceAccountId) {
      hasAccess = true;
    } else if (invoice.booking_id) {
      // Fallback: verify via booking table
      const [booking] = await db
        .select({ account_id: bookingsTable.account_id })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, invoice.booking_id))
        .limit(1);
      if (booking && booking.account_id && booking.account_id === guestAccountId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    if (invoice.status === "Paid") {
      res.status(400).json({ success: false, error: "Invoice is already paid" });
      return;
    }

    const isPaidMethod = payment_method !== "bank_transfer";
    const [updated] = await db
      .update(invoicesTable)
      .set({
        status: isPaidMethod ? "Paid" : "Sent",
        paid_at: isPaidMethod ? new Date() : null,
        payment_method,
        updated_at: new Date(),
      })
      .where(eq(invoicesTable.id, invoice_id))
      .returning();

    await logAction({
      entityType: "invoice",
      entityId: invoice_id,
      action: "PAYMENT",
      newValue: { status: updated.status, payment_method, note: "Guest portal payment confirmation" },
    });

    res.json({
      success: true,
      data: {
        invoice_ref: updated.invoice_ref,
        invoice_id: updated.id,
        amount: updated.amount,
        currency: updated.currency ?? "AUD",
        status: updated.status,
        payment_method,
        paid_at: updated.paid_at,
        message: isPaidMethod
          ? "Payment confirmed."
          : "Bank transfer noted. We will confirm once payment is received.",
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
/* ───────────────────────────────────────────────────────
   GET /api/v1/guest/me/data — Sprint B-4
   "내 데이터" — APP 12 (Right of access) full personal data dump.
   Optional ?format=download adds Content-Disposition for browser save.
──────────────────────────────────────────────────────── */
router.get("/v1/guest/me/data", async (req, res): Promise<void> => {
  const guest = (req as any).guest as { id: number; email: string; account_id: number | null };
  try {
    // 1. Profile (guest_users) — exclude password_hash
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
        is_active: guestUsersTable.is_active,
        email_verified: guestUsersTable.email_verified,
        created_at: guestUsersTable.created_at,
        updated_at: guestUsersTable.updated_at,
      })
      .from(guestUsersTable)
      .where(eq(guestUsersTable.id, guest.id))
      .limit(1);

    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    // 2. Account
    const account = guest.account_id
      ? (await db
          .select()
          .from(accountsTable)
          .where(eq(accountsTable.id, guest.account_id))
          .limit(1))[0] ?? null
      : null;

    // 3. Emergency contacts
    const emergencyContacts = await db
      .select()
      .from(guestEmergencyContactsTable)
      .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id))
      .orderBy(desc(guestEmergencyContactsTable.is_primary));

    // Sole-owner guard: only expose account-scoped records when this guest is
    // the only guest_user on the account. Prevents leaking another guest's
    // bookings/invoices when accounts are shared.
    let accountSoleOwner = false;
    if (guest.account_id) {
      const sharers = await db
        .select({ id: guestUsersTable.id })
        .from(guestUsersTable)
        .where(eq(guestUsersTable.account_id, guest.account_id));
      accountSoleOwner = sharers.length === 1 && sharers[0]!.id === guest.id;
    }

    // 4. Bookings (with space name) — sole-owner only
    const bookings = accountSoleOwner && guest.account_id
      ? await db
          .select({
            id: bookingsTable.id,
            booking_ref: bookingsTable.booking_ref,
            booking_status: bookingsTable.booking_status,
            check_in_date: bookingsTable.check_in_date,
            check_out_date: bookingsTable.check_out_date,
            num_guests: bookingsTable.num_guests,
            total_rent: bookingsTable.total_rent,
            currency: bookingsTable.currency,
            customer_notes: bookingsTable.customer_notes,
            space_id: bookingsTable.space_id,
            space_name: spacesTable.name,
            created_at: bookingsTable.created_at,
          })
          .from(bookingsTable)
          .leftJoin(spacesTable, eq(spacesTable.id, bookingsTable.space_id))
          .where(eq(bookingsTable.account_id, guest.account_id))
          .orderBy(desc(bookingsTable.created_at))
      : [];

    // 5. Invoices — sole-owner only
    const invoices = accountSoleOwner && guest.account_id
      ? await db
          .select({
            id: invoicesTable.id,
            invoice_ref: invoicesTable.invoice_ref,
            booking_id: invoicesTable.booking_id,
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
          .where(eq(invoicesTable.account_id, guest.account_id))
          .orderBy(desc(invoicesTable.created_at))
      : [];

    // 6. Documents (metadata only) — guest_user docs PLUS docs attached to
    // any of this guest's bookings (APP 12 completeness).
    const bookingIds = bookings.map((b) => b.id);
    const docFilter = bookingIds.length > 0
      ? or(
          and(
            eq(documentsTable.entity_type, "guest_user"),
            eq(documentsTable.entity_id, guest.id),
          ),
          and(
            eq(documentsTable.entity_type, "booking"),
            inArray(documentsTable.entity_id, bookingIds),
          ),
        )
      : and(
          eq(documentsTable.entity_type, "guest_user"),
          eq(documentsTable.entity_id, guest.id),
        );
    const docs = await db
      .select({
        id: documentsTable.id,
        entity_type: documentsTable.entity_type,
        entity_id: documentsTable.entity_id,
        doc_type: documentsTable.doc_type,
        file_name: documentsTable.file_name,
        file_size: documentsTable.file_size,
        mime_type: documentsTable.mime_type,
        retention_until: documentsTable.retention_until,
        created_at: documentsTable.created_at,
      })
      .from(documentsTable)
      .where(docFilter)
      .orderBy(desc(documentsTable.created_at));

    // 7. Contracts — tenancy contracts where this account is the tenant
    //    (sole-owner only, mirrors the bookings/invoices guard).
    const contracts = accountSoleOwner && guest.account_id
      ? await db
          .select({
            id: contractsTable.id,
            contract_ref: contractsTable.contract_ref,
            status: contractsTable.status,
            start_date: contractsTable.start_date,
            end_date: contractsTable.end_date,
            weekly_rate: contractsTable.weekly_rate,
            total_rent: contractsTable.total_rent,
            currency: contractsTable.currency,
            signed_at: contractsTable.signed_at,
            created_at: contractsTable.created_at,
          })
          .from(contractsTable)
          .where(eq(contractsTable.tenant_account_id, guest.account_id))
          .orderBy(desc(contractsTable.created_at))
      : [];

    // 8. Customer-support tickets raised by this guest.
    const supportTickets = await db
      .select({
        id: csTicketsTable.id,
        ticket_ref: csTicketsTable.ticket_ref,
        category: csTicketsTable.category,
        subject: csTicketsTable.subject,
        description: csTicketsTable.description,
        status: csTicketsTable.status,
        created_at: csTicketsTable.created_at,
        closed_at: csTicketsTable.closed_at,
      })
      .from(csTicketsTable)
      .where(eq(csTicketsTable.guest_user_id, guest.id))
      .orderBy(desc(csTicketsTable.created_at));

    // 9. Marketing consents
    const consents = await db
      .select({
        id: marketingConsentsTable.id,
        channel: marketingConsentsTable.channel,
        opted_in_at: marketingConsentsTable.opted_in_at,
        opted_out_at: marketingConsentsTable.opted_out_at,
        source: marketingConsentsTable.source,
        updated_at: marketingConsentsTable.updated_at,
      })
      .from(marketingConsentsTable)
      .where(eq(marketingConsentsTable.email, profile.email));

    const dump = {
      generated_at: new Date().toISOString(),
      generated_for: profile.email,
      legal_basis:
        "Australian Privacy Principle 12 (Right of access). This export contains all personal information held by Million Stay about you at the time of export.",
      data: {
        profile,
        account,
        emergency_contacts: emergencyContacts,
        bookings,
        invoices,
        contracts,
        documents: docs,
        support_tickets: supportTickets,
        marketing_consents: consents,
      },
      counts: {
        bookings: bookings.length,
        invoices: invoices.length,
        contracts: contracts.length,
        documents: docs.length,
        support_tickets: supportTickets.length,
        emergency_contacts: emergencyContacts.length,
        marketing_consents: consents.length,
      },
    };

    if ((req.query["format"] as string) === "download") {
      const safeEmail = profile.email.replace(/[^a-zA-Z0-9._-]/g, "_");
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="millionstay-mydata-${safeEmail}-${stamp}.json"`,
      );
      res.send(JSON.stringify(dump, null, 2));
      return;
    }

    res.json({ success: true, ...dump });
  } catch (err) {
    console.error("[my-data] failed:", err);
    res.status(500).json({ success: false, error: "Failed to assemble personal data" });
  }
});

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

/* ───────────────────────────────────────────────────────
   APP 12 — Right of access
   GET /api/v1/guest/me/export
   Returns all personal data we hold about the authenticated guest as JSON.
──────────────────────────────────────────────────────── */
router.get("/v1/guest/me/export", requireGuestAuth, async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  if (!guest?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [profile] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guest.id));
    const emergencyContacts = await db.select().from(guestEmergencyContactsTable)
      .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id));

    // SECURITY: only return bookings/invoices when the guest is the SOLE owner
    // of their account (no other guest_users share the same account_id).
    // Otherwise, on a shared account, exporting bookings would leak another
    // user's data — refuse and direct to support.
    let bookings: any[] = [];
    let invoices: any[] = [];
    if (guest.account_id) {
      const siblings = await db
        .select({ id: guestUsersTable.id })
        .from(guestUsersTable)
        .where(and(eq(guestUsersTable.account_id, guest.account_id), isNull(guestUsersTable.deleted_at)));
      const isSoleOwner = siblings.length === 1 && siblings[0].id === guest.id;
      if (isSoleOwner) {
        bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.account_id, guest.account_id));
        invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.account_id, guest.account_id));
      }
    }

    const consents = await db.select().from(marketingConsentsTable)
      .where(eq(marketingConsentsTable.email, profile?.email ?? ""));

    // Strip internal-only / auth-secret fields before disclosure.
    // NOTE: these keys MUST match the real column names in guest_users
    // (password_hash, reset_token_hash, reset_token_expires_at) — an earlier
    // version stripped `reset_token`/`reset_token_expires`, which do not exist,
    // so the reset-token hash + expiry leaked into the user-downloadable JSON.
    let sanitized: Record<string, unknown> | null = null;
    if (profile) {
      const {
        password_hash: _ph,
        reset_token_hash: _rth,
        reset_token_expires_at: _rte,
        tokens_invalid_after: _tia,
        ...rest
      } = profile as Record<string, unknown>;
      sanitized = rest;
    }

    await logAction({
      entityType: "guest_users",
      entityId: guest.id,
      action: "VERIFY",
      actorId: guest.id,
      actorEmail: profile?.email ?? null,
      newValue: { event: "DSAR_EXPORT" },
      ipAddress: req.ip ?? null,
    });

    res.setHeader("Content-Disposition", `attachment; filename="millionstay-data-${guest.id}.json"`);
    res.json({
      exported_at: new Date().toISOString(),
      privacy_act_reference: "Privacy Act 1988 (Cth) — Australian Privacy Principle 12",
      data: {
        profile: sanitized,
        emergency_contacts: emergencyContacts,
        bookings,
        invoices,
        marketing_consents: consents,
      },
    });
  } catch (err) {
    console.error("[DSAR export]", err);
    res.status(500).json({ error: `Export failed. Contact ${getPrivacyContactEmail()}.` });
  }
});

/* ───────────────────────────────────────────────────────
   APP 13 — Correction & deletion
   POST /api/v1/guest/me/deletion-request
   Initiates account deletion. Soft-delete + retention obligations
   (tax/contract records) honoured per retention.ts policy.
──────────────────────────────────────────────────────── */
router.post("/v1/guest/me/deletion-request", requireGuestAuth, async (req, res): Promise<void> => {
  const guest = (req as any).guest;
  if (!guest?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;

  try {
    const [profile] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guest.id));
    if (!profile) { res.status(404).json({ error: "Account not found" }); return; }

    // Soft-delete: mark account, preserve booking/invoice records under
    // legal retention obligations (ATO 5y for invoices, tenancy 7y for contracts).
    //
    // Pseudonymise ALL directly-identifying PII in the profile record while
    // retaining FK integrity. The email is unique+NOT NULL, so it is replaced
    // with a collision-free tombstone rather than nulled. (Earlier versions
    // left email, DOB, nationality, gender, student_id and full bank details
    // intact — those are now cleared.)
    await db.update(guestUsersTable)
      .set({
        is_active: false,
        deleted_at: new Date(),
        first_name: "Deleted",
        last_name: "User",
        email: `deleted+${guest.id}@deleted.millionstay.invalid`,
        phone: null,
        nationality: null,
        date_of_birth: null,
        gender: null,
        student_id: null,
        university: null,
        department: null,
        study_year: null,
        bank_name: null,
        bank_account_name: null,
        bank_bsb: null,
        bank_account_number: null,
        preferred_payment_method: null,
        avatar_url: null,
        avatar_public_id: null,
        // Invalidate any outstanding session/reset tokens for this account.
        tokens_invalid_after: new Date(),
        reset_token_hash: null,
        reset_token_expires_at: null,
      })
      .where(eq(guestUsersTable.id, guest.id));

    // Hard-delete emergency contacts (third-party PII, no retention obligation).
    await db.delete(guestEmergencyContactsTable)
      .where(eq(guestEmergencyContactsTable.guest_user_id, guest.id));

    // Remove marketing-consent linkage for this person (no retention obligation;
    // keyed by the original email, which we are about to stop holding).
    if (profile.email) {
      await db.delete(marketingConsentsTable)
        .where(eq(marketingConsentsTable.email, profile.email.toLowerCase().trim()));
    }

    // Soft-delete the guest's own sensitive documents (ID/visa scans etc.).
    // Booking/contract/invoice documents are attached to other entity_types and
    // remain under their statutory retention; the purge cron destroys the
    // Cloudinary assets for anything soft-deleted or past retention.
    await db.update(documentsTable)
      .set({ deleted_at: new Date() })
      .where(and(
        eq(documentsTable.entity_type, "guest_user"),
        eq(documentsTable.entity_id, guest.id),
        isNull(documentsTable.deleted_at),
      ));

    await logAction({
      entityType: "guest_users",
      entityId: guest.id,
      action: "DELETE",
      actorId: guest.id,
      actorEmail: profile.email,
      newValue: { event: "DSAR_DELETION", reason },
      ipAddress: req.ip ?? null,
    });

    res.json({
      success: true,
      message: "Deletion request received. Account is now pseudonymised. Records subject to legal retention (tax invoices, contracts) will be removed when the retention period expires.",
      privacy_contact: getPrivacyContactEmail(),
    });
  } catch (err) {
    console.error("[DSAR deletion]", err);
    res.status(500).json({ error: `Deletion request failed. Contact ${getPrivacyContactEmail()}.` });
  }
});

export default router;
