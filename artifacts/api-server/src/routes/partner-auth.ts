import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db, partnerUsersTable, accountsTable } from "@workspace/db";
import { signPartnerJWT, requirePartnerAuth, invalidatePartnerCache, type PartnerAuthPayload, type PortalType } from "../middlewares/requirePartnerAuth";
import { validatePassword } from "../utils/passwordPolicy";
import { checkLockout, recordAttempt } from "../lib/loginLockout";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, revokeAllForUser } from "../lib/refreshTokens";
import { issuePartnerResetLink, PORTAL_TYPES, BCRYPT_COST } from "../lib/partnerPortal";
import { loginIdentityFilter, lockoutKey } from "../lib/loginIdentifier";

const router: IRouter = Router();

const ALLOWED_PORTAL_TYPES = new Set<string>(PORTAL_TYPES);

function ipOf(req: any): string {
  const xff = (req.headers["x-forwarded-for"] || "") as string;
  return xff.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

/* POST /api/v1/auth/partner/login */
router.post("/v1/auth/partner/login", async (req, res): Promise<void> => {
  try {
    // `email` is the historical field name; the value may be an email address
    // OR a mobile number — both are valid personal IDs (see loginIdentifier).
    const { email, password } = req.body as { email: string; password: string };
    const identity = loginIdentityFilter(email, partnerUsersTable.email, partnerUsersTable.phone);
    if (!identity || !password) {
      res.status(400).json({ success: false, error: "Email or mobile number and password are required" });
      return;
    }
    const attemptKey = lockoutKey(identity.id, email);

    const lockout = await checkLockout(attemptKey, "partner");
    if (lockout.locked) {
      res.setHeader("Retry-After", String(lockout.retryAfterSeconds ?? 900));
      res.status(429).json({ success: false, error: "Too many failed attempts. Try again later." });
      return;
    }

    const [user] = await db
      .select()
      .from(partnerUsersTable)
      .where(and(identity.filter, isNull(partnerUsersTable.deleted_at)))
      .limit(1);

    const valid = user && user.is_active && (await bcrypt.compare(password, user.password_hash));

    if (!valid) {
      await recordAttempt(attemptKey, "partner", false, ipOf(req));
      // Generic message to prevent enumeration
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    if (!ALLOWED_PORTAL_TYPES.has(user.portal_type)) {
      // Misconfigured account — refuse to issue a token rather than emit garbage portal_type
      res.status(403).json({ success: false, error: "Account not configured" });
      return;
    }

    await recordAttempt(attemptKey, "partner", true, ipOf(req));
    await db
      .update(partnerUsersTable)
      .set({ last_login_at: new Date() })
      .where(eq(partnerUsersTable.id, user.id));

    const token = signPartnerJWT({
      id: user.id,
      email: user.email,
      account_id: user.account_id,
      portal_type: user.portal_type as PortalType,
    });
    const refresh_token = await issueRefreshToken({ userId: user.id, userType: "partner" });

    res.json({
      success: true,
      token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        portal_type: user.portal_type,
        account_id: user.account_id,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

/* POST /api/v1/auth/partner/refresh */
router.post("/v1/auth/partner/refresh", async (req, res): Promise<void> => {
  const { refresh_token } = req.body as { refresh_token?: string };
  if (!refresh_token) { res.status(400).json({ success: false, error: "refresh_token required" }); return; }
  const rotated = await rotateRefreshToken(refresh_token);
  if (!rotated || rotated.userType !== "partner") {
    res.status(401).json({ success: false, error: "Invalid refresh token" });
    return;
  }
  const [user] = await db
    .select()
    .from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.id, rotated.userId), isNull(partnerUsersTable.deleted_at)))
    .limit(1);
  if (!user || !user.is_active || !ALLOWED_PORTAL_TYPES.has(user.portal_type)) {
    res.status(401).json({ success: false, error: "Invalid refresh token" });
    return;
  }
  const token = signPartnerJWT({
    id: user.id,
    email: user.email,
    account_id: user.account_id,
    portal_type: user.portal_type as PortalType,
  });
  res.json({ success: true, token, refresh_token: rotated.newToken });
});

/* POST /api/v1/auth/partner/logout */
router.post("/v1/auth/partner/logout", async (req, res): Promise<void> => {
  const { refresh_token } = req.body as { refresh_token?: string };
  if (refresh_token) {
    try { await revokeRefreshToken(refresh_token); } catch {}
  }
  res.json({ success: true });
});

/* GET /api/v1/auth/partner/me */
router.get("/v1/auth/partner/me", requirePartnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const [user] = await db
    .select({
      id: partnerUsersTable.id,
      email: partnerUsersTable.email,
      first_name: partnerUsersTable.first_name,
      last_name: partnerUsersTable.last_name,
      phone: partnerUsersTable.phone,
      portal_type: partnerUsersTable.portal_type,
      account_id: partnerUsersTable.account_id,
      avatar_url: partnerUsersTable.avatar_url,
      is_active: partnerUsersTable.is_active,
      last_login_at: partnerUsersTable.last_login_at,
    })
    .from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.id, partner.id), isNull(partnerUsersTable.deleted_at)))
    .limit(1);

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name, account_type: accountsTable.account_type })
    .from(accountsTable)
    .where(eq(accountsTable.id, user.account_id))
    .limit(1);

  res.json({ success: true, user: { ...user, account } });
});

