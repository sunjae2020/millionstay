// Passkey (WebAuthn) login for all three audiences.
//
// Passkeys are ADDITIVE: every account keeps its password, and a user may
// register several devices. Registration requires an already-authenticated
// session (you prove who you are with the password once, then never again on
// that device); login is discoverable-credential based, so the user taps the
// button and picks a passkey without typing an identifier.
//
// Mounted before the admin `requireAuth` guard in app.ts because the login
// half must be reachable unauthenticated and the register half authenticates
// itself against whichever of the three token scopes the caller presents.
import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db, usersTable, partnerUsersTable, guestUsersTable, webauthnCredentialsTable } from "@workspace/db";
import { signJWT, verifyJWT } from "../middlewares/requireAuth";
import { signPartnerJWT, verifyPartnerJWT, type PortalType } from "../middlewares/requirePartnerAuth";
import { signGuestJWT, verifyGuestJWT } from "../middlewares/requireGuestAuth";
import { issueRefreshToken } from "../lib/refreshTokens";
import { PORTAL_TYPES } from "../lib/partnerPortal";
import { formatPersonName } from "../lib/nameFormat";
import { logAction } from "../utils/auditLog";
import {
  resolveRp,
  storeChallenge,
  consumeChallenge,
  listCredentials,
  findCredentialById,
  parseTransports,
  userHandle,
  deviceNameFromUserAgent,
  isPasskeyAudience,
  MAX_CREDENTIALS_PER_USER,
  type PasskeyAudience,
} from "../lib/webauthn";

const router: IRouter = Router();

const ALLOWED_PORTAL_TYPES = new Set<string>(PORTAL_TYPES);

function fail(res: any, status: number, code: string, message: string): void {
  res.status(status).json({ success: false, error: { code, message }, message });
}

function bearer(req: any): string | null {
  const h = req.headers?.authorization;
  if (typeof h !== "string" || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

type Caller = {
  audience: PasskeyAudience;
  id: number;
  userName: string;
  displayName: string;
};

/**
 * Who is calling? The three token scopes use three separate secrets, so trying
 * them in turn is unambiguous — a token only verifies under its own scope.
 */
async function resolveCaller(req: any): Promise<Caller | null> {
  const token = bearer(req);
  if (!token) return null;

  try {
    const payload = verifyJWT(token);
    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, payload.id), isNull(usersTable.deleted_at)))
      .limit(1);
    if (user && user.is_active && user.status === "active") {
      return {
        audience: "admin",
        id: user.id,
        userName: user.email,
        displayName: formatPersonName(user.first_name, user.last_name) || user.email,
      };
    }
    return null;
  } catch { /* not an admin token */ }

  try {
    const payload = verifyPartnerJWT(token);
    const [user] = await db
      .select()
      .from(partnerUsersTable)
      .where(and(eq(partnerUsersTable.id, payload.id), isNull(partnerUsersTable.deleted_at)))
      .limit(1);
    if (user && user.is_active && ALLOWED_PORTAL_TYPES.has(user.portal_type)) {
      return {
        audience: "partner",
        id: user.id,
        userName: user.email,
        displayName: formatPersonName(user.first_name, user.last_name) || user.email,
      };
    }
    return null;
  } catch { /* not a partner token */ }

  try {
    const payload = verifyGuestJWT(token);
    const [user] = await db
      .select()
      .from(guestUsersTable)
      .where(and(eq(guestUsersTable.id, payload.id), isNull(guestUsersTable.deleted_at)))
      .limit(1);
    if (user && user.is_active) {
      return {
        audience: "guest",
        id: user.id,
        userName: user.email,
        displayName: formatPersonName(user.first_name, user.last_name) || user.email,
      };
    }
  } catch { /* not a guest token */ }

  return null;
}

/* ── Registration ──────────────────────────────────────────────────────── */

