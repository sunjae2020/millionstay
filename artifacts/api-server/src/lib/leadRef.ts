import { db, leadsTable } from "@workspace/db";

export async function generateLeadRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ lead_ref: leadsTable.lead_ref }).from(leadsTable);
  const maxNum = rows
    .filter((r) => r.lead_ref.startsWith(`LEAD-${year}-`))
    .reduce((max, r) => {
      const n = parseInt(r.lead_ref.split("-")[2] ?? "0", 10);
      return n > max ? n : max;
    }, 0);
  return `LEAD-${year}-${String(maxNum + 1).padStart(5, "0")}`;
}

export async function insertLeadWithGeneratedRef<T extends Record<string, unknown>>(
  values: T,
): Promise<{ id: number; lead_ref: string }> {
  const MAX_ATTEMPTS = 6;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const lead_ref = await generateLeadRef();
    try {
      const [row] = await db
        .insert(leadsTable)
        .values({ ...(values as object), lead_ref } as typeof leadsTable.$inferInsert)
        .returning({ id: leadsTable.id, lead_ref: leadsTable.lead_ref });
      if (!row) throw new Error("insert returned no row");
      return row;
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      const cause = (e as { cause?: { code?: string } } | null)?.cause?.code;
      if (code === "23505" || cause === "23505") {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("Could not allocate unique lead_ref after retries");
}
