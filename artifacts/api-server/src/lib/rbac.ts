import { db, rolesTable } from "@workspace/db";

// RBAC enforcement helpers (data-driven; see lib/db/src/schema/roles.ts).
//
// Design is FAIL-OPEN so the matrix can only ever ADD restrictions and never
// locks an admin out by omission:
//   - SuperAdmin bypasses everything.
//   - An unknown role (not in the roles table) → allowed.
//   - A route whose path maps to no resource → allowed.
//   - A resource left unset in the role's map → allowed.
// Restrictions apply only where a role EXPLICITLY sets read/none on a resource
// that a route maps to. The Viewer hard-coded gate in requireAuth remains as a
// belt-and-suspenders safety net independent of this table.

export type PermLevel = "none" | "read" | "write";
const LEVEL_RANK: Record<PermLevel, number> = { none: 0, read: 1, write: 2 };

// Canonical resource domains. Keep in sync with the seed in 0008_roles_rbac.sql
// and the admin Roles UI.
export const RESOURCES = [
  "dashboard", "bookings", "contracts", "finance", "crm", "properties",
  "cs", "maintenance", "products", "promotions", "services", "documents",
  "content", "operations", "users", "settings",
] as const;
export type Resource = (typeof RESOURCES)[number];

// Longest-prefix-wins map from a request path (after /api/v1) to a resource.
// Order matters: more specific prefixes first.
const PREFIX_MAP: Array<[string, Resource]> = [
  ["/v1/admin-users", "users"],
  ["/v1/roles", "users"],
  ["/v1/accounting-periods", "finance"],
  ["/v1/fixed-assets", "finance"],
  ["/v1/transactions", "finance"],
  ["/v1/payment-schedules", "finance"],
  ["/v1/invoices", "finance"],
  ["/v1/receipts", "finance"],
  ["/v1/journal", "finance"],
  ["/v1/exchange-rate", "finance"],
  ["/v1/recurring-schedules", "finance"],
  ["/v1/quotes", "documents"],
  ["/v1/document", "documents"],
  ["/v1/help-docs", "documents"],
  ["/v1/contract-types", "contracts"],
  ["/v1/contract-products", "contracts"],
  ["/v1/contracts", "contracts"],
  ["/v1/bookings", "bookings"],
  ["/v1/condition-reports", "operations"],
  ["/v1/deposit-settlements", "operations"],
  ["/v1/contacts", "crm"],
  ["/v1/leads", "crm"],
  ["/v1/accounts", "crm"],
  ["/v1/tasks", "crm"],
  // Marketing (prospects/lists/campaigns) operates on the CRM's people data.
  ["/v1/marketing", "crm"],
  // AI ops (providers/keys/task models/usage) is managed at Settings → AI.
  ["/v1/ai", "settings"],
  // External-API key management lives at Settings → API Keys. (The /api/ext
  // runtime surface authenticates with its own key+secret, not admin JWTs.)
  ["/v1/api-credentials", "settings"],
  // Bank-account / payment-destination registry — financial master data, same
  // bucket as invoices/exchange-rate even though its page sits under Settings.
  ["/v1/payment-info", "finance"],
  ["/v1/properties", "properties"],
  ["/v1/spaces", "properties"],
  ["/v1/space", "properties"],
  ["/v1/cs", "cs"],
  ["/v1/work-orders", "maintenance"],
  ["/v1/service-hosts", "maintenance"],
  ["/v1/product-groups", "products"],
  ["/v1/products", "products"],
  ["/v1/promotions", "promotions"],
  ["/v1/services", "services"],
  ["/v1/page-contents", "content"],
  ["/v1/blog", "content"],
  ["/v1/knowledge", "content"],
  // 시스템 로그(감사 원장 + 활동 로그) — Settings 하위 화면이고 관리자 전용이다.
  ["/v1/system-logs", "settings"],
  ["/v1/branding", "settings"],
  ["/v1/settings", "settings"],
];

