import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, userTablePrefsTable } from "@workspace/db";

// Per-user list-table view preferences (column order / visibility / widths).
// requireAuth is applied globally at /api/v1 in app.ts, so (req as any).user is
// always set here. No SuperAdmin gating — every user manages only their own
// prefs. The Viewer read-only gate in requireAuth is exempted for this path
// (personalization, not data mutation) so read-only users can still save layouts.
const router: IRouter = Router();

function currentUserId(req: unknown): number | null {
  return (req as { user?: { id?: number } })?.user?.id ?? null;
}

const EMPTY = {
  order: [] as string[],
  hidden: [] as string[],
  widths: {} as Record<string, number>,
};

// GET /v1/table-prefs → all pref rows for the current user
router.get("/v1/table-prefs", async (req, res): Promise<void> => {
  const uid = currentUserId(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db
    .select()
    .from(userTablePrefsTable)
    .where(eq(userTablePrefsTable.user_id, uid));
  res.json({ success: true, data: rows });
});

// GET /v1/table-prefs/:tableKey → prefs for one table (defaults if none)
router.get("/v1/table-prefs/:tableKey", async (req, res): Promise<void> => {
  const uid = currentUserId(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [row] = await db
    .select()
    .from(userTablePrefsTable)
    .where(
      and(
        eq(userTablePrefsTable.user_id, uid),
        eq(userTablePrefsTable.table_key, req.params.tableKey),
      ),
    );
  res.json({ success: true, data: row?.prefs ?? EMPTY });
});

// PUT /v1/table-prefs/:tableKey → upsert { order, hidden, widths }
router.put("/v1/table-prefs/:tableKey", async (req, res): Promise<void> => {
  const uid = currentUserId(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const b = (req.body ?? {}) as { order?: unknown; hidden?: unknown; widths?: unknown };
  const prefs = {
    order: Array.isArray(b.order) ? b.order.map(String) : [],
    hidden: Array.isArray(b.hidden) ? b.hidden.map(String) : [],
    widths:
      b.widths && typeof b.widths === "object" && !Array.isArray(b.widths)
        ? (b.widths as Record<string, number>)
        : {},
  };
  const [row] = await db
    .insert(userTablePrefsTable)
    .values({ user_id: uid, table_key: req.params.tableKey, prefs })
    .onConflictDoUpdate({
      target: [userTablePrefsTable.user_id, userTablePrefsTable.table_key],
      set: { prefs, updated_at: new Date() },
    })
    .returning();
  res.json({ success: true, data: row.prefs });
});

export default router;
