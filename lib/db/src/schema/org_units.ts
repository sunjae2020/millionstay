import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// 조직 단위 — 지점(branch)과 팀(team).
//
// 회계 접근 범위(HQ/지점/팀)의 뼈대다. 지점이 여러 개인 운영에서 "다른 지점 장부가
// 다 보인다"는 것은 사고이므로, 회계 레코드에 귀속(Class)을 달고 보는 사람의
// 소속으로 거른다. 자세한 규칙은 api-server/src/lib/accounting/scope.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  /**
   * 본사는 전 지점의 회계를 본다. 여러 개일 수 있다(본사·재무본부 등) — 하나로
   * 강제하면 재무팀을 어디에 둘지가 매번 문제가 된다.
   */
  is_headquarters: boolean("is_headquarters").notNull().default(false),
  address: text("address"),
  phone: text("phone"),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  /** 팀은 반드시 지점에 속한다 — 지점 없는 팀은 "누가 보나"에 답이 없다. */
  branch_id: integer("branch_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * 명시적 공유 — 소속이 다른 지점·팀에게 **특정 레코드만** 열어 준다.
 * 스코프를 넓히는 유일한 예외 경로이므로, 사람이 하나씩 지정한 것만 들어온다.
 */
export const accountingSharesTable = pgTable("accounting_shares", {
  id: serial("id").primaryKey(),
  record_type: text("record_type").notNull(), // 'transaction' …
  record_id: integer("record_id").notNull(),
  share_branch_id: integer("share_branch_id"),
  share_team_id: integer("share_team_id"),
  note: text("note"),
  created_by: integer("created_by"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBranchSchema = createInsertSchema(branchesTable).omit({ id: true, created_at: true, updated_at: true });
export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, created_at: true, updated_at: true });
export type Branch = typeof branchesTable.$inferSelect;
export type Team = typeof teamsTable.$inferSelect;
export type AccountingShare = typeof accountingSharesTable.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
