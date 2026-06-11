import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

// ─── Scopes ───
// Granular read/write permissions per domain. An external credential is granted
// a subset of these; every /api/ext/v1 route declares the scope it requires.
export const API_SCOPES = [
  "bookings:read",
  "bookings:write",
  "availability:read",
  "availability:write",
  "pricing:read",
  "pricing:write",
  "tasks:read",
  "tasks:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isValidScope(s: string): s is ApiScope {
  return (API_SCOPES as readonly string[]).includes(s);
}

/** Parse the JSON-encoded scopes column into a clean string[] (never throws). */
export function parseScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ─── Credential generation ───
// key_id is the PUBLIC identifier (safe to display). secret is shown ONCE.
const BCRYPT_ROUNDS = 10;

export function generateKeyId(): string {
  // msk = MillionStay Key. 16 hex chars of entropy.
  return `msk_live_${randomBytes(8).toString("hex")}`;
}

export function generateSecret(): string {
  // mss = MillionStay Secret. ~43 url-safe chars of entropy.
  return `mss_${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

export function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

export function last4(secret: string): string {
  return secret.slice(-4);
}
