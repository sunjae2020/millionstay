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
 *   4. Compromise   → revoke the offending token *family* (see below)
 *
 * `family_id` groups every token descended from one login. Rotation copies the
 * parent's family_id onto the successor, so a whole browser session is one
 * family. Reuse of an already-rotated token kills only that family — signing a
 * user out of the laptop they left open must not sign them out of the desktop
 * they are working on. Legacy rows (issued before the column existed) were
 * backfilled with their own id, making each of them a family of one.
 */
export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: integer("user_id").notNull(),
    user_type: varchar("user_type", { length: 16 }).notNull(), // 'admin' | 'guest' | 'partner'
    /** Login lineage: every token rotated from the same login shares this id. */
    family_id: uuid("family_id"),
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
    index("idx_refresh_tokens_family").on(t.family_id),
  ],
);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type InsertRefreshToken = typeof refreshTokensTable.$inferInsert;
