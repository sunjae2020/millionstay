import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { allProviders, isProviderConfigured } from "../lib/ai/providers.js";

/**
 * System Map — a live, read-only snapshot of the platform for Super Admins:
 * database shape, technology stack, in-house engines, external integrations,
 * scheduled jobs and the live API surface.
 *
 * Curated/descriptive content (tech stack, engines, job schedules) lives on the
 * frontend; the endpoints below return only facts that would silently drift if
 * hand-maintained (table counts, migrations, integration presence, route census).
 *
 * SECURITY: presence only — secret values (API keys/tokens) NEVER leave the
 * server. Guarded by requireAuth (mounted in app.ts) + requireSuperAdmin here.
 */

const router: IRouter = Router();

const SUPER_ADMIN_ROLES = new Set(["Super Admin", "SuperAdmin", "superadmin", "super_admin"]);

function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as { role?: string } | undefined;
  if (!user || !user.role || !SUPER_ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Super Admin role required" });
    return;
  }
  next();
}

router.use(requireSuperAdmin);

/** Drizzle node-postgres `execute` returns rows directly in this project; keep a
 *  `.rows` fallback so a driver/version change can't quietly break the readouts. */
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : (r?.rows ?? []));

// Postgres-managed / Supabase-managed schemas that are not application data.
const SYSTEM_SCHEMAS = new Set([
  "information_schema", "extensions", "auth", "storage", "realtime",
  "graphql", "graphql_public", "vault", "supabase_migrations", "pgbouncer",
  "cron", "net", "pgsodium", "pgsodium_masks", "_analytics", "drizzle",
]);

function dbHost(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) return "PostgreSQL";
  try {
    const host = new URL(url).hostname;
    if (/supabase|pooler/.test(host)) return `Supabase (${host})`;
    return host;
  } catch {
    return "PostgreSQL";
  }
}

