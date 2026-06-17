// Application acknowledgment-email settings — controls, per application type,
// whether a "we received your application" email is sent to the applicant and
// whether the application is attached to that email as a PDF.
//
// Stored as a single JSON blob in the integration_settings KV (key
// `application_emails`). Mirrors the homestay-billing settings pattern
// (lib/homestay/billingSettings.ts): a safe getter that always returns a
// fully-populated object (defaults merged over stored values) so a missing or
// malformed row never breaks a send, plus a normalising setter.
import { eq } from "drizzle-orm";
import { db, integrationSettings } from "@workspace/db";

export const APPLICATION_EMAILS_KEY = "application_emails";

/** The four public application intakes that can send an acknowledgment email. */
export const APPLICATION_TYPES = ["homestay_host", "homestay_student", "landlord", "short_term"] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export interface AckEmailRule {
  /** Send the applicant a branded "application received" email on submission. */
  send_ack_email: boolean;
  /** Attach the application as a PDF to that acknowledgment email. */
  attach_pdf: boolean;
}

export type ApplicationEmailSettings = Record<ApplicationType, AckEmailRule>;

// Defaults reflect the live behaviour at the time this feature shipped: only the
// homestay host intake sent an applicant-facing acknowledgment; the others sent
// only an internal ops notification. PDF attachment is OFF everywhere so PDF
// rendering (Puppeteer) is never on the submission hot-path unless opted in.
export const DEFAULT_APPLICATION_EMAILS: ApplicationEmailSettings = {
  homestay_host: { send_ack_email: true, attach_pdf: false },
  homestay_student: { send_ack_email: false, attach_pdf: false },
  landlord: { send_ack_email: false, attach_pdf: false },
  short_term: { send_ack_email: false, attach_pdf: false },
};

function normalizeRule(raw: Partial<AckEmailRule> | undefined, def: AckEmailRule): AckEmailRule {
  return {
    send_ack_email: typeof raw?.send_ack_email === "boolean" ? raw.send_ack_email : def.send_ack_email,
    attach_pdf: typeof raw?.attach_pdf === "boolean" ? raw.attach_pdf : def.attach_pdf,
  };
}

function normalizeSettings(parsed: Partial<Record<ApplicationType, Partial<AckEmailRule>>>): ApplicationEmailSettings {
  return APPLICATION_TYPES.reduce((acc, type) => {
    acc[type] = normalizeRule(parsed?.[type], DEFAULT_APPLICATION_EMAILS[type]);
    return acc;
  }, {} as ApplicationEmailSettings);
}

/** Read the full settings object (defaults merged over stored values). Never throws. */
export async function getApplicationEmailSettings(): Promise<ApplicationEmailSettings> {
  try {
    const [row] = await db.select().from(integrationSettings)
      .where(eq(integrationSettings.key, APPLICATION_EMAILS_KEY)).limit(1);
    if (!row?.value) return structuredClone(DEFAULT_APPLICATION_EMAILS);
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return structuredClone(DEFAULT_APPLICATION_EMAILS);
  }
}

/** Convenience: the rule for a single application type. Never throws. */
export async function getAckRule(type: ApplicationType): Promise<AckEmailRule> {
  return (await getApplicationEmailSettings())[type];
}

/** Persist the full settings object (values normalised before saving). */
export async function saveApplicationEmailSettings(
  next: Partial<Record<ApplicationType, Partial<AckEmailRule>>>,
): Promise<ApplicationEmailSettings> {
  const normalized = normalizeSettings(next);
  await db.insert(integrationSettings)
    .values({ key: APPLICATION_EMAILS_KEY, value: JSON.stringify(normalized), updated_at: new Date() })
    .onConflictDoUpdate({ target: integrationSettings.key, set: { value: JSON.stringify(normalized), updated_at: new Date() } });
  return normalized;
}