/** POST /api/v1/auth/passkey/register/options */
router.post("/v1/auth/passkey/register/options", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { fail(res, 401, "UNAUTHORIZED", "Sign in first to add a passkey"); return; }
    const rp = resolveRp(req);
    if (!rp) { fail(res, 400, "BAD_ORIGIN", "Unrecognised origin"); return; }

    const existing = await listCredentials(caller.audience, caller.id);
    if (existing.length >= MAX_CREDENTIALS_PER_USER) {
      fail(res, 409, "TOO_MANY", `A maximum of ${MAX_CREDENTIALS_PER_USER} passkeys can be registered`);
      return;
    }

    const options = await generateRegistrationOptions({
      rpName: rp.rpName,
      rpID: rp.rpID,
      userName: caller.userName,
      userDisplayName: caller.displayName,
      userID: userHandle(caller.audience, caller.id),
      attestationType: "none",
      // Same device, same account → replace rather than pile up duplicates.
      excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) })),
      authenticatorSelection: {
        // A discoverable credential is what makes "just tap the button" login
        // work — without it the browser has nothing to offer before we know
        // who the user is.
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const challengeId = await storeChallenge({
      challenge: options.challenge,
      purpose: "register",
      userType: caller.audience,
      userId: caller.id,
      rpID: rp.rpID,
    });

    res.json({ success: true, data: { challenge_id: challengeId, options } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err?.message ?? "Failed to start passkey registration");
  }
});

/** POST /api/v1/auth/passkey/register/verify */
router.post("/v1/auth/passkey/register/verify", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { fail(res, 401, "UNAUTHORIZED", "Sign in first to add a passkey"); return; }
    const rp = resolveRp(req);
    if (!rp) { fail(res, 400, "BAD_ORIGIN", "Unrecognised origin"); return; }

    const { challenge_id, response, device_name } = req.body ?? {};
    const expectedChallenge = await consumeChallenge({
      id: Number(challenge_id),
      purpose: "register",
      userType: caller.audience,
      userId: caller.id,
    });
    if (!expectedChallenge) { fail(res, 400, "CHALLENGE_EXPIRED", "Passkey registration expired — try again"); return; }
    if (!response) { fail(res, 400, "NO_RESPONSE", "Missing authenticator response"); return; }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) {
      fail(res, 400, "NOT_VERIFIED", "Passkey could not be verified");
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const publicKey = Buffer.from(credential.publicKey).toString("base64url");
    const transports = credential.transports?.join(",") ?? null;
    const label = (typeof device_name === "string" && device_name.trim())
      ? device_name.trim().slice(0, 60)
      : deviceNameFromUserAgent(req.headers["user-agent"] as string | undefined);

    // Re-registering the same authenticator refreshes the row rather than
    // colliding on the unique credential_id.
    const existing = await findCredentialById(credential.id);
    if (existing) {
      if (existing.user_type !== caller.audience || existing.user_id !== caller.id) {
        fail(res, 409, "IN_USE", "This passkey is already registered to another account");
        return;
      }
      const [updated] = await db
        .update(webauthnCredentialsTable)
        .set({
          public_key: publicKey,
          counter: credential.counter,
          transports,
          device_type: credentialDeviceType,
          backed_up: credentialBackedUp,
          rp_id: rp.rpID,
          device_name: label,
          deleted_at: null,
        })
        .where(eq(webauthnCredentialsTable.id, existing.id))
        .returning();
      // 자격증명 변경은 감사 대상이다 — 누가 언제 어떤 기기를 붙였는지 남는다.
      void logAction({
        entityType: `${caller.audience}_passkey`,
        entityId: existing.id,
        action: "UPDATE",
        actorId: caller.id,
        actorEmail: caller.userName,
        newValue: { device_name: label, rp_id: rp.rpID },
      });
      res.json({ success: true, data: publicCredential(updated) });
      return;
    }

    const [row] = await db
      .insert(webauthnCredentialsTable)
      .values({
        user_type: caller.audience,
        user_id: caller.id,
        credential_id: credential.id,
        public_key: publicKey,
        counter: credential.counter,
        transports,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        rp_id: rp.rpID,
        device_name: label,
      })
      .returning();

    void logAction({
      entityType: `${caller.audience}_passkey`,
      entityId: row!.id,
      action: "CREATE",
      actorId: caller.id,
      actorEmail: caller.userName,
      newValue: { device_name: label, rp_id: rp.rpID },
    });

    res.status(201).json({ success: true, data: publicCredential(row) });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err?.message ?? "Failed to register passkey");
  }
});

