import { Router, type IRouter } from "express";
import { ilike, and, eq, SQL } from "drizzle-orm";
import { db, contactsTable, accountsTable, commissionsTable, paymentInfoTable } from "@workspace/db";

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

export default router;
