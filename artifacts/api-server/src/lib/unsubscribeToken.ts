/**
 * Unsubscribe token utility — Sprint B-1
 *
 * Generates and verifies HMAC-signed unsubscribe tokens that can be embedded
 * in marketing emails without a DB lookup. Token format:
 *   base64url(payload).base64url(signature)
 * payload = JSON({ email, channel, ts })
 * signature = HMAC-SHA256(SESSION_SECRET, payload)
 */
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("SESSION_SECRET (or JWT_SECRET) is required for unsubscribe tokens");
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function buildUnsubscribeToken(email: string, channel: "email" | "sms" = "email"): string {
  const payload = JSON.stringify({ email: email.toLowerCase().trim(), channel, ts: Date.now() });
  const payloadB64 = b64url(Buffer.from(payload, "utf8"));
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(sig)}`;
}

export interface UnsubscribePayload {
  email: string;
  channel: "email" | "sms";
  ts: number;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  if (!token || typeof token !== "string") return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  const providedSig = fromB64url(sigB64);
  if (expectedSig.length !== providedSig.length) return null;
  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  let payload: UnsubscribePayload;
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.email || !payload.channel || typeof payload.ts !== "number") return null;
  if (Date.now() - payload.ts > TOKEN_TTL_MS) return null;

  return payload;
}

/** Build the public unsubscribe URL embedded in marketing emails. */
export function buildUnsubscribeUrl(email: string, channel: "email" | "sms" = "email"): string {
  const base =
    process.env.PUBLIC_APP_URL ?? process.env.CLIENT_URL ?? "http://localhost";
  const token = buildUnsubscribeToken(email, channel);
  return `${base.replace(/\/$/, "")}/api/v1/privacy/unsubscribe?token=${encodeURIComponent(token)}`;
}
