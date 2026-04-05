import { Router } from "express";
import { db, emailLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/v1/email-logs", async (req, res): Promise<void> => {
  const {
    entity_type,
    entity_id,
    status,
    limit: limitStr = "20",
    offset: offsetStr = "0",
  } = req.query as Record<string, string>;

  const limit = Math.min(Number(limitStr) || 20, 200);
  const offset = Number(offsetStr) || 0;

  const conditions = [];
  if (entity_type) conditions.push(eq(emailLogsTable.entity_type, entity_type));
  if (entity_id) conditions.push(eq(emailLogsTable.entity_id, Number(entity_id)));
  if (status) conditions.push(eq(emailLogsTable.status, status));

  const rows = await db.select().from(emailLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(emailLogsTable.sent_at))
    .limit(limit)
    .offset(offset);

  res.json({ data: rows, limit, offset, count: rows.length });
});

export default router;
