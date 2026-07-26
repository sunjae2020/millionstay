import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, or, ilike, desc, inArray, isNull, isNotNull, gte, lte, sql } from "drizzle-orm";
import {
  db,
  bookingsTable,
  spacesTable,
  propertiesTable,
  contractsTable,
  contractLineItemsTable,
  invoicesTable,
  accountsTable,
  contactsTable,
  ownerSitesTable,
  leadsTable,
  spaceAvailabilityTable,
  spaceTermCalendarTable,
  documentsTable,
  validateSlug,
} from "@workspace/db";
import { requireOwnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder, generateSignedUrl } from "../utils/cloudinary";
import { logAction } from "../utils/auditLog";
import { syncOwnerSubdomain } from "../lib/vercelDomains";
import { parsePageParams, pageMeta, paginateArray } from "../utils/pagination";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// SECURITY: every /v1/owner/* route requires owner auth (defence in depth).
router.use("/v1/owner", requireOwnerAuth);

/* ─── helpers ─── */
function formatTenantForOwner(contact: { first_name: string | null; last_name: string | null; gender: string | null }) {
  const first = (contact.first_name ?? "").trim();
  const last = (contact.last_name ?? "").trim().toUpperCase();
  const display = [first, last].filter(Boolean).join(" ") || "—";
  return {
    display_name: display,
    first_name: first || "—",
    last_name: last || "—",
    gender: contact.gender ?? "—",
  };
}

/**
 * Accept either { dates: ["YYYY-MM-DD", ...] } or an inclusive { from, to }
 * range and return a deduped, sorted list of ISO dates (capped at 366 days).
 */
function normaliseDates(body: any): string[] {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const out = new Set<string>();
  if (Array.isArray(body?.dates)) {
    for (const d of body.dates) if (typeof d === "string" && isoRe.test(d)) out.add(d);
  } else if (typeof body?.from === "string" && typeof body?.to === "string" && isoRe.test(body.from) && isoRe.test(body.to)) {
    let from = body.from, to = body.to;
    if (to < from) [from, to] = [to, from];
    let guard = 0;
    for (let d = from; d <= to && guard < 366; guard++) {
      out.add(d);
      const nd = new Date(d + "T00:00:00Z");
      nd.setUTCDate(nd.getUTCDate() + 1);
      d = nd.toISOString().slice(0, 10);
    }
  }
  return [...out].sort();
}

/* GET /api/v1/owner/dashboard */
router.get("/v1/owner/dashboard", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name })
    .from(accountsTable)
    .where(eq(accountsTable.id, partner.account_id))
    .limit(1);

  // Owner's properties
  const properties = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address, city: propertiesTable.city, state: propertiesTable.state, approval_status: propertiesTable.approval_status })
    .from(propertiesTable)
    .where(eq(propertiesTable.owner_account_id, partner.account_id));

  const propertyIds = properties.map(p => p.id);
  if (!propertyIds.length) {
    res.json({ success: true, data: { account_name: account?.name ?? "—", properties: [], stats: { total_properties: 0, total_spaces: 0, active_bookings: 0, monthly_revenue: 0 }, recent_bookings: [] } });
    return;
  }

  // Spaces in those properties
  const spaces = await db
    .select({ id: spacesTable.id, property_id: spacesTable.property_id, name: spacesTable.name, space_type: spacesTable.space_type, status: spacesTable.status })
    .from(spacesTable)
    .where(inArray(spacesTable.property_id, propertyIds));

  const spaceIds = spaces.map(s => s.id);

  // Bookings for those spaces
  const bookings = spaceIds.length
    ? await db
        .select({
          id: bookingsTable.id,
          booking_ref: bookingsTable.booking_ref,
          booking_status: bookingsTable.booking_status,
          space_id: bookingsTable.space_id,
          check_in_date: bookingsTable.check_in_date,
          check_out_date: bookingsTable.check_out_date,
          agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
          total_rent: bookingsTable.total_rent,
          currency: bookingsTable.currency,
        })
        .from(bookingsTable)
        .where(and(inArray(bookingsTable.space_id, spaceIds), eq(bookingsTable.status, "Active")))
        .orderBy(desc(bookingsTable.created_at))
    : [];

  const activeBookings = bookings.filter(b => ["Confirmed", "Active"].includes(b.booking_status)).length;
  const monthlyRevenue = bookings
    .filter(b => ["Active", "CheckedOut"].includes(b.booking_status))
    .reduce((sum, b) => sum + parseFloat(b.agreed_weekly_rate ?? "0") * 4, 0);

  res.json({
    success: true,
    data: {
      account_name: account?.name ?? "—",
      properties,
      stats: {
        total_properties: properties.length,
        total_spaces: spaces.length,
        active_bookings: activeBookings,
        monthly_revenue: monthlyRevenue,
      },
      recent_bookings: bookings.slice(0, 5),
    },
  });
});

/* GET /api/v1/owner/properties */
router.get("/v1/owner/properties", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const properties = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      city: propertiesTable.city,
      state: propertiesTable.state,
      postcode: propertiesTable.postcode,
      approval_status: propertiesTable.approval_status,
    })
    .from(propertiesTable)
    .where(eq(propertiesTable.owner_account_id, partner.account_id));

  const propertyIds = properties.map(p => p.id);
  const spaces = propertyIds.length
    ? await db
        .select({ id: spacesTable.id, property_id: spacesTable.property_id, name: spacesTable.name, space_type: spacesTable.space_type, status: spacesTable.status })
        .from(spacesTable)
        .where(inArray(spacesTable.property_id, propertyIds))
    : [];

  const spaceMap: Record<number, typeof spaces> = {};
  for (const s of spaces) {
    if (s.property_id) {
      if (!spaceMap[s.property_id]) spaceMap[s.property_id] = [];
      spaceMap[s.property_id].push(s);
    }
  }

  const result = properties.map(p => ({ ...p, spaces: spaceMap[p.id] ?? [] }));
  res.json({ success: true, data: result });
});

