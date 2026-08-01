import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

// Editable blog category list, managed from property-admin (Content → Blog
// Categories). `blog_posts.category` stays a free-text column that stores the
// category NAME; this table just drives the admin dropdown and the public blog
// filter. Hiding (is_active=false) removes a category from those lists without
// touching existing posts.
export const blogCategoriesTable = pgTable(
  "blog_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Categories belong to one site's blog ('www' | 'homestay' | 'dev').
    site_key: text("site_key").notNull().default("www"),
    sort_order: integer("sort_order").notNull().default(0),
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  // Names are unique WITHIN a site — two sites may each have a "News" category.
  (t) => [unique("blog_categories_name_site_unique").on(t.name, t.site_key)],
);

export type BlogCategory = typeof blogCategoriesTable.$inferSelect;
