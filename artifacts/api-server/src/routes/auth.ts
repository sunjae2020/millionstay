import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { signJWT, requireAuth } from "../middlewares/requireAuth";
import { sendPasswordResetEmail, sendRegistrationRequestEmail } from "../lib/email";
import {
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllForUser,
} from "../lib/refreshTokens";
import { validatePassword } from "../utils/passwordPolicy";
import { checkLockout, recordAttempt } from "../lib/loginLockout";

function clientMeta(req: any) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const ua = (req.headers["user-agent"] as string | undefined) ?? null;
  return { ipAddress: ip, userAgent: ua };
}

const router: IRouter = Router();

/* ─── Login ──────────────────────────────────────────────── */
router.post("/v1/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const meta0 = clientMeta(req);

    // Sprint B-6: brute-force lockout (5 fails in 15min → 15min cooldown).
    const lock = await checkLockout(email, "admin");
    if (lock.locked) {
      res.setHeader("Retry-After", String(lock.retryAfterSeconds ?? 900));
      res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Please try again in ${Math.ceil((lock.retryAfterSeconds ?? 0) / 60)} minute(s).`,
      });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      await recordAttempt(email, "admin", false, meta0.ipAddress);
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    if (user.deleted_at) {
      await recordAttempt(email, "admin", false, meta0.ipAddress);
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
      await recordAttempt(email, "admin", false, meta0.ipAddress);
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordAttempt(email, "admin", false, meta0.ipAddress);
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    await recordAttempt(email, "admin", true, meta0.ipAddress);

    await db
      .update(usersTable)
      .set({ last_login_at: new Date() })
      .where(eq(usersTable.id, user.id));

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = signJWT(payload);

    if ((req as any).session) {
      (req as any).session.token = token;
    }

    // Sprint A-5: issue a refresh token alongside the access token.
    // Clients may opt-in by calling /v1/auth/refresh before the access token expires.
    const meta = clientMeta(req);
    const refreshToken = await issueRefreshToken({
      userId: user.id,
      userType: "admin",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.json({
      success: true,
      token,
      refresh_token: refreshToken,
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

/* ─── Refresh access token (Sprint A-5) ───────────────────── */
router.post("/v1/auth/refresh", async (req, res): Promise<void> => {
  try {
    const { refresh_token } = req.body as { refresh_token?: string };
    if (!refresh_token) {
      res.status(400).json({ success: false, error: "refresh_token is required" });
      return;
    }

    const verified = await verifyRefreshToken(refresh_token, "admin");
    if (!verified) {
      res.status(401).json({ success: false, error: "Invalid or expired refresh token" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, verified.user_id))
      .limit(1);

    if (!user || !user.is_active || user.deleted_at || user.status !== "active") {
      // Revoke the token so it can't be reused if the account became inactive
      await revokeRefreshToken(refresh_token);
      res.status(401).json({ success: false, error: "Account is no longer active" });
      return;
    }

    const meta = clientMeta(req);
    const newRefresh = await rotateRefreshToken(refresh_token, {
      userId: user.id,
      userType: "admin",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const payload = { id: user.id, email: user.email, role: user.role };
    const newAccess = signJWT(payload);

    if ((req as any).session) {
      (req as any).session.token = newAccess;
    }

    res.json({ success: true, token: newAccess, refresh_token: newRefresh });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Refresh failed" });
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
    const policy = validatePassword(password);
    if (!policy.ok) {
      res.status(400).json({ success: false, error: policy.error });
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
    const policy = validatePassword(password);
    if (!policy.ok) {
      res.status(400).json({ success: false, error: policy.error });
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

    // Sprint A-5: invalidate every refresh token for this user after password reset.
    try {
      await revokeAllForUser(user.id, "admin");
    } catch (err) {
      console.error("Failed to revoke refresh tokens after password reset:", err);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Password reset failed. Please try again." });
  }
});

/* ─── Logout ─────────────────────────────────────────────── */
router.post("/v1/auth/logout", async (req, res): Promise<void> => {
  // Sprint A-5: revoke the supplied refresh token so it cannot be used again.
  const { refresh_token } = (req.body ?? {}) as { refresh_token?: string };
  if (refresh_token) {
    try {
      await revokeRefreshToken(refresh_token);
    } catch (err) {
      console.error("Failed to revoke refresh token on logout:", err);
    }
  }
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
