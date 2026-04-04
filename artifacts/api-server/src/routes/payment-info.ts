import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, paymentInfoTable } from "@workspace/db";
import {
  ListPaymentInfoQueryParams,
  CreatePaymentInfoBody,
  GetPaymentInfoParams,
  UpdatePaymentInfoParams,
  UpdatePaymentInfoBody,
  DeletePaymentInfoParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/payment-info", async (req, res): Promise<void> => {
  const parsed = ListPaymentInfoQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, payment_type } = parsed.data;
  const conditions: SQL[] = [];
  if (payment_type) conditions.push(eq(paymentInfoTable.payment_type, payment_type));
  if (search) conditions.push(ilike(paymentInfoTable.name, `%${search}%`));
  const rows = await db.select().from(paymentInfoTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(paymentInfoTable.name);
  res.json(rows);
});

router.post("/v1/payment-info", async (req, res): Promise<void> => {
  const parsed = CreatePaymentInfoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(paymentInfoTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/v1/payment-info/:id", async (req, res): Promise<void> => {
  const parsed = GetPaymentInfoParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(paymentInfoTable).where(eq(paymentInfoTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/payment-info/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdatePaymentInfoParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdatePaymentInfoBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(paymentInfoTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(paymentInfoTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/v1/payment-info/:id", async (req, res): Promise<void> => {
  const parsed = DeletePaymentInfoParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(paymentInfoTable).where(eq(paymentInfoTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
