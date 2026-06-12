import { db, homestayHostApplicationsTable, homestayStudentRequestsTable, homestayPlacementsTable } from "@workspace/db";

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

// Generate the next "HSR-YYYY-NNNNN" student-request reference.
export async function generateStudentRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ request_ref: homestayStudentRequestsTable.request_ref })
    .from(homestayStudentRequestsTable);
  const maxNum = rows
    .filter((r) => r.request_ref?.startsWith(`HSR-${year}-`))
    .reduce((max, r) => {
      const n = parseInt(r.request_ref.split("-")[2] ?? "0", 10);
      return n > max ? n : max;
    }, 0);
  return `HSR-${year}-${String(maxNum + 1).padStart(5, "0")}`;
}

// Generate the next "HSP-YYYY-NNNNN" placement reference.
export async function generatePlacementRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ placement_ref: homestayPlacementsTable.placement_ref })
    .from(homestayPlacementsTable);
  const maxNum = rows
    .filter((r) => r.placement_ref?.startsWith(`HSP-${year}-`))
    .reduce((max, r) => {
      const n = parseInt(r.placement_ref.split("-")[2] ?? "0", 10);
      return n > max ? n : max;
    }, 0);
  return `HSP-${year}-${String(maxNum + 1).padStart(5, "0")}`;
}
