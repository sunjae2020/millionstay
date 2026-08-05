/**
 * Campaign message rendering — variables, compliance decorations, branded shell.
 *
 * Everything a recipient actually sees is assembled here so the legal
 * decorations cannot be forgotten by a caller: the "(광고)" subject prefix, the
 * free opt-out notice, the sender-identification footer and the unsubscribe
 * link are added at render time, not left to whoever writes the template.
 *
 * Branding is resolved per send from Settings → Organisation + branding_settings
 * rather than hard-coded, so a Metheim campaign carries Metheim's name, logo and
 * colour instead of MillionStay's.
 */
import { eq } from "drizzle-orm";
import { db, brandingSettingsTable, BRANDING_SINGLETON_ID } from "@workspace/db";
import { resolveCompanyInfo } from "../documents/companyInfo";
import { escapeHtml } from "../email";
import { buildUnsubscribeUrl } from "../unsubscribeToken";

export interface CampaignBrand {
  name: string;
  logoUrl: string;
  primaryColor: string;
  /** Sender-identification block: legal entity, address, contact, registration no. */
  identityLines: string[];
}

/** Resolved once per campaign run rather than per recipient. */
export async function resolveCampaignBrand(): Promise<CampaignBrand> {
  const company = await resolveCompanyInfo().catch(() => null);
  const [branding] = await db
    .select()
    .from(brandingSettingsTable)
    .where(eq(brandingSettingsTable.id, BRANDING_SINGLETON_ID))
    .catch(() => [] as (typeof brandingSettingsTable.$inferSelect)[]);

  const name =
    branding?.brand_name?.trim() ||
    company?.tradingName?.trim() ||
    company?.legalName?.trim() ||
    "MillionStay";

  const identityLines = [
    company?.legalName || name,
    company?.address || "",
    [company?.phone, company?.email].filter(Boolean).join(" · "),
    company?.abn ? `${company.regLabel ?? "ABN"} ${company.abn}` : "",
    company?.ceo ? `대표 ${company.ceo}` : "",
  ].filter((line) => line && line.trim() !== "");

  return {
    name,
    logoUrl: branding?.logo_url?.trim() || company?.logoUrl || "",
    primaryColor: branding?.primary_color?.trim() || company?.brandColor || "#E8621A",
    identityLines,
  };
}

export interface RenderVariables {
  company_name?: string;
  contact_name?: string;
  contact_title?: string;
  country?: string;
  city?: string;
  sender_name?: string;
  organisation_name?: string;
  [key: string]: string | undefined;
}

/**
 * Substitute `{{var}}` placeholders. Values are HTML-escaped: prospect data is
 * imported from spreadsheets we do not control, and an unescaped `<` in a
 * company name would otherwise break — or inject into — the message body.
 * Unknown placeholders collapse to an empty string rather than being left
 * visible to the recipient as literal `{{…}}`.
 */
export function substitute(template: string, vars: RenderVariables): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
    escapeHtml(vars[key] ?? ""),
  );
}

/** Placeholders present in a template, for the editor's variable checker. */
export function extractVariables(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!))];
}

export interface RenderedMessage {
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}

export interface RenderOptions {
  subject: string;
  bodyHtml: string;
  email: string;
  vars: RenderVariables;
  brand: CampaignBrand;
  languageCode: string;
  isAdvertising: boolean;
}

/** 정보통신망법 §50 ②: advertising email must be identifiable as such in the subject. */
export function applyAdvertisingPrefix(subject: string, languageCode: string, isAdvertising: boolean): string {
  if (!isAdvertising) return subject;
  if (languageCode !== "ko") return subject;
  return subject.startsWith("(광고)") ? subject : `(광고) ${subject}`;
}

const OPT_OUT_NOTICE: Record<string, string> = {
  ko: "본 메일은 광고성 정보입니다. 수신을 원하지 않으시면 아래 수신거부 링크를 눌러 주세요. 수신거부는 무료입니다.",
  en: "This is a commercial message. To stop receiving it, use the unsubscribe link below — there is no charge.",
  ja: "本メールは広告宣伝メールです。配信停止をご希望の場合は下の配信停止リンクをご利用ください（無料）。",
  zh: "本邮件为广告信息。如不希望继续接收，请点击下方退订链接，退订免费。",
  th: "อีเมลนี้เป็นข้อความเชิงพาณิชย์ หากไม่ประสงค์รับต่อ กรุณาใช้ลิงก์ยกเลิกด้านล่าง โดยไม่มีค่าใช้จ่าย",
  vi: "Đây là thư quảng cáo. Nếu không muốn tiếp tục nhận, vui lòng dùng liên kết hủy nhận bên dưới — hoàn toàn miễn phí.",
};

const UNSUBSCRIBE_LABEL: Record<string, string> = {
  ko: "수신거부", en: "Unsubscribe", ja: "配信停止", zh: "退订", th: "ยกเลิกรับ", vi: "Hủy nhận",
};

export function renderCampaignMessage(opts: RenderOptions): RenderedMessage {
  const lang = opts.languageCode || "ko";
  const unsubscribeUrl = buildUnsubscribeUrl(opts.email, "email");
  const vars: RenderVariables = {
    ...opts.vars,
    organisation_name: opts.vars.organisation_name ?? opts.brand.name,
  };

  const subject = applyAdvertisingPrefix(substitute(opts.subject, vars), lang, opts.isAdvertising);

  // The body may reference {{unsubscribe_url}} itself; if it does not, the
  // footer link below still guarantees a working opt-out.
  const body = substitute(opts.bodyHtml, { ...vars, unsubscribe_url: unsubscribeUrl });

  const notice = opts.isAdvertising ? (OPT_OUT_NOTICE[lang] ?? OPT_OUT_NOTICE.en!) : "";
  const unsubLabel = UNSUBSCRIBE_LABEL[lang] ?? UNSUBSCRIBE_LABEL.en!;
  const identity = opts.brand.identityLines.map((line) => escapeHtml(line)).join("<br/>");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{font-family:'Inter','Apple SD Gothic Neo',-apple-system,sans-serif;margin:0;padding:0;background:#f6f7f9;color:#111;}
  .container{max-width:600px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ececec;}
  .header{padding:20px 28px;border-bottom:1px solid #f0f0f0;}
  .header img{height:32px;width:auto;display:block;}
  .header .brand{font-size:16px;font-weight:700;color:${escapeHtml(opts.brand.primaryColor)};}
  .body{padding:28px;font-size:14px;line-height:1.7;color:#333;}
  .footer{padding:18px 28px;border-top:1px solid #f0f0f0;font-size:11px;color:#8a8a8a;line-height:1.6;}
  .footer a{color:${escapeHtml(opts.brand.primaryColor)};}
  .notice{margin-bottom:8px;}
</style></head><body>
<div class="container">
  <div class="header">${
    opts.brand.logoUrl
      ? `<img src="${escapeHtml(opts.brand.logoUrl)}" alt="${escapeHtml(opts.brand.name)}" />`
      : `<div class="brand">${escapeHtml(opts.brand.name)}</div>`
  }</div>
  <div class="body">${body}</div>
  <div class="footer">
    ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
    ${identity}
    <div style="margin-top:8px"><a href="${unsubscribeUrl}">${escapeHtml(unsubLabel)}</a></div>
  </div>
</div></body></html>`;

  const text = `${body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim()}

${notice}
${opts.brand.identityLines.join("\n")}
${unsubLabel}: ${unsubscribeUrl}`;

  return { subject, html, text, unsubscribeUrl };
}
