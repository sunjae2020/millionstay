import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, serviceHostsTable, accountsTable } from "@workspace/db";
import {
  ListServiceHostsQueryParams,
  CreateServiceHostBody,
  GetServiceHostParams,
  UpdateServiceHostParams,
  DeleteServiceHostParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/service-hosts", async (req, res): Promise<void> => {
  const parsed = ListServiceHostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, status } = parsed.data;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(serviceHostsTable.status, status));
  if (search) conditions.push(ilike(serviceHostsTable.name, `%${search}%`));
  const rows = await db
    .select()
    .from(serviceHostsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(serviceHostsTable.created_at);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [account] = row.account_id
        ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
        : [null];
      return { ...row, account_name: account?.name ?? null };
    })
  );
  res.json(enriched);
});

router.post("/v1/service-hosts", async (req, res): Promise<void> => {
  const parsed = CreateServiceHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(serviceHostsTable).values(parsed.data).returning();
  const [account] = row.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
    : [null];
  res.status(201).json({ ...row, account_name: account?.name ?? null });
});

router.get("/v1/service-hosts/:id", async (req, res): Promise<void> => {
  const parsed = GetServiceHostParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.select().from(serviceHostsTable).where(eq(serviceHostsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [account] = row.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
    : [null];
  res.json({ ...row, account_name: account?.name ?? null });
});

router.put("/v1/service-hosts/:id", async (req, res): Promise<void> => {
  const paramParsed = UpdateServiceHostParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) { res.status(400).json({ error: paramParsed.error.message }); return; }
  const bodyParsed = CreateServiceHostBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(serviceHostsTable).set(bodyParsed.data).where(eq(serviceHostsTable.id, paramParsed.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [account] = row.account_id
    ? await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id))
    : [null];
  res.json({ ...row, account_name: account?.name ?? null });
});

router.delete("/v1/service-hosts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteServiceHostParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(serviceHostsTable).set({ status: "Deleted" }).where(eq(serviceHostsTable.id, parsed.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

export default router;
