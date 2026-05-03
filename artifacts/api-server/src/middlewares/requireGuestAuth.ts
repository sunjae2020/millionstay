import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, guestUsersTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

const GUEST_JWT_SECRET = process.env["GUEST_JWT_SECRET"];
const SESSION_SECRET = process.env["SESSION_SECRET"];
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

if (!GUEST_JWT_SECRET) {
  if (IS_PRODUCTION) {
    throw new Error(
      "[FATAL] GUEST_JWT_SECRET environment variable must be set in production. " +
      "Refusing to derive guest JWT secret from another scope.",
    );
  }
  if (!SESSION_SECRET) {
    throw new Error("[FATAL] GUEST_JWT_SECRET (or SESSION_SECRET in dev) must be set.");
  }
}

const GUEST_SECRET: string = GUEST_JWT_SECRET ?? `${SESSION_SECRET}_guest_dev_only`;

// Short-lived access (1h). Refresh-token rotation handles longer sessions.
const GUEST_ACCESS_TTL = 60 * 60;

export interface GuestAuthPayload {
  id: number;
  email: string;
  account_id: number | null;
  role: "guest";
  iat?: number;
}

export function signGuestJWT(payload: Omit<GuestAuthPayload, "role" | "iat">): string {
  return jwt.sign({ ...payload, role: "guest" }, GUEST_SECRET, { expiresIn: GUEST_ACCESS_TTL });
}

export function verifyGuestJWT(token: string): GuestAuthPayload {
  return jwt.verify(token, GUEST_SECRET) as GuestAuthPayload;
}

type CacheEntry = { ok: boolean; tokens_invalid_after: number; expires: number };
const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

async function loadGuestState(id: number) {
  const cached = cache.get(id);
  const now = Date.now();
  if (cached && cached.expires > now) return cached;
  const [u] = await db
    .select({
      id: guestUsersTable.id,
      is_active: guestUsersTable.is_active,
      deleted_at: guestUsersTable.deleted_at,
      tokens_invalid_after: guestUsersTable.tokens_invalid_after,
    })
    .from(guestUsersTable)
    .where(and(eq(guestUsersTable.id, id), isNull(guestUsersTable.deleted_at)))
    .limit(1);
  if (!u) {
    cache.set(id, { ok: false, tokens_invalid_after: 0, expires: now + CACHE_TTL_MS });
    return { ok: false, tokens_invalid_after: 0 };
  }
  const tia = u.tokens_invalid_after ? Math.floor(new Date(u.tokens_invalid_after as any).getTime() / 1000) : 0;
  const ok = u.is_active === true;
  cache.set(id, { ok, tokens_invalid_after: tia, expires: now + CACHE_TTL_MS });
  return { ok, tokens_invalid_after: tia };
}

export function invalidateGuestCache(id: number): void {
  cache.delete(id);
}

export async function requireGuestAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const reject = () => {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Guest authentication required" },
    });
  };

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { reject(); return; }
  const token = auth.slice(7);
  let payload: GuestAuthPayload;
  try {
    payload = verifyGuestJWT(token);
  } catch {
    reject(); return;
  }
  if (payload.role !== "guest") { reject(); return; }

  try {
    const state = await loadGuestState(payload.id);
    if (!state?.ok) { reject(); return; }
    if (payload.iat && state.tokens_invalid_after > payload.iat) { reject(); return; }
  } catch {
    reject(); return;
  }

  (req as any).guest = payload;
  next();
}
