import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Supported display languages for the public website. Editable from the admin
// portal so new languages can be added without a code deploy.
export const languagesTable = pgTable("languages", {
  code: text("code").primaryKey(), // BCP-47-ish code, e.g. "en", "ko", "zh"
  name: text("name").notNull(), // native name, e.g. "한국어"
  english_name: text("english_name"), // e.g. "Korean"
  flag_iso: text("flag_iso"), // ISO country code used for the flag, e.g. "kr"
  enabled: boolean("enabled").notNull().default(true),
  is_default: boolean("is_default").notNull().default(false),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// One row per (language, key). `key` is the flattened dot-notation i18n key,
// e.g. "nav.links.search". The landing page overlays these on top of its
// bundled defaults, so a missing row simply falls back to the bundled value.
export const translationsTable = pgTable(
  "translations",
  {
    id: serial("id").primaryKey(),
    lang: text("lang").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull().default(""),
    updated_by: integer("updated_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniqueLangKey: unique("translations_lang_key_uq").on(t.lang, t.key),
  }),
);

export const insertLanguageSchema = createInsertSchema(languagesTable).omit({
  created_at: true,
  updated_at: true,
});
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
export type Language = typeof languagesTable.$inferSelect;

export const insertTranslationSchema = createInsertSchema(translationsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type Translation = typeof translationsTable.$inferSelect;