/* GET /api/v1/owner/properties/:id */
router.get("/v1/owner/properties/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const propertyId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(propertyId)) {
    res.status(400).json({ success: false, error: "Invalid property id" });
    return;
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, propertyId), eq(propertiesTable.owner_account_id, partner.account_id)))
    .limit(1);

  if (!property) {
    res.status(404).json({ success: false, error: "Property not found" });
    return;
  }

  // spaces of this property
  const spaces = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      space_type: spacesTable.space_type,
      status: spacesTable.status,
      property_id: spacesTable.property_id,
    })
    .from(spacesTable)
    .where(eq(spacesTable.property_id, propertyId));

  const spaceIds = spaces.map(s => s.id);

  // contracts on those spaces (or whose landlord is the owner)
  const contractsBySpace = spaceIds.length
    ? await db
        .select()
        .from(contractsTable)
        .where(inArray(contractsTable.space_id, spaceIds))
    : [];
  const contractsByLandlord = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.landlord_account_id, partner.account_id));

  const seen = new Set<number>();
  const allContracts = [...contractsBySpace, ...contractsByLandlord].filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    if (c.deleted_at) return false;
    // Only include landlord-side contracts or contracts on owner's space
    const onOwnerSpace = c.space_id != null && spaceIds.includes(c.space_id);
    const ownerIsLandlord = c.landlord_account_id === partner.account_id;
    return onOwnerSpace || ownerIsLandlord;
  });

  const contractIds = allContracts.map(c => c.id);
  const tenantIds = [...new Set(allContracts.map(c => c.tenant_account_id).filter(Boolean))] as number[];

  const lineItems = contractIds.length
    ? await db
        .select()
        .from(contractLineItemsTable)
        .where(inArray(contractLineItemsTable.contract_id, contractIds))
    : [];

  const tenantAccounts = tenantIds.length
    ? await db
        .select({ id: accountsTable.id, name: accountsTable.name })
        .from(accountsTable)
        .where(inArray(accountsTable.id, tenantIds))
    : [];
  const tenantMap = Object.fromEntries(tenantAccounts.map(a => [a.id, a.name]));
  const spaceMap = Object.fromEntries(spaces.map(s => [s.id, s.name]));

  const lineMap: Record<number, typeof lineItems> = {};
  for (const li of lineItems) {
    if (!lineMap[li.contract_id]) lineMap[li.contract_id] = [];
    lineMap[li.contract_id].push(li);
  }

  // Compute revenue share = sum of recurring rent line items / contract weekly_rate (illustrative)
  const enrichedContracts = allContracts
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
    .map(c => {
      const items = lineMap[c.id] ?? [];
      const recurringWeekly = items
        .filter(li => li.item_type === "Rent" && li.billing_trigger === "recurring")
        .reduce((sum, li) => {
          const total = parseFloat(li.total_price ?? "0");
          // normalise to weekly
          const f = (li.billing_frequency ?? "").toLowerCase();
          if (f === "weekly") return sum + total;
          if (f === "biweekly" || f === "fortnightly") return sum + total / 2;
          if (f === "monthly") return sum + total * 12 / 52;
          return sum + total;
        }, 0);
      const monthlyRent = (c.weekly_rate ?? 0) * 52 / 12;
      return {
        ...c,
        space_name: c.space_id ? spaceMap[c.space_id] ?? null : null,
        tenant_name: c.tenant_account_id ? tenantMap[c.tenant_account_id] ?? null : null,
        monthly_rent: Math.round(monthlyRent * 100) / 100,
        owner_share_weekly: Math.round(recurringWeekly * 100) / 100,
        owner_share_pct: c.weekly_rate ? Math.round((recurringWeekly / c.weekly_rate) * 1000) / 10 : null,
        line_items: items,
      };
    });

  // Documents = contract document_urls (and any future doc table)
  const documents = enrichedContracts
    .filter(c => c.document_url)
    .map(c => ({
      kind: "contract",
      contract_id: c.id,
      contract_ref: c.contract_ref,
      file_name: `${c.contract_ref}.pdf`,
      file_url: c.document_url,
      uploaded_at: c.signed_at ?? c.sent_at ?? c.created_at,
    }));

  res.json({
    success: true,
    data: {
      property,
      spaces,
      contracts: enrichedContracts,
      documents,
      stats: {
        total_spaces: spaces.length,
        active_contracts: enrichedContracts.filter(c => c.status === "Active").length,
        total_contracts: enrichedContracts.length,
      },
    },
  });
});

