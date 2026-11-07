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
  /**
   * Set only on tokens minted by the admin "대신 열기" (impersonate) endpoint:
   * the admin_users.id of the operator viewing the portal as this partner.
   * Such tokens are short-lived, carry no refresh token, and are refused on
   * credential / self-service privacy endpoints (see IMPERSONATION_BLOCKED).
   */
  impersonated_by?: number;
}

export function signPartnerJWT(payload: Omit<PartnerAuthPayload, "role" | "iat">): string {
  if (!ALLOWED_PORTAL_TYPES.has(payload.portal_type)) {
    throw new Error(`[FATAL] Refusing to sign partner JWT with unknown portal_type: ${payload.portal_type}`);
  }
  return jwt.sign({ ...payload, role: "partner" }, PARTNER_SECRET, { expiresIn: PARTNER_ACCESS_TTL });
}

/** Impersonation tokens live at most 30 minutes and are never refreshed. */
export const PARTNER_IMPERSONATION_TTL = 30 * 60; // 30m

/**
 * Mint a partner access token for an admin opening the portal as that partner.
 * Same secret/shape as a normal partner token (so every partner route accepts
 * it unchanged) plus the `impersonated_by` claim naming the admin.
 */
export function signPartnerImpersonationJWT(
  payload: Omit<PartnerAuthPayload, "role" | "iat" | "impersonated_by">,
  adminId: number,
): string {
  if (!ALLOWED_PORTAL_TYPES.has(payload.portal_type)) {
    throw new Error(`[FATAL] Refusing to sign partner JWT with unknown portal_type: ${payload.portal_type}`);
  }
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw new Error("[FATAL] Refusing to sign impersonation JWT without an admin id");
  }
  return jwt.sign(
    { ...payload, role: "partner", impersonated_by: adminId },
    PARTNER_SECRET,
    { expiresIn: PARTNER_IMPERSONATION_TTL },
  );
}

export function verifyPartnerJWT(token: string): PartnerAuthPayload {
  const decoded = jwt.verify(token, PARTNER_SECRET) as PartnerAuthPayload;
  if (!ALLOWED_PORTAL_TYPES.has(decoded.portal_type)) {
    throw new Error("Invalid portal_type in partner JWT");
  }
  return decoded;
}

type CacheEntry = { ok: boolean; tokens_invalid_after: number; portal_type: string; force_password_change: boolean; expires: number };
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
      force_password_change: partnerUsersTable.force_password_change,
    })
    .from(partnerUsersTable)
    .where(and(eq(partnerUsersTable.id, id), isNull(partnerUsersTable.deleted_at)))
    .limit(1);
  if (!u) {
    const e = { ok: false, tokens_invalid_after: 0, portal_type: "", force_password_change: false, expires: now + CACHE_TTL_MS };
    cache.set(id, e);
    return e;
  }
  const tia = u.tokens_invalid_after ? Math.floor(new Date(u.tokens_invalid_after as any).getTime() / 1000) : 0;
  const e = {
    ok: u.is_active === true,
    tokens_invalid_after: tia,
    portal_type: u.portal_type ?? "",
    force_password_change: u.force_password_change === true,
    expires: now + CACHE_TTL_MS,
  };
  cache.set(id, e);
  return e;
}

export function invalidatePartnerCache(id: number): void {
  cache.delete(id);
}

/** 비밀번호 변경 강제 중에도 허용되는 경로 — 바꾸는 호출과 그 사실을 읽는 호출. */
const PASSWORD_CHANGE_EXEMPT = /\/v1\/auth\/partner\/(change-password|me|logout)$/;

/**
 * 관리자가 "대신 열기"로 들어온 세션에서는 막는 경로 — 파트너 본인의 자격증명
 * (비밀번호)과 본인 권리 행사(개인정보 내보내기·삭제 요청)는 본인만 할 수 있다.
 * 패스키 등록·관리는 passkeys.ts 의 resolveCaller 가 따로 거절한다.
 */
const IMPERSONATION_BLOCKED = /\/v1\/(auth\/partner\/change-password|partner\/me\/)/;

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
    // 임시 비밀번호로 들어온 사람은 비밀번호를 바꾸기 전까지 아무것도 못 본다.
    // 화면에서 막는 것만으로는 API 를 직접 부르면 그대로 뚫리므로, 모든 파트너
    // 요청이 지나는 이 지점에서 막는다. 예외는 비밀번호를 바꾸는 그 호출과,
    // 화면이 "바꿔야 한다"는 사실을 알아내는 /me 뿐이다.
    if (payload.impersonated_by && IMPERSONATION_BLOCKED.test(req.originalUrl.split("?")[0] || "")) {
      res.status(403).json({
        success: false,
        error: {
          code: "IMPERSONATION_FORBIDDEN",
          message: "Not available while an administrator is viewing this portal.",
        },
      });
      return;
    }
    if (state.force_password_change && !PASSWORD_CHANGE_EXEMPT.test(req.originalUrl.split("?")[0] || "")) {
      res.status(403).json({
        success: false,
        error: {
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Password change required before continuing.",
        },
      });
      return;
    }
  } catch {
    reject(); return;
  }

  (req as any).partner = payload;
  // 파트너 id 는 partner_users 의 것이라 system_log.actor_id(admin_users)에 넣지 않는다.
  // 대신 열기 세션에서 남는 감사 기록은 "파트너 본인"이 아니라 관리자가 한 일임이
  // 보이도록 행위자 이메일에 관리자 id 를 덧붙인다.
  const actorEmail = (payload as any).email ?? null;
  setRequestActor({
    id: null,
    email: payload.impersonated_by
      ? `${actorEmail ?? `partner#${payload.id}`} [impersonated_by admin#${payload.impersonated_by}]`
      : actorEmail,
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
