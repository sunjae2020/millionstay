import { Router, type IRouter } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { eq, ne, ilike, and, between, gte, lte, SQL, or, isNull, inArray, sql, asc, desc } from "drizzle-orm";
import { parseListPage, parseSortParams, buildOrderBy, sendList, type SortMap } from "../utils/pagination.js";
import { periodOverlapConditions, yearOverlapConditions, distinctYears, keywordCondition } from "../lib/listSearch";
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
import { z } from "zod/v4";
import { logAction } from "../utils/auditLog";
import { formatPersonName, formatPersonLabel } from "../lib/nameFormat";
import { stayDuration } from "../lib/stayDuration";
import { productRates } from "../lib/productRates";
import { getRateToAud } from "../lib/rateSnapshot";
import { resolveLeaseTermsFromProduct } from "../lib/leaseTerms";
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

/**
 * 월세 정산 방식 + 요금 직접 입력(메뉴얼 선택) + 계약일 — none of these are part
 * of the generated `CreateBookingBody` (the OpenAPI spec predates them), so they
 * are validated separately and merged into the write. Absent keys are left
 * untouched.
 */
/** An emptied form field arrives as `""` — that means "clear it", not zero. */
const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? null : v), schema);

const RentSettlementBody = z.object({
  rent_due_day: blankToNull(z.coerce.number().int().min(1).max(31).nullish()),
  prorate_with_next_month: z.coerce.boolean().nullish(),
  manual_pricing: z.coerce.boolean().nullish(),
  deposit_amount: blankToNull(z.coerce.number().nullish()),
  monthly_rent: blankToNull(z.coerce.number().nullish()),
  special_terms: z.string().nullish(),
  contract_date: z.string().nullish(),
  // ── 임대 조건 (장기/단기) — 계약과 같은 축, 확정 시 계약으로 승계된다 ──────
  lease_mode: z.enum(["long", "short"]).nullish(),
  rate_period: z.enum(["daily", "weekly", "monthly"]).nullish(),
  rate_amount: blankToNull(z.coerce.number().nullish()),
  advance_amount: blankToNull(z.coerce.number().nullish()),
  down_payment: blankToNull(z.coerce.number().nullish()),
  down_payment_date: z.string().nullish(),
  interim_payment: blankToNull(z.coerce.number().nullish()),
  interim_payment_date: z.string().nullish(),
  balance_amount: blankToNull(z.coerce.number().nullish()),
  balance_date: z.string().nullish(),
}).partial();

/** Drizzle `numeric` columns are strings; `null` clears the amount. */
function money(v: number | null | undefined): string | null {
  return v == null || !Number.isFinite(v) ? null : String(v);
}

function rentSettlementPatch(body: unknown): Record<string, unknown> {
  const parsed = RentSettlementBody.safeParse(body ?? {});
  if (!parsed.success) return {};
  const has = (k: string) => k in (body as object);
  const patch: Record<string, unknown> = {};
  if (has("rent_due_day")) patch["rent_due_day"] = parsed.data.rent_due_day ?? null;
  if (has("prorate_with_next_month")) {
    patch["prorate_with_next_month"] = parsed.data.prorate_with_next_month ?? true;
  }
  if (has("manual_pricing")) patch["manual_pricing"] = parsed.data.manual_pricing ?? false;
  if (has("deposit_amount")) patch["deposit_amount"] = money(parsed.data.deposit_amount);
  if (has("monthly_rent")) patch["monthly_rent"] = money(parsed.data.monthly_rent);
  if (has("special_terms")) patch["special_terms"] = parsed.data.special_terms || null;
  if (has("contract_date")) patch["contract_date"] = parsed.data.contract_date || null;
  if (has("lease_mode")) patch["lease_mode"] = parsed.data.lease_mode ?? null;
  if (has("rate_period")) patch["rate_period"] = parsed.data.rate_period ?? null;
  if (has("rate_amount")) patch["rate_amount"] = money(parsed.data.rate_amount);
  if (has("advance_amount")) patch["advance_amount"] = money(parsed.data.advance_amount);
  if (has("down_payment")) patch["down_payment"] = money(parsed.data.down_payment);
  if (has("down_payment_date")) patch["down_payment_date"] = parsed.data.down_payment_date || null;
  if (has("interim_payment")) patch["interim_payment"] = money(parsed.data.interim_payment);
  if (has("interim_payment_date")) patch["interim_payment_date"] = parsed.data.interim_payment_date || null;
  if (has("balance_amount")) patch["balance_amount"] = money(parsed.data.balance_amount);
  if (has("balance_date")) patch["balance_date"] = parsed.data.balance_date || null;
  return patch;
}

