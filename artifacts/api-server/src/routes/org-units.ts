import { Router, type IRouter } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db, branchesTable, teamsTable, accountingSharesTable, usersTable, integrationSettings,
} from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { isSuperAdmin } from "../lib/softDelete";
import {
  CLASS_SCOPE_KEY, invalidateClassScopeGate, isClassScopeEnabled, resolveAccountingScope,
} from "../lib/accounting/scope";

// 조직 단위(지점·팀)와 회계 접근 범위 설정.
const router: IRouter = Router();

// ── 지점 ────────────────────────────────────────────────────────────────────
router.get("/v1/branches", async (_req, res): Promise<void> => {
  const rows = await db.select().from(branchesTable)
    .where(isNull(branchesTable.deleted_at))
    .orderBy(asc(branchesTable.sort_order), asc(branchesTable.id));
  // 지점마다 팀 수와 인원을 함께 준다 — 지우기 전에 "안에 뭐가 있나"를 알아야 한다.
  const counts = await db.select({
    branch_id: teamsTable.branch_id,
    n: sql<number>`count(*)::int`,
  }).from(teamsTable).where(isNull(teamsTable.deleted_at)).groupBy(teamsTable.branch_id);
  const staff = await db.select({
    branch_id: usersTable.branch_id,
    n: sql<number>`count(*)::int`,
  }).from(usersTable).groupBy(usersTable.branch_id);
  const teamMap = new Map(counts.map((c) => [c.branch_id, c.n]));
  const staffMap = new Map(staff.map((c) => [c.branch_id, c.n]));
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      team_count: teamMap.get(r.id) ?? 0,
      staff_count: staffMap.get(r.id) ?? 0,
    })),
  });
});

const BranchBody = z.object({
  name: z.string().min(1),
  code: z.string().nullish(),
  is_headquarters: z.boolean().optional(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().nullish(),
});

router.post("/v1/branches", async (req, res): Promise<void> => {
  const parsed = BranchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const [row] = await db.insert(branchesTable).values({
    name: b.name,
    code: b.code ?? null,
    is_headquarters: b.is_headquarters ?? false,
    address: b.address ?? null,
    phone: b.phone ?? null,
    sort_order: b.sort_order ?? 0,
    is_active: b.is_active ?? true,
    notes: b.notes ?? null,
  }).returning();
  void logAction({ entityType: "branch", entityId: row!.id, action: "CREATE", newValue: { name: b.name } });
  res.status(201).json({ success: true, data: row });
});

router.put("/v1/branches/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = BranchBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const set: Record<string, unknown> = { updated_at: new Date() };
  for (const k of ["name", "code", "is_headquarters", "address", "phone", "sort_order", "is_active", "notes"] as const) {
    if (b[k] !== undefined) set[k] = b[k] ?? null;
  }
  const [row] = await db.update(branchesTable).set(set)
    .where(and(eq(branchesTable.id, id), isNull(branchesTable.deleted_at))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, data: row });
});

router.delete("/v1/branches/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // 소속된 팀이나 직원이 남아 있으면 지우지 않는다 — 지워 버리면 그 사람들의
  // 접근 범위가 조용히 "소속 없음"이 되어 아무것도 못 보게 된다.
  const [team] = await db.select({ n: sql<number>`count(*)::int` }).from(teamsTable)
    .where(and(eq(teamsTable.branch_id, id), isNull(teamsTable.deleted_at)));
  const [staff] = await db.select({ n: sql<number>`count(*)::int` }).from(usersTable)
    .where(eq(usersTable.branch_id, id));
  if ((team?.n ?? 0) > 0 || (staff?.n ?? 0) > 0) {
    res.status(409).json({ error: `Branch still has ${team?.n ?? 0} team(s) and ${staff?.n ?? 0} staff — move them first` });
    return;
  }
  const [row] = await db.update(branchesTable)
    .set({ deleted_at: new Date(), is_active: false, updated_at: new Date() })
    .where(and(eq(branchesTable.id, id), isNull(branchesTable.deleted_at))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: "branch", entityId: id, action: "DELETE" });
  res.status(204).send();
});

// ── 팀 ──────────────────────────────────────────────────────────────────────
router.get("/v1/teams", async (req, res): Promise<void> => {
  const branchId = Number(req.query.branch_id);
  const conds = [isNull(teamsTable.deleted_at)];
  if (Number.isFinite(branchId) && branchId > 0) conds.push(eq(teamsTable.branch_id, branchId));
  const rows = await db.select().from(teamsTable).where(and(...conds))
    .orderBy(asc(teamsTable.sort_order), asc(teamsTable.id));
  const staff = await db.select({
    team_id: usersTable.team_id, n: sql<number>`count(*)::int`,
  }).from(usersTable).groupBy(usersTable.team_id);
  const staffMap = new Map(staff.map((c) => [c.team_id, c.n]));
  const branches = await db.select({ id: branchesTable.id, name: branchesTable.name }).from(branchesTable);
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      branch_name: branchMap.get(r.branch_id) ?? null,
      staff_count: staffMap.get(r.id) ?? 0,
    })),
  });
});

