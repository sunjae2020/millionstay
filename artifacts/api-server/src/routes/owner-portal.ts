import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  spacesTable,
  propertiesTable,
  contractsTable,
  invoicesTable,
  accountsTable,
  contactsTable,
} from "@workspace/db";
import { requireOwnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";

const router: IRouter = Router();

/* ─── helpers ─── */
function maskTenantForOwner(contact: { first_name: string | null; gender: string | null }) {
  const rawFirst = contact.first_name ?? "";
  const maskedFirst = rawFirst.length > 2 ? rawFirst.slice(0, 2) + "***" : rawFirst || "—";
  return {
    display_name: maskedFirst,
    gender: contact.gender ?? "—",
  };
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

/* GET /api/v1/owner/bookings */
router.get("/v1/owner/bookings", requireOwnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const properties = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(eq(propertiesTable.owner_account_id, partner.account_id));

  const propertyIds = properties.map(p => p.id);
  if (!propertyIds.length) { res.json({ success: true, data: [] }); return; }

  const spaces = await db
    .select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
    .from(spacesTable)
    .where(inArray(spacesTable.property_id, propertyIds));

  const spaceIds = spaces.map(s => s.id);
  if (!spaceIds.length) { res.json({ success: true, data: [] }); return; }

  const bookings = await db
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
    })
    .from(bookingsTable)
    .where(and(inArray(bookingsTable.space_id, spaceIds), eq(bookingsTable.status, "Active")))
    .orderBy(desc(bookingsTable.created_at));

  const contactIds = [...new Set(bookings.map(b => b.contact_id).filter(Boolean))] as number[];
  const contacts = contactIds.length
    ? await db
        .select({ id: contactsTable.id, first_name: contactsTable.first_name, gender: contactsTable.gender })
        .from(contactsTable)
        .where(inArray(contactsTable.id, contactIds))
    : [];

  const spaceMap = Object.fromEntries(spaces.map(s => [s.id, s]));
  const propMap = Object.fromEntries(
    (await db.select({ id: propertiesTable.id, name: propertiesTable.name }).from(propertiesTable).where(inArray(propertiesTable.id, propertyIds)))
      .map(p => [p.id, p])
  );
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

  const result = bookings.map(b => {
    const space = b.space_id ? spaceMap[b.space_id] : null;
    const property = space?.property_id ? propMap[space.property_id] : null;
    const contact = b.contact_id ? contactMap[b.contact_id] : null;
    return {
      ...b,
      space_name: space?.name ?? "—",
      property_name: (property as any)?.name ?? "—",
      tenant: contact ? maskTenantForOwner(contact) : null,
    };
  });

  res.json({ success: true, data: result });
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

  const totalRevenue = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (i.amount ?? 0), 0);
  const pendingRevenue = invoices.filter(i => i.status !== "Paid" && i.status !== "Void").reduce((s, i) => s + (i.amount ?? 0), 0);

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

  res.json({
    success: true,
    data: {
      properties,
      total_revenue: totalRevenue,
      pending_revenue: pendingRevenue,
      invoices: enrichedInvoices,
    },
  });
});

export default router;
