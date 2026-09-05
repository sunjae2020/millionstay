import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject"),
  task_status: text("task_status").notNull().default("Todo"),
  priority: text("priority").notNull().default("Medium"),
  task_category: text("task_category"),
  primary_contact_id: integer("primary_contact_id"),
  secondary_contact_id: integer("secondary_contact_id"),
  account_id: integer("account_id"),
  booking_id: integer("booking_id"),
  start_date: date("start_date"),
  due_date: date("due_date"),
  // 시각이 있는 일정(방문 예약 등). due_date 는 날짜뿐이라 "오후 3시" 를 담지
  // 못한다 — 시각이 필요한 업무만 아래를 채우고 나머지는 지금까지대로 둔다(0088).
  scheduled_start_at: timestamp("scheduled_start_at", { withTimezone: true }),
  scheduled_end_at: timestamp("scheduled_end_at", { withTimezone: true }),
  /** 어느 문의에서 잡힌 일정인지. 계약 전이라 booking_id 로는 못 가리킨다. */
  lead_id: integer("lead_id"),
  /** 보러 가는 세대. 아직 안 정해진 방문도 있어 nullable. */
  space_id: integer("space_id"),
  /** 만나는 장소 — 세대 미정이거나 사무실에서 만나는 경우가 있다. */
  location: text("location"),
  /**
   * 담당자. 연락처 슬롯 둘은 "누구에 관한 업무인가"이지 "누가 하는가"가 아니어서,
   * 업무에는 담당자 칸이 없었다. leads.assigned_to 와 같은 자유 텍스트(0088).
   */
  assigned_to: text("assigned_to"),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  description: text("description"),
  manual_input: boolean("manual_input").notNull().default(false),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