interface BookingRelations {
  account?: typeof accountsTable.$inferSelect | null;
  contact?: typeof contactsTable.$inferSelect | null;
  space?: typeof spacesTable.$inferSelect | null;
  property?: typeof propertiesTable.$inferSelect | null;
  product?: typeof accommodationCatalogTable.$inferSelect | null;
}

/**
 * Shape one booking for the API. Pure — the related rows are handed in, so the
 * list endpoint can batch-load them once (see `buildBookingResponses`) instead
 * of issuing five queries per booking.
 */
function shapeBooking(booking: typeof bookingsTable.$inferSelect, rel: BookingRelations) {
  const { account, contact, space, property, product } = rel;
  return {
    ...booking,
    account_name: account?.name ?? null,
    // 임경임 (no separating space for CJK), with the mobile appended as
    // 임경임_010-5252-5232 in `contact_label` for screens that show both.
    contact_name: contact ? formatPersonName(contact.first_name, contact.last_name) : null,
    contact_mobile: contact?.mobile_number ?? null,
    contact_email: contact?.email ?? null,
    contact_label: contact
      ? formatPersonLabel(contact.first_name, contact.last_name, contact.mobile_number)
      : null,
    // The product/숙박 패키지 is configured in the product catalog — the booking
    // screen links straight to it and mirrors its rate card, so `product` ships
    // the full pricing set rather than just a name.
    product_name: product?.name ?? null,
    product: product
      ? {
          id: product.id,
          name: product.name,
          item_description: product.item_description ?? null,
          product_tag: product.product_tag ?? null,
          currency: product.currency,
          rates: productRates(product),
          deposit_amount: product.deposit_amount ?? null,
          billing_frequency: product.billing_frequency ?? null,
          term_type: product.term_type ?? null,
          contract_term: product.contract_term ?? null,
          room_type: product.room_type ?? null,
          status: product.status,
        }
      : null,
    stay_duration: stayDuration(booking.check_in_date, booking.check_out_date),
    space_name: space?.name ?? null,
    space_type: space?.space_type ?? null,
    booking_mode: space?.booking_mode ?? null,
    property_address: property ? `${property.address ?? ""} ${property.city ?? ""}`.trim() : null,
  };
}

/** Single-booking loader — five point reads, then `shapeBooking`. */
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
  const [product] = booking.product_id
    ? await db.select().from(accommodationCatalogTable).where(eq(accommodationCatalogTable.id, booking.product_id))
    : [null];
  return shapeBooking(booking, { account, contact, space, property, product });
}

/**
 * List loader — five batched `inArray` reads for the whole page, regardless of
 * how many bookings it holds. Keeps the list off the N+1 path that made other
 * admin lists hang.
 */
