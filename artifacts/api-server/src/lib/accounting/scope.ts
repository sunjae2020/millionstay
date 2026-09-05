// HQ / 지점 / 팀 회계 접근 범위.
//
// 지점이 여러 개인 운영에서 "다른 지점 장부가 다 보인다"는 것은 사고다. 회계
// 레코드마다 귀속(Class = branch_id + team_id)을 달고, 보는 사람의 소속으로 거른다.
//
//   본사(HQ)   전부 본다. SuperAdmin·Admin 이거나, is_headquarters 지점 소속.
//   지점원     자기 지점 + 그 지점 아래 모든 팀.
//   팀원       자기 팀만.
//   + 명시적 공유(accounting_shares)로 레코드 단위 예외를 연다.
//
// ⚠️ **기본은 꺼져 있다.** integration_settings 의 `accounting.class_scope` 가 "1"
// 일 때만 강제된다. 직원 소속을 다 넣기도 전에 강제하면 아무도 아무것도 못 본다.
//
// ⚠️ 소속이 없는 행(branch_id·team_id 둘 다 NULL)은 **보이게** 둔다(fail-open).
// 이관 전 과거 데이터가 통째로 사라지는 것이 접근 통제 누락보다 나쁘다. 배정이
// 끝나면 `FAIL_OPEN_UNCLASSED` 를 false 로 바꾸면 fail-closed 가 된다.
import type { Request } from "express";
import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db, branchesTable, teamsTable, usersTable, integrationSettings } from "@workspace/db";

/** 소속 미지정 행을 보이게 둘 것인가. 배정이 끝나면 false 로. */
const FAIL_OPEN_UNCLASSED = true;

/** 소속과 무관하게 전부 보는 역할. */
const HQ_ROLES = new Set(["SuperAdmin", "Admin"]);

export const CLASS_SCOPE_KEY = "accounting.class_scope";

export interface AccountingScope {
  /** 이 인스턴스에서 강제가 켜져 있는가. */
  enabled: boolean;
  /** true → 전부 본다(HQ 이거나 게이트가 꺼짐). */
  unrestricted: boolean;
  branchIds: number[];
  teamIds: number[];
}

const UNRESTRICTED: AccountingScope = { enabled: false, unrestricted: true, branchIds: [], teamIds: [] };

// 게이트는 요청마다 읽히므로 짧게 캐시한다. 60초면 관리자가 토글한 뒤 곧 반영되고,
// 그 사이 매 요청이 DB 를 때리지도 않는다.
const GATE_TTL_MS = 60_000;
let _gate: { on: boolean; expiresAt: number } | null = null;

export function invalidateClassScopeGate(): void {
  _gate = null;
}

export async function isClassScopeEnabled(): Promise<boolean> {
  const now = Date.now();
  if (_gate && _gate.expiresAt > now) return _gate.on;
  let on = false;
  try {
    const [row] = await db.select({ value: integrationSettings.value })
      .from(integrationSettings)
      .where(eq(integrationSettings.key, CLASS_SCOPE_KEY))
      .limit(1);
    on = row?.value === "1" || row?.value === "true";
  } catch {
    // 설정을 못 읽으면 **끈 것으로 본다.** 여기서 켜진 것으로 처리하면 설정 조회
    // 실패가 곧 전 직원의 장부 차단이 된다.
    on = false;
  }
  _gate = { on, expiresAt: now + GATE_TTL_MS };
  return on;
}

/** 이 요청자의 접근 범위. */
export async function resolveAccountingScope(req: Request): Promise<AccountingScope> {
  if (!(await isClassScopeEnabled())) return UNRESTRICTED;

  const user = (req as unknown as { user?: { id?: number; role?: string } })?.user;
  if (!user?.id) return { enabled: true, unrestricted: false, branchIds: [], teamIds: [] };
  if (user.role && HQ_ROLES.has(user.role)) return { enabled: true, unrestricted: true, branchIds: [], teamIds: [] };

  const [me] = await db.select({
    branch_id: usersTable.branch_id,
    team_id: usersTable.team_id,
  }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  // 팀만 있으면 팀의 지점을 따른다 — 팀원에게 지점을 또 입력하게 하면 둘이 어긋난다.
  let branchId = me?.branch_id ?? null;
  const teamId = me?.team_id ?? null;
  if (!branchId && teamId) {
    const [team] = await db.select({ branch_id: teamsTable.branch_id })
      .from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    branchId = team?.branch_id ?? null;
  }

  // 본사 지점 소속이면 역할과 무관하게 전부 본다.
  if (branchId) {
    const [branch] = await db.select({ hq: branchesTable.is_headquarters })
      .from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
    if (branch?.hq) return { enabled: true, unrestricted: true, branchIds: [], teamIds: [] };
  }

  // 팀에 속했으면 그 팀만. 팀 없이 지점에만 속했으면 지점 + 그 아래 모든 팀.
  if (teamId) {
    return { enabled: true, unrestricted: false, branchIds: [], teamIds: [teamId] };
  }
  if (branchId) {
    const teams = await db.select({ id: teamsTable.id })
      .from(teamsTable).where(and(eq(teamsTable.branch_id, branchId), isNull(teamsTable.deleted_at)));
    return { enabled: true, unrestricted: false, branchIds: [branchId], teamIds: teams.map((t) => t.id) };
  }

  // 소속이 없는 직원. 자기 것도 못 보게 되지만, 강제가 켜진 상태에서 소속 없는
  // 사람에게 전체를 열어 주면 스코프 자체가 무의미해진다.
  return { enabled: true, unrestricted: false, branchIds: [], teamIds: [] };
}

/**
 * 목록 쿼리에 붙일 가시성 조건. 강제가 꺼져 있거나 HQ 면 undefined(조건 없음).
 *
 * `idCol` 은 명시적 공유를 조회하는 데 쓴다 — 공유는 레코드 단위이므로 id 가 필요하다.
 */
export function accountingScopeSql(
  scope: AccountingScope,
  branchCol: SQL,
  teamCol: SQL,
  idCol: SQL,
  recordType: string,
): SQL | undefined {
  if (!scope.enabled || scope.unrestricted) return undefined;

  const parts: SQL[] = [];
  if (scope.branchIds.length) parts.push(inArray(branchCol, scope.branchIds));
  if (scope.teamIds.length) parts.push(inArray(teamCol, scope.teamIds));

  // 명시적 공유. 소속이 하나도 없으면 공유로도 열릴 것이 없다.
  if (scope.branchIds.length || scope.teamIds.length) {
    const branchShare = scope.branchIds.length
      ? inArray(sql`s.share_branch_id`, scope.branchIds) : sql`false`;
    const teamShare = scope.teamIds.length
      ? inArray(sql`s.share_team_id`, scope.teamIds) : sql`false`;
    parts.push(sql`EXISTS (
      SELECT 1 FROM accounting_shares s
      WHERE s.record_type = ${recordType} AND s.record_id = ${idCol}
        AND (${branchShare} OR ${teamShare})
    )`);
  }

  if (FAIL_OPEN_UNCLASSED) {
    parts.push(sql`(${branchCol} IS NULL AND ${teamCol} IS NULL)`);
  }

  // 조건이 하나도 없다 = 볼 수 있는 것이 없다. `false` 를 명시해야 한다 —
  // 빈 배열로 두면 조건이 통째로 사라져 전부 보이는 정반대가 된다.
  if (parts.length === 0) return sql`false`;
  return sql`(${sql.join(parts, sql` OR `)})`;
}
