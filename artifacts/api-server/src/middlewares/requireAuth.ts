import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

// SECURITY: distinct secret per token scope (admin / guest / partner). Refuse
// to fall back across scopes — sharing the session-cookie HMAC key with the
// JWT signing key means a leak in either direction is catastrophic.
const JWT_SECRET = process.env["JWT_SECRET"];
const SESSION_SECRET = process.env["SESSION_SECRET"];
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

if (!JWT_SECRET) {
  if (IS_PRODUCTION) {
    throw new Error(
      "[FATAL] JWT_SECRET environment variable must be set in production. " +
      "Refusing to fall back to SESSION_SECRET — secrets must be scoped.",
    );
  }
  if (!SESSION_SECRET) {
    throw new Error(
      "[FATAL] JWT_SECRET (or SESSION_SECRET in dev) must be set. " +
      "Refusing to start with a hardcoded development secret.",
    );
  }
}

const ADMIN_SECRET: string = JWT_SECRET ?? SESSION_SECRET!;

export interface AuthPayload {
  id: number;
  email: string;
  role: string;
  iat?: number;
}

// Short-lived access tokens (1h) instead of 8h — combined with refresh-token
// rotation this is the OAuth 2.0 best-current-practice for revocability.
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export function verifyJWT(token: string): AuthPayload {
  return jwt.verify(token, ADMIN_SECRET) as AuthPayload;
}

export function signJWT(payload: Omit<AuthPayload, "iat">): string {
  return jwt.sign(payload, ADMIN_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

/**
 * Per-request user-state revalidation cache.
 * Keeps DB hits cheap by caching positive results for 30s.
 */
type CacheEntry = { ok: boolean; tokens_invalid_after: number; force_password_change: boolean; expires: number };
const userCache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

async function loadUserState(id: number): Promise<{ ok: boolean; tokens_invalid_after: number; force_password_change: boolean } | null> {
  const cached = userCache.get(id);
  const now = Date.now();
  if (cached && cached.expires > now) return cached;

  const [u] = await db
    .select({
      id: usersTable.id,
      is_active: usersTable.is_active,
      deleted_at: usersTable.deleted_at,
      tokens_invalid_after: usersTable.tokens_invalid_after,
      force_password_change: usersTable.force_password_change,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), isNull(usersTable.deleted_at)))
    .limit(1);

  if (!u) {
    userCache.set(id, { ok: false, tokens_invalid_after: 0, force_password_change: false, expires: now + CACHE_TTL_MS });
    return { ok: false, tokens_invalid_after: 0, force_password_change: false };
  }
  const tia = u.tokens_invalid_after ? Math.floor(new Date(u.tokens_invalid_after as any).getTime() / 1000) : 0;
  const ok = u.is_active === true;
  const fpc = u.force_password_change === true;
  userCache.set(id, { ok, tokens_invalid_after: tia, force_password_change: fpc, expires: now + CACHE_TTL_MS });
  return { ok, tokens_invalid_after: tia, force_password_change: fpc };
}

export function invalidateUserCache(id: number): void {
  userCache.delete(id);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const reject = () => {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  };

  const auth = req.headers.authorization;
  let token: string | undefined;
  if (auth?.startsWith("Bearer ")) token = auth.slice(7);
  else if ((req as any).session?.token) token = (req as any).session.token;

  if (!token) { reject(); return; }

  let payload: AuthPayload;
  try {
    payload = verifyJWT(token);
  } catch {
    reject(); return;
  }

  // Per-request revalidation: the user must still be active, not soft-deleted,
  // and the token must have been issued AFTER any password change / forced
  // revocation (tokens_invalid_after).
  try {
    const state = await loadUserState(payload.id);
    if (!state?.ok) { reject(); return; }
    if (payload.iat && state.tokens_invalid_after > payload.iat) { reject(); return; }
    if (state.force_password_change) {
      res.status(403).json({
        success: false,
        error: {
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Password change required. Use the password reset flow before continuing.",
        },
      });
      return;
    }
  } catch {
    reject(); return;
  }

  (req as any).user = payload;
  next();
}
