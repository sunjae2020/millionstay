import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, isNull, inArray } from "drizzle-orm";
import { requireAuth, invalidateUserCache } from "../middlewares/requireAuth";
import { validatePassword } from "../utils/passwordPolicy";
import { logAction } from "../utils/auditLog";
import { revokeAllForUser } from "../lib/refreshTokens";

const router: IRouter = Router();

router.use(requireAuth);

const SUPER_ADMIN = "SuperAdmin";

/* ─── List all admin users ─────────────────────────────── */
router.get("/v1/admin/users", async (req, res): Promise<void> => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        first_name: usersTable.first_name,
        last_name: usersTable.last_name,
        role: usersTable.role,
        is_active: usersTable.is_active,
        status: usersTable.status,
        deleted_at: usersTable.deleted_at,
        last_login_at: usersTable.last_login_at,
        created_at: usersTable.created_at,
      })
      .from(usersTable)
      .where(isNull(usersTable.deleted_at))
      .orderBy(usersTable.created_at);

    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to load users" });
  }
});

/* ─── Create a new admin user (SuperAdmin only) ────────────
   Admin-initiated creation: the account is created active (no
   self-registration / approval step). The recipient is forced to
   change the temporary password on first login.
─────────────────────────────────────────────────────────────── */
router.post("/v1/admin/users", async (req, res): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Only SuperAdmin can create users" });
      return;
    }

    const { email, password, first_name, last_name, role } = req.body as {
      email?: string; password?: string; first_name?: string; last_name?: string; role?: string;
    };

    if (!email || !password || !first_name || !last_name) {
      res.status(400).json({ success: false, error: "Email, password, first name and last name are required." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ success: false, error: "Invalid email address." });
      return;
    }

    // Strip control characters and cap length on user-supplied names.
    const cleanFirst = String(first_name).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 80);
    const cleanLast = String(last_name).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 80);
    if (!cleanFirst || !cleanLast) {
      res.status(400).json({ success: false, error: "Invalid name." });
      return;
    }

    const newRole = role ?? "Admin";
    if (!["SuperAdmin", "Admin", "Viewer"].includes(newRole)) {
      res.status(400).json({ success: false, error: "Invalid role." });
      return;
    }

    const policy = validatePassword(password);
    if (!policy.ok) {
      res.status(400).json({ success: false, error: policy.error });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, cleanEmail))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ success: false, error: "A user with this email already exists." });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [created] = await db.insert(usersTable).values({
      email: cleanEmail,
      password_hash,
      first_name: cleanFirst,
      last_name: cleanLast,
      role: newRole,
      status: "active",
      is_active: true,
      force_password_change: true,
    }).returning({
      id: usersTable.id,
      email: usersTable.email,
      first_name: usersTable.first_name,
      last_name: usersTable.last_name,
      role: usersTable.role,
      is_active: usersTable.is_active,
      status: usersTable.status,
      created_at: usersTable.created_at,
    });

    try {
      await logAction({
        entityType: "admin_user",
        entityId: created.id,
        action: "CREATE",
        actorId: currentUser?.id ?? null,
        actorEmail: currentUser?.email ?? null,
        newValue: { email: cleanEmail, role: newRole },
      });
    } catch {}

    res.status(201).json({ success: true, user: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

/* ─── Update user (status, role, is_active, password) ───────
   SECURITY: Privileged fields (role, is_active, status, password) are
   gated to SuperAdmin only. Regular Admins cannot self-promote, cannot
   reactivate other accounts, and cannot reset another user's password.
─────────────────────────────────────────────────────────────── */
router.patch("/v1/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const currentUser = (req as any).user;

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }

    const isSuperAdmin = currentUser?.role === SUPER_ADMIN;

    const { status, role, is_active, password } = req.body as {
      status?: string;
      role?: string;
      is_active?: boolean;
      password?: string;
    };

    // Determine which fields require SuperAdmin
    const wantsPrivileged =
      role !== undefined ||
      is_active !== undefined ||
      status !== undefined ||
      password !== undefined;

    if (wantsPrivileged && !isSuperAdmin) {
      res.status(403).json({
        success: false,
        error: "Only SuperAdmin can change role, status, activation, or password",
      });
      return;
    }

    // SuperAdmin-only: prevent demoting the last active SuperAdmin / self-lockout
    if (isSuperAdmin && id === currentUser.id) {
      if (role !== undefined && role !== SUPER_ADMIN) {
        res.status(400).json({ success: false, error: "Cannot demote yourself" });
        return;
      }
      if (is_active === false || status === "rejected") {
        res.status(400).json({ success: false, error: "Cannot deactivate yourself" });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!["active", "pending", "rejected"].includes(status)) {
        res.status(400).json({ success: false, error: "Invalid status value" });
        return;
      }
      updates.status = status;
      if (status === "active") updates.is_active = true;
      if (status === "rejected") updates.is_active = false;
    }
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      const policy = validatePassword(password);
      if (!policy.ok) {
        res.status(400).json({ success: false, error: policy.error });
        return;
      }
      updates.password_hash = await bcrypt.hash(password, 12);
      updates.force_password_change = true; // force the recipient to change on next login
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: "No valid fields to update" });
      return;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, id));

    // Audit + token revocation when sensitive fields change
    try {
      await logAction({
        entityType: "admin_user",
        entityId: id,
        action: "UPDATE",
        actorId: currentUser?.id ?? null,
        actorEmail: currentUser?.email ?? null,
        newValue: {
          fields: Object.keys(updates),
          role_changed: role !== undefined,
          password_reset: !!password,
          status_changed: status !== undefined || is_active !== undefined,
        },
      });
    } catch {}

    if (password || is_active === false || status === "rejected") {
      try { await revokeAllForUser(id, "admin"); } catch {}
      invalidateUserCache(id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

/* ─── Bulk delete users (SuperAdmin only) ─────────────────── */
router.post("/v1/admin/users/bulk-delete", async (req, res): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ success: false, error: "Only SuperAdmin can perform bulk delete" }); return;
    }
    const { ids, permanent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: "ids must be a non-empty array" }); return;
    }
    const numIds = ids.map(Number).filter(id => !isNaN(id) && id !== currentUser.id);
    if (numIds.length === 0) {
      res.status(400).json({ success: false, error: "No valid IDs (cannot delete yourself)" }); return;
    }

    // Prevent mass deletion of other SuperAdmins via this endpoint
    const targets = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(inArray(usersTable.id, numIds));
    const superTargets = targets.filter((u) => u.role === SUPER_ADMIN).map((u) => u.id);
    if (superTargets.length > 0) {
      res.status(403).json({
        success: false,
        error: `Cannot delete other SuperAdmin accounts via bulk endpoint (ids: ${superTargets.join(", ")})`,
      });
      return;
    }

    if (permanent) {
      await db.delete(usersTable).where(inArray(usersTable.id, numIds));
    } else {
      await db.update(usersTable).set({ deleted_at: new Date(), is_active: false, status: "archived" }).where(inArray(usersTable.id, numIds));
    }
    // Revoke any active refresh tokens for affected users
    for (const uid of numIds) {
      try { await revokeAllForUser(uid, "admin"); } catch {}
    }
    res.json({ success: true, affected: numIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to bulk delete users" });
  }
});

/* ─── Delete user ────────────────────────────────────────── */
router.delete("/v1/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const currentUser = (req as any).user;

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }
    if (id === currentUser.id) {
      res.status(400).json({ success: false, error: "You cannot delete your own account" });
      return;
    }

    // SuperAdmin required for any deletion (soft or hard)
    if (currentUser?.role !== SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Only SuperAdmin can delete users" });
      return;
    }

    // Prevent removal of another SuperAdmin via this endpoint
    const [target] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (target?.role === SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Cannot delete another SuperAdmin via this endpoint" });
      return;
    }

    const permanent = req.query.permanent === "true";

    if (permanent) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    } else {
      await db.update(usersTable)
        .set({ deleted_at: new Date(), is_active: false, status: "archived" })
        .where(eq(usersTable.id, id));
    }

    try { await revokeAllForUser(id, "admin"); } catch {}

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

export default router;
