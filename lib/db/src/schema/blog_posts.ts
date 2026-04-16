import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  cover_image_url: text("cover_image_url"),
  category: text("category"),
  author: text("author"),
  status: text("status").notNull().default("Draft"),
  published_at: timestamp("published_at", { withTimezone: true }),
  seo_title: text("seo_title"),
  seo_description: text("seo_description"),
  seo_keywords: text("seo_keywords"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPostsTable.$inferSelect;
