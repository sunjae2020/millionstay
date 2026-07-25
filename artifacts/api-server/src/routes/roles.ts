import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rolesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logAction } from "../utils/auditLog";
import { RESOURCES, invalidateRoleCache, type PermLevel } from "../lib/rbac";

// Role & permission-matrix management. Reads are open to any admin (the UI needs
// them); writes are SuperAdmin-only (matches user management). Changing a role
// invalidates the RBAC cache so enforcement picks it up within the request.
const router: IRouter = Router();
router.use("/v1/roles", requireAuth);

const LEVELS: PermLevel[] = ["none", "read", "write"];

function sanitizePermissions(input: unknown): Record<string, PermLevel> {
  const out: Record<string, PermLevel> = {};
  const obj = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  for (const res of RESOURCES) {
    const v = obj[res];
    if (typeof v === "string" && LEVELS.includes(v as PermLevel)) out[res] = v as PermLevel;
  }
  return out;
}

function isSuperAdmin(req: any): boolean {
  return req.user?.role === "SuperAdmin";
}

// List roles (+ the canonical resource list for the matrix UI).
router.get("/v1/roles", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(rolesTable).orderBy(rolesTable.id);
    res.json({ success: true, data: rows, resources: RESOURCES });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Create a custom role (SuperAdmin only).
router.post("/v1/roles", async (req, res): Promise<void> => {
  try {
    if (!isSuperAdmin(req)) { res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Only SuperAdmin can manage roles" } }); return; }
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) { res.status(400).json({ success: false, error: { code: "BAD_NAME", message: "name required" } }); return; }
    const [existing] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, name)).limit(1);
    if (existing) { res.status(409).json({ success: false, error: { code: "DUPLICATE", message: "Role name already exists" } }); return; }
    const [row] = await db.insert(rolesTable).values({
      name,
      description: typeof req.body?.description === "string" ? req.body.description : null,
      is_system: false,
      permissions: sanitizePermissions(req.body?.permissions),
    }).returning();
    invalidateRoleCache();
    void logAction({ entityType: "role", entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { name } });
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Update a role's permissions/description (SuperAdmin only). System roles keep
// their name; permissions are still editable.
router.patch("/v1/roles/:id", async (req, res): Promise<void> => {
  try {
    if (!isSuperAdmin(req)) { res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Only SuperAdmin can manage roles" } }); return; }
    const id = Number(req.params.id);
    const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!role) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Role not found" } }); return; }
    const patch: any = {};
    if (req.body?.permissions !== undefined) patch.permissions = sanitizePermissions(req.body.permissions);
    if (typeof req.body?.description === "string") patch.description = req.body.description;
    if (typeof req.body?.name === "string" && req.body.name.trim() && !role.is_system) patch.name = req.body.name.trim();
    if (Object.keys(patch).length) await db.update(rolesTable).set(patch).where(eq(rolesTable.id, id));
    invalidateRoleCache();
    void logAction({ entityType: "role", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: patch });
    const [updated] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Delete a custom role (SuperAdmin only; system roles protected).
router.delete("/v1/roles/:id", async (req, res): Promise<void> => {
  try {
    if (!isSuperAdmin(req)) { res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Only SuperAdmin can manage roles" } }); return; }
    const id = Number(req.params.id);
    const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!role) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Role not found" } }); return; }
    if (role.is_system) { res.status(409).json({ success: false, error: { code: "SYSTEM_ROLE", message: "System roles cannot be deleted" } }); return; }
    await db.delete(rolesTable).where(eq(rolesTable.id, id));
    invalidateRoleCache();
    void logAction({ entityType: "role", entityId: id, action: "DELETE", actorId: (req as any).user?.id ?? null, newValue: { name: role.name } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

export default router;
