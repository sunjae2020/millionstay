import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SEED_FILE_PATH = path.resolve(__dirname, "seed-migration.sql");

// IMPORTANT: every table that the seed file may INSERT into must be listed
// here, otherwise a primary-key collision will fail the import. CASCADE
// handles FK ordering. Tables not present in the DB are tolerated below.
const TRUNCATE_TABLES = [
  // content / public site
  "page_contents", "blog_posts", "announcements",
  // guest portal
  "guest_direct_messages", "guest_emergency_contacts",
  // bookings & service photos
  "booking_services", "booking_service_photos",
  "contract_line_items", "partner_users",
  // reference data
  "suburbs", "product_groups", "product_types", "contract_types", "payment_info",
  // CRM
  "contacts", "accounts", "leads", "tasks",
  // users
  "admin_users", "guest_users",
  // properties
  "properties", "spaces", "space_options", "space_policies",
  "space_images", "space_availability", "space_blocked_dates", "space_option_maps",
  // catalogues
  "service_catalog", "accommodation_catalog", "accommodation_service_catalog",
  "space_service_catalog",
  // sales
  "promotions", "beneficiaries", "commissions",
  // contracts / bookings
  "contracts", "bookings", "booking_documents", "contract_products",
  // finance
  "invoices", "recurring_schedule",
  // platform
  "integration_settings", "email_template", "email_log",
  "service_hosts", "system_log", "work_orders",
  "cs_tickets", "cs_messages",
];

const TRUNCATE_SQL = `TRUNCATE TABLE ${TRUNCATE_TABLES.join(", ")} RESTART IDENTITY CASCADE`;

export interface SeedInfo {
  exists: boolean;
  path: string;
  sizeBytes: number | null;
  lineCount: number | null;
  insertCount: number | null;
  setvalCount: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  isProductionDb: boolean;
}

export function isProductionDatabase(): boolean {
  const url = process.env["DATABASE_URL"] ?? "";
  return url.includes("neon.tech") || url.includes("neondb");
}

export function getSeedInfo(): SeedInfo {
  const isProd = isProductionDatabase();
  if (!fs.existsSync(SEED_FILE_PATH)) {
    return {
      exists: false,
      path: SEED_FILE_PATH,
      sizeBytes: null,
      lineCount: null,
      insertCount: null,
      setvalCount: null,
      createdAt: null,
      modifiedAt: null,
      isProductionDb: isProd,
    };
  }

  const stat = fs.statSync(SEED_FILE_PATH);
  const content = fs.readFileSync(SEED_FILE_PATH, "utf-8");
  const lines = content.split("\n");
  const lineCount = lines.length;
  let insertCount = 0;
  let setvalCount = 0;
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith("INSERT INTO")) insertCount++;
    else if (t.startsWith("SELECT pg_catalog.setval")) setvalCount++;
  }

  return {
    exists: true,
    path: SEED_FILE_PATH,
    sizeBytes: stat.size,
    lineCount,
    insertCount,
    setvalCount,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    isProductionDb: isProd,
  };
}

/**
 * Dump current DB to seed-migration.sql via pg_dump.
 * Refuses to run when DATABASE_URL points at production (Neon).
 */
export function exportSeed(): SeedInfo {
  if (isProductionDatabase()) {
    throw new Error(
      "Refusing to export seed from a production database. Run this from the dev environment only.",
    );
  }
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  const dump = execFileSync(
    "pg_dump",
    [
      dbUrl,
      "--data-only",
      "--no-owner",
      "--no-acl",
      "--column-inserts",
      "--rows-per-insert=9999",
    ],
    { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 },
  );

  const linesOut: string[] = [];
  let inInsert = false;
  let buf: string[] = [];
  for (const line of dump.split("\n")) {
    const s = line.trimEnd();
    if (!inInsert) {
      if (s.startsWith("INSERT INTO")) {
        inInsert = true;
        buf = [s];
        if (s.endsWith(";")) {
          linesOut.push(buf.join("\n"));
          buf = [];
          inInsert = false;
        }
      } else if (s.startsWith("SELECT pg_catalog.setval")) {
        linesOut.push(s);
      }
    } else {
      buf.push(s);
      if (s.endsWith(";")) {
        linesOut.push(buf.join("\n"));
        buf = [];
        inInsert = false;
      }
    }
  }

  const sqlOut = linesOut.join("\n") + "\n";
  fs.mkdirSync(path.dirname(SEED_FILE_PATH), { recursive: true });
  fs.writeFileSync(SEED_FILE_PATH, sqlOut);
  return getSeedInfo();
}

export interface ImportResult {
  executed: number;
  errors: number;
  total: number;
  /** First few error messages (for diagnostics). */
  errorSamples: string[];
}

export interface ImportOptions {
  /**
   * When true, statement-level failures are tolerated and the transaction
   * still commits. When false (default), any failure throws and the entire
   * TRUNCATE+restore is rolled back — leaving the DB unchanged.
   *
   * Use `true` only on automated boot-time sync where partial data is
   * preferable to no data; never expose `true` to operator-triggered HTTP.
   */
  allowPartial?: boolean;
}

/**
 * Apply seed-migration.sql to the current DB:
 *   1) TRUNCATE all data tables
 *   2) Replay every INSERT/setval inside one transaction (each guarded by SAVEPOINT)
 *
 * By default (allowPartial=false) the entire transaction rolls back if any
 * statement fails, leaving the DB in its pre-call state.
 */
export async function importSeed(opts: ImportOptions = {}): Promise<ImportResult> {
  const allowPartial = opts.allowPartial ?? false;
  if (!fs.existsSync(SEED_FILE_PATH)) {
    throw new Error("seed-migration.sql not found");
  }

  const seedSql = fs.readFileSync(SEED_FILE_PATH, "utf-8");
  const statements = seedSql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        (s.startsWith("INSERT INTO") || s.startsWith("SELECT pg_catalog.setval")),
    );

  let executed = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(TRUNCATE_SQL));
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // privacy-skip: SAVEPOINT name is built from a loop counter (sp_imp_<int>),
      // not user input. Postgres SAVEPOINTs cannot be parameterised.
      const sp = `sp_imp_${i}`;
      try {
        await tx.execute(sql.raw(`SAVEPOINT ${sp}`));
        await tx.execute(sql.raw(stmt));
        executed++;
      } catch (err: any) {
        try {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${sp}`));
        } catch {
          /* ignore */
        }
        errors++;
        if (errorSamples.length < 5) {
          errorSamples.push(`[${i}] ${stmt.slice(0, 80)}… → ${err?.message ?? "unknown"}`);
        }
      }
    }

    if (errors > 0 && !allowPartial) {
      // Throwing rolls back the transaction → DB is fully restored to its
      // pre-call state (TRUNCATE undone too).
      throw new SeedImportFailure(executed, errors, statements.length, errorSamples);
    }
  });

  return { executed, errors, total: statements.length, errorSamples };
}

export class SeedImportFailure extends Error {
  constructor(
    public readonly executed: number,
    public readonly errors: number,
    public readonly total: number,
    public readonly errorSamples: string[],
  ) {
    super(
      `Seed import aborted and rolled back: ${errors}/${total} statements failed. First errors: ${errorSamples.slice(0, 3).join(" | ")}`,
    );
    this.name = "SeedImportFailure";
  }
}
