import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  cover_image_url: text("cover_image_url"),
  cover_image_alt: text("cover_image_alt"),
  category: text("category"),
  // Which public site this post belongs to ('www' | 'homestay' | 'dev'). Each
  // site runs its own blog; historical posts default to the guest site.
  site_key: text("site_key").notNull().default("www"),
  // 'legacy' = the HTML in `content`; 'blocks' = the block tree in `body_json`
  // (and per-locale trees in cms_post_translations).
  render_mode: text("render_mode").notNull().default("legacy"),
  body_json: jsonb("body_json"),
  author: text("author"),
  status: text("status").notNull().default("Draft"),
  published_at: timestamp("published_at", { withTimezone: true }),
  seo_title: text("seo_title"),
  seo_description: text("seo_description"),
  seo_keywords: text("seo_keywords"),
  translations: jsonb("translations").default({}),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPostsTable.$inferSelect;
