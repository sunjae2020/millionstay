import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  spacesTable,
  propertiesTable,
  contractsTable,
  invoicesTable,
  guestUsersTable,
  accountsTable,
  commissionsTable,
  contactsTable,
} from "@workspace/db";
import { requireAgentAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";

const router: IRouter = Router();

/* ─── helpers ─── */
function maskTenantForAgent(contact: { first_name: string | null; last_name: string | null; email: string | null }) {
  return {
    display_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—",
    email: contact.email ?? "—",
  };
}

/* GET /api/v1/agent/dashboard */
router.get("/v1/agent/dashboard", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const agentAccountId = partner.account_id;

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name, default_commission_id: accountsTable.default_commission_id })
    .from(accountsTable)
    .where(eq(accountsTable.id, agentAccountId))
    .limit(1);

  // Bookings managed by this agent
  const bookings = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
    })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, agentAccountId), eq(bookingsTable.status, "Active")))
    .orderBy(desc(bookingsTable.created_at));

  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => ["Confirmed", "Active"].includes(b.booking_status)).length;
  const totalRent = bookings.reduce((sum, b) => sum + parseFloat(b.total_rent ?? "0"), 0);

  // Commission info
  let commission = null;
  if (account?.default_commission_id) {
    const [comm] = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.id, account.default_commission_id))
      .limit(1);
    commission = comm;
  }

  const commissionEarned =
    commission?.commission_type === "Percentage" && commission.commission_rate
      ? totalRent * (commission.commission_rate / 100)
      : (commission?.commission_amount ?? 0) * totalBookings;

  res.json({
    success: true,
    data: {
      account_name: account?.name ?? "—",
      commission,
      stats: {
        total_bookings: totalBookings,
        active_bookings: activeBookings,
        total_rent_managed: totalRent,
        estimated_commission_earned: commissionEarned,
      },
      recent_bookings: bookings.slice(0, 5),
    },
  });
});

/* GET /api/v1/agent/bookings */
router.get("/v1/agent/bookings", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const bookings = await db
    .select({
      id: bookingsTable.id,
      booking_ref: bookingsTable.booking_ref,
      booking_status: bookingsTable.booking_status,
      check_in_date: bookingsTable.check_in_date,
      check_out_date: bookingsTable.check_out_date,
      agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
      total_rent: bookingsTable.total_rent,
      currency: bookingsTable.currency,
      space_id: bookingsTable.space_id,
      contact_id: bookingsTable.contact_id,
    })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")))
    .orderBy(desc(bookingsTable.created_at));

  // Fetch space names
  const spaceIds = [...new Set(bookings.map(b => b.space_id).filter(Boolean))] as number[];
  const spaces = spaceIds.length
    ? await db.select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
        .from(spacesTable).where(inArray(spacesTable.id, spaceIds))
    : [];

  // Fetch property names
  const propertyIds = [...new Set(spaces.map(s => s.property_id).filter(Boolean))] as number[];
  const properties = propertyIds.length
    ? await db.select({ id: propertiesTable.id, name: propertiesTable.name })
        .from(propertiesTable).where(inArray(propertiesTable.id, propertyIds))
    : [];

  // Fetch contacts (tenant info: name + email only — no other personal info)
  const contactIds = [...new Set(bookings.map(b => b.contact_id).filter(Boolean))] as number[];
  const contacts = contactIds.length
    ? await db
        .select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name, email: contactsTable.email })
        .from(contactsTable)
        .where(inArray(contactsTable.id, contactIds))
    : [];

  const spaceMap = Object.fromEntries(spaces.map(s => [s.id, s]));
  const propMap = Object.fromEntries(properties.map(p => [p.id, p]));
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

  const result = bookings.map(b => {
    const space = b.space_id ? spaceMap[b.space_id] : null;
    const property = space?.property_id ? propMap[space.property_id] : null;
    const contact = b.contact_id ? contactMap[b.contact_id] : null;
    return {
      ...b,
      space_name: space?.name ?? "—",
      property_name: property?.name ?? "—",
      tenant: contact ? maskTenantForAgent(contact) : null,
    };
  });

  res.json({ success: true, data: result });
});

