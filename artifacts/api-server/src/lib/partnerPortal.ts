/**
 * Partner portal account helpers — shared by the partner auth routes (self-serve
 * "forgot password") and the admin 계정 → 포털 사용 section, which issues the very
 * same link when an operator invites a partner or resets their password.
 *
 * Keeping the token shape in one place means a link minted by an admin and one
 * minted by the portal are indistinguishable to /auth/partner/reset-password.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, partnerUsersTable, type PartnerUser } from "@workspace/db";
import { sendPasswordResetEmail } from "./email";

export const PORTAL_TYPES = ["agent", "owner", "service_host"] as const;
export type PortalTypeName = (typeof PORTAL_TYPES)[number];

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const BCRYPT_COST = 12;

/** The portal this user signs into — env-configurable per tenant deployment. */
export function portalBaseUrl(portalType: string): string {
  const base = process.env["CLIENT_URL"] || "https://millionstay.com";
  switch (portalType) {
    case "agent": return process.env["AGENT_PORTAL_URL"] || `${base}/agent`;
    case "owner": return process.env["OWNER_PORTAL_URL"] || `${base}/owner`;
    case "service_host": return process.env["SERVICE_HOST_PORTAL_URL"] || `${base}/service-host`;
    default: return base;
  }
}

/**
 * Stamp a fresh reset token on the user and email them the link.
 * Returns false when the mail could not be sent (the token is still stored, so
 * the operator can retry) — callers decide whether that is fatal.
 */
export async function issuePartnerResetLink(
  user: Pick<PartnerUser, "id" | "email" | "first_name" | "last_name" | "portal_type">,
): Promise<boolean> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db
    .update(partnerUsersTable)
    .set({ reset_token_hash: tokenHash, reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS) })
    .where(eq(partnerUsersTable.id, user.id));

  const resetUrl = `${portalBaseUrl(user.portal_type)}/reset-password#token=${rawToken}`;
  return sendPasswordResetEmail({
    to: user.email,
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "Partner",
    resetUrl,
  });
}
