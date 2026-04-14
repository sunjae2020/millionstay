import { Router, type IRouter } from "express";
import { eq, ilike, and, or, isNull, inArray, SQL } from "drizzle-orm";
import { db, accountsTable, contactsTable, commissionsTable, paymentInfoTable } from "@workspace/db";
import {
  ListAccountsQueryParams,
  CreateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  UpdateAccountBody,
  DeleteAccountParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichAccount(row: typeof accountsTable.$inferSelect) {
  const [primaryContact] = row.primary_contact_id
    ? await db.select({ first_name: contactsTable.first_name, last_name: contactsTable.last_name })
        .from(contactsTable).where(eq(contactsTable.id, row.primary_contact_id))
    : [null];
  const [secondaryContact] = row.secondary_contact_id
    ? await db.select({ first_name: contactsTable.first_name, last_name: contactsTable.last_name })
        .from(contactsTable).where(eq(contactsTable.id, row.secondary_contact_id))
    : [null];
  const [commission] = row.default_commission_id
    ? await db.select({ name: commissionsTable.name }).from(commissionsTable)
        .where(eq(commissionsTable.id, row.default_commission_id))
    : [null];
  const [payInfo] = row.payment_info_id
    ? await db.select({ name: paymentInfoTable.name }).from(paymentInfoTable)
        .where(eq(paymentInfoTable.id, row.payment_info_id))
    : [null];
  const [parentAccount] = row.parent_account_id
    ? await db.select({ name: accountsTable.name }).from(accountsTable)
        .where(eq(accountsTable.id, row.parent_account_id))
    : [null];

  return {
    ...row,
    primary_contact_name: primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : null,
    secondary_contact_name: secondaryContact ? `${secondaryContact.first_name} ${secondaryContact.last_name}` : null,
    default_commission_name: commission?.name ?? null,
    payment_info_name: payInfo?.name ?? null,
    parent_account_name: parentAccount?.name ?? null,
  };
}

router.get("/v1/accounts", async (req, res): Promise<void> => {
  const parsed = ListAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, account_type, status } = parsed.data;
  const conditions: SQL[] = [isNull(accountsTable.deleted_at)];
  if (account_type) conditions.push(eq(accountsTable.account_type, account_type));
  if (status) conditions.push(eq(accountsTable.status, status));
  if (search) {
    conditions.push(or(
      ilike(accountsTable.name, `%${search}%`),
      ilike(accountsTable.account_email, `%${search}%`),
    )!);
  }
  const rows = await db.select().from(accountsTable)
    .where(and(...conditions))
    .orderBy(accountsTable.name);
  const enriched = await Promise.all(rows.map(enrichAccount));
  res.json(enriched);
});

router.post("/v1/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(accountsTable).values(parsed.data).returning();
  res.status(201).json(await enrichAccount(row));
});

router.get("/v1/accounts/:id", async (req, res): Promise<void> => {
  const parsed = GetAccountParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(accountsTable).where(eq(accountsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichAccount(row));
});

router.put("/v1/accounts/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateAccountParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateAccountBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(accountsTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(accountsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichAccount(row));
});

router.post("/v1/accounts/bulk-delete", async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  if (currentUser?.role !== "SuperAdmin") {
    res.status(403).json({ error: "Only SuperAdmin can perform bulk delete" }); return;
  }
  const { ids, permanent } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const numIds = ids.map(Number).filter(Boolean);
  if (permanent) {
    await db.delete(accountsTable).where(inArray(accountsTable.id, numIds));
  } else {
    await db.update(accountsTable).set({ deleted_at: new Date(), status: "Archived" }).where(inArray(accountsTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/accounts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteAccountParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only Super Admin can permanently delete records" }); return;
    }
    await db.delete(accountsTable).where(eq(accountsTable.id, parsed.data.id));
  } else {
    await db.update(accountsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(accountsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

export default router;
