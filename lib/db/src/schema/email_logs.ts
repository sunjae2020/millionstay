import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailLogsTable = pgTable("email_log", {
  id: serial("id").primaryKey(),
  template_code: text("template_code"),
  to_email: text("to_email").notNull(),
  to_name: text("to_name"),
  subject: text("subject").notNull(),
  resend_message_id: text("resend_message_id"),
  status: text("status").notNull().default("Sent"),
  entity_type: text("entity_type"),
  entity_id: integer("entity_id"),
  sent_at: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  delivered_at: timestamp("delivered_at", { withTimezone: true }),
  error_message: text("error_message"),
}, (table) => [
  index("idx_email_log_entity").on(table.entity_type, table.entity_id),
]);

export const insertEmailLogSchema = createInsertSchema(emailLogsTable, {
  to_email: z.string().email(),
  subject: z.string(),
  template_code: z.string().optional().nullable(),
  to_name: z.string().optional().nullable(),
  resend_message_id: z.string().optional().nullable(),
  entity_type: z.string().optional().nullable(),
  entity_id: z.number().int().optional().nullable(),
  error_message: z.string().optional().nullable(),
}).omit({ id: true, sent_at: true });
