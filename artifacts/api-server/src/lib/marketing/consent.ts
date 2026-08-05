/**
 * Sendability — the single place that decides whether an address may be mailed.
 *
 * Three independent records can forbid a send, and all three must be consulted
 * every time, because each expresses something the others cannot:
 *
 *   • marketing_consents  — the recipient's own decision. An explicit opt-out here
 *     outranks every other ground; it is also where the public unsubscribe
 *     endpoint writes, so this is what "수신거부" actually means in this system.
 *   • email_suppressions  — what consent cannot express: the address is dead
 *     (hard bounce) or its owner reported us as spam.
 *   • prospects.consent_basis — our legal ground for making contact at all.
 *
 * On the last point: `sendMarketingEmail()` in lib/email.ts requires an express
 * opt-in, which is right for the Australian instance (Spam Act 2003 s.16 — no
 * inferred consent for the addresses we hold). Cold partner development has no
 * opt-in by definition, so this module recognises a second ground —
 * `inferred_b2b`: a published business address, contacted about the business it
 * publishes. Korean 정보통신망법 §50 governs those sends through disclosure duties
 * instead ("(광고)" subject prefix, free opt-out, 21:00–08:00 quiet hours), which
 * the campaign layer enforces separately.
 *
 * The ground is therefore instance-scoped and defaults to the strict reading:
 * only MARKETING_INFERRED_CONSENT=true (set on the Korean instance) permits it.
 * Personal mailbox domains are excluded regardless — "published business address"
 * is the whole basis, and a gmail.com address is not one.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, marketingConsentsTable, emailSuppressionsTable } from "@workspace/db";

/** Legal grounds recorded on prospects.consent_basis. */
export type ConsentBasis = "express" | "inferred_b2b" | "existing" | "none";

export interface SendabilityInput {
  email: string;
  consentBasis?: string | null;
}

export interface SendabilityResult {
  sendable: boolean;
  /** Machine-readable reason when not sendable — stored on skip_reason. */
  reason?: "unsubscribed" | "suppressed" | "no_consent_basis" | "personal_domain" | "invalid_email";
  /** The ground relied on when sendable. */
  basis?: ConsentBasis;
  detail?: string;
}

/**
 * Mailbox providers whose addresses belong to a person, not to a published
 * business role. `inferred_b2b` never applies to these.
 */
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "naver.com", "hanmail.net", "daum.net", "kakao.com",
  "nate.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.jp", "yahoo.co.kr", "icloud.com", "me.com", "aol.com",
  "qq.com", "163.com", "126.com", "protonmail.com", "proton.me", "hanmir.com",
]);

/** RFC-shaped enough to reject typos and header injection; not a deliverability check. */
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function domainOf(email: string): string {
  return email.toLowerCase().trim().split("@")[1] ?? "";
}

export function isPersonalDomain(email: string): boolean {
  return PERSONAL_DOMAINS.has(domainOf(email));
}

/** Whether this instance may rely on inferred B2B consent (Korean instance only). */
export function inferredConsentAllowed(): boolean {
  return String(process.env.MARKETING_INFERRED_CONSENT ?? "").toLowerCase() === "true";
}

/**
 * Decide sendability for one address. Called twice per send — once when the
 * recipient list is built, and again immediately before handing the message to
 * the provider, because an unsubscribe that lands between those two moments must
 * still stop the send.
 */
export async function checkSendable(input: SendabilityInput): Promise<SendabilityResult> {
  const email = input.email.toLowerCase().trim();
  if (!isValidEmail(email)) return { sendable: false, reason: "invalid_email" };

  const [suppression] = await db
    .select()
    .from(emailSuppressionsTable)
    .where(sql`lower(${emailSuppressionsTable.email}) = ${email}`)
    .limit(1);
  if (suppression) {
    return { sendable: false, reason: "suppressed", detail: suppression.reason };
  }

  const [consent] = await db
    .select()
    .from(marketingConsentsTable)
    .where(and(eq(marketingConsentsTable.email, email), eq(marketingConsentsTable.channel, "email")))
    .limit(1);

  // An explicit withdrawal ends the analysis — no other ground revives it.
  if (consent?.opted_out_at) return { sendable: false, reason: "unsubscribed" };
  if (consent?.opted_in_at) return { sendable: true, basis: "express" };

  const basis = (input.consentBasis ?? "none") as ConsentBasis;

  if (basis === "existing") return { sendable: true, basis: "existing" };

  if (basis === "inferred_b2b") {
    if (!inferredConsentAllowed()) {
      return {
        sendable: false,
        reason: "no_consent_basis",
        detail: "Inferred B2B consent is not enabled for this instance",
      };
    }
    if (isPersonalDomain(email)) {
      return { sendable: false, reason: "personal_domain" };
    }
    return { sendable: true, basis: "inferred_b2b" };
  }

  return { sendable: false, reason: "no_consent_basis" };
}

/** Batch form of `checkSendable` — two queries regardless of list size. */
export async function checkSendableBatch(
  inputs: SendabilityInput[],
): Promise<Map<string, SendabilityResult>> {
  const out = new Map<string, SendabilityResult>();
  const emails = [...new Set(inputs.map((i) => i.email.toLowerCase().trim()))];
  if (emails.length === 0) return out;

  const suppressed = new Set(
    (
      await db
        .select({ email: emailSuppressionsTable.email, reason: emailSuppressionsTable.reason })
        .from(emailSuppressionsTable)
        .where(inArray(sql`lower(${emailSuppressionsTable.email})`, emails))
    ).map((r) => r.email.toLowerCase()),
  );

  const consents = new Map(
    (
      await db
        .select()
        .from(marketingConsentsTable)
        .where(
          and(
            inArray(sql`lower(${marketingConsentsTable.email})`, emails),
            eq(marketingConsentsTable.channel, "email"),
          ),
        )
    ).map((r) => [r.email.toLowerCase(), r] as const),
  );

  const allowInferred = inferredConsentAllowed();

  for (const input of inputs) {
    const email = input.email.toLowerCase().trim();
    if (!isValidEmail(email)) { out.set(email, { sendable: false, reason: "invalid_email" }); continue; }
    if (suppressed.has(email)) { out.set(email, { sendable: false, reason: "suppressed" }); continue; }

    const consent = consents.get(email);
    if (consent?.opted_out_at) { out.set(email, { sendable: false, reason: "unsubscribed" }); continue; }
    if (consent?.opted_in_at) { out.set(email, { sendable: true, basis: "express" }); continue; }

    const basis = (input.consentBasis ?? "none") as ConsentBasis;
    if (basis === "existing") { out.set(email, { sendable: true, basis: "existing" }); continue; }
    if (basis === "inferred_b2b") {
      if (!allowInferred) {
        out.set(email, { sendable: false, reason: "no_consent_basis", detail: "Inferred B2B consent is not enabled for this instance" });
      } else if (isPersonalDomain(email)) {
        out.set(email, { sendable: false, reason: "personal_domain" });
      } else {
        out.set(email, { sendable: true, basis: "inferred_b2b" });
      }
      continue;
    }
    out.set(email, { sendable: false, reason: "no_consent_basis" });
  }

  return out;
}