/* GET /api/v1/agent/bookings/:id */
router.get("/v1/agent/bookings/:id", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid id" }); return; }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, id), eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")))
    .limit(1);

  if (!booking) { res.status(404).json({ success: false, error: "Booking not found" }); return; }

  const [space] = booking.space_id
    ? await db.select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
        .from(spacesTable).where(eq(spacesTable.id, booking.space_id)).limit(1)
    : [null];
  const [property] = space?.property_id
    ? await db.select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address })
        .from(propertiesTable).where(eq(propertiesTable.id, space.property_id)).limit(1)
    : [null];
  const [contact] = booking.contact_id
    ? await db
        .select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name, email: contactsTable.email })
        .from(contactsTable).where(eq(contactsTable.id, booking.contact_id)).limit(1)
    : [null];

  const [contract] = await db
    .select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref, status: contractsTable.status, start_date: contractsTable.start_date, end_date: contractsTable.end_date })
    .from(contractsTable).where(eq(contractsTable.booking_id, id)).limit(1);

  res.json({
    success: true,
    data: {
      ...booking,
      space_name: space?.name ?? "—",
      property_name: property?.name ?? "—",
      property_address: property?.address ?? "—",
      tenant: contact ? maskTenantForAgent(contact) : null,
      contract: contract ?? null,
    },
  });
});

/* GET /api/v1/agent/properties */
router.get("/v1/agent/properties", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  // Properties that have bookings with this agent
  const agentBookings = await db
    .select({ space_id: bookingsTable.space_id })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")));

  const spaceIds = [...new Set(agentBookings.map(b => b.space_id).filter(Boolean))] as number[];
  if (!spaceIds.length) { res.json({ success: true, data: [] }); return; }

  const spaces = await db
    .select({ id: spacesTable.id, name: spacesTable.name, space_type: spacesTable.space_type, property_id: spacesTable.property_id, status: spacesTable.status })
    .from(spacesTable).where(inArray(spacesTable.id, spaceIds));

  const propertyIds = [...new Set(spaces.map(s => s.property_id).filter(Boolean))] as number[];
  const properties = propertyIds.length
    ? await db
        .select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address, city: propertiesTable.city, state: propertiesTable.state })
        .from(propertiesTable).where(inArray(propertiesTable.id, propertyIds))
    : [];

  const propMap = Object.fromEntries(properties.map(p => [p.id, p]));
  const result = spaces.map(s => ({ ...s, property: s.property_id ? propMap[s.property_id] : null }));
  res.json({ success: true, data: result });
});

/* GET /api/v1/agent/commission */
router.get("/v1/agent/commission", requireAgentAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name, default_commission_id: accountsTable.default_commission_id })
    .from(accountsTable)
    .where(eq(accountsTable.id, partner.account_id))
    .limit(1);

  let commission = null;
  if (account?.default_commission_id) {
    const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, account.default_commission_id)).limit(1);
    commission = comm;
  }

  const bookings = await db
    .select({ total_rent: bookingsTable.total_rent, booking_status: bookingsTable.booking_status, booking_ref: bookingsTable.booking_ref, check_in_date: bookingsTable.check_in_date, check_out_date: bookingsTable.check_out_date })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.agent_account_id, partner.account_id), eq(bookingsTable.status, "Active")))
    .orderBy(desc(bookingsTable.created_at));

  const earningsBreakdown = bookings.map(b => {
    const rentAmount = parseFloat(b.total_rent ?? "0");
    const earned =
      commission?.commission_type === "Percentage" && commission.commission_rate
        ? rentAmount * (commission.commission_rate / 100)
        : commission?.commission_amount ?? 0;
    return {
      booking_ref: b.booking_ref,
      booking_status: b.booking_status,
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date,
      rent_amount: rentAmount,
      commission_earned: earned,
    };
  });

  const totalEarned = earningsBreakdown.reduce((s, r) => s + r.commission_earned, 0);
  const paidCount = earningsBreakdown.filter(r => ["Active", "CheckedOut"].includes(r.booking_status)).length;

  res.json({
    success: true,
    data: {
      account_name: account?.name ?? "—",
      commission,
      total_earned: totalEarned,
      paid_count: paidCount,
      pending_count: earningsBreakdown.length - paidCount,
      breakdown: earningsBreakdown,
    },
  });
});

export default router;