// ── Overview — database shape + core entity counts ───────────────────────────
router.get("/system-map/overview", async (_req, res) => {
  try {
    // Base tables grouped by schema (no views, no pg_* internals).
    const tablesRes = await db.execute(sql`
      SELECT table_schema AS schema, COUNT(*)::int AS cnt
        FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT LIKE 'pg_%'
       GROUP BY table_schema
       ORDER BY table_schema
    `);
    const bySchema = rowsOf(tablesRes) as Array<{ schema: string; cnt: number }>;
    const publicTables = bySchema.find((r) => r.schema === "public")?.cnt ?? 0;
    const totalTables = bySchema.reduce((s, r) => s + Number(r.cnt), 0);
    const appSchemas = bySchema
      .filter((r) => !SYSTEM_SCHEMAS.has(r.schema))
      .map((r) => ({ name: r.schema, tableCount: Number(r.cnt) }));

    // Migration ledger — Drizzle keeps applied migrations in drizzle.__drizzle_migrations.
    let migrationCount = 0;
    let latestMigrationAt: string | null = null;
    try {
      const migRes = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt,
               to_timestamp(MAX(created_at) / 1000.0) AS latest_at
          FROM drizzle.__drizzle_migrations
      `);
      const m = rowsOf(migRes)[0] ?? {};
      migrationCount = Number(m.cnt ?? 0);
      latestMigrationAt = m.latest_at ? new Date(m.latest_at).toISOString() : null;
    } catch {
      /* ledger optional (fresh db:push instance) */
    }

    // Core entity row counts — a live pulse of what the platform holds.
    const ENTITIES: Array<{ key: string; table: string }> = [
      { key: "properties", table: "properties" },
      { key: "spaces", table: "spaces" },
      { key: "accounts", table: "accounts" },
      { key: "contacts", table: "contacts" },
      { key: "contracts", table: "contracts" },
      { key: "bookings", table: "bookings" },
      { key: "invoices", table: "invoices" },
      { key: "work_orders", table: "work_orders" },
    ];
    const counts: Record<string, number | null> = {};
    await Promise.all(
      ENTITIES.map(async (e) => {
        try {
          const r = await db.execute(
            sql`SELECT COUNT(*)::int AS cnt FROM ${sql.identifier(e.table)}`,
          );
          counts[e.key] = Number(rowsOf(r)[0]?.cnt ?? 0);
        } catch {
          counts[e.key] = null;
        }
      }),
    );

    return res.json({
      database: {
        engine: "PostgreSQL",
        host: dbHost(),
        orm: "Drizzle ORM",
        totalTables,
        publicTables,
        appSchemas,
        migrationCount,
        latestMigrationAt,
        entityCounts: counts,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "GET /system-map/overview failed");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Integrations — configured presence only, never secret values ─────────────
router.get("/system-map/integrations", (_req, res) => {
  try {
    const env = (k: string) => !!(process.env[k] && String(process.env[k]).trim());
    const stripeKey = process.env["STRIPE_SECRET_KEY"];
    const stripeMode = stripeKey ? (stripeKey.startsWith("sk_live") ? "live" : "test") : null;

    const integrations: Array<{
      name: string; kind: string; configured: boolean; detail: string;
    }> = [
      {
        name: "Stripe",
        kind: "Billing",
        configured: env("STRIPE_SECRET_KEY"),
        detail: stripeMode ? `STRIPE_SECRET_KEY · ${stripeMode} mode` : "STRIPE_SECRET_KEY",
      },
      {
        name: "Cloudinary",
        kind: "Storage",
        configured: env("CLOUDINARY_CLOUD_NAME") && env("CLOUDINARY_API_KEY") && env("CLOUDINARY_API_SECRET"),
        detail: "CLOUDINARY_* (documents & images)",
      },
      {
        name: "Resend",
        kind: "Email",
        configured: env("RESEND_API_KEY"),
        detail: "RESEND_API_KEY (transactional + marketing)",
      },
      {
        name: "SMS (SOLAPI)",
        kind: "SMS",
        configured: env("SOLAPI_API_KEY") && env("SOLAPI_API_SECRET"),
        detail: "SOLAPI_API_KEY / SOLAPI_API_SECRET",
      },
      {
        name: "Supabase (PostgreSQL)",
        kind: "Platform",
        configured: env("DATABASE_URL"),
        detail: "DATABASE_URL (session pooler)",
      },
    ];

    // AI engines from the task registry — Anthropic / Kimi / Gemini + any custom.
    for (const p of allProviders()) {
      integrations.push({
        name: p.label,
        kind: "AI",
        configured: isProviderConfigured(p.id),
        detail: `${p.keyEnv}${p.custom ? " · custom engine" : ""}`,
      });
    }

    const configuredCount = integrations.filter((i) => i.configured).length;
    return res.json({ integrations, configuredCount, generatedAt: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /system-map/integrations failed");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── API census — introspect the live Express router stack ────────────────────
router.get("/system-map/endpoints", (req, res) => {
  try {
    const app: any = req.app;
    const rootStack = app?.router?.stack ?? app?._router?.stack ?? null;
    if (!rootStack) return res.json({ available: false, reason: "router stack not accessible" });

    const GUARD_NAMES = new Set([
      "requireAuth", "authenticate", "requireGuestAuth", "requirePartnerAuth",
      "requireSuperAdmin", "requireRole", "authenticateToken",
    ]);
    const routes: Array<{ path: string; methods: string[]; guards: string[] }> = [];

    const walk = (stack: any[]) => {
      for (const layer of stack ?? []) {
        if (layer?.route) {
          const path = layer.route.path ?? "";
          const methods = Object.keys(layer.route.methods ?? {})
            .filter((m) => m !== "_all")
            .map((m) => m.toUpperCase());
          const guards: string[] = [];
          for (const s of layer.route.stack ?? []) {
            const n = s?.handle?.name;
            if (n && GUARD_NAMES.has(n)) guards.push(n);
          }
          const paths = Array.isArray(path) ? path : [path];
          for (const p of paths) routes.push({ path: String(p), methods, guards });
        } else if (layer?.handle?.stack) {
          walk(layer.handle.stack);
        }
      }
    };
    walk(rootStack);

    let totalEndpoints = 0;
    let guardedRoutes = 0;
    const byMethod: Record<string, number> = {};
    const byGroup: Record<string, number> = {};
    for (const r of routes) {
      totalEndpoints += r.methods.length;
      for (const m of r.methods) byMethod[m] = (byMethod[m] ?? 0) + 1;
      // Group by the first meaningful path segment (skip api / v1 prefixes).
      const segs = r.path.split("/").filter(Boolean).filter((s) => s !== "api" && s !== "v1");
      const seg = (segs[0] ?? "(root)").split(":")[0] || "(root)";
      byGroup[seg] = (byGroup[seg] ?? 0) + r.methods.length;
      if (r.guards.length) guardedRoutes++;
    }
    const groups = Object.entries(byGroup)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      available: true,
      totalRoutes: routes.length,
      totalEndpoints,
      guardedRoutes,
      unguardedRoutes: routes.length - guardedRoutes,
      byMethod,
      groups,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "GET /system-map/endpoints failed");
    return res.json({ available: false, reason: "introspection failed" });
  }
});

// ── Schema browser — list tables of a schema, or one table's columns + FKs ────
router.get("/system-map/schema", async (req, res) => {
  try {
    const schema = String(req.query["schema"] ?? "public").toLowerCase();
    const table = req.query["table"] ? String(req.query["table"]) : null;

    // Whitelist schema against real schemas — blocks injection / arbitrary probing.
    const schemasRes = await db.execute(sql`
      SELECT nspname FROM pg_namespace
       WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
    `);
    const validSchemas = new Set(rowsOf(schemasRes).map((r: any) => r.nspname));
    if (!validSchemas.has(schema)) return res.status(400).json({ error: "Unknown schema" });

    if (!table) {
      const tablesRes = await db.execute(sql`
        SELECT t.table_name,
               (SELECT COUNT(*)::int FROM information_schema.columns c
                 WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS column_count
          FROM information_schema.tables t
         WHERE t.table_schema = ${schema} AND t.table_type = 'BASE TABLE'
         ORDER BY t.table_name
      `);
      const tables = rowsOf(tablesRes).map((r: any) => ({
        name: r.table_name,
        columnCount: Number(r.column_count ?? 0),
      }));
      return res.json({ schema, tables, generatedAt: new Date().toISOString() });
    }

    const [colsRes, fkOutRes, fkInRes, pkRes] = await Promise.all([
      db.execute(sql`
        SELECT column_name, data_type, is_nullable, character_maximum_length
          FROM information_schema.columns
         WHERE table_schema = ${schema} AND table_name = ${table}
         ORDER BY ordinal_position
      `),
      db.execute(sql`
        SELECT kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
          JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = ${schema} AND tc.table_name = ${table}
      `),
      db.execute(sql`
        SELECT tc.table_name AS from_table, kcu.column_name AS from_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
          JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = ${schema} AND ccu.table_name = ${table}
      `),
      db.execute(sql`
        SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ${schema} AND tc.table_name = ${table}
      `),
    ]);

    const pkCols = new Set(rowsOf(pkRes).map((r: any) => r.column_name));
    const fkMap = new Map(
      rowsOf(fkOutRes).map((r: any) => [r.column_name, { table: r.ref_table, column: r.ref_column }]),
    );
    const columns = rowsOf(colsRes).map((r: any) => ({
      name: r.column_name,
      type: r.character_maximum_length ? `${r.data_type}(${r.character_maximum_length})` : r.data_type,
      nullable: r.is_nullable === "YES",
      isPrimaryKey: pkCols.has(r.column_name),
      references: fkMap.get(r.column_name) ?? null,
    }));
    const referencedBy = rowsOf(fkInRes).map((r: any) => ({ table: r.from_table, column: r.from_column }));

    return res.json({ schema, table, columns, referencedBy, generatedAt: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /system-map/schema failed");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
