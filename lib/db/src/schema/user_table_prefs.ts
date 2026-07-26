import { pgTable, serial, integer, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";

// Per-admin-user list-table view preferences: column order, hidden columns, and
// column widths — stored so a user's layout for each list page ("spaces",
// "bookings", …) follows their account across devices. One row per
// (user_id, table_key); the `prefs` blob is a sparse overlay merged over the
// page's ColumnDef defaults on the client, so it stays robust to columns being
// added/removed across releases.
export const userTablePrefsTable = pgTable(
  "user_table_prefs",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").notNull(), // admin_users.id (FK enforced in migration)
    table_key: text("table_key").notNull(), // e.g. "spaces", "bookings"
    // { order: string[], hidden: string[], widths: Record<string, number> }
    prefs: jsonb("prefs").notNull().default({}),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("user_table_prefs_user_table_uq").on(t.user_id, t.table_key)],
);

export type UserTablePref = typeof userTablePrefsTable.$inferSelect;
export type InsertUserTablePref = typeof userTablePrefsTable.$inferInsert;
