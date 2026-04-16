import { pgTable, serial, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";

export const pageContentsTable = pgTable("page_contents", {
  id: serial("id").primaryKey(),
  page_key: text("page_key").notNull(),
  language: text("language").notNull().default("en"),
  content: jsonb("content").default({}),
  seo_title: text("seo_title"),
  seo_description: text("seo_description"),
  seo_keywords: text("seo_keywords"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("page_contents_page_key_language_unique").on(t.page_key, t.language),
]);

export type PageContent = typeof pageContentsTable.$inferSelect;
