import { pgTable, uuid, varchar, timestamp, boolean, index } from "drizzle-orm/pg-core";

/**
 * Login Attempts — Sprint B-6
 *
 * Records login attempts so that a brute-force lockout can be enforced.
 * Policy: 5 failed attempts within 15 minutes for the same email locks the
 * account for 15 minutes. Successful login deletes prior failures for the email.
 */
export const loginAttemptsTable = pgTable(
  "login_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    ip_address: varchar("ip_address", { length: 45 }),
    user_type: varchar("user_type", { length: 16 }).notNull(), // 'admin' | 'guest' | 'partner'
    success: boolean("success").notNull().default(false),
    attempted_at: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_login_attempts_email_time").on(t.email, t.attempted_at),
  ],
);

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
export type InsertLoginAttempt = typeof loginAttemptsTable.$inferInsert;