/* GET /api/v1/owner/bookings */
router.get("/v1/owner/bookings", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const { limit, offset, page, q } = parsePageParams(req.query);
  const statusFilter = typeof req.query.booking_status === "string" ? req.query.booking_status : "";

  const conds = [
    eq(propertiesTable.owner_account_id, partner.account_id),
    eq(bookingsTable.status, "Active"),
  ];
  if (statusFilter) conds.push(eq(bookingsTable.booking_status, statusFilter));
  if (q) {
    conds.push(
      or(
        ilike(bookingsTable.booking_ref, `%${q}%`),
        ilike(contactsTable.first_name, `%${q}%`),
        ilike(contactsTable.last_name, `%${q}%`),
        ilike(propertiesTable.name, `%${q}%`),
        ilike(spacesTable.name, `%${q}%`),
      )!,
    );
  }
  // Date-range overlap: a booking with an open-ended (null) check-out is always ongoing.
  const dateFrom = typeof req.query.date_from === "string" ? req.query.date_from : "";
  const dateTo = typeof req.query.date_to === "string" ? req.query.date_to : "";
  if (dateTo) conds.push(or(isNull(bookingsTable.check_in_date), lte(bookingsTable.check_in_date, dateTo))!);
  if (dateFrom) conds.push(or(isNull(bookingsTable.check_out_date), gte(bookingsTable.check_out_date, dateFrom))!);
  const whereExpr = and(...conds);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .innerJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .innerJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(contactsTable, eq(bookingsTable.contact_id, contactsTable.id))
    .where(whereExpr);

  const rows = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      space_id: bookingsTable.space_id,
      contact_id: bookingsTable.contact_id,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
      space_name: spacesTable.name,
      property_name: propertiesTable.name,
      contact_first: contactsTable.first_name,
      contact_last: contactsTable.last_name,
      contact_gender: contactsTable.gender,
    })
    .from(bookingsTable)
    .innerJoin(spacesTable, eq(bookingsTable.space_id, spacesTable.id))
    .innerJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .leftJoin(contactsTable, eq(bookingsTable.contact_id, contactsTable.id))
    .where(whereExpr)
    .orderBy(desc(bookingsTable.created_at))
    .limit(limit)
    .offset(offset);

  const result = rows.map((r) => ({
    id: r.id,
    booking_ref: r.booking_ref,
    booking_status: r.booking_status,
    space_id: r.space_id,
    contact_id: r.contact_id,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    agreed_weekly_rate: r.agreed_weekly_rate,
    total_rent: r.total_rent,
    currency: r.currency,
    space_name: r.space_name ?? "—",
    property_name: r.property_name ?? "—",
    tenant: r.contact_id
      ? formatTenantForOwner({ first_name: r.contact_first, last_name: r.contact_last, gender: r.contact_gender })
      : null,
  }));

  res.json({ success: true, data: result, meta: pageMeta(total ?? 0, { limit, offset, page }) });
});

/* GET /api/v1/owner/revenue */
router.get("/v1/owner/revenue", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const properties = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name })
    .from(propertiesTable)
    .where(eq(propertiesTable.owner_account_id, partner.account_id));

  const propertyIds = properties.map(p => p.id);
  if (!propertyIds.length) {
    res.json({ success: true, data: { properties: [], total_revenue: 0, invoices: [] } });
    return;
  }

  const spaces = await db
    .select({ id: spacesTable.id, property_id: spacesTable.property_id, name: spacesTable.name })
    .from(spacesTable).where(inArray(spacesTable.property_id, propertyIds));
  const spaceIds = spaces.map(s => s.id);

  const bookings = spaceIds.length
    ? await db
        .select({ id: bookingsTable.id, space_id: bookingsTable.space_id, total_rent: bookingsTable.total_rent, booking_status: bookingsTable.booking_status })
        .from(bookingsTable)
        .where(and(inArray(bookingsTable.space_id, spaceIds), eq(bookingsTable.status, "Active")))
    : [];

  const bookingIds = bookings.map(b => b.id);
  const invoices = bookingIds.length
    ? await db
        .select({
          id: invoicesTable.id,
          booking_id: invoicesTable.booking_id,
          invoice_ref: invoicesTable.invoice_ref,
          due_date: invoicesTable.due_date,
          amount: invoicesTable.amount,
          status: invoicesTable.status,
          currency: invoicesTable.currency,
          description: invoicesTable.description,
        })
        .from(invoicesTable)
        .where(inArray(invoicesTable.booking_id, bookingIds))
        .orderBy(desc(invoicesTable.due_date))
    : [];

  const totalRevenue = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const pendingRevenue = invoices.filter(i => i.status !== "Paid" && i.status !== "Void").reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const spaceMap = Object.fromEntries(spaces.map(s => [s.id, s]));
  const propMap = Object.fromEntries(properties.map(p => [p.id, p]));

  const enrichedInvoices = invoices.map(inv => {
    const booking = bookings.find(b => b.id === inv.booking_id);
    const space = booking?.space_id ? spaceMap[booking.space_id] : null;
    const property = space?.property_id ? propMap[space.property_id] : null;
    return {
      ...inv,
      amount_due: inv.amount,
      amount_paid: inv.status === "Paid" ? inv.amount : null,
      space_name: space?.name ?? "—",
      property_name: (property as any)?.name ?? "—",
    };
  });

  // Aggregates span all invoices; only the invoice list is paginated/searched.
  const { limit, offset, page, q } = parsePageParams(req.query);
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "";
  const lowerQ = q.toLowerCase();
  const filteredInvoices = enrichedInvoices.filter((inv) => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (!lowerQ) return true;
    return (
      (inv.invoice_ref ?? "").toLowerCase().includes(lowerQ) ||
      inv.property_name.toLowerCase().includes(lowerQ) ||
      inv.space_name.toLowerCase().includes(lowerQ)
    );
  });
  const pagedInvoices = paginateArray(filteredInvoices, { limit, offset });

  res.json({
    success: true,
    data: {
      properties,
      total_revenue: totalRevenue,
      pending_revenue: pendingRevenue,
      invoices: pagedInvoices,
    },
    meta: pageMeta(filteredInvoices.length, { limit, offset, page }),
  });
});

