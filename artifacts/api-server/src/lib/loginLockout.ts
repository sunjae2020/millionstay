/**
 * Login lockout service — Sprint B-6
 *
 * Records each login attempt and locks accounts that exceed the threshold.
 * Default policy: 5 failures within 15 minutes → 15 minute lockout.
 */
import { db, loginAttemptsTable } from "@workspace/db";
import { and, eq, gte, lt, inArray } from "drizzle-orm";

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

/**
 * 잠금 해제 — 창(15분) 안의 실패 기록을 지운다.
 *
 * 잠금은 별도 플래그가 아니라 `login_attempts` 의 최근 실패 연속 횟수로 계산되므로
 * (checkLockout 참조), 해제하려면 그 실패 기록 자체를 없애야 한다. 한 사람이
 * 이메일과 휴대폰 두 가지로 로그인할 수 있어 키가 둘일 수 있으니 배열로 받는다.
 *
 * 성공 기록은 남긴다 — 감사 흔적이고, 어차피 잠금 계산에 걸리지 않는다.
 */
export async function clearFailedAttempts(keys: string[], userType: UserType): Promise<number> {
  const normalised = [...new Set(keys.map((k) => k.toLowerCase().trim()).filter(Boolean))];
  if (!normalised.length) return 0;
  const since = new Date(Date.now() - WINDOW_MS);
  const result = await db
    .delete(loginAttemptsTable)
    .where(
      and(
        inArray(loginAttemptsTable.email, normalised),
        eq(loginAttemptsTable.user_type, userType),
        eq(loginAttemptsTable.success, false),
        gte(loginAttemptsTable.attempted_at, since),
      ),
    );
  return (result as any).rowCount ?? 0;
}

/** Optional cleanup — call from a scheduler to keep the table small. */
export async function purgeOldAttempts(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  const result = await db.delete(loginAttemptsTable).where(lt(loginAttemptsTable.attempted_at, cutoff));
  return (result as any).rowCount ?? 0;
}
