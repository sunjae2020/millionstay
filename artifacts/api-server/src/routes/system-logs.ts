import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, branchesTable, teamsTable } from "@workspace/db";
import { sql, eq, and, isNull, asc } from "drizzle-orm";
import { parseListPage, sendList } from "../utils/pagination";
import { resolveIpGeos } from "../lib/geoip";

/**
 * 시스템 로그 — "누가 언제 무엇을 했나"를 한 화면에서 본다.
 *
 * 두 원장을 하나의 피드로 합친다.
 *   - `system_log`        생성·수정·삭제(CUD). 전·후 값이 함께 남는다.
 *   - `user_activity_log` 값이 안 바뀌는 행위: 로그인, 열람·다운로드, 내보내기,
 *                         AI·OCR 호출, 서류 발행, 메일 발송.
 *
 * 합치는 일은 SQL UNION ALL 로 한다 — 두 테이블을 넉넉히 긁어와 앱에서 병합·자르면
 * 총 건수와 페이지 경계가 어긋나기 때문이다.
 *
 * 권한: 관리자(Admin/SuperAdmin) 전용. requireAuth 는 app.ts 에서 /api/v1 전체에
 * 걸려 있고, 여기서 역할만 한 번 더 좁힌다 — 로그에는 다른 직원의 행적과 IP 가
 * 들어 있어 일반 역할에게 열어 둘 수 없다.
 */

const router: IRouter = Router();

const LOG_ADMIN_ROLES = new Set([
  "Super Admin", "SuperAdmin", "superadmin", "super_admin",
  "Admin", "admin",
]);

function requireLogAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as { role?: string } | undefined;
  if (!user?.role || !LOG_ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin role required" } });
    return;
  }
  next();
}

router.use("/v1/system-logs", requireLogAdmin);

/** drizzle 의 execute 는 이 프로젝트에서 배열을 그대로 돌려준다 — 드라이버가 바뀌어도
 *  조용히 깨지지 않도록 `.rows` 폴백을 둔다. */
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : (r?.rows ?? []));

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** to 는 "그 날짜까지 포함"으로 읽는다(날짜만 들어오면 하루를 더한다). */
function parseToDate(v: unknown): Date | null {
  const d = parseDate(v);
  if (!d) return null;
  if (typeof v === "string" && v.length <= 10) d.setDate(d.getDate() + 1);
  return d;
}