/* ═══════════════════════════════════════════════════════
   Analytics — aggregated series/breakdowns for the owner
   dashboard (revenue trend, occupancy, contracts, invoices).
   All scoped to the owner's own properties/spaces.
═══════════════════════════════════════════════════════ */
router.get("/v1/owner/analytics", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const empty = {
    revenue_trend: [] as Array<{ month: string; paid: number; pending: number }>,
    occupancy: { occupied: 0, total: 0, rate: 0 },
    contracts_by_status: [] as Array<{ status: string; count: number }>,
    invoices_summary: { paid: 0, pending: 0, overdue: 0, paid_count: 0, pending_count: 0, overdue_count: 0 },
    spaces_by_status: [] as Array<{ status: string; count: number }>,
    revenue_by_property: [] as Array<{ property: string; paid: number }>,
    currency: "KRW",
  };

  const properties = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.owner_account_id, partner.account_id), isNull(propertiesTable.deleted_at)));
  const propertyIds = properties.map((p) => p.id);
  if (!propertyIds.length) {
    res.json({ success: true, data: empty });
    return;
  }

  const spaces = await db
    .select({ id: spacesTable.id, property_id: spacesTable.property_id, status: spacesTable.status, base_currency: spacesTable.base_currency })
    .from(spacesTable)
    .where(and(inArray(spacesTable.property_id, propertyIds), isNull(spacesTable.deleted_at)));
  const spaceIds = spaces.map((s) => s.id);
  const propNameById = Object.fromEntries(properties.map((p) => [p.id, p.name]));
  const propIdBySpace = Object.fromEntries(spaces.map((s) => [s.id, s.property_id]));
  const currency = spaces.find((s) => s.base_currency)?.base_currency ?? "KRW";

  const bookings = spaceIds.length
    ? await db
        .select({
          id: bookingsTable.id,
          space_id: bookingsTable.space_id,
          booking_status: bookingsTable.booking_status,
          check_in_date: bookingsTable.check_in_date,
          check_out_date: bookingsTable.check_out_date,
        })
        .from(bookingsTable)
        .where(and(inArray(bookingsTable.space_id, spaceIds), eq(bookingsTable.status, "Active")))
    : [];
  const bookingIds = bookings.map((b) => b.id);

  const invoices = bookingIds.length
    ? await db
        .select({
          booking_id: invoicesTable.booking_id,
          amount: invoicesTable.amount,
          status: invoicesTable.status,
          due_date: invoicesTable.due_date,
          paid_at: invoicesTable.paid_at,
        })
        .from(invoicesTable)
        .where(inArray(invoicesTable.booking_id, bookingIds))
    : [];

  const contracts = spaceIds.length
    ? await db
        .select({ status: contractsTable.status, space_id: contractsTable.space_id })
        .from(contractsTable)
        .where(and(inArray(contractsTable.space_id, spaceIds), isNull(contractsTable.deleted_at)))
    : [];

  const today = new Date().toISOString().slice(0, 10);

  // Revenue trend — last 12 months, paid vs. outstanding (by due month).
  const months: string[] = [];
  {
    const d = new Date();
    d.setUTCDate(1);
    for (let i = 11; i >= 0; i--) {
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
      months.push(m.toISOString().slice(0, 7));
    }
  }
  const trendMap = Object.fromEntries(months.map((m) => [m, { paid: 0, pending: 0 }]));
  const bookingById = Object.fromEntries(bookings.map((b) => [b.id, b]));
  const revByProp: Record<number, number> = {};
  for (const inv of invoices) {
    const ref = (inv.paid_at ? inv.paid_at.toISOString().slice(0, 7) : (inv.due_date ?? "").slice(0, 7));
    const amt = Number(inv.amount ?? 0);
    if (inv.status === "Paid") {
      if (trendMap[ref]) trendMap[ref].paid += amt;
      const sid = bookingById[inv.booking_id ?? -1]?.space_id;
      const pid = sid != null ? propIdBySpace[sid] : undefined;
      if (pid != null) revByProp[pid] = (revByProp[pid] ?? 0) + amt;
    } else if (inv.status !== "Void" && trendMap[ref]) {
      trendMap[ref].pending += amt;
    }
  }
  const revenue_trend = months.map((m) => ({ month: m, paid: trendMap[m].paid, pending: trendMap[m].pending }));

  // Occupancy — spaces with a booking that spans today.
  const occupiedSpaceIds = new Set<number>();
  for (const b of bookings) {
    if (!["Confirmed", "Active", "CheckedOut"].includes(b.booking_status)) continue;
    const ci = b.check_in_date ?? null;
    const co = b.check_out_date ?? null;
    if (ci && ci <= today && (!co || co >= today) && b.space_id != null) occupiedSpaceIds.add(b.space_id);
  }
  const occupancy = { occupied: occupiedSpaceIds.size, total: spaces.length, rate: spaces.length ? Math.round((occupiedSpaceIds.size / spaces.length) * 100) : 0 };

  // Contract + space status breakdowns.
  const countBy = <T,>(rows: T[], key: (r: T) => string) => {
    const m: Record<string, number> = {};
    for (const r of rows) { const k = key(r) || "—"; m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).map(([status, count]) => ({ status, count }));
  };
  const contracts_by_status = countBy(contracts, (c) => c.status);
  const spaces_by_status = countBy(spaces, (s) => s.status);

  // Invoice money summary (paid / pending / overdue).
  let paid = 0, pending = 0, overdue = 0, paidCount = 0, pendingCount = 0, overdueCount = 0;
  for (const inv of invoices) {
    const amt = Number(inv.amount ?? 0);
    if (inv.status === "Paid") { paid += amt; paidCount++; }
    else if (inv.status !== "Void") {
      pending += amt; pendingCount++;
      if (inv.due_date && inv.due_date < today) { overdue += amt; overdueCount++; }
    }
  }

  const revenue_by_property = Object.entries(revByProp)
    .map(([pid, amt]) => ({ property: propNameById[Number(pid)] ?? "—", paid: amt }))
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 6);

  res.json({
    success: true,
    data: {
      revenue_trend,
      occupancy,
      contracts_by_status,
      invoices_summary: { paid, pending, overdue, paid_count: paidCount, pending_count: pendingCount, overdue_count: overdueCount },
      spaces_by_status,
      revenue_by_property,
      currency,
    },
  });
});

/* ═══════════════════════════════════════════════════════
   Documents (문서 관리함) — READ-ONLY. Lists sensitive documents
   (contracts, invoices, receipts…) that the operator has attached
   to any entity the owner controls. Owner cannot upload/delete;
   downloads go through a short-lived Cloudinary signed URL.
═══════════════════════════════════════════════════════ */

