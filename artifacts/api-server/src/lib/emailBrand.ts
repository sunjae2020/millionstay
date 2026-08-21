/**
 * Tenant branding for every outbound email.
 *
 * Emails used to hard-code MillionStay chrome — the logo URL, the orange
 * #E8621A accent, "MillionStay Pty Ltd" in the footer and the brand name in the
 * subject — so a Metheim invoice arrived as a MillionStay email with a broken
 * logo. Branding now resolves the same way generated documents do: Settings →
 * Organisation (`company_info`) first, env fallbacks after, with the palette
 * coming from the DOC_* tokens the tenant's documents already use.
 *
 * Every email in this codebase must render through `renderEmailShell()` (or at
 * minimum take its colours/logo/names from `resolveEmailBrand()`). Do not
 * re-introduce a literal brand colour, logo URL or company name in a template.
 */
import { db, brandingSettingsTable, BRANDING_SINGLETON_ID } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveCompanyInfo } from "./documents/companyInfo";
import { DOC_TOKENS } from "./documents/theme";
import { escapeHtml } from "./htmlEscape";

/** Resolved per-tenant identity + palette handed to every email template. */
export interface EmailBrand {
  /** Trading name — what a recipient calls the sender ("메트하임 여수"). */
  name: string;
  /** Registered entity for the legal footer line. */
  legalName: string;
  /** Logo, guaranteed to be a format email clients actually render. */
  logoUrl: string;
  /** Customer-facing contact address shown in the body. */
  supportEmail: string;
  /** Single-line postal address for the footer (may be empty). */
  address: string;
  color: string;
  colorHover: string;
  accentBg: string;
  accentBorder: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  pageBg: string;
  border: string;
}

/**
 * Make a logo URL safe for email clients.
 *
 * Gmail, Outlook and most mobile clients refuse to render SVG — a tenant whose
 * logo is an SVG (Metheim's is) shows a broken-image icon. Cloudinary can
 * rasterise on delivery, so ask it for a PNG at 2× the display height; anything
 * else is passed through untouched.
 */
export function rasterLogoUrl(url: string): string {
  if (!url || !/\.svg(\?|$)/i.test(url)) return url;
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i);
  if (!m) return url;
  return `${m[1]}f_png,h_96,c_fit/${m[2]}`;
}

const FALLBACK = {
  name: "MillionStay",
  legalName: "MillionStay Pty Ltd",
  logoUrl: process.env.EMAIL_LOGO_URL ?? "https://www.millionstay.com/millionstay-logo.png",
  supportEmail: process.env.SUPPORT_EMAIL ?? "millionstay.com@gmail.com",
};

/**
 * The name a recipient sees as the sender.
 *
 * Settings → Design (`branding.brand_name`) wins over the registered trading
 * name because they are not the same thing: Metheim trades as "메트하임 여수"
 * on paperwork but presents itself as "Metheim" to customers, and the From
 * line, subject and SMS body are customer-facing. Documents keep using the
 * trading name — only messaging follows the brand. Matches
 * `resolveCampaignBrand()` so campaigns and transactional mail agree.
 */