function publicCredential(row: any) {
  return {
    id: row.id,
    device_name: row.device_name,
    device_type: row.device_type,
    backed_up: row.backed_up,
    rp_id: row.rp_id,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
  };
}

/* ── Managing registered passkeys ──────────────────────────────────────── */

/** GET /api/v1/auth/passkey/credentials */
router.get("/v1/auth/passkey/credentials", async (req, res): Promise<void> => {
  const caller = await resolveCaller(req);
  if (!caller) { fail(res, 401, "UNAUTHORIZED", "Sign in first"); return; }
  const rows = await listCredentials(caller.audience, caller.id);
  res.json({ success: true, data: rows.map(publicCredential) });
});

/** PATCH /api/v1/auth/passkey/credentials/:id — rename a device */
router.patch("/v1/auth/passkey/credentials/:id", async (req, res): Promise<void> => {
  const caller = await resolveCaller(req);
  if (!caller) { fail(res, 401, "UNAUTHORIZED", "Sign in first"); return; }
  const name = typeof req.body?.device_name === "string" ? req.body.device_name.trim().slice(0, 60) : "";
  if (!name) { fail(res, 400, "INVALID", "device_name is required"); return; }
  const [row] = await db
    .update(webauthnCredentialsTable)
    .set({ device_name: name })
    .where(
      and(
        eq(webauthnCredentialsTable.id, Number(req.params.id)),
        eq(webauthnCredentialsTable.user_type, caller.audience),
        eq(webauthnCredentialsTable.user_id, caller.id),
        isNull(webauthnCredentialsTable.deleted_at),
      ),
    )
    .returning();
  if (!row) { fail(res, 404, "NOT_FOUND", "Passkey not found"); return; }
  res.json({ success: true, data: publicCredential(row) });
});

/** DELETE /api/v1/auth/passkey/credentials/:id */
router.delete("/v1/auth/passkey/credentials/:id", async (req, res): Promise<void> => {
  const caller = await resolveCaller(req);
  if (!caller) { fail(res, 401, "UNAUTHORIZED", "Sign in first"); return; }
  const [row] = await db
    .update(webauthnCredentialsTable)
    .set({ deleted_at: new Date() })
    .where(
      and(
        eq(webauthnCredentialsTable.id, Number(req.params.id)),
        eq(webauthnCredentialsTable.user_type, caller.audience),
        eq(webauthnCredentialsTable.user_id, caller.id),
        isNull(webauthnCredentialsTable.deleted_at),
      ),
    )
    .returning();
  if (!row) { fail(res, 404, "NOT_FOUND", "Passkey not found"); return; }
  void logAction({
    entityType: `${caller.audience}_passkey`,
    entityId: row.id,
    action: "DELETE",
    actorId: caller.id,
    actorEmail: caller.userName,
    oldValue: { device_name: row.device_name, rp_id: row.rp_id },
  });
  res.json({ success: true, data: { id: row.id } });
});

/* ── Login ─────────────────────────────────────────────────────────────── */

