import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
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
  validateSlug,
} from "@workspace/db";
import { requireOwnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { isCloudinaryConfigured, uploadToCloudinary } from "../utils/cloudinary";
import { logAction } from "../utils/auditLog";
import { syncOwnerSubdomain } from "../lib/vercelDomains";

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
        .select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name, gender: contactsTable.gender })
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
      tenant: contact ? formatTenantForOwner(contact) : null,
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
  const limit = Math.min(Number(req.query.limit) || 50, 200);

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
    .where(and(
      eq(leadsTable.owner_account_id, partner.account_id),
      isNull(leadsTable.deleted_at),
    ))
    .orderBy(desc(leadsTable.created_at))
    .limit(limit);

  res.json({ success: true, data: rows, meta: { total: rows.length } });
});

/* POST /api/v1/owner/site/upload-image — single image → Cloudinary, returns URL */
router.post("/v1/owner/site/upload-image", requireOwnerAuth, upload.single("image"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image upload not configured" }); return; }
    const result = await uploadToCloudinary(req.file.buffer, { folder: "millionstay/owner-sites" });
    res.json({ success: true, url: result.secure_url, thumbnail_url: result.thumbnail_url });
  } catch (err: any) {
    console.error("[owner/site/upload-image] upload failed:", err?.message, err);
    res.status(500).json({ error: err?.message ?? "Upload failed" });
  }
});

export default router;
