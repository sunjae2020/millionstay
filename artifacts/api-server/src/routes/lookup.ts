import { Router, type IRouter } from "express";
import { ilike, and, eq, isNull, SQL, asc } from "drizzle-orm";
import { db, contactsTable, accountsTable, commissionsTable, paymentInfoTable, spacesTable, suburbsTable, propertiesTable, accommodationCatalogTable, productGroupsTable, productTypesTable, contractTypesTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/v1/lookup/contacts", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const conditions: SQL[] = [];
  if (q) {
    const { or } = await import("drizzle-orm");
    conditions.push(or(
      ilike(contactsTable.first_name, `%${q}%`),
      ilike(contactsTable.last_name, `%${q}%`),
      ilike(contactsTable.email, `%${q}%`),
    )!);
  }
  const rows = await db.select({
    id: contactsTable.id,
    first_name: contactsTable.first_name,
    last_name: contactsTable.last_name,
    email: contactsTable.email,
  }).from(contactsTable)
    .where(conditions.length ? conditions[0] : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.first_name} ${r.last_name} — ${r.email}`,
  })));
});

router.get("/v1/lookup/accounts", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const type = (req.query["type"] as string) || "";
  const conditions: SQL[] = [];
  if (type) conditions.push(eq(accountsTable.account_type, type));
  if (q) {
    const { or } = await import("drizzle-orm");
    conditions.push(or(
      ilike(accountsTable.name, `%${q}%`),
      ilike(accountsTable.account_email, `%${q}%`),
    )!);
  }
  const rows = await db.select({
    id: accountsTable.id,
    name: accountsTable.name,
    account_type: accountsTable.account_type,
  }).from(accountsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.name} (${r.account_type})`,
  })));
});

// Admin (ops staff) users — for assignment pickers. Active, non-deleted only.
router.get("/v1/lookup/admin-users", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const conditions: SQL[] = [
    isNull(usersTable.deleted_at),
    eq(usersTable.is_active, true),
  ];
  if (q) {
    const { or } = await import("drizzle-orm");
    conditions.push(or(
      ilike(usersTable.first_name, `%${q}%`),
      ilike(usersTable.last_name, `%${q}%`),
      ilike(usersTable.email, `%${q}%`),
    )!);
  }
  const rows = await db.select({
    id: usersTable.id,
    first_name: usersTable.first_name,
    last_name: usersTable.last_name,
    email: usersTable.email,
  }).from(usersTable)
    .where(and(...conditions))
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${`${r.first_name} ${r.last_name}`.trim()} (${r.email})`,
  })));
});

router.get("/v1/lookup/commissions", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db.select({
    id: commissionsTable.id,
    name: commissionsTable.name,
    commission_type: commissionsTable.commission_type,
    commission_rate: commissionsTable.commission_rate,
    commission_amount: commissionsTable.commission_amount,
  }).from(commissionsTable)
    .where(q ? ilike(commissionsTable.name, `%${q}%`) : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: r.commission_type === "Percentage"
      ? `${r.name} (${r.commission_rate}%)`
      : `${r.name} ($${r.commission_amount})`,
  })));
});

router.get("/v1/lookup/payment-info", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db.select({
    id: paymentInfoTable.id,
    name: paymentInfoTable.name,
    payment_type: paymentInfoTable.payment_type,
    bsb_number: paymentInfoTable.bsb_number,
    bank_name: paymentInfoTable.bank_name,
  }).from(paymentInfoTable)
    .where(q ? ilike(paymentInfoTable.name, `%${q}%`) : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: r.bsb_number
      ? `${r.bank_name ?? r.name} — BSB ${r.bsb_number} (${r.payment_type})`
      : `${r.name} (${r.payment_type})`,
  })));
});

router.get("/v1/lookup/spaces", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const property_id = req.query["property_id"] ? parseInt(req.query["property_id"] as string, 10) : null;
  const conditions: SQL[] = [];
  if (property_id) conditions.push(eq(spacesTable.property_id, property_id));
  if (q) conditions.push(ilike(spacesTable.name, `%${q}%`));

  const rows = await db.select({
    id: spacesTable.id,
    name: spacesTable.name,
    space_type: spacesTable.space_type,
    property_address: propertiesTable.address,
    base_weekly_price: spacesTable.base_weekly_price,
  })
    .from(spacesTable)
    .leftJoin(propertiesTable, eq(spacesTable.property_id, propertiesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(20);

  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.name} (${r.space_type}) — ${r.property_address ?? ""}`,
    base_weekly_price: r.base_weekly_price,
  })));
});

router.get("/v1/lookup/suburbs", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db.select({
    id: suburbsTable.id,
    name: suburbsTable.name,
    state: suburbsTable.state,
    postcode: suburbsTable.postcode,
  }).from(suburbsTable)
    .where(q ? ilike(suburbsTable.name, `%${q}%`) : undefined)
    .limit(20);
  res.json(rows.map((r) => ({
    id: r.id,
    display: `${r.name} ${r.state ?? ""} ${r.postcode ?? ""}`.trim(),
  })));
});

router.get("/v1/lookup/product-groups", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: productGroupsTable.id, name: productGroupsTable.name })
    .from(productGroupsTable)
    .where(q ? ilike(productGroupsTable.name, `%${q}%`) : undefined)
    .orderBy(asc(productGroupsTable.name))
    .limit(50);
  res.json(rows.map(r => ({ id: r.id, display: r.name })));
});

router.get("/v1/lookup/product-types", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: productTypesTable.id, name: productTypesTable.name })
    .from(productTypesTable)
    .where(q ? ilike(productTypesTable.name, `%${q}%`) : undefined)
    .orderBy(asc(productTypesTable.name))
    .limit(50);
  res.json(rows.map(r => ({ id: r.id, display: r.name })));
});

router.get("/v1/lookup/products", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: accommodationCatalogTable.id, name: accommodationCatalogTable.name, price: accommodationCatalogTable.price })
    .from(accommodationCatalogTable)
    .where(q ? ilike(accommodationCatalogTable.name, `%${q}%`) : undefined)
    .orderBy(asc(accommodationCatalogTable.name))
    .limit(20);
  res.json(rows.map(r => ({
    id: r.id,
    display: `${r.name}${r.price != null ? ` — $${r.price}/wk` : ""}`,
  })));
});

router.get("/v1/lookup/contract-types", async (req, res): Promise<void> => {
  const q = (req.query["q"] as string) || "";
  const rows = await db
    .select({ id: contractTypesTable.id, name: contractTypesTable.name })
    .from(contractTypesTable)
    .where(q ? ilike(contractTypesTable.name, `%${q}%`) : undefined)
    .orderBy(asc(contractTypesTable.name))
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: r.name })));
});

export default router;