export function resourceForPath(path: string): Resource | null {
  for (const [prefix, resource] of PREFIX_MAP) {
    if (path === prefix || path.startsWith(prefix + "/")) return resource;
  }
  return null;
}

// ── Fail-open visibility ─────────────────────────────────────────────────────
// The allow-by-default paths above are deliberate (see the header comment), but
// they must be VISIBLE, not silent: an admin router someone forgets to add to
// PREFIX_MAP would otherwise bypass the matrix forever without a trace. Each
// distinct condition is logged once per process so the log stays readable.
const warnedFallbacks = new Set<string>();
function warnFailOpen(key: string, message: string): void {
  if (warnedFallbacks.has(key)) return;
  if (warnedFallbacks.size < 500) warnedFallbacks.add(key); // bound memory
  console.warn(`[rbac] WARN fail-open: ${message} — request allowed by design (lib/rbac.ts)`);
}

// ── Role permission cache ────────────────────────────────────────────────────
type RoleCacheEntry = { permissions: Record<string, PermLevel> };
let roleCache: Map<string, RoleCacheEntry> | null = null;
let roleCacheExpires = 0;
const ROLE_CACHE_TTL_MS = 30 * 1000;

export function invalidateRoleCache(): void {
  roleCache = null;
  roleCacheExpires = 0;
}

async function loadRoles(): Promise<Map<string, RoleCacheEntry>> {
  const now = Date.now();
  if (roleCache && roleCacheExpires > now) return roleCache;
  const map = new Map<string, RoleCacheEntry>();
  try {
    const rows = await db.select().from(rolesTable);
    for (const r of rows) {
      map.set(r.name, { permissions: (r.permissions as Record<string, PermLevel>) ?? {} });
    }
    roleCache = map;
    roleCacheExpires = now + ROLE_CACHE_TTL_MS;
  } catch (err) {
    // Table may not exist yet (migration not applied) or the DB blipped — fail
    // open with the stale cache (or an empty map) rather than lock admins out.
    console.warn(
      `[rbac] WARN fail-open: roles table unreadable (${err instanceof Error ? err.message : String(err)}) — ` +
      `using ${roleCache ? "stale cached" : "empty"} permission map`,
    );
    return roleCache ?? map;
  }
  return map;
}

/**
 * Decide whether `roleName` may perform `method` on `path`. Returns true (allow)
 * unless the role explicitly lacks the required level on a mapped resource.
 */
export async function isAllowed(roleName: string, method: string, path: string): Promise<boolean> {
  if (roleName === "SuperAdmin") return true;
  const resource = resourceForPath(path);
  if (!resource) {
    // Key on the first two path segments so ids don't fan out the warn set.
    const prefix = path.split("/").slice(0, 3).join("/");
    warnFailOpen(`unmapped:${prefix}`, `no PREFIX_MAP entry for "${prefix}"`);
    return true; // unmapped route → allow
  }

  const roles = await loadRoles();
  const role = roles.get(roleName);
  if (!role) {
    warnFailOpen(`role:${roleName}`, `role "${roleName}" not found in roles table`);
    return true; // unknown role → allow
  }

  const have = role.permissions[resource];
  if (have === undefined) return true; // unset resource → allow

  const isSafe = method === "GET" || method === "HEAD" || method === "OPTIONS";
  const required: PermLevel = isSafe ? "read" : "write";
  return LEVEL_RANK[have] >= LEVEL_RANK[required];
}

/**
 * The role names that actually exist in `roles` — the single source of truth for
 * what may be written to `admin_users.role`. A near-miss like "Super Admin"
 * (space) is a different string from "SuperAdmin" and silently loses every
 * privilege gate, so assignment is validated against this list rather than
 * being trusted from the client. Falls back to the built-ins when `roles` is
 * unreadable, so role assignment keeps working on an instance without the table.
 */
export async function knownRoleNames(): Promise<string[]> {
  const roles = await loadRoles();
  const names = [...roles.keys()];
  return names.length > 0 ? names : ["SuperAdmin", "Admin", "Viewer"];
}
