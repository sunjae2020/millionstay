import { Router, type IRouter } from "express";
import { eq, ilike, and, or, SQL } from "drizzle-orm";
import { db, contactsTable } from "@workspace/db";
import {
  ListContactsQueryParams,
  CreateContactBody,
  GetContactParams,
  UpdateContactParams,
  UpdateContactBody,
  DeleteContactParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/contacts", async (req, res): Promise<void> => {
  const parsed = ListContactsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, nationality, gender, portal_enabled, status } = parsed.data;
  const conditions: SQL[] = [];
  if (nationality) conditions.push(eq(contactsTable.nationality, nationality));
  if (gender) conditions.push(eq(contactsTable.gender, gender));
  if (portal_enabled !== undefined) conditions.push(eq(contactsTable.portal_enabled, portal_enabled));
  if (status) conditions.push(eq(contactsTable.status, status));
  if (search) {
    conditions.push(or(
      ilike(contactsTable.first_name, `%${search}%`),
      ilike(contactsTable.last_name, `%${search}%`),
      ilike(contactsTable.email, `%${search}%`),
      ilike(contactsTable.mobile_number, `%${search}%`),
    )!);
  }
  const rows = await db.select().from(contactsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(contactsTable.last_name);
  res.json(rows);
});

router.post("/v1/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contactsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/v1/contacts/:id", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(contactsTable).where(eq(contactsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/contacts/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateContactParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateContactBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(contactsTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(contactsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/v1/contacts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(contactsTable).where(eq(contactsTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
