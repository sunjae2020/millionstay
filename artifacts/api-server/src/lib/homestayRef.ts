import { db, homestayHostApplicationsTable } from "@workspace/db";

// Generate the next "HHA-YYYY-NNNNN" application reference.
export async function generateHomestayRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ application_ref: homestayHostApplicationsTable.application_ref })
    .from(homestayHostApplicationsTable);
  const maxNum = rows
    .filter((r) => r.application_ref?.startsWith(`HHA-${year}-`))
    .reduce((max, r) => {
      const n = parseInt(r.application_ref.split("-")[2] ?? "0", 10);
      return n > max ? n : max;
    }, 0);
  return `HHA-${year}-${String(maxNum + 1).padStart(5, "0")}`;
}