function defaultFrom(days = 14): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 기간 조건. from/to 없으면 최근 14일 — 로그 전체 스캔을 기본값으로 두지 않는다. */
function range(q: Record<string, unknown>, defaultDays = 14): { from: Date; to: Date } {
  return {
    from: parseDate(q.from) ?? defaultFrom(defaultDays),
    to: parseToDate(q.to) ?? new Date(Date.now() + 60_000),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 합산 피드
 * ────────────────────────────────────────────────────────────────────────── */

type FeedFilters = {
  from: Date;
  to: Date;
  source: "all" | "audit" | "activity";
  action: string | null;
  resourceType: string | null;
  actorId: number | null;
  branchId: number | null;
  teamId: number | null;
  q: string | null;
};

function readFilters(query: Record<string, unknown>, defaultDays = 14): FeedFilters {
  const { from, to } = range(query, defaultDays);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };
  const src = str(query.source)?.toLowerCase();
  return {
    from,
    to,
    source: src === "audit" || src === "activity" ? src : "all",
    action: str(query.action),
    resourceType: str(query.resource_type) ?? str(query.entity_type),
    actorId: num(query.actor_id),
    branchId: num(query.branch_id),
    teamId: num(query.team_id),
    q: str(query.q) ?? str(query.search) ?? str(query.actor_email),
  };
}

/** system_log 쪽 WHERE. 두 테이블의 컬럼 이름이 달라 분기를 따로 만든다. */
function auditWhere(f: FeedFilters) {
  const parts = [sql`s.created_at >= ${f.from}`, sql`s.created_at < ${f.to}`];
  if (f.action) parts.push(sql`s.action = ${f.action}`);
  if (f.resourceType) parts.push(sql`s.entity_type = ${f.resourceType}`);
  if (f.actorId) parts.push(sql`s.actor_id = ${f.actorId}`);
  if (f.q) parts.push(sql`(s.actor_email ILIKE ${"%" + f.q + "%"} OR s.entity_type ILIKE ${"%" + f.q + "%"} OR s.action ILIKE ${"%" + f.q + "%"})`);
  return sql.join(parts, sql` AND `);
}

function activityWhere(f: FeedFilters) {
  const parts = [sql`a.created_at >= ${f.from}`, sql`a.created_at < ${f.to}`];
  if (f.action) parts.push(sql`a.action = ${f.action}`);
  if (f.resourceType) parts.push(sql`a.resource_type = ${f.resourceType}`);
  if (f.actorId) parts.push(sql`a.actor_id = ${f.actorId}`);
  if (f.q) parts.push(sql`(a.actor_email ILIKE ${"%" + f.q + "%"} OR a.path ILIKE ${"%" + f.q + "%"} OR a.action ILIKE ${"%" + f.q + "%"})`);
  return sql.join(parts, sql` AND `);
}

/** 두 원장을 같은 컬럼 모양으로 세워 UNION ALL 한다. */
function feedCte(f: FeedFilters) {
  const auditPart = sql`
    SELECT
      'audit'::text        AS source,
      s.id                 AS id,
      s.created_at         AS created_at,
      s.actor_id           AS actor_id,
      s.actor_email        AS actor_email,
      NULL::text           AS actor_role,
      s.actor_type         AS actor_type,
      s.action             AS action,
      s.entity_type        AS resource_type,
      s.entity_id          AS resource_id,
      NULL::text           AS method,
      NULL::text           AS path,
      NULL::int            AS status_code,
      NULL::int            AS duration_ms,
      s.old_value          AS old_value,
      s.new_value          AS new_value,
      NULL::jsonb          AS metadata,
      s.ip_address         AS ip_address,
      s.user_agent         AS user_agent,
      s.notes              AS notes
    FROM public.system_log s
    WHERE ${auditWhere(f)}
  `;
  const activityPart = sql`
    SELECT
      'activity'::text     AS source,
      a.id                 AS id,
      a.created_at         AS created_at,
      a.actor_id           AS actor_id,
      a.actor_email        AS actor_email,
      a.actor_role         AS actor_role,
      'User'::text         AS actor_type,
      a.action             AS action,
      a.resource_type      AS resource_type,
      a.resource_id        AS resource_id,
      a.method             AS method,
      a.path               AS path,
      a.status_code        AS status_code,
      a.duration_ms        AS duration_ms,
      NULL::jsonb          AS old_value,
      NULL::jsonb          AS new_value,
      a.metadata           AS metadata,
      a.ip_address         AS ip_address,
      a.user_agent         AS user_agent,
      NULL::text           AS notes
    FROM public.user_activity_log a
    WHERE ${activityWhere(f)}
  `;

  if (f.source === "audit") return sql`(${auditPart})`;
  if (f.source === "activity") return sql`(${activityPart})`;
  return sql`(${auditPart} UNION ALL ${activityPart})`;
}

/** 지점·팀 필터는 행이 아니라 행위자(admin_users)에 걸린다. */
function orgWhere(f: FeedFilters) {
  const parts = [sql`TRUE`];
  if (f.branchId) parts.push(sql`u.branch_id = ${f.branchId}`);
  if (f.teamId) parts.push(sql`u.team_id = ${f.teamId}`);
  return sql.join(parts, sql` AND `);
}

// ── GET /v1/system-logs — 합산 피드(서버 정렬·페이징) ────────────────────────
router.get("/v1/system-logs", async (req, res): Promise<void> => {
  try {
    const f = readFilters(req.query as Record<string, unknown>);
    const p = parseListPage(req.query as Record<string, unknown>, { defaultLimit: 50, maxLimit: 5000, unpagedLimit: 5000 });

    const dir = String((req.query as any).dir ?? "desc").toLowerCase() === "asc" ? sql`ASC` : sql`DESC`;
    // 정렬 화이트리스트. 파생 컬럼(사용자 이름 등)은 인덱스가 없어 열지 않는다.
    const sortKey = String((req.query as any).sort ?? "logged_at");
    const sortCol =
      sortKey === "action" ? sql`f.action`
      : sortKey === "actor_email" ? sql`f.actor_email`
      : sortKey === "resource_type" ? sql`f.resource_type`
      : sortKey === "source" ? sql`f.source`
      : sql`f.created_at`;

    const feed = feedCte(f);

    const [countRow] = rowsOf(await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      WHERE ${orgWhere(f)}
    `));

    // created_at 을 logged_at 으로 내보낸다 — 공용 DataTable 은 행에 created_at 이
    // 보이면 "생성일" 감사 컬럼을 맨 뒤에 자동으로 붙이는데, 로그 화면에서 시각은
    // 첫 컬럼이어야 하고 같은 값이 두 번 나오면 안 된다.
    const rows = rowsOf(await db.execute(sql`
      SELECT
        f.source           AS source,
        f.id               AS id,
        f.created_at       AS logged_at,
        f.actor_id         AS actor_id,
        f.actor_email      AS actor_email,
        f.actor_role       AS actor_role,
        f.actor_type       AS actor_type,
        f.action           AS action,
        f.resource_type    AS resource_type,
        f.resource_id      AS resource_id,
        f.method           AS method,
        f.path             AS path,
        f.status_code      AS status_code,
        f.duration_ms      AS duration_ms,
        f.old_value        AS old_value,
        f.new_value        AS new_value,
        f.metadata         AS metadata,
        f.ip_address       AS ip_address,
        f.user_agent       AS user_agent,
        f.notes            AS notes,
        u.first_name       AS actor_first_name,
        u.last_name        AS actor_last_name,
        u.role             AS actor_current_role,
        u.branch_id        AS branch_id,
        u.team_id          AS team_id,
        b.name             AS branch_name,
        t.name             AS team_name
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      LEFT JOIN public.branches b ON b.id = u.branch_id
      LEFT JOIN public.teams t ON t.id = u.team_id
      WHERE ${orgWhere(f)}
      ORDER BY ${sortCol} ${dir}, f.id ${dir}
      LIMIT ${p.limit} OFFSET ${p.offset}
    `));

    // IP 옆에 예상 지역을 붙인다. 조회는 캐시 우선이고, 실패해도 목록은 그대로 나간다 —
    // 부가 정보 하나 때문에 로그 화면이 죽으면 안 된다.
    try {
      const geos = await resolveIpGeos(rows.map((r) => r.ip_address as string | null));
      for (const row of rows) {
        const g = row.ip_address ? geos.get(String(row.ip_address).trim()) : undefined;
        row.ip_geo = g ?? null;
      }
    } catch (err) {
      console.warn("[GET /v1/system-logs] ip geo lookup failed:", (err as Error)?.message ?? err);
      for (const row of rows) row.ip_geo = null;
    }

    sendList(res, rows, Number(countRow?.total ?? rows.length), p);
  } catch (err) {
    console.error("[GET /v1/system-logs]", err);
    res.status(500).json({ success: false, error: "Failed to load system logs" });
  }
});

// ── GET /v1/system-logs/summary — 일자별·액션별 집계 + 상위 사용자 ────────────
router.get("/v1/system-logs/summary", async (req, res): Promise<void> => {
  try {
    const f = readFilters(req.query as Record<string, unknown>);
    const feed = feedCte(f);

    const byDay = rowsOf(await db.execute(sql`
      SELECT to_char(f.created_at, 'YYYY-MM-DD') AS date,
             COUNT(*)::int                       AS count,
             COUNT(DISTINCT f.actor_id)::int     AS actors
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      WHERE ${orgWhere(f)}
      GROUP BY 1 ORDER BY 1 ASC
    `));

    const byAction = rowsOf(await db.execute(sql`
      SELECT f.action AS action, f.source AS source, COUNT(*)::int AS count
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      WHERE ${orgWhere(f)}
      GROUP BY 1, 2 ORDER BY 3 DESC
    `));

    const byActor = rowsOf(await db.execute(sql`
      SELECT f.actor_id AS actor_id,
             COALESCE(MAX(f.actor_email), '')                 AS actor_email,
             MAX(u.first_name)                                AS first_name,
             MAX(u.last_name)                                 AS last_name,
             COUNT(*)::int                                    AS count
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      WHERE ${orgWhere(f)}
      GROUP BY 1 ORDER BY 5 DESC LIMIT 15
    `));

    const byResource = rowsOf(await db.execute(sql`
      SELECT COALESCE(f.resource_type, '—') AS resource_type, COUNT(*)::int AS count
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      WHERE ${orgWhere(f)}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20
    `));

    res.json({
      success: true,
      data: { by_day: byDay, by_action: byAction, by_actor: byActor, by_resource: byResource },
      meta: { from: f.from, to: f.to },
    });
  } catch (err) {
    console.error("[GET /v1/system-logs/summary]", err);
    res.status(500).json({ success: false, error: "Failed to load summary" });
  }
});

// ── GET /v1/system-logs/work-hours — 사용자·일자별 첫 활동 ~ 마지막 활동 ──────
//
// 근태 기록이 아니라 "시스템을 쓴 시간대"다. 첫 로그와 마지막 로그의 간격이므로
// 로그를 남기지 않는 업무(전화·현장)는 잡히지 않는다 — 화면에도 그렇게 적는다.
router.get("/v1/system-logs/work-hours", async (req, res): Promise<void> => {
  try {
    const f = readFilters(req.query as Record<string, unknown>);
    const feed = feedCte(f);

    const rows = rowsOf(await db.execute(sql`
      SELECT
        to_char(f.created_at, 'YYYY-MM-DD')                                        AS date,
        f.actor_id                                                                 AS actor_id,
        MAX(f.actor_email)                                                         AS actor_email,
        MAX(u.first_name)                                                          AS first_name,
        MAX(u.last_name)                                                           AS last_name,
        MAX(u.role)                                                                AS role,
        MAX(b.name)                                                                AS branch_name,
        MAX(t.name)                                                                AS team_name,
        MIN(f.created_at)                                                          AS first_at,
        MAX(f.created_at)                                                          AS last_at,
        ROUND(EXTRACT(EPOCH FROM (MAX(f.created_at) - MIN(f.created_at)))::numeric / 3600.0, 2) AS hours,
        COUNT(*)::int                                                              AS action_count
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      LEFT JOIN public.branches b ON b.id = u.branch_id
      LEFT JOIN public.teams t ON t.id = u.team_id
      WHERE ${orgWhere(f)} AND f.actor_id IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1 DESC, 3 ASC
    `));

    res.json({ success: true, data: rows, meta: { from: f.from, to: f.to } });
  } catch (err) {
    console.error("[GET /v1/system-logs/work-hours]", err);
    res.status(500).json({ success: false, error: "Failed to load work hours" });
  }
});

// ── GET /v1/system-logs/by-team — 팀별 일자 집계 ─────────────────────────────
router.get("/v1/system-logs/by-team", async (req, res): Promise<void> => {
  try {
    const f = readFilters(req.query as Record<string, unknown>);
    const feed = feedCte(f);

    const rows = rowsOf(await db.execute(sql`
      SELECT
        to_char(f.created_at, 'YYYY-MM-DD')  AS date,
        u.team_id                            AS team_id,
        COALESCE(MAX(t.name), '(미지정)')     AS team_name,
        COALESCE(MAX(b.name), '—')           AS branch_name,
        COUNT(DISTINCT f.actor_id)::int      AS active_users,
        COUNT(*)::int                        AS action_count,
        MIN(f.created_at)                    AS first_at,
        MAX(f.created_at)                    AS last_at
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      LEFT JOIN public.teams t ON t.id = u.team_id
      LEFT JOIN public.branches b ON b.id = u.branch_id
      WHERE ${orgWhere(f)}
      GROUP BY 1, 2
      ORDER BY 1 DESC, 3 ASC
    `));

    res.json({ success: true, data: rows, meta: { from: f.from, to: f.to } });
  } catch (err) {
    console.error("[GET /v1/system-logs/by-team]", err);
    res.status(500).json({ success: false, error: "Failed to load team activity" });
  }
});

// ── GET /v1/system-logs/by-branch — 지점별 일자 집계 ─────────────────────────
router.get("/v1/system-logs/by-branch", async (req, res): Promise<void> => {
  try {
    const f = readFilters(req.query as Record<string, unknown>);
    const feed = feedCte(f);

    const rows = rowsOf(await db.execute(sql`
      SELECT
        to_char(f.created_at, 'YYYY-MM-DD')  AS date,
        u.branch_id                          AS branch_id,
        COALESCE(MAX(b.name), '(미지정)')     AS branch_name,
        COUNT(DISTINCT f.actor_id)::int      AS active_users,
        COUNT(*)::int                        AS action_count,
        MIN(f.created_at)                    AS first_at,
        MAX(f.created_at)                    AS last_at
      FROM ${feed} AS f
      LEFT JOIN public.admin_users u ON u.id = f.actor_id
      LEFT JOIN public.branches b ON b.id = u.branch_id
      WHERE ${orgWhere(f)}
      GROUP BY 1, 2
      ORDER BY 1 DESC, 3 ASC
    `));

    res.json({ success: true, data: rows, meta: { from: f.from, to: f.to } });
  } catch (err) {
    console.error("[GET /v1/system-logs/by-branch]", err);
    res.status(500).json({ success: false, error: "Failed to load branch activity" });
  }
});

// ── GET /v1/system-logs/facets — 필터 드롭다운 값(사용자·액션·대상·조직) ──────
router.get("/v1/system-logs/facets", async (_req, res): Promise<void> => {
  try {
    const [actors, branches, teams, actions, resources] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          first_name: usersTable.first_name,
          last_name: usersTable.last_name,
          role: usersTable.role,
        })
        .from(usersTable)
        .where(and(isNull(usersTable.deleted_at), eq(usersTable.is_active, true)))
        .orderBy(asc(usersTable.last_name), asc(usersTable.first_name)),
      db
        .select({ id: branchesTable.id, name: branchesTable.name })
        .from(branchesTable)
        .where(isNull(branchesTable.deleted_at))
        .orderBy(asc(branchesTable.sort_order), asc(branchesTable.name)),
      db
        .select({ id: teamsTable.id, name: teamsTable.name, branch_id: teamsTable.branch_id })
        .from(teamsTable)
        .where(isNull(teamsTable.deleted_at))
        .orderBy(asc(teamsTable.sort_order), asc(teamsTable.name)),
      db.execute(sql`
        SELECT action, SUM(count)::int AS count FROM (
          SELECT action, COUNT(*)::int AS count FROM public.system_log GROUP BY 1
          UNION ALL
          SELECT action, COUNT(*)::int AS count FROM public.user_activity_log GROUP BY 1
        ) x GROUP BY 1 ORDER BY 2 DESC
      `),
      db.execute(sql`
        SELECT resource_type, SUM(count)::int AS count FROM (
          SELECT entity_type AS resource_type, COUNT(*)::int AS count FROM public.system_log GROUP BY 1
          UNION ALL
          SELECT resource_type, COUNT(*)::int AS count FROM public.user_activity_log WHERE resource_type IS NOT NULL GROUP BY 1
        ) x GROUP BY 1 ORDER BY 2 DESC
      `),
    ]);

    res.json({
      success: true,
      data: {
        actors,
        branches,
        teams,
        actions: rowsOf(actions).map((r) => String(r.action)),
        resource_types: rowsOf(resources).map((r) => String(r.resource_type)).filter(Boolean),
      },
    });
  } catch (err) {
    console.error("[GET /v1/system-logs/facets]", err);
    res.status(500).json({ success: false, error: "Failed to load facets" });
  }
});

export default router;
