/**
 * Company info resolution for documents (Document Hub follow-up)
 *
 * Company / issuer details are stored as a single JSON blob in the
 * `integration_settings` key-value table under `company_info`, editable from
 * Settings → Organisation. This avoids a dedicated table/migration.
 *
 * `resolveCompanyInfo()` reads that blob, maps it to the document `CompanyInfo`
 * shape, and falls back to env-based defaults (`getCompanyInfo()`) for any
 * missing field — so documents always render even before the form is saved.
 */
import { db, integrationSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCompanyInfo, type CompanyInfo } from "./theme";

export const COMPANY_INFO_KEY = "company_info";

/** Persisted form shape (Settings → Organisation). All fields optional. */
export interface StoredCompanyInfo {
  company_name?: string;
  trading_name?: string;
  abn?: string;
  phone?: string;
  email?: string;
  website?: string;
  address1?: string;
  address2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  timezone?: string;
  logo_url?: string;
}

/** Read the raw stored blob (or empty object if unset / unparseable). */
export async function readStoredCompanyInfo(): Promise<StoredCompanyInfo> {
  try {
    const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.key, COMPANY_INFO_KEY));
    if (!row?.value) return {};
    return JSON.parse(row.value) as StoredCompanyInfo;
  } catch {
    return {};
  }
}

/** Compose a single-line address from the stored parts. */
function composeAddress(s: StoredCompanyInfo): string {
  return [
    s.address1,
    s.address2,
    s.suburb,
    [s.state, s.postcode].filter(Boolean).join(" ").trim() || null,
    s.country,
  ].filter(Boolean).join(", ");
}

/** Resolve the document CompanyInfo: stored values override env defaults. */
export async function resolveCompanyInfo(): Promise<CompanyInfo> {
  const defaults = getCompanyInfo();
  const s = await readStoredCompanyInfo();
  const address = composeAddress(s);
  return {
    legalName: s.company_name?.trim() || defaults.legalName,
    tradingName: s.trading_name?.trim() || defaults.tradingName,
    abn: s.abn?.trim() || defaults.abn,
    email: s.email?.trim() || defaults.email,
    phone: s.phone?.trim() || defaults.phone,
    website: s.website?.trim() || defaults.website,
    address: address || defaults.address,
    logoUrl: s.logo_url?.trim() || defaults.logoUrl,
  };
}