/** All entity ids (properties / spaces / bookings / contracts) this owner controls. */
async function ownerEntityIds(accountId: number) {
  const properties = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.owner_account_id, accountId), isNull(propertiesTable.deleted_at)));
  const propertyIds = properties.map((p) => p.id);

  const spaces = propertyIds.length
    ? await db.select({ id: spacesTable.id }).from(spacesTable).where(and(inArray(spacesTable.property_id, propertyIds), isNull(spacesTable.deleted_at)))
    : [];
  const spaceIds = spaces.map((s) => s.id);

  const bookings = spaceIds.length
    ? await db.select({ id: bookingsTable.id }).from(bookingsTable).where(inArray(bookingsTable.space_id, spaceIds))
    : [];
  const bookingIds = bookings.map((b) => b.id);

  const contracts = spaceIds.length
    ? await db.select({ id: contractsTable.id }).from(contractsTable).where(inArray(contractsTable.space_id, spaceIds))
    : [];
  const contractIds = contracts.map((c) => c.id);

  return { propertyIds, spaceIds, bookingIds, contractIds };
}

/** Build the entity_type/entity_id filter for an owner's documents. */
function ownerDocFilter(accountId: number, ids: Awaited<ReturnType<typeof ownerEntityIds>>) {
  const clauses = [and(eq(documentsTable.entity_type, "account"), eq(documentsTable.entity_id, accountId))];
  if (ids.propertyIds.length) clauses.push(and(eq(documentsTable.entity_type, "property"), inArray(documentsTable.entity_id, ids.propertyIds)));
  if (ids.spaceIds.length) clauses.push(and(eq(documentsTable.entity_type, "space"), inArray(documentsTable.entity_id, ids.spaceIds)));
  if (ids.bookingIds.length) clauses.push(and(eq(documentsTable.entity_type, "booking"), inArray(documentsTable.entity_id, ids.bookingIds)));
  if (ids.contractIds.length) clauses.push(and(eq(documentsTable.entity_type, "contract"), inArray(documentsTable.entity_id, ids.contractIds)));
  return or(...clauses);
}

/* GET /api/v1/owner/documents — paginated list of the owner's documents. */
router.get("/v1/owner/documents", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const ids = await ownerEntityIds(partner.account_id);

  const rows = await db
    .select({
      id: documentsTable.id,
      entity_type: documentsTable.entity_type,
      entity_id: documentsTable.entity_id,
      doc_type: documentsTable.doc_type,
      doc_ref: documentsTable.doc_ref,
      version: documentsTable.version,
      file_name: documentsTable.file_name,
      file_size: documentsTable.file_size,
      mime_type: documentsTable.mime_type,
      created_at: documentsTable.created_at,
    })
    .from(documentsTable)
    .where(and(isNull(documentsTable.deleted_at), ownerDocFilter(partner.account_id, ids)))
    .orderBy(desc(documentsTable.created_at));

  const typeFilter = typeof req.query.doc_type === "string" ? req.query.doc_type : "";
  const { limit, offset, page, q } = parsePageParams(req.query);
  const lowerQ = q.toLowerCase();
  const filtered = rows.filter((d) => {
    if (typeFilter && d.doc_type !== typeFilter) return false;
    if (!lowerQ) return true;
    return (d.file_name ?? "").toLowerCase().includes(lowerQ) || (d.doc_ref ?? "").toLowerCase().includes(lowerQ);
  });

  res.json({
    success: true,
    data: paginateArray(filtered, { limit, offset }),
    meta: pageMeta(filtered.length, { limit, offset, page }),
  });
});

/* GET /api/v1/owner/documents/:id/download — returns a short-lived signed URL. */
router.get("/v1/owner/documents/:id/download", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const docId = String(req.params.id);

  const [doc] = await db
    .select({ entity_type: documentsTable.entity_type, entity_id: documentsTable.entity_id, cloudinary_public_id: documentsTable.cloudinary_public_id })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, docId), isNull(documentsTable.deleted_at)))
    .limit(1);

  if (!doc) {
    res.status(404).json({ success: false, error: "Document not found" });
    return;
  }

  // Ownership check: the doc's entity must belong to this owner.
  const ids = await ownerEntityIds(partner.account_id);
  const owned =
    (doc.entity_type === "account" && doc.entity_id === partner.account_id) ||
    (doc.entity_type === "property" && ids.propertyIds.includes(doc.entity_id)) ||
    (doc.entity_type === "space" && ids.spaceIds.includes(doc.entity_id)) ||
    (doc.entity_type === "booking" && ids.bookingIds.includes(doc.entity_id)) ||
    (doc.entity_type === "contract" && ids.contractIds.includes(doc.entity_id));

  if (!owned) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  if (!isCloudinaryConfigured() || !doc.cloudinary_public_id) {
    res.status(404).json({ success: false, error: "File unavailable" });
    return;
  }

  res.json({ success: true, data: { url: generateSignedUrl(doc.cloudinary_public_id, 300) } });
});

/* ═══════════════════════════════════════════════════════
   Occupancy calendar — bookings + operation blocks + short-term
   conversion markers, all scoped to the owner's own spaces.
═══════════════════════════════════════════════════════ */

const CAL_ACTIVE_BOOKING_STATUSES = ["Confirmed", "Pending", "PendingApproval", "Active", "CheckedOut"];

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Resolve the spaces this owner controls, optionally narrowed by property/space. */
async function resolveOwnerSpaces(accountId: number, propertyId?: number, spaceId?: number) {
  const properties = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name })
    .from(propertiesTable)
    .where(eq(propertiesTable.owner_account_id, accountId));
  let propertyIds = properties.map(p => p.id);
  if (propertyId) propertyIds = propertyIds.filter(id => id === propertyId);
  if (!propertyIds.length) return { properties, spaces: [] as Array<{ id: number; name: string; space_type: string | null; property_id: number | null }> };

  const spaces = await db
    .select({ id: spacesTable.id, name: spacesTable.name, space_type: spacesTable.space_type, property_id: spacesTable.property_id })
    .from(spacesTable)
    .where(and(inArray(spacesTable.property_id, propertyIds), isNull(spacesTable.deleted_at)));

  return { properties, spaces: spaceId ? spaces.filter(s => s.id === spaceId) : spaces };
}

