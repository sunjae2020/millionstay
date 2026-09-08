/**
 * Refresh Token service — Sprint A-5 (hardened)
 *
 * Issue / verify / revoke / rotate primitives for refresh tokens with
 * OAuth 2.0 BCP-style reuse detection.
 *
 * - Tokens are random 64-byte strings; only their SHA-256 hash is stored.
 * - Rotation is atomic: old token is revoked, a new one is issued.
 * - If a revoked token is presented for verification, that is treated as
 *   theft → every token in that login's *family* is revoked. Other logins of
 *   the same account (a second browser, a phone) are left alone: a stale tab
 *   must not be able to sign the user out of the machine they are working on.
 */
import { randomBytes, createHash, randomUUID } from "crypto";
import { db, refreshTokensTable } from "@workspace/db";
import { and, eq, isNull, lt } from "drizzle-orm";

export type UserType = "admin" | "guest" | "partner";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Rotation grace window.
 *
 * Rotation revokes the presented token, so two refreshes that race — two
 * browser tabs, a background timer firing while a 401 retry is in flight, a
 * request replayed after a flaky network — would have the loser present a
 * token that was revoked milliseconds earlier. Treating that as theft logged
 * the user out of every session, which is the single biggest source of
 * "it signed me out again" reports.
 *
 * Within the grace window we replay the rotation instead: the loser gets the
 * same successor token the winner got. Outside the window, reuse is still
 * treated as theft.
 */
const ROTATION_GRACE_MS = 60 * 1000;
const MAX_GRACE_ENTRIES = 5000;

interface RotationRecord {
  newToken: string;
  userId: number;
  userType: UserType;
  at: number;
}

/** oldTokenHash → the rotation it produced, for ROTATION_GRACE_MS. */
const recentRotations = new Map<string, RotationRecord>();

function pruneRotations(): void {
  const cutoff = Date.now() - ROTATION_GRACE_MS;
  for (const [hash, rec] of recentRotations) {
    if (rec.at <= cutoff) recentRotations.delete(hash);
  }
  // Hard cap so a burst can never grow the map without bound.
  while (recentRotations.size > MAX_GRACE_ENTRIES) {
    const oldest = recentRotations.keys().next();
    if (oldest.done) break;
    recentRotations.delete(oldest.value);
  }
}

function recallRotation(tokenHash: string): RotationRecord | null {
  const rec = recentRotations.get(tokenHash);
  if (!rec) return null;
  if (Date.now() - rec.at > ROTATION_GRACE_MS) {
    recentRotations.delete(tokenHash);
    return null;
  }
  return rec;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssueOptions {
  userId: number;
  userType: UserType;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Continue an existing login's family (rotation). Omit to start a new one. */
  familyId?: string | null;
}

export async function issueRefreshToken(opts: IssueOptions): Promise<string> {
  const raw = randomBytes(64).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokensTable).values({
    user_id: opts.userId,
    user_type: opts.userType,
    family_id: opts.familyId ?? randomUUID(),
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
  family_id: string | null;
}

/**
 * Verify and consume a refresh token.
 *
 * - Active token: returns its row.
 * - Already-revoked token (REUSE): revokes that token's family and returns
 *   null. This is the OAuth 2.0 BCP defence against stolen refresh tokens,
 *   scoped to the compromised login rather than the whole account.
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
    // …unless it was revoked by a rotation moments ago: that is a benign race
    // between two clients of the same session, not a stolen token.
    if (recallRotation(tokenHash)) return null;
    console.warn(
      `[refresh-tokens] REUSE DETECTED: user ${row.user_id} (${ut}) presented a revoked token. ` +
        `Revoking family ${row.family_id ?? row.id}.`,
    );
    await revokeFamily(row.family_id, row.id);
    return null;
  }

  if (new Date(row.expires_at as any) <= now) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    user_type: row.user_type as UserType,
    family_id: row.family_id ?? null,
  };
}

/**
 * Revoke every live token descended from one login. Rows predating `family_id`
 * were backfilled with their own id, so `familyId` is only ever null for a row
 * written between the migration and this deploy — fall back to that one row.
 */
export async function revokeFamily(familyId: string | null, fallbackRowId: string): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revoked_at: new Date() })
    .where(
      and(
        familyId ? eq(refreshTokensTable.family_id, familyId) : eq(refreshTokensTable.id, fallbackRowId),
        isNull(refreshTokensTable.revoked_at),
      ),
    );
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
  const oldHash = hashToken(oldRaw);

  // Racing refresh of the same token: hand back the successor already issued.
  const replayed = recallRotation(oldHash);
  if (replayed) {
    return { newToken: replayed.newToken, userId: replayed.userId, userType: replayed.userType };
  }

  const verified = await verifyRefreshToken(oldRaw);
  if (!verified) return null;
  await revokeRefreshToken(oldRaw);
  const newToken = await issueRefreshToken({
    userId: verified.user_id,
    userType: verified.user_type,
    familyId: verified.family_id ?? verified.id,
    ipAddress: opts?.ipAddress ?? null,
    userAgent: opts?.userAgent ?? null,
  });
  pruneRotations();
  recentRotations.set(oldHash, {
    newToken,
    userId: verified.user_id,
    userType: verified.user_type,
    at: Date.now(),
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
