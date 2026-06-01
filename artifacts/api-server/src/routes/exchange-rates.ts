import { Router, type IRouter } from "express";
import { db, exchangeRatesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import * as z from "zod/v4";
import { syncExchangeRates, getSyncInfo, getLiveRatesVsAud } from "../lib/exchangeRateSync";

const router: IRouter = Router();

const CreateRateBody = z.object({
  from_currency: z.string().min(3).max(10).transform((s) => s.toUpperCase()),
  to_currency: z.string().min(3).max(10).default("AUD").transform((s) => s.toUpperCase()),
  rate: z.union([z.number(), z.string()]).transform((v) => String(v)),
  source: z.enum(["manual", "auto"]).default("manual"),
  effective_date: z.string().optional(),
});

router.get("/v1/exchange-rates", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(exchangeRatesTable)
    .orderBy(desc(exchangeRatesTable.effective_date), desc(exchangeRatesTable.id));
  res.json({ success: true, data: rows });
});

router.get("/v1/exchange-rates/sync-info", async (_req, res): Promise<void> => {
  const info = await getSyncInfo();
  res.json({ success: true, data: info });
});

// Read-only live market rates (1 X = N AUD) for the admin preview — not persisted.
router.get("/v1/exchange-rates/live", async (_req, res): Promise<void> => {
  const live = await getLiveRatesVsAud();
  res.json({ success: live.ok, data: live });
});

router.post("/v1/exchange-rates", async (req, res): Promise<void> => {
  const parsed = CreateRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  const user = (req as any).user as { id: number } | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const date = parsed.data.effective_date ?? today;

  const inserted = await db
    .insert(exchangeRatesTable)
    .values({
      from_currency: parsed.data.from_currency,
      to_currency: parsed.data.to_currency,
      rate: parsed.data.rate,
      source: parsed.data.source,
      effective_date: date,
      created_by: user?.id ?? null,
    })
    .onConflictDoUpdate({
      target: [exchangeRatesTable.from_currency, exchangeRatesTable.to_currency, exchangeRatesTable.effective_date],
      set: { rate: parsed.data.rate, source: parsed.data.source, updated_at: new Date() },
    })
    .returning();

  res.status(201).json({ success: true, data: inserted[0] });
});

router.delete("/v1/exchange-rates/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, error: { code: "INVALID_ID" } });
    return;
  }
  await db.delete(exchangeRatesTable).where(eq(exchangeRatesTable.id, id));
  res.json({ success: true });
});

router.post("/v1/exchange-rates/sync", async (_req, res): Promise<void> => {
  const result = await syncExchangeRates();
  res.json({ success: result.ok, data: result });
});

export default router;