/** Verify a single space belongs to this owner; returns the space row or null. */
async function ownerSpace(accountId: number, spaceId: number) {
  const [space] = await db
    .select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
    .from(spacesTable)
    .innerJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(and(eq(spacesTable.id, spaceId), eq(propertiesTable.owner_account_id, accountId)))
    .limit(1);
  return space ?? null;
}

/* GET /api/v1/owner/calendar?from=&to=&property_id=&space_id=
   Per-space, per-date occupancy with masked tenant labels. */
router.get("/v1/owner/calendar", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const today = new Date().toISOString().slice(0, 10);
  const from = String(req.query.from ?? today);
  let to = String(req.query.to ?? addDays(from, 60));
  if (to > addDays(from, 400)) to = addDays(from, 400); // guard runaway ranges
  if (to < from) to = from;

  const propertyId = req.query.property_id ? Number(req.query.property_id) : undefined;
  const spaceId = req.query.space_id ? Number(req.query.space_id) : undefined;

  const { properties, spaces } = await resolveOwnerSpaces(partner.account_id, propertyId, spaceId);
  const propMap = Object.fromEntries(properties.map(p => [p.id, p.name]));
  const spaceIds = spaces.map(s => s.id);

  if (!spaceIds.length) {
    res.json({ success: true, data: { from, to, properties, spaces: [] } });
    return;
  }

  const [bookings, blocks, terms] = await Promise.all([
    db
      .select({
        id: bookingsTable.id,
        space_id: bookingsTable.space_id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        contact_id: bookingsTable.contact_id,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
      })
      .from(bookingsTable)
      .where(and(
        inArray(bookingsTable.space_id, spaceIds),
        eq(bookingsTable.status, "Active"),
        inArray(bookingsTable.booking_status, CAL_ACTIVE_BOOKING_STATUSES),
        isNotNull(bookingsTable.check_in_date),
        isNotNull(bookingsTable.check_out_date),
        lte(bookingsTable.check_in_date, to),
        gte(bookingsTable.check_out_date, from),
      )),
    db
      .select({
        space_id: spaceAvailabilityTable.space_id,
        date: spaceAvailabilityTable.date,
        block_reason: spaceAvailabilityTable.block_reason,
      })
      .from(spaceAvailabilityTable)
      .where(and(
        inArray(spaceAvailabilityTable.space_id, spaceIds),
        eq(spaceAvailabilityTable.is_available, false),
        gte(spaceAvailabilityTable.date, from),
        lte(spaceAvailabilityTable.date, to),
      )),
    db
      .select({
        space_id: spaceTermCalendarTable.space_id,
        date: spaceTermCalendarTable.date,
        term_type: spaceTermCalendarTable.term_type,
        daily_rate: spaceTermCalendarTable.daily_rate,
        currency: spaceTermCalendarTable.currency,
      })
      .from(spaceTermCalendarTable)
      .where(and(
        inArray(spaceTermCalendarTable.space_id, spaceIds),
        gte(spaceTermCalendarTable.date, from),
        lte(spaceTermCalendarTable.date, to),
      )),
  ]);

  // Mask tenant identity (owner portal never exposes full guest details).
  const contactIds = [...new Set(bookings.map(b => b.contact_id).filter(Boolean))] as number[];
  const contacts = contactIds.length
    ? await db
        .select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name, gender: contactsTable.gender })
        .from(contactsTable)
        .where(inArray(contactsTable.id, contactIds))
    : [];
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

  type Day = {
    date: string;
    status: "available" | "booked" | "blocked" | "short_term";
    booking_ref: string | null;
    tenant: string | null;
    block_reason: string | null;
    daily_rate: string | null;
    currency: string | null;
  };

  const result = spaces.map(space => {
    const sBookings = bookings.filter(b => b.space_id === space.id);
    const blockSet = new Map(blocks.filter(b => b.space_id === space.id).map(b => [String(b.date), b]));
    const termMap = new Map(terms.filter(t => t.space_id === space.id).map(t => [String(t.date), t]));

    const days: Day[] = [];
    const summary = { available: 0, booked: 0, blocked: 0, short_term: 0 };
    for (let d = from; d <= to; d = addDays(d, 1)) {
      // checkout date is exclusive
      const bk = sBookings.find(b => b.check_in_date! <= d && d < b.check_out_date!);
      const blk = blockSet.get(d);
      const term = termMap.get(d);

      let day: Day;
      if (bk) {
        const c = bk.contact_id ? contactMap[bk.contact_id] : null;
        day = { date: d, status: "booked", booking_ref: bk.booking_ref ?? null, tenant: c ? formatTenantForOwner(c).display_name : null, block_reason: null, daily_rate: null, currency: null };
      } else if (blk) {
        day = { date: d, status: "blocked", booking_ref: null, tenant: null, block_reason: blk.block_reason ?? null, daily_rate: null, currency: null };
      } else if (term) {
        day = { date: d, status: "short_term", booking_ref: null, tenant: null, block_reason: null, daily_rate: term.daily_rate ?? null, currency: term.currency ?? null };
      } else {
        day = { date: d, status: "available", booking_ref: null, tenant: null, block_reason: null, daily_rate: null, currency: null };
      }
      days.push(day);
      summary[day.status]++;
    }

    return {
      space_id: space.id,
      space_name: space.name,
      space_type: space.space_type,
      property_id: space.property_id,
      property_name: space.property_id ? propMap[space.property_id] ?? null : null,
      days,
      summary,
    };
  });

  res.json({ success: true, data: { from, to, properties, spaces: result } });
});

/* POST /api/v1/owner/spaces/:id/block — mark dates as operation-suspended */
router.post("/v1/owner/spaces/:id/block", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid space id" }); return; }

  const space = await ownerSpace(partner.account_id, id);
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const dates = normaliseDates(req.body);
  const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : "Owner block";
  if (!dates.length) { res.status(400).json({ error: "dates array (or from/to) is required" }); return; }

  for (const date of dates) {
    await db.insert(spaceAvailabilityTable)
      .values({ space_id: id, date, is_available: false, block_reason: reason, source: "manual" })
      .onConflictDoUpdate({
        target: [spaceAvailabilityTable.space_id, spaceAvailabilityTable.date],
        set: { is_available: false, block_reason: reason, source: "manual" },
      });
  }
  await logAction({ entityType: "space", entityId: id, action: "BLOCK", actorId: partner.id, actorEmail: partner.email, newValue: { dates, reason }, ipAddress: req.ip ?? null });
  res.json({ success: true, blocked_count: dates.length });
});