async function resolveBrandName(): Promise<string> {
  try {
    const [row] = await db
      .select({ brand_name: brandingSettingsTable.brand_name })
      .from(brandingSettingsTable)
      .where(eq(brandingSettingsTable.id, BRANDING_SINGLETON_ID))
      .limit(1);
    return row?.brand_name?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Resolve the sending tenant's identity and palette. Read per-send (never
 * cached) so an edit in Settings → Organisation applies to the next email
 * without a restart. Never throws — falls back to env/MillionStay defaults so a
 * DB hiccup can't stop a transactional email going out.
 */
export async function resolveEmailBrand(): Promise<EmailBrand> {
  const [company, brandName] = await Promise.all([
    resolveCompanyInfo().catch(() => null),
    resolveBrandName(),
  ]);
  const color = company?.brandColor || DOC_TOKENS.brand;
  return {
    name: brandName || company?.tradingName || FALLBACK.name,
    legalName: company?.legalName || FALLBACK.legalName,
    logoUrl: rasterLogoUrl(company?.logoUrl || FALLBACK.logoUrl),
    supportEmail: company?.email || FALLBACK.supportEmail,
    address: company?.address || "",
    color,
    colorHover: DOC_TOKENS.brandHover,
    accentBg: DOC_TOKENS.accentBg,
    accentBorder: DOC_TOKENS.accentBorder,
    ink: DOC_TOKENS.ink,
    inkMuted: DOC_TOKENS.inkMuted,
    inkFaint: DOC_TOKENS.inkFaint,
    pageBg: DOC_TOKENS.pageBg,
    border: DOC_TOKENS.border,
  };
}

export interface EmailShellOptions {
  brand: EmailBrand;
  /** Body HTML — already escaped/localised by the caller. */
  body: string;
  /** Small line under the logo (e.g. "New Access Request"). */
  tag?: string | null;
  /** Extra footer lines, rendered above the legal line. Already escaped. */
  footerLines?: string[];
  /** Widen for content-heavy emails such as the booking confirmation. */
  maxWidth?: number;
  /** Template-specific CSS appended to the shell's. Use brand tokens, not literals. */
  extraStyles?: string;
}

/** Shared `<style>` block — one card, tenant palette, no external assets. */
function shellStyles(b: EmailBrand, maxWidth: number): string {
  return `
  body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif;margin:0;padding:0;background:${b.pageBg};color:${b.ink};}
  .container{max-width:${maxWidth}px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .header{background:#fff;padding:28px 32px;border-bottom:1px solid ${b.border};}
  .header img{height:36px;width:auto;display:block;border:0;}
  .header .tag{display:block;margin-top:10px;font-size:13px;font-weight:600;color:${b.color};}
  .body{padding:32px;}
  .body p{font-size:14px;line-height:1.65;color:${b.inkMuted};margin:0 0 14px;}
  .body p.lead{font-size:16px;color:${b.ink};}
  .body h2{font-size:17px;margin:0 0 12px;color:${b.ink};}
  .box{background:${b.accentBg};border:1px solid ${b.accentBorder};border-radius:10px;padding:16px 20px;margin:20px 0;}
  .box .label{font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:${b.inkFaint};}
  .box .ref{font-size:18px;font-weight:700;color:${b.color};font-family:'SFMono-Regular',Menlo,monospace;letter-spacing:0.04em;}
  .box .amount{font-size:15px;color:${b.ink};margin-top:8px;font-weight:600;}
  .btn{display:block;text-align:center;background:${b.color};color:#fff !important;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin:24px 0;}
  .muted{font-size:13px;color:${b.inkFaint};}
  a{color:${b.color};}
  table.kv{width:100%;border-collapse:collapse;font-size:14px;}
  table.kv td{padding:9px 0;border-bottom:1px solid ${b.border};vertical-align:top;}
  table.kv td.k{color:${b.inkFaint};width:38%;}
  .footer{padding:20px 32px;border-top:1px solid ${b.border};font-size:12px;color:${b.inkFaint};text-align:center;line-height:1.6;}`;
}

/**
 * Wrap body HTML in the tenant-branded card: tenant logo, tenant accent colour,
 * tenant legal footer. The single place email chrome is defined.
 */
export function renderEmailShell(opts: EmailShellOptions): string {
  const b = opts.brand;
  const maxWidth = opts.maxWidth ?? 560;
  const footer = [
    ...(opts.footerLines ?? []),
    `© ${new Date().getFullYear()} ${escapeHtml(b.legalName)}${b.address ? ` · ${escapeHtml(b.address)}` : ""}`,
  ];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${shellStyles(b, maxWidth)}${opts.extraStyles ?? ""}</style></head><body>
<div class="container">
  <div class="header">
    <img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.name)}" />
    ${opts.tag ? `<span class="tag">${escapeHtml(opts.tag)}</span>` : ""}
  </div>
  <div class="body">${opts.body}</div>
  <div class="footer">${footer.join("<br/>")}</div>
</div></body></html>`;
}
