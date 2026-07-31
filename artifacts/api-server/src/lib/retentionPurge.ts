/**
 * Retention purge job — Australian APP 11.5 ("destroy / de-identify personal
 * information once the purpose for which it was collected is fulfilled").
 *
 * `retention.ts` defines the policy and stamps every sensitive document with a
 * `retention_until` date, but nothing previously enforced it: the helpers had
 * no callers and no scheduler, so expired ID/visa scans and deletion-requested
 * documents lived forever. This job is wired into the cron in `index.ts` and
 * physically destroys eligible documents (Cloudinary asset + DB row).
 *
 * A document is eligible for destruction when EITHER:
 *   - its `retention_until` has elapsed (policy retention fulfilled), OR
 *   - it has been soft-deleted (`deleted_at` set, e.g. by a DSAR deletion
 *     request) AND it is not under a statutory minimum-retention obligation
 *     (tax invoices 5y / receipts 5y / contracts 7y). This lets ID/visa/other
 *     documents be destroyed promptly on a deletion request while never
 *     prematurely destroying records the ATO or tenancy law require us to keep.
 */
import { db, documentsTable } from "@workspace/db";
import { and, eq, isNotNull, lt, notInArray, or, sql } from "drizzle-orm";
import { deleteFromCloudinary } from "../utils/cloudinary";
import { logAction } from "../utils/auditLog";
import { logger } from "./logger";

/** Doc types we must retain for a statutory minimum even if soft-deleted. */
const STATUTORY_RETENTION_TYPES = ["tax_invoice", "receipt", "contract", "signed_contract"];

export interface PurgeResult {
  scanned: number;
  destroyed: number;
  cloudinaryDeleted: number;
  errors: number;
}

export async function purgeExpiredDocuments(opts: { dryRun?: boolean } = {}): Promise<PurgeResult> {
  const dryRun = opts.dryRun ?? false;
  const result: PurgeResult = { scanned: 0, destroyed: 0, cloudinaryDeleted: 0, errors: 0 };

  const candidates = await db
    .select()
    .from(documentsTable)
    .where(
      or(
        // Policy/statutory retention elapsed (applies to all doc types).
        lt(documentsTable.retention_until, sql`now()`),
        // Soft-deleted AND not under a statutory minimum-retention obligation.
        and(
          isNotNull(documentsTable.deleted_at),
          notInArray(documentsTable.doc_type, STATUTORY_RETENTION_TYPES),
        ),
      ),
    );

  result.scanned = candidates.length;

  for (const doc of candidates) {
    try {
      if (dryRun) {
        result.destroyed++;
        continue;
      }
      if (doc.cloudinary_public_id) {
        await deleteFromCloudinary(doc.cloudinary_public_id);
        result.cloudinaryDeleted++;
      }
      await db.delete(documentsTable).where(eq(documentsTable.id, doc.id));
      result.destroyed++;
    } catch (err) {
      result.errors++;
      logger.error({ err, docId: doc.id }, "Retention purge: failed to destroy document");
    }
  }

  if (!dryRun && result.destroyed > 0) {
    await logAction({
      entityType: "documents",
      entityId: 0,
      action: "DELETE",
      actorId: null,
      actorEmail: "system@retention-cron",
      newValue: {
        event: "RETENTION_PURGE",
        scanned: result.scanned,
        destroyed: result.destroyed,
        cloudinaryDeleted: result.cloudinaryDeleted,
        errors: result.errors,
      },
      ipAddress: null,
    });
  }

  return result;
}