/* POST /api/v1/owner/spaces/:id/unblock — clear operation-suspension blocks.
   Only clears manual (owner) blocks, never booking/OTA-originated rows. */
router.post("/v1/owner/spaces/:id/unblock", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid space id" }); return; }

  const space = await ownerSpace(partner.account_id, id);
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const dates = normaliseDates(req.body);
  if (!dates.length) { res.status(400).json({ error: "dates array (or from/to) is required" }); return; }

  let cleared = 0;
  for (const date of dates) {
    const r = await db.delete(spaceAvailabilityTable)
      .where(and(
        eq(spaceAvailabilityTable.space_id, id),
        eq(spaceAvailabilityTable.date, date),
        eq(spaceAvailabilityTable.source, "manual"),
        eq(spaceAvailabilityTable.is_available, false),
      ))
      .returning({ id: spaceAvailabilityTable.id });
    cleared += r.length;
  }
  await logAction({ entityType: "space", entityId: id, action: "UNBLOCK", actorId: partner.id, actorEmail: partner.email, newValue: { dates }, ipAddress: req.ip ?? null });
  res.json({ success: true, unblocked_count: cleared });
});

/* POST /api/v1/owner/spaces/:id/term — flag dates as short-term + set daily rate */
router.post("/v1/owner/spaces/:id/term", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid space id" }); return; }

  const space = await ownerSpace(partner.account_id, id);
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const dates = normaliseDates(req.body);
  if (!dates.length) { res.status(400).json({ error: "dates array (or from/to) is required" }); return; }

  const term_type = "short_term"; // only term the owner UI converts to today
  const currency = typeof req.body?.currency === "string" && req.body.currency.trim() ? req.body.currency.trim() : "AUD";
  // Daily rate: numeric column → store as string. Optional but validated when present.
  let daily_rate: string | null = null;
  if (req.body?.daily_rate !== undefined && req.body.daily_rate !== null && String(req.body.daily_rate) !== "") {
    const n = Number(req.body.daily_rate);
    if (!Number.isFinite(n) || n < 0) { res.status(400).json({ error: "daily_rate must be a non-negative number" }); return; }
    daily_rate = String(n);
  }

  for (const date of dates) {
    await db.insert(spaceTermCalendarTable)
      .values({ space_id: id, date, term_type, daily_rate, currency })
      .onConflictDoUpdate({
        target: [spaceTermCalendarTable.space_id, spaceTermCalendarTable.date],
        set: { term_type, daily_rate, currency, updated_at: new Date() },
      });
  }
  await logAction({ entityType: "space", entityId: id, action: "TERM_SET", actorId: partner.id, actorEmail: partner.email, newValue: { dates, term_type, daily_rate, currency }, ipAddress: req.ip ?? null });
  res.json({ success: true, converted_count: dates.length });
});

/* DELETE /api/v1/owner/spaces/:id/term — clear short-term conversion markers */
router.delete("/v1/owner/spaces/:id/term", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid space id" }); return; }

  const space = await ownerSpace(partner.account_id, id);
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const dates = normaliseDates(req.body);
  if (!dates.length) { res.status(400).json({ error: "dates array (or from/to) is required" }); return; }

  let cleared = 0;
  for (const date of dates) {
    const r = await db.delete(spaceTermCalendarTable)
      .where(and(eq(spaceTermCalendarTable.space_id, id), eq(spaceTermCalendarTable.date, date)))
      .returning({ id: spaceTermCalendarTable.id });
    cleared += r.length;
  }
  await logAction({ entityType: "space", entityId: id, action: "TERM_CLEAR", actorId: partner.id, actorEmail: partner.email, newValue: { dates }, ipAddress: req.ip ?? null });
  res.json({ success: true, cleared_count: cleared });
});

/* ═══════════════════════════════════════════════════════
   Owner landing site ("내 사이트") — {slug}.millionstay.com
═══════════════════════════════════════════════════════ */

// Columns the owner is allowed to set on their landing site.
function pickSiteFields(body: any) {
  const out: Record<string, unknown> = {};
  for (const k of [
    "logo_url", "primary_color", "hero_image_url", "content",
    "seo_title", "seo_description", "og_image_url",
  ]) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

/* GET /api/v1/owner/site — current owner's landing site (or null defaults) */
router.get("/v1/owner/site", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const [site] = await db
    .select()
    .from(ownerSitesTable)
    .where(eq(ownerSitesTable.account_id, partner.account_id))
    .limit(1);
  res.json({ success: true, data: site ?? null });
});

/* GET /api/v1/owner/site/slug-available?slug= — validity + uniqueness check */
router.get("/v1/owner/site/slug-available", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const slug = String(req.query.slug ?? "").trim().toLowerCase();
  const reason = validateSlug(slug);
  if (reason) { res.json({ success: true, available: false, reason }); return; }

  const [taken] = await db
    .select({ account_id: ownerSitesTable.account_id })
    .from(ownerSitesTable)
    .where(eq(ownerSitesTable.slug, slug))
    .limit(1);
  // Available if free, or already owned by this account.
  const available = !taken || taken.account_id === partner.account_id;
  res.json({ success: true, available, reason: available ? null : "taken" });
});

