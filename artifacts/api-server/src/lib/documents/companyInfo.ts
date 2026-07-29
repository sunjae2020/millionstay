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
import { db, integrationSettings, brandingSettingsTable, BRANDING_SINGLETON_ID } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCompanyInfo, type CompanyInfo } from "./theme";
import { setDocDateFormat, normalizeLang, type DocLang } from "./i18n";
import { formatPostalAddress } from "./address";

export const COMPANY_INFO_KEY = "company_info";

/**
 * Refresh the app-wide document date format from the global branding row.
 * Called from `resolveCompanyInfo()` — the common pre-build step of every
 * document route — so all generated paperwork uses the configured format.
 * `date_format` is a single global value, so caching it module-side is safe.
 */
async function syncDocDateFormat(): Promise<void> {
  try {
    const [row] = await db
      .select({ date_format: brandingSettingsTable.date_format })
      .from(brandingSettingsTable)
      .where(eq(brandingSettingsTable.id, BRANDING_SINGLETON_ID))
      .limit(1);
    setDocDateFormat(row?.date_format);
  } catch {
    /* keep the last-known / default format */
  }
}

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
  /** Company seal / stamp (도장) image URL, shown on the issuer/signature block. */
  stamp_url?: string;
  brand_color?: string;
  // Operator/legal fields shown in the public landing footer + legal pages
  // (KR business-registration info, legally displayed publicly on a commerce site).
  ceo?: string;
  biz_no?: string;
  privacy_officer?: string;
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

/** Compose a single-line address from the stored parts, in `lang` order. */
function composeAddress(s: StoredCompanyInfo, lang: DocLang): string {
  return formatPostalAddress({
    line1: s.address1, line2: s.address2, suburb: s.suburb,
    state: s.state, postcode: s.postcode, country: s.country,
  }, lang);
}

/**
 * Resolve the document CompanyInfo: stored values override env defaults.
 * `lang` only affects address ordering — pass the document's language so the
 * issuer block reads naturally for its reader; it defaults to the tenant's.
 */
export async function resolveCompanyInfo(lang?: DocLang): Promise<CompanyInfo> {
  const defaults = getCompanyInfo();
  await syncDocDateFormat();
  const s = await readStoredCompanyInfo();
  const address = composeAddress(s, normalizeLang(lang));
  return {
    legalName: s.company_name?.trim() || defaults.legalName,
    tradingName: s.trading_name?.trim() || defaults.tradingName,
    // KR issuers store the registration number in biz_no (사업자등록번호); AU in abn.
    abn: s.biz_no?.trim() || s.abn?.trim() || defaults.abn,
    regLabel: defaults.regLabel,
    ceo: s.ceo?.trim() || defaults.ceo,
    email: s.email?.trim() || defaults.email,
    phone: s.phone?.trim() || defaults.phone,
    website: s.website?.trim() || defaults.website,
    address: address || defaults.address,
    logoUrl: s.logo_url?.trim() || defaults.logoUrl,
    stampUrl: s.stamp_url?.trim() || defaults.stampUrl,
    brandColor: s.brand_color?.trim() || undefined,
  };
}

/**
 * Public-safe company/operator block for the landing footer + legal pages.
 * Single source of truth = Settings → Organisation. Footer/legal fields are
 * returned EMPTY when unset (not env-filled) so the guest web can fall back to
 * its localized i18n defaults; only `email`/`tradingName` keep an env fallback
 * for backward compatibility with the guest support-email lookup.
 */
export interface PublicCompanyContact {
  email: string;
  tradingName: string;
  companyName: string;
  ceo: string;
  bizNo: string;
  address: string;
  phone: string;
  website: string;
  privacyOfficer: string;
}

export async function resolvePublicCompanyContact(): Promise<PublicCompanyContact> {
  const defaults = getCompanyInfo();
  const s = await readStoredCompanyInfo();
  return {
    email: s.email?.trim() || defaults.email,
    tradingName: s.trading_name?.trim() || defaults.tradingName,
    companyName: s.company_name?.trim() || "",
    ceo: s.ceo?.trim() || "",
    // `abn` is the same concept as a KR business-registration number — accept either.
    bizNo: s.biz_no?.trim() || s.abn?.trim() || "",
    // Free-text address line(s) only — NOT composeAddress(), whose AU state/
    // country parts would pollute a KR footer (e.g. "…, VIC, AU"). Empty when
    // unset so the web falls back to its localized i18n address.
    address: [s.address1, s.address2].map((x) => x?.trim()).filter(Boolean).join(", "),
    phone: s.phone?.trim() || "",
    website: s.website?.trim() || "",
    privacyOfficer: s.privacy_officer?.trim() || "",
  };
}
