import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const systemLogsTable = pgTable("system_log", {
  id: serial("id").primaryKey(),
  entity_type: text("entity_type").notNull(),
  entity_id: integer("entity_id").notNull(),
  action: text("action").notNull(),
  actor_type: text("actor_type").notNull().default("User"),
  actor_id: integer("actor_id"),
  actor_email: text("actor_email"),
  old_value: jsonb("old_value"),
  new_value: jsonb("new_value"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_syslog_entity").on(table.entity_type, table.entity_id),
  index("idx_syslog_actor").on(table.actor_id),
  index("idx_syslog_created").on(table.created_at),
]);

export const insertSystemLogSchema = createInsertSchema(systemLogsTable, {
  entity_type: z.string(),
  entity_id: z.number().int(),
  action: z.string(),
  actor_type: z.string().optional(),
  actor_id: z.number().int().optional().nullable(),
  actor_email: z.string().optional().nullable(),
  old_value: z.any().optional().nullable(),
  new_value: z.any().optional().nullable(),
  ip_address: z.string().optional().nullable(),
  user_agent: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).omit({ id: true, created_at: true });
