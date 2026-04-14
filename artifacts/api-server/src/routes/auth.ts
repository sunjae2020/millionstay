import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { signJWT, requireAuth } from "../middlewares/requireAuth";
import { sendPasswordResetEmail, sendRegistrationRequestEmail } from "../lib/email";

const router: IRouter = Router();

/* ─── Login ──────────────────────────────────────────────── */
router.post("/v1/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    if (user.deleted_at) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    if (user.status === "pending") {
      res.status(403).json({ success: false, error: "Your account is pending admin approval. You will be notified once it is activated." });
      return;
    }

    if (user.status === "rejected") {
      res.status(403).json({ success: false, error: "Your account request was not approved. Please contact an administrator." });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    await db
      .update(usersTable)
      .set({ last_login_at: new Date() })
      .where(eq(usersTable.id, user.id));

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = signJWT(payload);

    if ((req as any).session) {
      (req as any).session.token = token;
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        force_password_change: user.force_password_change,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

/* ─── Register (request access) ─────────────────────────── */
router.post("/v1/auth/register", async (req, res): Promise<void> => {
  try {
    const { email, password, first_name, last_name } = req.body as {
      email: string; password: string; first_name: string; last_name: string;
    };

    if (!email || !password || !first_name || !last_name) {
      res.status(400).json({ success: false, error: "All fields are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: "Password must be at least 8 characters." });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ success: false, error: "An account with this email already exists." });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      password_hash,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      role: "Admin",
      status: "pending",
      is_active: false,
    });

    // Notify all super-admin users by email
    const adminPanelUrl = process.env.CLIENT_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:23339"}/admin`;
    try {
      const superAdmins = await db
        .select({ email: usersTable.email, first_name: usersTable.first_name })
        .from(usersTable)
        .where(and(eq(usersTable.role, "SuperAdmin"), eq(usersTable.status, "active")));
      for (const admin of superAdmins) {
        await sendRegistrationRequestEmail(admin.email, `${first_name} ${last_name}`, adminPanelUrl);
      }
    } catch {}

    res.json({ success: true, message: "Account request submitted. You will be notified once an admin approves it." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Registration failed. Please try again." });
  }
});

/* ─── Forgot password ────────────────────────────────────── */
router.post("/v1/auth/forgot-password", async (req, res): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    if (!email) {
      res.status(400).json({ success: false, error: "Email is required." });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always respond with success to prevent email enumeration
    if (!user || user.status !== "active" || !user.is_active) {
      res.json({ success: true });
      return;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(usersTable)
      .set({ reset_token: token, reset_token_expires_at: expiresAt })
      .where(eq(usersTable.id, user.id));

    const adminBase = process.env.CLIENT_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:23339"}/admin`;
    const resetUrl = `${adminBase}/reset-password?token=${token}`;
    const name = `${user.first_name} ${user.last_name}`.trim() || user.email;

    await sendPasswordResetEmail(user.email, name, resetUrl);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to process request. Please try again." });
  }
});

/* ─── Reset password ─────────────────────────────────────── */
router.post("/v1/auth/reset-password", async (req, res): Promise<void> => {
  try {
    const { token, password } = req.body as { token: string; password: string };

    if (!token || !password) {
      res.status(400).json({ success: false, error: "Token and new password are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: "Password must be at least 8 characters." });
      return;
    }

    const now = new Date();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.reset_token, token),
          gt(usersTable.reset_token_expires_at, now)
        )
      )
      .limit(1);

    if (!user) {
      res.status(400).json({ success: false, error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    await db
      .update(usersTable)
      .set({ password_hash, reset_token: null, reset_token_expires_at: null, force_password_change: false })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Password reset failed. Please try again." });
  }
});

/* ─── Logout ─────────────────────────────────────────────── */
router.post("/v1/auth/logout", (req, res): void => {
  if ((req as any).session) {
    (req as any).session.destroy(() => {});
  }
  res.json({ success: true });
});

/* ─── Me ─────────────────────────────────────────────────── */
router.get("/v1/auth/me", requireAuth, (req, res): void => {
  res.json({ success: true, user: (req as any).user });
});

export default router;
