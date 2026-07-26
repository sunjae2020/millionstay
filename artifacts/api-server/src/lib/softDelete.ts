import type { Request, Response } from "express";
import { inArray, isNull, isNotNull, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";

// Shared soft-delete lifecycle for admin list resources: the deleted-row VIEW
// filter, plus SuperAdmin-gated bulk DELETE (soft/permanent) and RESTORE
// handler factories. Keeps each route to a few lines instead of copy-paste, and
// centralizes the SuperAdmin gate that was previously inlined everywhere.
//
// `table`/columns are typed loosely (any) on purpose so one helper spans every
// Drizzle table without per-resource generics.

export function isSuperAdmin(req: Request): boolean {
  return (req as unknown as { user?: { role?: string } })?.user?.role === "SuperAdmin";
}

/**
 * Build the `deleted_at` filter for a list endpoint from `?deleted`:
 *   absent / "0"   → isNull    (non-deleted; current default behavior)
 *   "only" / "1"   → isNotNull (soft-deleted rows) — SuperAdmin ONLY
 * Non-SuperAdmins always get the non-deleted filter (the deleted view is gated).
 * Reads `req.query.deleted` directly — the generated Zod query schemas strip
 * unknown keys, so the param never survives `safeParse`.
 */
export function deletedFilter(deletedAtCol: any, req: Request): SQL {
  const raw = String((req.query as Record<string, unknown>)?.deleted ?? "").toLowerCase();
  const wantsDeleted = raw === "only" || raw === "1" || raw === "true";
  return wantsDeleted && isSuperAdmin(req)
    ? (isNotNull(deletedAtCol) as SQL)
    : (isNull(deletedAtCol) as SQL);
}

export interface SoftDeleteConfig {
  table: any;
  idColumn: any;
  /** Model property name for the status column (usually "status"). Omit to
   *  leave status untouched — use this for lifecycle resources (bookings,
   *  invoices, …) whose original status can't be recovered from an archived row. */
  statusKey?: string;
  /** Status value written on soft-delete. Default "Archived". */
  archivedStatus?: string;
  /** Status value written on restore. Default "Active". */
  restoredStatus?: string;
  /** Child-row cleanup before a permanent (hard) delete. */
  onPurge?: (ids: number[]) => Promise<void>;
}

function parseIds(body: unknown): number[] {
  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids)) return [];
  return ids.map(Number).filter((n) => Number.isFinite(n) && n > 0);
}

/** POST /v1/<resource>/bulk-delete — SuperAdmin only. Body: { ids, permanent? }. */
export function makeBulkDelete(cfg: SoftDeleteConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    if (!isSuperAdmin(req)) {
      res.status(403).json({ error: "Only SuperAdmin can perform bulk delete" });
      return;
    }
    const numIds = parseIds(req.body);
    if (numIds.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }
    if ((req.body as { permanent?: unknown })?.permanent) {
      if (cfg.onPurge) await cfg.onPurge(numIds);
      await db.delete(cfg.table).where(inArray(cfg.idColumn, numIds));
    } else {
      const set: Record<string, unknown> = { deleted_at: new Date() };
      if (cfg.statusKey) set[cfg.statusKey] = cfg.archivedStatus ?? "Archived";
      await db.update(cfg.table).set(set).where(inArray(cfg.idColumn, numIds));
    }
    res.json({ success: true, affected: numIds.length });
  };
}

/** POST /v1/<resource>/bulk-restore — SuperAdmin only. Body: { ids }. */
export function makeBulkRestore(cfg: SoftDeleteConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    if (!isSuperAdmin(req)) {
      res.status(403).json({ error: "Only SuperAdmin can restore" });
      return;
    }
    const numIds = parseIds(req.body);
    if (numIds.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }
    const set: Record<string, unknown> = { deleted_at: null };
    if (cfg.statusKey) set[cfg.statusKey] = cfg.restoredStatus ?? "Active";
    await db.update(cfg.table).set(set).where(inArray(cfg.idColumn, numIds));
    res.json({ success: true, affected: numIds.length });
  };
}
