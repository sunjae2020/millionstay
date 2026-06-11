import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// API credentials issued to EXTERNAL third-party apps so they can call the
// public /api/ext/v1/* endpoints with an API Key + Secret pair.
//
// SECURITY: the secret is shown to the operator exactly once at creation/rotation
// time and is NEVER stored in plaintext — only its bcrypt hash lives here. The
// public "key_id" identifies the credential and is safe to display.
export const apiCredentialsTable = pgTable("api_credentials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // human label for the external app, e.g. "Owner mobile app"
  key_id: text("key_id").notNull().unique(), // public identifier, e.g. "msk_live_ab12…"
  secret_hash: text("secret_hash").notNull(), // bcrypt hash of the secret — never the secret itself
  secret_last4: text("secret_last4"), // last 4 chars of the secret, for display hints only
  // JSON-encoded array of scope strings, e.g. ["bookings:read","tasks:write"].
  scopes: text("scopes").notNull().default("[]"),
  is_active: boolean("is_active").notNull().default(true),
  last_used_at: timestamp("last_used_at", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  created_by: integer("created_by"), // admin user id who issued the credential
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApiCredentialSchema = createInsertSchema(apiCredentialsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertApiCredential = z.infer<typeof insertApiCredentialSchema>;
export type ApiCredential = typeof apiCredentialsTable.$inferSelect;