async function buildBookingResponses(bookings: (typeof bookingsTable.$inferSelect)[]) {
  if (bookings.length === 0) return [];
  const ids = <T,>(xs: (T | null | undefined)[]) => [...new Set(xs.filter((x): x is T => x != null))];

  const accountIds = ids(bookings.map((b) => b.account_id));
  const contactIds = ids(bookings.map((b) => b.contact_id));
  const spaceIds = ids(bookings.map((b) => b.space_id));
  const productIds = ids(bookings.map((b) => b.product_id));

  const [accounts, contacts, spaces, products] = await Promise.all([
    accountIds.length ? db.select().from(accountsTable).where(inArray(accountsTable.id, accountIds)) : [],
    contactIds.length ? db.select().from(contactsTable).where(inArray(contactsTable.id, contactIds)) : [],
    spaceIds.length ? db.select().from(spacesTable).where(inArray(spacesTable.id, spaceIds)) : [],
    productIds.length
      ? db.select().from(accommodationCatalogTable).where(inArray(accommodationCatalogTable.id, productIds))
      : [],
  ]);

  const propertyIds = ids(spaces.map((sp) => sp.property_id));
  const properties = propertyIds.length
    ? await db.select().from(propertiesTable).where(inArray(propertiesTable.id, propertyIds))
    : [];

  const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const accountMap = byId(accounts);
  const contactMap = byId(contacts);
  const spaceMap = byId(spaces);
  const productMap = byId(products);
  const propertyMap = byId(properties);

  return bookings.map((b) => {
    const space = b.space_id ? spaceMap.get(b.space_id) ?? null : null;
    return shapeBooking(b, {
      account: b.account_id ? accountMap.get(b.account_id) ?? null : null,
      contact: b.contact_id ? contactMap.get(b.contact_id) ?? null : null,
      space,
      property: space?.property_id ? propertyMap.get(space.property_id) ?? null : null,
      product: b.product_id ? productMap.get(b.product_id) ?? null : null,
    });
  });
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

/** 정렬 허용 컬럼 — BookingList 의 SORTABLE_KEYS 와 1:1. 금액은 계약과 같은 월 환산액. */
const BOOKING_SORT: SortMap = {
  booking_ref: bookingsTable.booking_ref,
  check_in_date: bookingsTable.check_in_date,
  check_out_date: bookingsTable.check_out_date,
  stay_nights: bookingsTable.stay_nights,
  booking_status: bookingsTable.booking_status,
  booking_source: bookingsTable.booking_source,
  created_at: bookingsTable.created_at,
  updated_at: bookingsTable.updated_at,
  space_name: sql`(select sp.name from spaces sp where sp.id = ${bookingsTable.space_id})`,
  guest: sql`coalesce(
      (select a.name from accounts a where a.id = ${bookingsTable.account_id}),
      (select coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')
         from contacts c where c.id = ${bookingsTable.contact_id})
    )`,
  amount: sql`(case
      when ${bookingsTable.lease_mode} = 'long'
        or (${bookingsTable.lease_mode} is null and coalesce(${bookingsTable.monthly_rent}, 0) > 0)
        then coalesce(${bookingsTable.monthly_rent}, 0)
      else coalesce(${bookingsTable.rate_amount}, ${bookingsTable.agreed_weekly_rate}, 0)
        * (case ${bookingsTable.rate_period}
             when 'daily' then 365.0 / 12
             when 'monthly' then 1
             else 52.0 / 12 end)
    end)`,
};

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
  // 체류 기간이 지정 구간과 겹치는 예약(zod 파라미터 스키마 밖이라 req.query 에서 직접 읽는다).
  const { date_from, date_to, year } = req.query as Record<string, string>;
  conditions.push(...periodOverlapConditions(bookingsTable.check_in_date, bookingsTable.check_out_date, date_from, date_to));
  conditions.push(...yearOverlapConditions(bookingsTable.check_in_date, bookingsTable.check_out_date, year));

  // 임대 유형(장기/단기). 백필 전 행은 lease_mode 가 NULL 이라 월세 유무로 갈음한다
  // (계약 목록과 같은 규칙). 예전에는 프런트가 로드된 행에서 걸렀다.
  const leaseMode = String((req.query as Record<string, string>).lease_mode ?? "").trim();
  if (leaseMode === "long") {
    conditions.push(or(eq(bookingsTable.lease_mode, "long"),
      and(isNull(bookingsTable.lease_mode), sql`coalesce(${bookingsTable.monthly_rent}, 0) > 0`))!);
  } else if (leaseMode === "short") {
    conditions.push(or(eq(bookingsTable.lease_mode, "short"),
      and(isNull(bookingsTable.lease_mode), sql`coalesce(${bookingsTable.monthly_rent}, 0) = 0`))!);
  }

  // 검색은 SQL 단계에서 끝낸다. 예전처럼 enrich 후 배열을 거르면 서버 페이징이
  // "현재 페이지 안에서만" 검색되는 꼴이 된다.
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      or(
        ilike(bookingsTable.booking_ref, like),
        sql`exists (select 1 from accounts a where a.id = ${bookingsTable.account_id} and a.name ilike ${like})`,
        sql`exists (select 1 from contacts c where c.id = ${bookingsTable.contact_id}
              and (coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) ilike ${like})`,
        sql`exists (select 1 from spaces sp where sp.id = ${bookingsTable.space_id} and sp.name ilike ${like})`,
      )!,
    );
  }

  const where = and(...conditions);
  const { limit, offset, page } = parseListPage(req.query);
  const sort = parseSortParams(req.query, BOOKING_SORT);

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(bookingsTable)
      .where(where)
      .orderBy(...buildOrderBy(BOOKING_SORT, sort, bookingsTable.id, [asc(bookingsTable.created_at)]))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable).where(where),
  ]);

  const enriched = await buildBookingResponses(rows);
  sendList(res, enriched, count ?? 0, { limit, offset, page });
});

