import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, partnerUsersTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { setRequestActor } from "../lib/requestContext";

const PARTNER_JWT_SECRET = process.env["PARTNER_JWT_SECRET"];
const SESSION_SECRET = process.env["SESSION_SECRET"];
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

if (!PARTNER_JWT_SECRET) {
  if (IS_PRODUCTION) {
    throw new Error(
      "[FATAL] PARTNER_JWT_SECRET environment variable must be set in production. " +
      "Refusing to derive partner JWT secret from another scope.",
    );
  }
  if (!SESSION_SECRET) {
    throw new Error("[FATAL] PARTNER_JWT_SECRET (or SESSION_SECRET in dev) must be set.");
  }
}

const PARTNER_SECRET: string = PARTNER_JWT_SECRET ?? `${SESSION_SECRET}_partner_dev_only`;

const PARTNER_ACCESS_TTL = 60 * 60; // 1h
const ALLOWED_PORTAL_TYPES = new Set(["agent", "owner", "service_host", "homestay"]);

export type PortalType = "agent" | "owner" | "service_host" | "homestay";

export interface PartnerAuthPayload {
  id: number;
  email: string;
  account_id: number;
  portal_type: PortalType;
  role: "partner";
  iat?: number;
}

export function signPartnerJWT(payload: Omit<PartnerAuthPayload, "role" | "iat">): string {
  if (!ALLOWED_PORTAL_TYPES.has(payload.portal_type)) {
    throw new Error(`[FATAL] Refusing to sign partner JWT with unknown portal_type: ${payload.portal_type}`);
  }
  return jwt.sign({ ...payload, role: "partner" }, PARTNER_SECRET, { expiresIn: PARTNER_ACCESS_TTL });
}

export function verifyPartnerJWT(token: string): PartnerAuthPayload {
  const decoded = jwt.verify(token, PARTNER_SECRET) as PartnerAuthPayload;
  if (!ALLOWED_PORTAL_TYPES.has(decoded.portal_type)) {
    throw new Error("Invalid portal_type in partner JWT");
  }
  return decoded;
}

type CacheEntry = { ok: boolean; tokens_invalid_after: number; portal_type: string; expires: number };
const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

async function loadPartnerState(id: number) {
  const cached = cache.get(id);
  const now = Date.now();
  if (cached && cached.expires > now) return cached;
  const [u] = await db
    .select({
      id: partnerUsersTable.id,
      is_active: partnerUsersTable.is_active,
      deleted_at: partnerUsersTable.deleted_at,
      portal_type: partnerUsersTable.portal_type,
      tokens_invalid_after: partnerUsersTable.tokens_invalid_after,
    })
    .from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.id, id), isNull(partnerUsersTable.deleted_at)))
    .limit(1);
  if (!u) {
    const e = { ok: false, tokens_invalid_after: 0, portal_type: "", expires: now + CACHE_TTL_MS };
    cache.set(id, e);
    return e;
  }
  const tia = u.tokens_invalid_after ? Math.floor(new Date(u.tokens_invalid_after as any).getTime() / 1000) : 0;
  const e = {
    ok: u.is_active === true,
    tokens_invalid_after: tia,
    portal_type: u.portal_type ?? "",
    expires: now + CACHE_TTL_MS,
  };
  cache.set(id, e);
  return e;
}

export function invalidatePartnerCache(id: number): void {
  cache.delete(id);
}

export async function requirePartnerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const reject = () => {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Partner authentication required" },
    });
  };

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { reject(); return; }
  const token = auth.slice(7);
  let payload: PartnerAuthPayload;
  try {
    payload = verifyPartnerJWT(token);
  } catch {
    reject(); return;
  }
  if (payload.role !== "partner") { reject(); return; }

  try {
    const state = await loadPartnerState(payload.id);
    if (!state?.ok) { reject(); return; }
    if (payload.iat && state.tokens_invalid_after > payload.iat) { reject(); return; }
    if (state.portal_type && state.portal_type !== payload.portal_type) { reject(); return; }
  } catch {
    reject(); return;
  }

  (req as any).partner = payload;
  // 파트너 id 는 partner_users 의 것이라 system_log.actor_id(admin_users)에 넣지 않는다.
  setRequestActor({
    id: null,
    email: (payload as any).email ?? null,
    role: (payload as any).portal_type ?? null,
    type: "Partner",
  });
  next();
}

export async function requireAgentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePartnerAuth(req, res, () => {
    const partner = (req as any).partner as PartnerAuthPayload;
    if (partner.portal_type !== "agent") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Agent access only" } });
      return;
    }
    next();
  });
}

export async function requireOwnerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePartnerAuth(req, res, () => {
    const partner = (req as any).partner as PartnerAuthPayload;
    if (partner.portal_type !== "owner") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Owner access only" } });
      return;
    }
    next();
  });
}

export async function requireServiceHostAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePartnerAuth(req, res, () => {
    const partner = (req as any).partner as PartnerAuthPayload;
    if (partner.portal_type !== "service_host") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Service host access only" } });
      return;
    }
    next();
  });
}

export async function requireHomestayAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePartnerAuth(req, res, () => {
    const partner = (req as any).partner as PartnerAuthPayload;
    if (partner.portal_type !== "homestay") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Homestay host access only" } });
      return;
    }
    next();
  });
}
