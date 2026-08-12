// Auto-create the operational/financial Booking for a homestay placement (match).
//
// A homestay placement is the CRM match record (host family ⇄ student). The
// unified product model expects every placement to carry a Booking that holds
// the dates, pricing, product classification, host link and billing spine —
// exactly like a short-term/share booking. This module creates that booking the
// moment a placement is proposed and links it back via
// homestay_placements.booking_id.
//
// Money columns are numeric → Drizzle returns/accepts strings; wrap writes in
// String(), reads in Number().
import { and, eq, ilike, isNull } from "drizzle-orm";
import { DEFAULT_CURRENCY } from "../currency.js";
import {
  db,
  bookingsTable,
  accountsTable,
  spacesTable,
  homestayPlacementsTable,
  homestayStudentRequestsTable,
  homestayHostApplicationsTable,
} from "@workspace/db";
import { formatPersonName } from "../../lib/nameFormat";

type Placement = typeof homestayPlacementsTable.$inferSelect;
type Student = typeof homestayStudentRequestsTable.$inferSelect;
type Host = typeof homestayHostApplicationsTable.$inferSelect;

type MealPlan = "none" | "partial_board" | "full_board";
type ContractTerm = "short_term" | "mid_term" | "long_term";

/** Replicates bookings.ts ref generation: MS-YYYY-#####, count of MS-YYYY-% rows + 1. */
async function generateBookingRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(ilike(bookingsTable.booking_ref, `MS-${year}-%`))
    .orderBy(bookingsTable.id);
  const count = rows.length + 1;
  return `MS-${year}-${String(count).padStart(5, "0")}`;
}

/** Derive the booking's meal_plan from the student's stored preferences. */
function deriveMealPlan(preferences: unknown): MealPlan {
  if (!preferences || typeof preferences !== "object") return "none";
  const prefs = preferences as Record<string, unknown>;
  const stayType = typeof prefs.stay_type === "string" ? prefs.stay_type : "";
  if (stayType === "share" || stayType === "homestay_self_board") return "none";
  const meals = typeof prefs.meals === "string" ? prefs.meals : "";
  if (meals.includes("Full board")) return "full_board";
  if (meals.includes("Half board") || meals.includes("Dinner only")) return "partial_board";
  return "none";
}

/** Derive contract_term from preferences (only the three valid enum values). */
function deriveContractTerm(preferences: unknown): ContractTerm | null {
  if (!preferences || typeof preferences !== "object") return null;
  const term = (preferences as Record<string, unknown>).contract_term;
  if (term === "short_term" || term === "mid_term" || term === "long_term") return term;
  return null;
}

/**
 * Create (idempotently) the Booking backing a homestay placement and link it
 * back via homestay_placements.booking_id. Returns the booking id.
 *
 * Exceptions propagate — the caller wraps this best-effort.
 */
export async function createBookingForPlacement({
  placement,
  student,
  host,
}: {
  placement: Placement;
  student: Student;
  host: Host;
}): Promise<number> {
  // Idempotent: a placement already linked to a booking returns it unchanged.
  if (placement.booking_id) return placement.booking_id;

  // Resolve the student's guest account, creating one if needed (no login row —
  // the student portal is a later phase).
  let accountId = student.account_id;
  if (!accountId) {
    const [acct] = await db
      .insert(accountsTable)
      .values({
        name: formatPersonName(student.student_first_name, student.student_last_name),
        account_type: "Guest",
        account_email: student.student_email ?? null,
        status: "Active",
      })
      .returning();
    accountId = acct!.id;
    await db
      .update(homestayStudentRequestsTable)
      .set({ account_id: accountId, updated_at: new Date() })
      .where(eq(homestayStudentRequestsTable.id, student.id));
  }

  // Resolve a homestay space owned by the host family (may be none yet).
  let spaceId: number | null = null;
  if (host.account_id) {
    const [space] = await db
      .select({ id: spacesTable.id })
      .from(spacesTable)
      .where(
        and(
          eq(spacesTable.landlord_account_id, host.account_id),
          eq(spacesTable.space_type, "Homestay"),
          isNull(spacesTable.deleted_at),
        ),
      )
      .limit(1);
    spaceId = space?.id ?? null;
  }

  // Product classification snapshot.
  const room_type = "homestay" as const;
  const meal_plan = deriveMealPlan(student.preferences);
  const contract_term = deriveContractTerm(student.preferences);

  // Weekly rate derived from the monthly fee (monthly × 12 / 52).
  const monthly = Number(placement.monthly_fee ?? 0);
  const weekly = monthly > 0 ? String(Math.round((monthly * 12) / 52 * 100) / 100) : null;

  // Stay calc (only when both dates are present).
  let stayFields: {
    stay_nights?: number;
    stay_weeks?: string;
    total_rent?: string | null;
  } = {};
  if (placement.move_in_date && placement.move_out_date) {
    const checkIn = new Date(placement.move_in_date).getTime();
    const checkOut = new Date(placement.move_out_date).getTime();
    const nights = Math.round((checkOut - checkIn) / 86400000);
    const weeks = parseFloat((nights / 7).toFixed(2));
    const weeklyRate = weekly ? Number(weekly) : null;
    const total = weeklyRate ? weeks * weeklyRate : null;
    stayFields = {
      stay_nights: nights,
      stay_weeks: String(weeks),
      total_rent: total !== null ? String(total) : null,
    };
  }

  const booking_ref = await generateBookingRef();
  const [booking] = await db
    .insert(bookingsTable)
    .values({
      booking_ref,
      name: `Homestay_${placement.placement_ref}`,
      account_id: accountId,
      space_id: spaceId,
      booking_status: "Confirmed",
      booking_source: "homestay_placement",
      check_in_date: placement.move_in_date ?? null,
      check_out_date: placement.move_out_date ?? null,
      agreed_weekly_rate: weekly,
      currency: placement.currency ?? DEFAULT_CURRENCY,
      num_guests: 1,
      room_type,
      meal_plan,
      contract_term,
      host_application_id: host.id,
      agent_account_id: placement.agent_account_id ?? null,
      assigned_staff_user_id: student.assigned_staff_user_id ?? null,
      ...stayFields,
    })
    .returning();

  await db
    .update(homestayPlacementsTable)
    .set({ booking_id: booking!.id, updated_at: new Date() })
    .where(eq(homestayPlacementsTable.id, placement.id));

  return booking!.id;
}
