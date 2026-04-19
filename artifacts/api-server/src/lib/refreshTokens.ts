/**
 * Refresh Token service — Sprint A-5
 *
 * Provides issue / verify / revoke / rotate primitives for refresh tokens.
 * Tokens themselves are random 64-byte strings; only their SHA-256 hash is
 * stored in the DB so DB exposure alone cannot be used to impersonate users.
 */
import { randomBytes, createHash } from "crypto";
import { db, refreshTokensTable } from "@workspace/db";
import { and, eq, isNull, gt, lt } from "drizzle-orm";

export type UserType = "admin" | "guest" | "partner";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssueOptions {
  userId: number;
  userType: UserType;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function issueRefreshToken(opts: IssueOptions): Promise<string> {
  const raw = randomBytes(64).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokensTable).values({
    user_id: opts.userId,
    user_type: opts.userType,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: opts.ipAddress?.slice(0, 45) ?? null,
    user_agent: opts.userAgent?.slice(0, 512) ?? null,
  });

  return raw;
}

export interface VerifiedRefreshToken {
  id: string;
  user_id: number;
  user_type: UserType;
}

/** Verify a refresh token. Returns null if invalid / expired / revoked. */
export async function verifyRefreshToken(
  raw: string,
  userType: UserType,
): Promise<VerifiedRefreshToken | null> {
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const now = new Date();

  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.token_hash, tokenHash),
        eq(refreshTokensTable.user_type, userType),
        isNull(refreshTokensTable.revoked_at),
        gt(refreshTokensTable.expires_at, now),
      ),
    )
    .limit(1);

  if (!row) return null;
  return { id: row.id, user_id: row.user_id, user_type: row.user_type as UserType };
}

/** Mark a refresh token as revoked. Safe to call on already-revoked tokens. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  if (!raw) return;
  const tokenHash = hashToken(raw);
  await db
    .update(refreshTokensTable)
    .set({ revoked_at: new Date() })
    .where(eq(refreshTokensTable.token_hash, tokenHash));
}

/** Revoke every active refresh token for a user (e.g. after password change). */
export async function revokeAllForUser(userId: number, userType: UserType): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(refreshTokensTable.user_id, userId),
        eq(refreshTokensTable.user_type, userType),
        isNull(refreshTokensTable.revoked_at),
      ),
    );
}

/** Atomic rotation: revoke old, issue new. Used by /auth/refresh. */
export async function rotateRefreshToken(
  oldRaw: string,
  opts: IssueOptions,
): Promise<string> {
  await revokeRefreshToken(oldRaw);
  return issueRefreshToken(opts);
}

/** Periodic cleanup of expired tokens. Safe to call from a scheduler. */
export async function purgeExpiredTokens(): Promise<number> {
  const result = await db
    .delete(refreshTokensTable)
    .where(lt(refreshTokensTable.expires_at, new Date()));
  return (result as any).rowCount ?? 0;
}
