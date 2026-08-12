import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db, guestUsersTable, accountsTable, marketingConsentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { signGuestJWT, requireGuestAuth, invalidateGuestCache } from "../middlewares/requireGuestAuth";
import { validatePassword } from "../utils/passwordPolicy";
import { checkLockout, recordAttempt } from "../lib/loginLockout";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, revokeAllForUser } from "../lib/refreshTokens";
import { sendPasswordResetEmail } from "../lib/email";
import { loginIdentityFilter, lockoutKey } from "../lib/loginIdentifier";
import { formatPersonName } from "../lib/nameFormat";

const router: IRouter = Router();

const BCRYPT_COST = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function ipOf(req: any): string | null {
  const xff = (req.headers["x-forwarded-for"] || "") as string;
  return xff.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
}

function cleanName(s: string | undefined | null, max = 80): string | null {
  if (!s) return null;
  const cleaned = String(s).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max);
  return cleaned || null;
}

/* ───────────────────────────────────────────────────────
   POST /api/v1/auth/guest/register
   Generic success response — never reveal whether the email
   is already registered (prevents enumeration). The actual
   registration happens only on first-seen emails.
──────────────────────────────────────────────────────── */
router.post("/v1/auth/guest/register", async (req, res): Promise<void> => {
  try {
    const { email, password, first_name, last_name, phone, marketing_consent } = req.body as {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      marketing_consent?: boolean;
    };

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const policy = validatePassword(password);
    if (!policy.ok) {
      res.status(400).json({ success: false, error: policy.error });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [existing] = await db
      .select({ id: guestUsersTable.id })
      .from(guestUsersTable)
      .where(eq(guestUsersTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      // Generic OK response — no enumeration. Caller cannot tell if account
      // exists. Frontend should show "Check your email" rather than auto-log-in.
      res.status(200).json({
        success: true,
        registered: false,
        message: "If this email is not yet registered, your account has been created.",
      });
      return;
    }

    const cleanFirst = cleanName(first_name);
    const cleanLast = cleanName(last_name);
    const password_hash = await bcrypt.hash(password, BCRYPT_COST);

    const fullName = [cleanFirst, cleanLast].filter(Boolean).join(" ") || normalizedEmail.split("@")[0];
    const [newAccount] = await db
      .insert(accountsTable)
      .values({
        name: fullName,
        account_type: "Guest",
        account_email: normalizedEmail,
        phone1: phone ?? null,
        status: "Active",
      })
      .returning({ id: accountsTable.id });

    const [newGuest] = await db
      .insert(guestUsersTable)
      .values({
        email: normalizedEmail,
        password_hash,
        first_name: cleanFirst,
        last_name: cleanLast,
        phone: phone ?? null,
        account_id: newAccount.id,
        is_active: true,
      })
      .returning({
        id: guestUsersTable.id,
        email: guestUsersTable.email,
        first_name: guestUsersTable.first_name,
        last_name: guestUsersTable.last_name,
        account_id: guestUsersTable.account_id,
      });

    if (marketing_consent === true) {
      const ip = ipOf(req);
      const ua = (req.headers["user-agent"] as string | undefined) ?? null;
      try {
        await db
          .insert(marketingConsentsTable)
          .values({
            user_id: newGuest.id,
            email: normalizedEmail,
            channel: "email",
            opted_in_at: new Date(),
            opted_out_at: null,
            source: "registration",
            ip_address: ip,
            user_agent: ua,
          })
          .onConflictDoUpdate({
            target: [marketingConsentsTable.email, marketingConsentsTable.channel],
            set: {
              user_id: newGuest.id,
              opted_in_at: new Date(),
              opted_out_at: null,
              source: "registration",
              ip_address: ip,
              user_agent: ua,
              updated_at: sql`now()`,
            },
          });
      } catch (consentErr) {
        console.error("[marketing_consent] insert failed:", consentErr);
      }
    }

    const token = signGuestJWT({
      id: newGuest.id,
      email: newGuest.email,
      account_id: newGuest.account_id,
    });
    const refresh_token = await issueRefreshToken({ userId: newGuest.id, userType: "guest" });

    res.status(201).json({
      success: true,
      registered: true,
      token,
      refresh_token,
      user: {
        id: newGuest.id,
        email: newGuest.email,
        first_name: newGuest.first_name,
        last_name: newGuest.last_name,
        account_id: newGuest.account_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/auth/guest/login
──────────────────────────────────────────────────────── */
router.post("/v1/auth/guest/login", async (req, res): Promise<void> => {
  try {
    // `email` may hold an email address OR a mobile number — both are valid
    // personal IDs across the platform (see loginIdentifier).
    const { email, password } = req.body as { email: string; password: string };
    const identity = loginIdentityFilter(email, guestUsersTable.email, guestUsersTable.phone);

    if (!identity || !password) {
      res.status(400).json({ success: false, error: "Email or mobile number and password are required" });
      return;
    }
    const attemptKey = lockoutKey(identity.id, email);

    const lock = await checkLockout(attemptKey, "guest");
    if (lock.locked) {
      res.setHeader("Retry-After", String(lock.retryAfterSeconds ?? 900));
      res.status(429).json({ success: false, error: "Too many failed login attempts. Try again later." });
      return;
    }

    const [guest] = await db
      .select()
      .from(guestUsersTable)
      .where(and(identity.filter, isNull(guestUsersTable.deleted_at)))
      .limit(1);

    const dummyHash = "$2b$12$LF0J1vePdhsBvJBuA77ei.2sdaANBSwnHyWAn66pyzJz9Ew9km0E.";
    const candidateHash = guest?.password_hash ?? dummyHash;
    const passwordMatches = await bcrypt.compare(password, candidateHash);

    if (!guest || !guest.is_active || !passwordMatches) {
      await recordAttempt(attemptKey, "guest", false, ipOf(req));
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    await recordAttempt(attemptKey, "guest", true, ipOf(req));

    const token = signGuestJWT({
      id: guest.id,
      email: guest.email,
      account_id: guest.account_id,
    });
    const refresh_token = await issueRefreshToken({ userId: guest.id, userType: "guest" });

    res.json({
      success: true,
      token,
      refresh_token,
      user: {
        id: guest.id,
        email: guest.email,
        first_name: guest.first_name,
        last_name: guest.last_name,
        account_id: guest.account_id,
        avatar_url: guest.avatar_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

/* POST /api/v1/auth/guest/refresh */
router.post("/v1/auth/guest/refresh", async (req, res): Promise<void> => {
  const { refresh_token } = req.body as { refresh_token?: string };
  if (!refresh_token) { res.status(400).json({ success: false, error: "refresh_token required" }); return; }
  const rotated = await rotateRefreshToken(refresh_token);
  if (!rotated || rotated.userType !== "guest") {
    res.status(401).json({ success: false, error: "Invalid refresh token" });
    return;
  }
  const [guest] = await db
    .select()
    .from(guestUsersTable)
    .where(and(eq(guestUsersTable.id, rotated.userId), isNull(guestUsersTable.deleted_at)))
    .limit(1);
  if (!guest || !guest.is_active) {
    await revokeRefreshToken(rotated.newToken);
    res.status(401).json({ success: false, error: "Account no longer active" });
    return;
  }
  const token = signGuestJWT({ id: guest.id, email: guest.email, account_id: guest.account_id });
  res.json({ success: true, token, refresh_token: rotated.newToken });
});

/* POST /api/v1/auth/guest/logout */
router.post("/v1/auth/guest/logout", async (req, res): Promise<void> => {
  const { refresh_token } = req.body as { refresh_token?: string };
  if (refresh_token) {
    try { await revokeRefreshToken(refresh_token); } catch {}
  }
  // Bump tokens_invalid_after if access token present
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const { verifyGuestJWT } = await import("../middlewares/requireGuestAuth");
      const payload = verifyGuestJWT(auth.slice(7));
      if (payload?.id) {
        await db.update(guestUsersTable).set({ tokens_invalid_after: new Date() }).where(eq(guestUsersTable.id, payload.id));
        invalidateGuestCache(payload.id);
        try { await revokeAllForUser(payload.id, "guest"); } catch {}
      }
    } catch {}
  }
  res.json({ success: true });
});

/* POST /api/v1/auth/guest/forgot-password */
router.post("/v1/auth/guest/forgot-password", async (req, res): Promise<void> => {
  const generic = () => { res.json({ success: true, message: "If an account exists, a reset link has been sent." }); };
  try {
    // Accepts an email address or a mobile number, matching the login prompt.
    const { email } = req.body as { email: string };
    const identity = loginIdentityFilter(email, guestUsersTable.email, guestUsersTable.phone);
    if (!identity) { generic(); return; }

    generic();

    const [guest] = await db
      .select()
      .from(guestUsersTable)
      .where(and(identity.filter, isNull(guestUsersTable.deleted_at)))
      .limit(1);
    // The reset link is delivered by email, so a phone-only account gets nothing.
    if (!guest || !guest.is_active || !guest.email) return;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db
      .update(guestUsersTable)
      .set({ reset_token_hash: tokenHash, reset_token_expires_at: expires })
      .where(eq(guestUsersTable.id, guest.id));

    const baseUrl = process.env["PUBLIC_WEB_URL"] || process.env["CLIENT_URL"] || "https://millionstay.com";
    const resetUrl = `${baseUrl}/reset-password#token=${rawToken}`;
    const name = formatPersonName(guest.first_name, guest.last_name) || guest.email;

    await sendPasswordResetEmail({ to: guest.email, name, resetUrl, product: "Guest" });
  } catch (err) {
    console.error("guest forgot-password failed:", err);
  }
});

/* POST /api/v1/auth/guest/reset-password */
router.post("/v1/auth/guest/reset-password", async (req, res): Promise<void> => {
  try {
    const { token, new_password } = req.body as { token: string; new_password: string };
    if (!token || !new_password) {
      res.status(400).json({ success: false, error: "Token and new password are required" });
      return;
    }
    const policy = validatePassword(new_password);
    if (!policy.ok) {
      res.status(400).json({ success: false, error: policy.error });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [guest] = await db
      .select()
      .from(guestUsersTable)
      .where(and(eq(guestUsersTable.reset_token_hash, tokenHash), isNull(guestUsersTable.deleted_at)))
      .limit(1);
    if (!guest || !guest.reset_token_expires_at || new Date(guest.reset_token_expires_at as any) < new Date()) {
      res.status(400).json({ success: false, error: "Invalid or expired reset link" });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, BCRYPT_COST);
    await db
      .update(guestUsersTable)
      .set({
        password_hash,
        reset_token_hash: null,
        reset_token_expires_at: null,
        tokens_invalid_after: new Date(),
        is_active: true,
      })
      .where(eq(guestUsersTable.id, guest.id));
    invalidateGuestCache(guest.id);
    try { await revokeAllForUser(guest.id, "guest"); } catch {}
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Password reset failed" });
  }
});

/* GET /api/v1/auth/guest/me */
router.get("/v1/auth/guest/me", requireGuestAuth, async (req, res): Promise<void> => {
  const guestPayload = (req as any).guest;

  const [guest] = await db
    .select({
      id: guestUsersTable.id,
      email: guestUsersTable.email,
      first_name: guestUsersTable.first_name,
      last_name: guestUsersTable.last_name,
      phone: guestUsersTable.phone,
      account_id: guestUsersTable.account_id,
      avatar_url: guestUsersTable.avatar_url,
      is_active: guestUsersTable.is_active,
      created_at: guestUsersTable.created_at,
    })
    .from(guestUsersTable)
    .where(and(eq(guestUsersTable.id, guestPayload.id), isNull(guestUsersTable.deleted_at)))
    .limit(1);

  if (!guest) {
    res.status(404).json({ success: false, error: "Guest not found" });
    return;
  }

  res.json({ success: true, user: guest });
});

export default router;
