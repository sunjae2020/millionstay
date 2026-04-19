/**
 * Login lockout service — Sprint B-6
 *
 * Records each login attempt and locks accounts that exceed the threshold.
 * Default policy: 5 failures within 15 minutes → 15 minute lockout.
 */
import { db, loginAttemptsTable } from "@workspace/db";
import { and, eq, gte, lt } from "drizzle-orm";

export type UserType = "admin" | "guest" | "partner";

const WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window
const MAX_FAILURES = 5;

export async function recordAttempt(
  email: string,
  userType: UserType,
  success: boolean,
  ipAddress?: string | null,
): Promise<void> {
  await db.insert(loginAttemptsTable).values({
    email: email.toLowerCase().trim(),
    user_type: userType,
    success,
    ip_address: ipAddress?.slice(0, 45) ?? null,
  });
}

export interface LockStatus {
  locked: boolean;
  retryAfterSeconds?: number;
  failureCount: number;
}

export async function checkLockout(email: string, userType: UserType): Promise<LockStatus> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select({
      success: loginAttemptsTable.success,
      attempted_at: loginAttemptsTable.attempted_at,
    })
    .from(loginAttemptsTable)
    .where(
      and(
        eq(loginAttemptsTable.email, email.toLowerCase().trim()),
        eq(loginAttemptsTable.user_type, userType),
        gte(loginAttemptsTable.attempted_at, since),
      ),
    );

  // If any successful login is inside the window AFTER the streak of failures,
  // the user has reset their state — not locked.
  const sorted = [...rows].sort(
    (a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime(),
  );

  let failures = 0;
  for (const r of sorted) {
    if (r.success) break;
    failures++;
  }

  if (failures >= MAX_FAILURES) {
    const oldestFailure = sorted[failures - 1];
    const lockUntil = new Date(new Date(oldestFailure.attempted_at).getTime() + WINDOW_MS);
    const retryAfter = Math.max(0, Math.ceil((lockUntil.getTime() - Date.now()) / 1000));
    return { locked: true, retryAfterSeconds: retryAfter, failureCount: failures };
  }

  return { locked: false, failureCount: failures };
}

/** Optional cleanup — call from a scheduler to keep the table small. */
export async function purgeOldAttempts(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  const result = await db.delete(loginAttemptsTable).where(lt(loginAttemptsTable.attempted_at, cutoff));
  return (result as any).rowCount ?? 0;
}
