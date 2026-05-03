/**
 * Refresh Token service — Sprint A-5 (hardened)
 *
 * Issue / verify / revoke / rotate primitives for refresh tokens with
 * OAuth 2.0 BCP-style reuse detection.
 *
 * - Tokens are random 64-byte strings; only their SHA-256 hash is stored.
 * - Rotation is atomic: old token is revoked, a new one is issued.
 * - If a revoked token is presented for verification, that is treated as
 *   theft → all refresh tokens for that user are mass-revoked AND
 *   `tokens_invalid_after` is bumped on the user row, invalidating any
 *   outstanding access tokens too.
 */
import { randomBytes, createHash } from "crypto";
import { db, refreshTokensTable, usersTable, guestUsersTable, partnerUsersTable } from "@workspace/db";
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

async function bumpTokensInvalidAfter(userId: number, userType: UserType): Promise<void> {
  const now = new Date();
  try {
    if (userType === "admin") {
      await db.update(usersTable).set({ tokens_invalid_after: now }).where(eq(usersTable.id, userId));
    } else if (userType === "guest") {
      await db.update(guestUsersTable).set({ tokens_invalid_after: now }).where(eq(guestUsersTable.id, userId));
    } else {
      await db.update(partnerUsersTable).set({ tokens_invalid_after: now }).where(eq(partnerUsersTable.id, userId));
    }
  } catch (err) {
    console.error("[refresh-tokens] bumpTokensInvalidAfter failed", err);
  }
}

/**
 * Verify and consume a refresh token.
 *
 * - Active token: returns its row.
 * - Already-revoked token (REUSE): triggers mass-revocation for that user
 *   and returns null. This is the OAuth 2.0 BCP defence against stolen
 *   refresh tokens.
 * - Unknown / expired token: returns null silently.
 */
export async function verifyRefreshToken(
  raw: string,
  userType?: UserType,
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
        ...(userType ? [eq(refreshTokensTable.user_type, userType)] : []),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Reuse detection: revoked token presented again → treat as theft.
  if (row.revoked_at !== null) {
    const ut = row.user_type as UserType;
    console.warn(
      `[refresh-tokens] REUSE DETECTED: user ${row.user_id} (${ut}) presented a revoked token. Mass-revoking all sessions.`,
    );
    await revokeAllForUser(row.user_id, ut);
    await bumpTokensInvalidAfter(row.user_id, ut);
    return null;
  }

  if (new Date(row.expires_at as any) <= now) return null;

  return { id: row.id, user_id: row.user_id, user_type: row.user_type as UserType };
}

/** Mark a refresh token as revoked. Safe to call on already-revoked tokens. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  if (!raw) return;
  const tokenHash = hashToken(raw);
  await db
    .update(refreshTokensTable)
    .set({ revoked_at: new Date() })
    .where(and(eq(refreshTokensTable.token_hash, tokenHash), isNull(refreshTokensTable.revoked_at)));
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

/**
 * Atomic rotation. Revoke the presented token; if it was already revoked
 * (reuse), trigger mass-revocation and refuse to rotate. Returns the new
 * raw token + caller-friendly user info, or null if the input was invalid.
 */
export async function rotateRefreshToken(
  oldRaw: string,
  opts?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ newToken: string; userId: number; userType: UserType } | null> {
  const verified = await verifyRefreshToken(oldRaw);
  if (!verified) return null;
  await revokeRefreshToken(oldRaw);
  const newToken = await issueRefreshToken({
    userId: verified.user_id,
    userType: verified.user_type,
    ipAddress: opts?.ipAddress ?? null,
    userAgent: opts?.userAgent ?? null,
  });
  return { newToken, userId: verified.user_id, userType: verified.user_type };
}

/** Periodic cleanup of expired tokens. Safe to call from a scheduler. */
export async function purgeExpiredTokens(): Promise<number> {
  const result = await db
    .delete(refreshTokensTable)
    .where(lt(refreshTokensTable.expires_at, new Date()));
  return (result as any).rowCount ?? 0;
}