/* POST /api/v1/auth/partner/change-password */
router.post("/v1/auth/partner/change-password", requirePartnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const { current_password, new_password } = req.body as { current_password: string; new_password: string };
  if (!current_password || !new_password) {
    res.status(400).json({ success: false, error: "Both current and new password required" });
    return;
  }
  const policy = validatePassword(new_password);
  if (!policy.ok) {
    res.status(400).json({ success: false, error: policy.error });
    return;
  }
  const [user] = await db.select().from(partnerUsersTable).where(eq(partnerUsersTable.id, partner.id)).limit(1);
  if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) { res.status(400).json({ success: false, error: "Current password is incorrect" }); return; }
  const password_hash = await bcrypt.hash(new_password, BCRYPT_COST);
  await db
    .update(partnerUsersTable)
    .set({ password_hash, tokens_invalid_after: new Date() })
    .where(eq(partnerUsersTable.id, partner.id));
  invalidatePartnerCache(partner.id);
  try { await revokeAllForUser(partner.id, "partner"); } catch {}
  res.json({ success: true, message: "Password changed successfully" });
});

/* POST /api/v1/auth/partner/forgot-password
   Generic success response — no account enumeration. */
router.post("/v1/auth/partner/forgot-password", async (req, res): Promise<void> => {
  // Accepts an email address or a mobile number, matching the login prompt.
  // The reset link is always delivered by email, so an account identified by
  // phone but holding no email address simply gets nothing (still a 200).
  const { email } = req.body as { email: string };
  const identity = loginIdentityFilter(email, partnerUsersTable.email, partnerUsersTable.phone);
  // Always return success regardless of whether the account exists.
  res.json({ success: true, message: "If an account exists, a reset link has been sent." });
  if (!identity) return;

  try {
    const [user] = await db
      .select()
      .from(partnerUsersTable)
      .where(and(identity.filter, isNull(partnerUsersTable.deleted_at)))
      .limit(1);
    if (!user || !user.is_active || !user.email) return;

    await issuePartnerResetLink(user);
  } catch (err) {
    console.error("Partner forgot-password failed:", err);
  }
});

/* POST /api/v1/auth/partner/reset-password */
router.post("/v1/auth/partner/reset-password", async (req, res): Promise<void> => {
  const { token, new_password } = req.body as { token: string; new_password: string };
  if (!token || !new_password) { res.status(400).json({ success: false, error: "Invalid request" }); return; }
  const policy = validatePassword(new_password);
  if (!policy.ok) { res.status(400).json({ success: false, error: policy.error }); return; }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [user] = await db
    .select()
    .from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.reset_token_hash, tokenHash), isNull(partnerUsersTable.deleted_at)))
    .limit(1);
  if (!user || !user.reset_token_expires_at || new Date(user.reset_token_expires_at as any) < new Date()) {
    res.status(400).json({ success: false, error: "Invalid or expired reset token" });
    return;
  }

  const password_hash = await bcrypt.hash(new_password, BCRYPT_COST);
  await db
    .update(partnerUsersTable)
    .set({
      password_hash,
      reset_token_hash: null,
      reset_token_expires_at: null,
      tokens_invalid_after: new Date(),
      is_active: true,
    })
    .where(eq(partnerUsersTable.id, user.id));
  invalidatePartnerCache(user.id);
  try { await revokeAllForUser(user.id, "partner"); } catch {}
  res.json({ success: true });
});

export default router;
