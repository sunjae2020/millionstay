import { Router } from "express";
import { db, systemLogsTable } from "@workspace/db";
import { eq, ilike, gte, lte, and, desc } from "drizzle-orm";

const router = Router();

router.get("/v1/system-logs", async (req, res): Promise<void> => {
  const {
    entity_type,
    action,
    actor_email,
    from,
    to,
    limit: limitStr = "50",
    offset: offsetStr = "0",
  } = req.query as Record<string, string>;

  const limit = Math.min(Number(limitStr) || 50, 200);
  const offset = Number(offsetStr) || 0;

  const conditions = [];
  if (entity_type) conditions.push(eq(systemLogsTable.entity_type, entity_type));
  if (action) conditions.push(eq(systemLogsTable.action, action));
  if (actor_email) conditions.push(ilike(systemLogsTable.actor_email, `%${actor_email}%`));
  if (from) conditions.push(gte(systemLogsTable.created_at, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lte(systemLogsTable.created_at, toDate));
  }

  const rows = await db.select().from(systemLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemLogsTable.created_at))
    .limit(limit)
    .offset(offset);

  res.json({ data: rows, limit, offset, count: rows.length });
});

export default router;
