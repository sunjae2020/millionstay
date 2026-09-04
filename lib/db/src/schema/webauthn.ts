import { pgTable, serial, integer, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// Passkeys (WebAuthn). One table serves all three audiences — admin (`users`),
// partner (`partner_users`) and guest (`guest_users`) — because the credential
// shape is identical and only the (user_type, user_id) pair differs. Keeping
// them together means one verification path instead of three copies.
export const webauthnCredentialsTable = pgTable(
  "webauthn_credentials",
  {
    id: serial("id").primaryKey(),
    user_type: text("user_type").notNull(), // admin | partner | guest
    user_id: integer("user_id").notNull(),
    // Base64URL credential id as returned by the authenticator.
    credential_id: text("credential_id").notNull(),
    // Base64URL COSE public key.
    public_key: text("public_key").notNull(),
    // Signature counter; a decrease signals a cloned authenticator.
    counter: integer("counter").notNull().default(0),
    // Comma-separated hints (usb,nfc,ble,internal,hybrid) for the next login.
    transports: text("transports"),
    // singleDevice | multiDevice (synced passkeys are multiDevice).
    device_type: text("device_type"),
    backed_up: boolean("backed_up").notNull().default(false),
    // The RP the credential was created for — passkeys are scoped per hostname,
    // so a credential registered on the admin host never logs in on a portal.
    rp_id: text("rp_id").notNull(),
    // User-facing label ("김용식 아이폰"); defaults to the registering UA.
    device_name: text("device_name"),
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    credentialIdIdx: uniqueIndex("webauthn_credentials_credential_id_key").on(t.credential_id),
    ownerIdx: index("webauthn_credentials_owner_idx").on(t.user_type, t.user_id),
  }),
);

// Short-lived challenges. Stored in the DB rather than in memory because the
// API runs multiple instances — a challenge issued by one must verify on another.
export const webauthnChallengesTable = pgTable(
  "webauthn_challenges",
  {
    id: serial("id").primaryKey(),
    challenge: text("challenge").notNull(),
    purpose: text("purpose").notNull(), // register | login
    user_type: text("user_type").notNull(),
    // NULL for a discoverable-credential login (we don't know who is at the
    // keyboard until the authenticator answers).
    user_id: integer("user_id"),
    rp_id: text("rp_id").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    expiresIdx: index("webauthn_challenges_expires_idx").on(t.expires_at),
  }),
);
