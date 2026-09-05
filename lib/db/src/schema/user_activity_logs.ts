import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * 사용자 활동 로그 — "무엇을 바꿨나"가 아니라 "무엇을 했나"를 남긴다.
 *
 * 생성·수정·삭제(CUD)는 이미 `system_log`(utils/auditLog.ts → logAction)가
 * 전·후 값까지 남기므로 여기서 중복해서 쌓지 않는다. 이 테이블은 값이 바뀌지
 * 않는 행위 — 로그인/로그아웃, 문서 열람·다운로드, CSV 내보내기, AI·OCR 호출,
 * 서류 발행 — 을 담당한다. 두 테이블을 시스템 로그 화면에서 하나의 피드로
 * 합쳐 보여 준다(routes/system-logs.ts).
 *
 * 적재는 응답이 끝난 뒤(res.on("finish")) 비동기로 이뤄지므로 요청을 막지 않는다.
 * 보존 기간은 다른 로그와 같은 정책을 따른다(lib/retentionPurge.ts).
 */
export const userActivityLogsTable = pgTable("user_activity_log", {
  id: serial("id").primaryKey(),
  /** admin_users.id. 로그인 실패처럼 사용자가 특정되지 않으면 NULL. */
  actor_id: integer("actor_id"),
  actor_email: text("actor_email"),
  actor_role: text("actor_role"),
  /** 로그 시점의 소속(admin_users 스냅숏) — 조직이 개편돼도 당시 기준이 남는다. */
  branch_id: integer("branch_id"),
  team_id: integer("team_id"),
  /** LOGIN | LOGOUT | LOGIN_FAILED | VIEW | DOWNLOAD | EXPORT | AI_CALL | OCR_RUN | DOC_ISSUE | SEND_EMAIL | IMPORT */
  action: text("action").notNull(),
  /** 대상 도메인(document, invoice, contract, export …). */
  resource_type: text("resource_type"),
  /** URL 에서 뽑은 대상 id(숫자 경로 파라미터). 없으면 NULL. */
  resource_id: integer("resource_id"),
  method: text("method"),
  path: text("path"),
  status_code: integer("status_code"),
  duration_ms: integer("duration_ms"),
  metadata: jsonb("metadata"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_activity_actor_created").on(table.actor_id, table.created_at),
  index("idx_activity_action").on(table.action),
  index("idx_activity_resource").on(table.resource_type, table.resource_id),
  index("idx_activity_created").on(table.created_at),
]);

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogsTable, {
  action: z.string(),
  actor_id: z.number().int().optional().nullable(),
  actor_email: z.string().optional().nullable(),
  actor_role: z.string().optional().nullable(),
  resource_type: z.string().optional().nullable(),
  resource_id: z.number().int().optional().nullable(),
  metadata: z.any().optional().nullable(),
}).omit({ id: true, created_at: true });

export type UserActivityLog = typeof userActivityLogsTable.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLogsTable.$inferInsert;
