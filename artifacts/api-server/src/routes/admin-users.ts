import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

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
        last_login_at: usersTable.last_login_at,
        created_at: usersTable.created_at,
      })
      .from(usersTable)
      .orderBy(usersTable.created_at);

    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to load users" });
  }
});

/* ─── Update user (status, role, is_active) ─────────────── */
router.patch("/v1/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const currentUser = (req as any).user;

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }

    const { status, role, is_active, password } = req.body as {
      status?: string;
      role?: string;
      is_active?: boolean;
      password?: string;
    };

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
      updates.password_hash = await bcrypt.hash(password, 12);
      updates.force_password_change = false;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: "No valid fields to update" });
      return;
    }

    await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update user" });
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

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

export default router;