/* PUT /api/v1/owner/site — create/update + publish (immediate) */
router.put("/v1/owner/site", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const b = req.body ?? {};

  const slug = b.slug !== undefined ? String(b.slug).trim().toLowerCase() : undefined;
  if (slug !== undefined) {
    const reason = validateSlug(slug);
    if (reason) { res.status(400).json({ error: `Invalid slug: ${reason}` }); return; }
  }

  // status: only 'draft' | 'published'
  let status: string | undefined;
  if (b.status !== undefined) {
    status = String(b.status);
    if (status !== "draft" && status !== "published") {
      res.status(400).json({ error: "status must be 'draft' or 'published'" }); return;
    }
  }

  const fields = pickSiteFields(b);

  const [existing] = await db
    .select({ id: ownerSitesTable.id, slug: ownerSitesTable.slug, status: ownerSitesTable.status })
    .from(ownerSitesTable)
    .where(eq(ownerSitesTable.account_id, partner.account_id))
    .limit(1);

  try {
    let saved: { slug: string; status: string };
    if (existing) {
      const updates: Record<string, unknown> = { ...fields };
      if (slug !== undefined) updates.slug = slug;
      if (status !== undefined) updates.status = status;
      const [row] = await db
        .update(ownerSitesTable)
        .set(updates)
        .where(eq(ownerSitesTable.account_id, partner.account_id))
        .returning();
      saved = { slug: row.slug, status: row.status };
      res.json({ success: true, data: row });
    } else {
      if (!slug) { res.status(400).json({ error: "slug is required to create your site" }); return; }
      const [row] = await db
        .insert(ownerSitesTable)
        .values({
          account_id: partner.account_id,
          slug,
          status: status ?? "published",
          ...fields,
        } as any)
        .returning();
      saved = { slug: row.slug, status: row.status };
      res.status(201).json({ success: true, data: row });
    }
    // Provision/retire the Vercel subdomain off the request path (never blocks).
    void syncOwnerSubdomain({
      slug: saved.slug,
      status: saved.status,
      previousSlug: existing?.slug ?? null,
      previousStatus: existing?.status ?? null,
    });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "That subdomain is already taken" }); return; }
    console.error("[owner/site] save failed:", err);
    res.status(500).json({ error: "Failed to save site" });
  }
});

/* ═══════════════════════════════════════════════════════
   Owner content editing — property / space intro text
═══════════════════════════════════════════════════════ */

/* PATCH /api/v1/owner/properties/:id — edit intro (owned properties only) */
router.patch("/v1/owner/properties/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid property id" }); return; }

  const [prop] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.owner_account_id, partner.account_id)))
    .limit(1);
  if (!prop) { res.status(404).json({ error: "Property not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (req.body?.description !== undefined) updates.description = String(req.body.description);
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nothing to update" }); return; }

  const [row] = await db.update(propertiesTable).set(updates).where(eq(propertiesTable.id, id)).returning();
  await logAction({ entityType: "property", entityId: id, action: "UPDATE", actorId: partner.id, actorEmail: partner.email, newValue: updates, ipAddress: req.ip ?? null });
  res.json({ success: true, data: row });
});

/* PATCH /api/v1/owner/spaces/:id — edit name/description (owned spaces only) */
router.patch("/v1/owner/spaces/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid space id" }); return; }

  // Ownership is enforced via the parent property's owner_account_id.
  const [space] = await db
    .select({ id: spacesTable.id })
    .from(spacesTable)
    .innerJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(and(eq(spacesTable.id, id), eq(propertiesTable.owner_account_id, partner.account_id)))
    .limit(1);
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (req.body?.name !== undefined) updates.name = String(req.body.name);
  if (req.body?.description !== undefined) updates.description = String(req.body.description);
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nothing to update" }); return; }

  const [row] = await db.update(spacesTable).set(updates).where(eq(spacesTable.id, id)).returning();
  await logAction({ entityType: "space", entityId: id, action: "UPDATE", actorId: partner.id, actorEmail: partner.email, newValue: updates, ipAddress: req.ip ?? null });
  res.json({ success: true, data: row });
});

/* GET /api/v1/owner/site/inquiries — leads captured from this owner's landing site */
router.get("/v1/owner/site/inquiries", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  // Dashboard previews pass a small ?limit with no offset → keep that working;
  // the full Inquiries page passes limit/offset (+ optional ?q) for real paging.
  const { limit, offset, page, q } = parsePageParams(req.query, { defaultLimit: 50, maxLimit: 200 });
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "";

  const conds = [eq(leadsTable.owner_account_id, partner.account_id), isNull(leadsTable.deleted_at)];
  if (statusFilter) conds.push(eq(leadsTable.lead_status, statusFilter));
  if (q) {
    conds.push(
      or(
        ilike(leadsTable.first_name, `%${q}%`),
        ilike(leadsTable.last_name, `%${q}%`),
        ilike(leadsTable.email, `%${q}%`),
        ilike(leadsTable.lead_ref, `%${q}%`),
        ilike(leadsTable.message, `%${q}%`),
      )!,
    );
  }
  const whereExpr = and(...conds);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(whereExpr);

  const rows = await db
    .select({
      id: leadsTable.id,
      lead_ref: leadsTable.lead_ref,
      first_name: leadsTable.first_name,
      last_name: leadsTable.last_name,
      email: leadsTable.email,
      phone: leadsTable.phone,
      message: leadsTable.message,
      lead_status: leadsTable.lead_status,
      created_at: leadsTable.created_at,
    })
    .from(leadsTable)
    .where(whereExpr)
    .orderBy(desc(leadsTable.created_at))
    .limit(limit)
    .offset(offset);

  res.json({ success: true, data: rows, meta: pageMeta(total ?? 0, { limit, offset, page }) });
});

/* POST /api/v1/owner/site/upload-image — single image → Cloudinary, returns URL */
router.post("/v1/owner/site/upload-image", requireOwnerAuth, upload.single("image"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image upload not configured" }); return; }
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("owner-sites") });
    res.json({ success: true, url: result.secure_url, thumbnail_url: result.thumbnail_url });
  } catch (err: any) {
    console.error("[owner/site/upload-image] upload failed:", err?.message, err);
    res.status(500).json({ error: err?.message ?? "Upload failed" });
  }
});

export default router;
