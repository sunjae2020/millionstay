// Passkey (WebAuthn) plumbing shared by the three audiences — admin, partner
// and guest. Everything here is audience-agnostic; routes/passkeys.ts binds it
// to a concrete user table and token issuer.
import crypto from "node:crypto";
import { and, eq, isNull, lt, inArray } from "drizzle-orm";
import { db, webauthnCredentialsTable, webauthnChallengesTable } from "@workspace/db";
import { isOriginAllowed } from "./allowedOrigins";

export type PasskeyAudience = "admin" | "partner" | "guest";

export const PASSKEY_AUDIENCES: readonly PasskeyAudience[] = ["admin", "partner", "guest"] as const;

export function isPasskeyAudience(v: unknown): v is PasskeyAudience {
  return typeof v === "string" && (PASSKEY_AUDIENCES as readonly string[]).includes(v);
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * The relying party for this request.
 *
 * The RP ID is the exact request hostname, NOT the apex: owner landing sites
 * live on arbitrary {slug}.millionstay.com subdomains, and an apex-scoped RP ID
 * would let any of them ask for our passkeys. One credential therefore belongs
 * to one host (admin.example.com passkeys don't log in on host.example.com),
 * which is what we want. WEBAUTHN_RP_ID overrides it for instances that
 * deliberately share credentials across a controlled set of hosts.
 */
export function resolveRp(req: any): { rpID: string; origin: string; rpName: string } | null {
  const origin = typeof req.headers?.origin === "string" && req.headers.origin
    ? req.headers.origin
    : `${req.protocol}://${req.get?.("host") ?? ""}`;
  if (!origin || !isOriginAllowed(origin)) return null;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return null;
  }
  const rpID = (process.env["WEBAUTHN_RP_ID"] ?? "").trim() || hostname;
  const rpName = (process.env["WEBAUTHN_RP_NAME"] ?? "").trim() || "MillionStay";
  return { rpID, origin, rpName };
}

/* ── Challenges ────────────────────────────────────────────────────────────
   Stored in the DB, not in memory: the API runs several instances, so the one
   that issues a challenge is rarely the one that verifies it.               */

export async function storeChallenge(input: {
  challenge: string;
  purpose: "register" | "login";
  userType: PasskeyAudience;
  userId?: number | null;
  rpID: string;
}): Promise<number> {
  // Opportunistic sweep — expired challenges are worthless and unbounded growth
  // is the only way this table misbehaves.
  await db.delete(webauthnChallengesTable).where(lt(webauthnChallengesTable.expires_at, new Date()));
  const [row] = await db
    .insert(webauthnChallengesTable)
    .values({
      challenge: input.challenge,
      purpose: input.purpose,
      user_type: input.userType,
      user_id: input.userId ?? null,
      rp_id: input.rpID,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning({ id: webauthnChallengesTable.id });
  return row!.id;
}

/** Consumes a challenge: single use, so a replayed response finds nothing. */
export async function consumeChallenge(input: {
  id: number;
  purpose: "register" | "login";
  userType: PasskeyAudience;
  userId?: number | null;
}): Promise<string | null> {
  if (!Number.isFinite(input.id)) return null;
  const [row] = await db
    .delete(webauthnChallengesTable)
    .where(eq(webauthnChallengesTable.id, input.id))
    .returning();
  if (!row) return null;
  if (row.purpose !== input.purpose) return null;
  if (row.user_type !== input.userType) return null;
  if (input.userId != null && row.user_id !== input.userId) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.challenge;
}

/* ── Credentials ───────────────────────────────────────────────────────── */

export async function listCredentials(userType: PasskeyAudience, userId: number) {
  return db
    .select()
    .from(webauthnCredentialsTable)
    .where(
      and(
        eq(webauthnCredentialsTable.user_type, userType),
        eq(webauthnCredentialsTable.user_id, userId),
        isNull(webauthnCredentialsTable.deleted_at),
      ),
    );
}

export async function findCredentialById(credentialId: string) {
  const [row] = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(
      and(
        eq(webauthnCredentialsTable.credential_id, credentialId),
        isNull(webauthnCredentialsTable.deleted_at),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function parseTransports(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const list = v.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

/** A stable per-user WebAuthn user handle: "<audience>:<id>", base64url. */
export function userHandle(userType: PasskeyAudience, userId: number) {
  return new TextEncoder().encode(`${userType}:${userId}`);
}

/** Best-effort device label from the User-Agent, so the list isn't all "Passkey". */
export function deviceNameFromUserAgent(ua: string | undefined): string {
  const s = ua ?? "";
  if (/iPhone/i.test(s)) return "iPhone";
  if (/iPad/i.test(s)) return "iPad";
  if (/Android/i.test(s)) return "Android";
  if (/Macintosh|Mac OS X/i.test(s)) return "Mac";
  if (/Windows/i.test(s)) return "Windows";
  if (/Linux/i.test(s)) return "Linux";
  return "Passkey";
}

export function newChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Cheap guard so a caller can't hoard credentials on one account. */
export const MAX_CREDENTIALS_PER_USER = 20;

export async function credentialsFor(userType: PasskeyAudience, userIds: number[]) {
  if (!userIds.length) return [];
  return db
    .select()
    .from(webauthnCredentialsTable)
    .where(
      and(
        eq(webauthnCredentialsTable.user_type, userType),
        inArray(webauthnCredentialsTable.user_id, userIds),
        isNull(webauthnCredentialsTable.deleted_at),
      ),
    );
}