/** POST /api/v1/auth/passkey/login/options — body: { audience } */
router.post("/v1/auth/passkey/login/options", async (req, res): Promise<void> => {
  try {
    const audience = req.body?.audience;
    if (!isPasskeyAudience(audience)) { fail(res, 400, "INVALID", "audience must be admin, partner or guest"); return; }
    const rp = resolveRp(req);
    if (!rp) { fail(res, 400, "BAD_ORIGIN", "Unrecognised origin"); return; }

    // No allowCredentials: the authenticator offers whatever discoverable
    // passkey it holds for this RP, so the user never types an identifier — and
    // we never confirm whether a given account exists.
    const options = await generateAuthenticationOptions({
      rpID: rp.rpID,
      userVerification: "preferred",
    });
    const challengeId = await storeChallenge({
      challenge: options.challenge,
      purpose: "login",
      userType: audience,
      rpID: rp.rpID,
    });
    res.json({ success: true, data: { challenge_id: challengeId, options } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err?.message ?? "Failed to start passkey sign-in");
  }
});

/** POST /api/v1/auth/passkey/login/verify — body: { audience, challenge_id, response } */
router.post("/v1/auth/passkey/login/verify", async (req, res): Promise<void> => {
  try {
    const { audience, challenge_id, response } = req.body ?? {};
    if (!isPasskeyAudience(audience)) { fail(res, 400, "INVALID", "audience must be admin, partner or guest"); return; }
    const rp = resolveRp(req);
    if (!rp) { fail(res, 400, "BAD_ORIGIN", "Unrecognised origin"); return; }
    if (!response?.id) { fail(res, 400, "NO_RESPONSE", "Missing authenticator response"); return; }

    const expectedChallenge = await consumeChallenge({
      id: Number(challenge_id),
      purpose: "login",
      userType: audience,
    });
    if (!expectedChallenge) { fail(res, 400, "CHALLENGE_EXPIRED", "Sign-in expired — try again"); return; }

    const stored = await findCredentialById(String(response.id));
    // Same generic message whether the credential is unknown or belongs to a
    // different audience — no probing which portal an account lives on.
    if (!stored || stored.user_type !== audience) { fail(res, 401, "INVALID_CREDENTIAL", "Passkey not recognised"); return; }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: false,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64url")),
        counter: stored.counter,
        transports: parseTransports(stored.transports) as any,
      },
    });
    if (!verification.verified) { fail(res, 401, "NOT_VERIFIED", "Passkey not recognised"); return; }

    const now = new Date();
    await db
      .update(webauthnCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter, last_used_at: now })
      .where(eq(webauthnCredentialsTable.id, stored.id));

    void logAction({
      entityType: `${audience}_passkey`,
      entityId: stored.id,
      action: "LOGIN",
      actorId: stored.user_id,
      newValue: { device_name: stored.device_name },
    });

    const issued = await issueTokensFor(audience, stored.user_id, req);
    if (!issued) { fail(res, 403, "ACCOUNT_INACTIVE", "Account is not active"); return; }
    res.json({ success: true, ...issued });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err?.message ?? "Passkey sign-in failed");
  }
});

/**
 * Issue exactly the tokens the password login of that audience issues — the
 * client code after sign-in must not care which factor was used.
 */
async function issueTokensFor(audience: PasskeyAudience, userId: number, req: any) {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

  if (audience === "admin") {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), isNull(usersTable.deleted_at)))
      .limit(1);
    if (!user || !user.is_active || user.status !== "active") return null;
    await db.update(usersTable).set({ last_login_at: new Date() }).where(eq(usersTable.id, user.id));
    const token = signJWT({ id: user.id, email: user.email, role: user.role });
    if (req.session) req.session.token = token;
    const refresh_token = await issueRefreshToken({ userId: user.id, userType: "admin", ipAddress, userAgent });
    return {
      token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        force_password_change: user.force_password_change,
      },
    };
  }

  if (audience === "partner") {
    const [user] = await db
      .select()
      .from(partnerUsersTable)
      .where(and(eq(partnerUsersTable.id, userId), isNull(partnerUsersTable.deleted_at)))
      .limit(1);
    if (!user || !user.is_active || !ALLOWED_PORTAL_TYPES.has(user.portal_type)) return null;
    await db.update(partnerUsersTable).set({ last_login_at: new Date() }).where(eq(partnerUsersTable.id, user.id));
    const token = signPartnerJWT({
      id: user.id,
      email: user.email,
      account_id: user.account_id,
      portal_type: user.portal_type as PortalType,
    });
    const refresh_token = await issueRefreshToken({ userId: user.id, userType: "partner", ipAddress, userAgent });
    return {
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
    };
  }

  const [guest] = await db
    .select()
    .from(guestUsersTable)
    .where(and(eq(guestUsersTable.id, userId), isNull(guestUsersTable.deleted_at)))
    .limit(1);
  if (!guest || !guest.is_active) return null;
  const token = signGuestJWT({ id: guest.id, email: guest.email, account_id: guest.account_id });
  const refresh_token = await issueRefreshToken({ userId: guest.id, userType: "guest", ipAddress, userAgent });
  return {
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
  };
}

export default router;