/** 연도 선택지(체크인 기준). "/:id" 보다 먼저 선언해야 한다. */
router.get("/v1/bookings/facets", async (req, res): Promise<void> => {
  const base = deletedFilter(bookingsTable.deleted_at, req);
  res.json({ years: await distinctYears(bookingsTable, bookingsTable.check_in_date, base) });
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
  const contactName = contact ? formatPersonName(contact.first_name, contact.last_name).replace(/\s+/g, "_") : "Guest";
  const name = `GuestBook_${contactName}_${new Date().toISOString().slice(0, 10)}`;

  const exchange_rate_to_aud = await getRateToAud((data as any).currency ?? DEFAULT_CURRENCY);
  const [row] = await db
    .insert(bookingsTable)
    .values({ ...data, ...rentSettlementPatch(req.body), ...stayDetails, booking_ref, name, booking_status: "Draft", exchange_rate_to_aud })
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
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, formatPersonName(c.first_name, c.last_name)]));

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
    const enriched = await buildBookingResponses(bookings);
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
    const enriched = await buildBookingResponses(bookings);
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

  const [row] = await db.update(bookingsTable).set({ ...data, ...rentSettlementPatch(req.body), ...stayDetails }).where(eq(bookingsTable.id, paramParsed.data.id)).returning();
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
    const advanceAmount = weeklyRate * 2;

    // 보증금 / 월세 — 예약에 직접 입력된 값이 상품 rate card 를 이긴다. 예약 화면의
    // "요금 직접 입력"(manual_pricing)으로 합의한 조건이 계약으로 넘어오지 않으면
    // 자동 월세청구가 상품 정가로 잡히므로, 예약 값 → 상품 → 서구식 4주 본드 순.
    const lease = await resolveLeaseTermsFromProduct(existing.product_id);
    const bookedDeposit = existing.deposit_amount != null ? parseFloat(existing.deposit_amount) : null;
    const bookedMonthly = existing.monthly_rent != null ? parseFloat(existing.monthly_rent) : null;
    const bondAmount = bookedDeposit ?? lease?.deposit_amount ?? weeklyRate * 4;
    const monthlyRent = bookedMonthly ?? lease?.effective_monthly ?? null;
    // 임대 유형은 예약에서 고른 값을 따르고, 없으면 월세 유무로 갈음한다.
    const leaseMode = existing.lease_mode ?? (monthlyRent != null && monthlyRent > 0 ? "long" : "short");
    const numOrNull = (v: string | null) => (v == null ? null : parseFloat(v));

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
      `  Currency            : ${existing.currency ?? DEFAULT_CURRENCY}`,
      monthlyRent != null
        ? `  Monthly Rent        : ${existing.currency} ${monthlyRent.toFixed(2)}` +
          (lease?.promotion_name ? `  (프로모션: ${lease.promotion_name})` : "")
        : `  Weekly Rent         : ${existing.currency} ${weeklyRate.toFixed(2)}`,
      `  Total Rent          : ${existing.currency} ${totalRent.toFixed(2)}`,
      lease?.deposit_amount != null
        ? `  Deposit (보증금)     : ${existing.currency} ${bondAmount.toFixed(2)}`
        : `  Security Bond       : ${existing.currency} ${bondAmount.toFixed(2)} (4 weeks rent)`,
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
      ...(existing.special_terms ? ["특약 (SPECIAL CONDITIONS)", existing.special_terms, ""] : []),
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
      advance_amount: numOrNull(existing.advance_amount) ?? advanceAmount,
      monthly_rent: monthlyRent,
      // ── 예약에서 확정한 임대 조건을 그대로 승계 ─────────────────────────────
      lease_mode: leaseMode,
      rate_period: existing.rate_period ?? (existing.agreed_weekly_rate ? "weekly" : null),
      rate_amount: numOrNull(existing.rate_amount) ?? (weeklyRate || null),
      rent_due_day: existing.rent_due_day ?? null,
      down_payment: numOrNull(existing.down_payment),
      down_payment_date: existing.down_payment_date ?? null,
      interim_payment: numOrNull(existing.interim_payment),
      interim_payment_date: existing.interim_payment_date ?? null,
      balance_amount: numOrNull(existing.balance_amount),
      balance_date: existing.balance_date ?? null,
      effective_date: existing.contract_date ?? null,
      currency: existing.currency ?? DEFAULT_CURRENCY,
      exchange_rate_to_aud: await getRateToAud(existing.currency ?? DEFAULT_CURRENCY),
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
      currency: existing.currency ?? DEFAULT_CURRENCY,
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
        currency: svc.currency ?? existing.currency ?? DEFAULT_CURRENCY,
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
    currency: currency ?? DEFAULT_CURRENCY,
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
  const conditions = q ? [keywordCondition(q, [bookingsTable.booking_ref, bookingsTable.name])] : [];
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