const TeamBody = z.object({
  branch_id: z.number().int().positive(),
  name: z.string().min(1),
  code: z.string().nullish(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().nullish(),
});

router.post("/v1/teams", async (req, res): Promise<void> => {
  const parsed = TeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const [branch] = await db.select({ id: branchesTable.id }).from(branchesTable)
    .where(and(eq(branchesTable.id, b.branch_id), isNull(branchesTable.deleted_at))).limit(1);
  if (!branch) { res.status(400).json({ error: "Branch not found" }); return; }
  const [row] = await db.insert(teamsTable).values({
    branch_id: b.branch_id,
    name: b.name,
    code: b.code ?? null,
    sort_order: b.sort_order ?? 0,
    is_active: b.is_active ?? true,
    notes: b.notes ?? null,
  }).returning();
  void logAction({ entityType: "team", entityId: row!.id, action: "CREATE", newValue: { name: b.name } });
  res.status(201).json({ success: true, data: row });
});

router.put("/v1/teams/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = TeamBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const set: Record<string, unknown> = { updated_at: new Date() };
  for (const k of ["branch_id", "name", "code", "sort_order", "is_active", "notes"] as const) {
    if (b[k] !== undefined) set[k] = b[k] ?? null;
  }
  const [row] = await db.update(teamsTable).set(set)
    .where(and(eq(teamsTable.id, id), isNull(teamsTable.deleted_at))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, data: row });
});

router.delete("/v1/teams/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [staff] = await db.select({ n: sql<number>`count(*)::int` }).from(usersTable)
    .where(eq(usersTable.team_id, id));
  if ((staff?.n ?? 0) > 0) {
    res.status(409).json({ error: `Team still has ${staff?.n} staff — move them first` });
    return;
  }
  const [row] = await db.update(teamsTable)
    .set({ deleted_at: new Date(), is_active: false, updated_at: new Date() })
    .where(and(eq(teamsTable.id, id), isNull(teamsTable.deleted_at))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ── 접근 범위 설정 ──────────────────────────────────────────────────────────
/** 현재 게이트 상태 + 요청자에게 적용되는 범위(설정 화면이 "지금 내가 뭘 보나"를 보여준다). */
router.get("/v1/accounting/class-scope", async (req, res): Promise<void> => {
  const enabled = await isClassScopeEnabled();
  const scope = await resolveAccountingScope(req);
  res.json({
    success: true,
    data: {
      enabled,
      viewer: {
        unrestricted: scope.unrestricted,
        branch_ids: scope.branchIds,
        team_ids: scope.teamIds,
      },
    },
  });
});

/**
 * 게이트 토글. SuperAdmin 전용 — 이 스위치 하나로 전 직원의 장부 가시성이 바뀐다.
 */
router.put("/v1/accounting/class-scope", async (req, res): Promise<void> => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "Only SuperAdmin can change the accounting scope" }); return; }
  const enabled = req.body?.enabled === true || req.body?.enabled === "1";
  await db.insert(integrationSettings)
    .values({ key: CLASS_SCOPE_KEY, value: enabled ? "1" : "0" })
    .onConflictDoUpdate({ target: integrationSettings.key, set: { value: enabled ? "1" : "0" } });
  invalidateClassScopeGate();
  void logAction({ entityType: "setting", entityId: 0, action: "UPDATE", newValue: { [CLASS_SCOPE_KEY]: enabled } });
  res.json({ success: true, data: { enabled } });
});

// ── 명시적 공유 ─────────────────────────────────────────────────────────────
router.get("/v1/accounting/shares", async (req, res): Promise<void> => {
  const recordType = String(req.query.record_type ?? "").trim();
  const recordId = Number(req.query.record_id);
  if (!recordType || !Number.isFinite(recordId)) { res.status(400).json({ error: "record_type and record_id are required" }); return; }
  const rows = await db.select().from(accountingSharesTable).where(and(
    eq(accountingSharesTable.record_type, recordType),
    eq(accountingSharesTable.record_id, recordId),
  ));
  res.json({ success: true, data: rows });
});

const ShareBody = z.object({
  record_type: z.string().min(1),
  record_id: z.number().int().positive(),
  share_branch_id: z.number().int().positive().nullish(),
  share_team_id: z.number().int().positive().nullish(),
  note: z.string().nullish(),
});

router.post("/v1/accounting/shares", async (req, res): Promise<void> => {
  const parsed = ShareBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  // 대상이 없는 공유는 아무것도 열지 않는다 — 조용히 만들어 두면 "공유했는데 왜
  // 안 보이냐"가 된다.
  if (!b.share_branch_id && !b.share_team_id) {
    res.status(400).json({ error: "Pick a branch or a team to share with" });
    return;
  }
  const [row] = await db.insert(accountingSharesTable).values({
    record_type: b.record_type,
    record_id: b.record_id,
    share_branch_id: b.share_branch_id ?? null,
    share_team_id: b.share_team_id ?? null,
    note: b.note ?? null,
    created_by: (req as any).user?.id ?? null,
  }).onConflictDoNothing().returning();
  res.status(201).json({ success: true, data: row ?? null });
});

router.delete("/v1/accounting/shares/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(accountingSharesTable).where(eq(accountingSharesTable.id, id));
  res.status(204).send();
});

export default router;
