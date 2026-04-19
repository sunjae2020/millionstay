#!/usr/bin/env tsx
/**
 * Purge expired documents — Sprint B-2
 *
 * Soft-deletes documents whose retention_until has passed and removes the
 * underlying Cloudinary asset. Designed to be invoked manually OR by a cron
 * scheduler (recommended: daily at 03:00 server time).
 *
 * Usage:
 *   tsx artifacts/api-server/scripts/purge-expired-documents.ts          # dry run
 *   tsx artifacts/api-server/scripts/purge-expired-documents.ts --apply  # actually delete
 */
import { db, documentsTable } from "@workspace/db";
import { and, isNull, lt } from "drizzle-orm";
import { deleteFromCloudinary } from "../src/utils/cloudinary";

async function main() {
  const apply = process.argv.includes("--apply");
  const now = new Date();

  const expired = await db
    .select()
    .from(documentsTable)
    .where(and(lt(documentsTable.retention_until, now), isNull(documentsTable.deleted_at)));

  console.log(`Found ${expired.length} expired document(s).`);
  if (!apply) {
    console.log("Dry run — pass --apply to actually delete.");
    for (const d of expired.slice(0, 20)) {
      console.log(`  · ${d.id}  ${d.doc_type}  ${d.file_name}  expired ${d.retention_until.toISOString?.() ?? d.retention_until}`);
    }
    return;
  }

  let deleted = 0;
  for (const doc of expired) {
    try {
      await deleteFromCloudinary(doc.cloudinary_public_id);
      await db
        .update(documentsTable)
        .set({ deleted_at: now, updated_at: now })
        .where(eqId(doc.id));
      deleted++;
    } catch (err) {
      console.error(`Failed to purge ${doc.id}:`, err);
    }
  }
  console.log(`Successfully purged ${deleted}/${expired.length} document(s).`);
}

import { eq } from "drizzle-orm";
function eqId(id: string) {
  return eq(documentsTable.id, id);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
