import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailTemplatesTable = pgTable("email_template", {
  id: serial("id").primaryKey(),
  template_code: text("template_code").notNull().unique(),
  subject: text("subject").notNull(),
  body_html: text("body_html").notNull(),
  body_text: text("body_text"),
  available_vars: jsonb("available_vars"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplatesTable, {
  template_code: z.string(),
  subject: z.string(),
  body_html: z.string(),
  body_text: z.string().optional().nullable(),
  available_vars: z.any().optional().nullable(),
}).omit({ id: true, created_at: true, updated_at: true });
