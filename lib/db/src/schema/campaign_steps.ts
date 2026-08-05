import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One step of a drip sequence. `step_no` 1 is the initial message; later steps
 * fire `delay_days`/`delay_hours` after the previous step was sent, subject to the
 * campaign send window.
 *
 * Content is either inline (`subject` + `body_html`) or, when `template_code` is
 * set, resolved from the existing `email_template` table so the two systems share
 * one variable-substitution syntax. `body_i18n` holds per-locale overrides keyed by
 * language code, mirroring the document_template_translations pattern.
 */
export const campaignStepsTable = pgTable(
  "campaign_steps",
  {
    id: serial("id").primaryKey(),
    campaign_id: integer("campaign_id").notNull(),
    step_no: integer("step_no").notNull().default(1),
    name: text("name").notNull().default(""),
    template_code: text("template_code"),
    subject: text("subject").notNull().default(""),
    body_html: text("body_html").notNull().default(""),
    body_i18n: jsonb("body_i18n").$type<Record<string, { subject?: string; body_html?: string }>>(),
    delay_days: integer("delay_days").notNull().default(0),
    delay_hours: integer("delay_hours").notNull().default(0),
    // Stop advancing this prospect through the sequence once they engage.
    // 'none' | 'open' | 'click' | 'reply'
    stop_on: text("stop_on").notNull().default("reply"),
    status: text("status").notNull().default("Active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_campaign_steps_no").on(t.campaign_id, t.step_no),
    index("idx_campaign_steps_campaign").on(t.campaign_id),
  ],
);

export const insertCampaignStepSchema = createInsertSchema(campaignStepsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertCampaignStep = z.infer<typeof insertCampaignStepSchema>;
export type CampaignStep = typeof campaignStepsTable.$inferSelect;
