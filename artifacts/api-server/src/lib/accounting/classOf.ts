// 담당자 → 회계 귀속(Class) 파생.
//
// 거래를 만들 때 한 번 계산해 **스탬프**한다. 조회할 때마다 파생하면 담당자가
// 부서를 옮긴 순간 과거 장부의 귀속이 통째로 바뀐다 — 회계는 그때의 사실을 기억해야
// 한다. (지점 개편으로 과거를 다시 귀속시키려면 그건 의도적인 백필의 일이다.)
import { eq } from "drizzle-orm";
import { db, teamsTable, usersTable } from "@workspace/db";

export interface AccountingClass {
  branch_id: number | null;
  team_id: number | null;
}

const EMPTY: AccountingClass = { branch_id: null, team_id: null };

/**
 * `ownerUserId` 의 소속으로 Class 를 만든다. 담당자가 없거나 소속이 없으면
 * {null,null} — 그 행은 fail-open 규칙에 따라 보인다(scope.ts 참고).
 * 절대 throw 하지 않는다: 귀속 실패가 거래 저장을 막으면 안 된다.
 */
export async function resolveClassFromOwner(ownerUserId?: number | null): Promise<AccountingClass> {
  if (!ownerUserId) return EMPTY;
  try {
    const [me] = await db.select({
      branch_id: usersTable.branch_id,
      team_id: usersTable.team_id,
    }).from(usersTable).where(eq(usersTable.id, ownerUserId)).limit(1);
    if (!me) return EMPTY;

    let branchId = me.branch_id ?? null;
    // 팀만 있으면 팀의 지점을 따른다.
    if (!branchId && me.team_id) {
      const [team] = await db.select({ branch_id: teamsTable.branch_id })
        .from(teamsTable).where(eq(teamsTable.id, me.team_id)).limit(1);
      branchId = team?.branch_id ?? null;
    }
    return { branch_id: branchId, team_id: me.team_id ?? null };
  } catch {
    return EMPTY;
  }
}
