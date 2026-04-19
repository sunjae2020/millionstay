import { pgTable, uuid, integer, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Refresh Tokens table — Sprint A-5
 *
 * Stores hashed refresh tokens (sha256) so that they can be revoked or rotated
 * without the user being able to forge them from the DB contents.
 *
 * Token lifecycle:
 *   1. Login        → issue access (short-lived) + refresh (long-lived) tokens, store hash
 *   2. Refresh call → verify hash, revoke old, issue new (rotation pattern)
 *   3. Logout       → mark revoked_at on the current refresh token
 *   4. Compromise   → bulk-revoke all rows for a user
 */
export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: integer("user_id").notNull(),
    user_type: varchar("user_type", { length: 16 }).notNull(), // 'admin' | 'guest' | 'partner'
    token_hash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    ip_address: varchar("ip_address", { length: 45 }),
    user_agent: varchar("user_agent", { length: 512 }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_refresh_tokens_user").on(t.user_id, t.user_type),
    index("idx_refresh_tokens_expires").on(t.expires_at),
  ],
);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type InsertRefreshToken = typeof refreshTokensTable.$inferInsert;
