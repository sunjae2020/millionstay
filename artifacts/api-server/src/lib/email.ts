import { Resend } from "resend";
import { db, marketingConsentsTable, emailLogsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { t, normalizeLang, docLocale, type DocLang } from "./documents/i18n";
import { buildAppointmentIcs } from "./ical";
import { buildUnsubscribeUrl } from "./unsubscribeToken";
import { resolveTemplate, renderString } from "./documents/templateEngine";
import { resolveCompanyInfo } from "./documents/companyInfo";
import { DOC_TOKENS, formatDocMoney } from "./documents/theme";
import { DEFAULT_CURRENCY } from "./currency";
import { resolveEmailBrand, renderEmailShell, type EmailBrand } from "./emailBrand";
import { escapeHtml } from "./htmlEscape";

let resend: Resend | null = null;
let resendKey: string | null = null;

export { escapeHtml };

/** Escape and clip a name for safe rendering. */
function safeName(name: string | null | undefined, max = 80): string {
  return escapeHtml((name ?? "").slice(0, max));
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  // Re-create the client when the key changes (e.g. updated live via Settings →
  // Integrations) so a new key takes effect without a server restart. The client
  // was previously cached forever, so a stale/invalid key kept being used.
  if (!resend || resendKey !== key) {
    resend = new Resend(key);
    resendKey = key;
  }
  return resend;
}

const DEFAULT_FROM = "MillionStay <noreply@contact.millionstay.com>";

/**
 * Free / shared mailbox providers. An ESP can only send from a domain the
 * account owns and verified, so an org contact address on one of these (e.g. a
 * tenant whose Settings → Organisation email is `…@gmail.com`) must never end
 * up as the envelope From — Resend rejects the whole send with
 * "This API key is not authorized to send emails from gmail.com".
 */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com",
  "nate.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.jp", "ymail.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "qq.com", "163.com", "126.com",
]);

/** Pull the bare address out of `Name <addr@host>` or a plain address. */
function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m?.[1] ?? from).trim().toLowerCase();
}

/**
 * Envelope sender for every outbound email.
 *
 * `EMAIL_FROM` is tenant-configurable (env, or Settings → Integrations which
 * writes it into `process.env`), so it is read per-send rather than captured at
 * import time. When it is missing, malformed, or points at a free-mail domain
 * the provider cannot authorise, we fall back to the verified default sender and
 * keep the configured address as Reply-To so replies still reach the tenant.
 */
export function emailSender(): { from: string; replyTo?: string } {
  const configured = (process.env.EMAIL_FROM ?? "").trim();
  if (!configured) return { from: DEFAULT_FROM };
  const address = bareAddress(configured);
  const domain = address.split("@")[1];
  if (!domain || !address.includes("@")) {
    console.warn(`[email] EMAIL_FROM is not a valid address (${configured}) — using ${DEFAULT_FROM}`);
    return { from: DEFAULT_FROM };
  }
  if (FREE_MAIL_DOMAINS.has(domain)) {
    console.warn(
      `[email] EMAIL_FROM domain "${domain}" cannot be used as a sender (free/shared mailbox) — ` +
        `sending from ${DEFAULT_FROM} with Reply-To ${address}. Configure EMAIL_FROM to an address on a domain verified with the email provider.`,
    );
    return { from: DEFAULT_FROM, replyTo: address };
  }
  return { from: configured };
}
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "millionstay.com@gmail.com";

/**
 * The customer-facing support / contact email shown in transactional emails.
 * Single source of truth = Settings → Organisation (company_info.email), falling
 * back to the SUPPORT_EMAIL env/default. Resolved per-send so changes apply live.
 */
async function resolveSupportEmail(): Promise<string> {
  try {
    return (await resolveCompanyInfo()).email || SUPPORT_EMAIL;
  } catch {
    return SUPPORT_EMAIL;
  }
}
const PORTAL_URL = process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com";

export interface DocumentEmailOptions {
  /** One address or several — the document send dialog lets admins add more. */
  to: string | string[];
  toName?: string | null;
  /** Document type label, already localised to `lang` (e.g. "청구서"). */
  docTypeLabel: string;
  ref: string;
  /** Optional amount line shown in the cover email, e.g. "1,450.00 AUD". */
  amountLabel?: string | null;
  /** Optional extra sentence (e.g. due date / validity), already localised. */
  note?: string | null;
  /** The rendered PDF to attach. */
  pdf: Buffer;
  filename: string;
  /** Cover-email + subject language. Defaults to English. */
  lang?: DocLang | string;
  /** Optional subject override; otherwise built from docTypeLabel + ref. */
  subject?: string;
}

/**
 * Send a customer-facing document (invoice / receipt / quote / contract) as a
 * branded cover email with the PDF attached. The cover body, subject and the
 * attached PDF are localised via `lang` (default English). Best-effort:
 * returns a result object and never throws so callers can record the outcome.
 */
export async function sendDocumentEmail(
  opts: DocumentEmailOptions,
): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string; subject: string }> {
  const lang = normalizeLang(typeof opts.lang === "string" ? opts.lang : opts.lang);
  const brand = await resolveEmailBrand();
  const subject = opts.subject ?? t(lang, "email.subject", { brand: brand.name, doc: opts.docTypeLabel, ref: opts.ref });
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((x) => x.trim()).filter(Boolean);
  const toLabel = recipients.join(", ");

  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — skipping ${opts.docTypeLabel} ${opts.ref} to ${toLabel}`);
    return { ok: false, skipped: true, error: "Email service not configured", subject };
  }

  const supportEmail = brand.supportEmail;
  const greeting = opts.toName
    ? t(lang, "email.greeting.named", { name: `<strong>${safeName(opts.toName)}</strong>` })
    : t(lang, "email.greeting.plain");
  const html = renderEmailShell({
    brand,
    footerLines: [t(lang, "email.sentTo", { to: escapeHtml(toLabel) })],
    body: `
    <p class="lead">${greeting}</p>
    <p>${t(lang, "email.body", { doc: escapeHtml(opts.docTypeLabel) })}</p>
    <div class="box">
      <div class="label">${escapeHtml(opts.docTypeLabel)}</div>
      <div class="ref">${escapeHtml(opts.ref)}</div>
      ${opts.amountLabel ? `<div class="amount">${escapeHtml(opts.amountLabel)}</div>` : ""}
    </div>
    ${opts.note ? `<p class="muted">${escapeHtml(opts.note)}</p>` : ""}
    <p class="muted">${t(lang, "email.questions", { email: `<a href="mailto:${supportEmail}">${escapeHtml(supportEmail)}</a>` })}</p>`,
  });

  const payload = {
    ...emailSender(),
    to: recipients,
    subject,
    html,
    attachments: [{ filename: opts.filename, content: opts.pdf.toString("base64") }],
  };

  // Resend does NOT throw on API errors — it returns { data, error }. A null id
  // with an ignored error is why sends were logged "Sent" but never delivered.
  // Check error explicitly, and retry on rate limits (free tier = 2 req/s).
  const MAX_ATTEMPTS = 4;
  let lastError = "Send failed";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await client.emails.send(payload);
      if (!error && data?.id) {
        console.log(`[email] ${opts.docTypeLabel} ${opts.ref} sent to ${toLabel} (${data.id})`);
        return { ok: true, id: data.id, subject };
      }
      const e = error as { statusCode?: number; name?: string; message?: string } | null;
      lastError = e?.message || e?.name || "Send returned no message id";
      const isRateLimited = e?.statusCode === 429 || /rate.?limit|too.?many/i.test(`${e?.name} ${e?.message}`);
      if (isRateLimited && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      console.error(`[email] Resend rejected ${opts.docTypeLabel} ${opts.ref} to ${toLabel}:`, lastError);
      return { ok: false, error: lastError, subject };
    } catch (err) {
      // Network/transport failure (rare — SDK normally returns errors in-band).
      lastError = err instanceof Error ? err.message : "Send failed";
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      console.error(`[email] Failed to send ${opts.docTypeLabel} ${opts.ref}:`, err);
      return { ok: false, error: lastError, subject };
    }
  }
  return { ok: false, error: lastError, subject };
}

/**
 * Resolve a published email template's cover copy (subject + note) for a
 * customer-facing document email. Returns {} when no published template exists,
 * so callers keep their hardcoded fallback. The template body is a plain-text
 * note sentence (it is escaped into the fixed branded cover, like the
 * hardcoded notes); the subject is optional. Both support {{var}} placeholders.
 */
export async function resolveDocEmailCopy(
  key: string,
  locale: string | undefined,
  vars: Record<string, unknown>,
): Promise<{ subject?: string; note?: string }> {
  const tpl = await resolveTemplate({ kind: "email", key, locale });
  if (!tpl) return {};
  return {
    subject: tpl.subject ? renderString(tpl.subject, vars) : undefined,
    note: tpl.bodyHtml ? renderString(tpl.bodyHtml, vars) : undefined,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   편집 가능한 문안 해석 (Settings → Documents → Templates)

   발송 함수는 문안을 코드에 두지 않고 여기를 거친다. 운영자가 Studio 에서 고치면
   재배포 없이 반영된다. 정본 = docs/EMAIL_TEMPLATE_SPEC.md

   **폴백이 핵심이다.** 템플릿이 없거나 미발행이면 `null` 을 돌려주고 호출부는 기존
   하드코딩 문안을 그대로 쓴다. 그래서
     - 문안을 아직 시드하지 않은 테넌트(MillionStay 본체)는 동작이 바뀌지 않고,
     - Studio 에서 실수로 archive 해도 메일이 안 나가는 사고가 나지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ResolvedCopy {
  subject: string | null;
  /** 셸 안쪽 본문 HTML. renderEmailShell({ body }) 에 그대로 넣는다. */
  body: string;
}

/**
 * 발행된 이메일 템플릿을 찾아 {{변수}}를 채운다. 없으면 null → 호출부가 폴백.
 *
 * ⚠️ 변수 값은 **호출부가 escape 해서 넘긴다.** 문안에는 사용자 입력이 그대로 박히므로
 *    (이름·주소·문의 내용) 이스케이프를 빼먹으면 저장형 XSS 가 된다. 기존 발송 함수가
 *    이미 safeName()/escapeHtml() 을 쓰고 있으니 그 값을 그대로 넘기면 된다.
 */
export async function resolveEmailCopy(
  key: string,
  lang: string | undefined,
  vars: Record<string, unknown>,
): Promise<ResolvedCopy | null> {
  try {
    const tpl = await resolveTemplate({ kind: "email", key, locale: normalizeLang(lang ?? "") });
    if (!tpl?.bodyHtml?.trim()) return null;
    return {
      subject: tpl.subject?.trim() ? renderString(tpl.subject, vars) : null,
      body: renderString(tpl.bodyHtml, vars),
    };
  } catch (err) {
    // 템플릿 조회 실패로 메일이 안 나가면 안 된다 — 폴백으로 보낸다.
    console.error(`[email] 템플릿 해석 실패 (${key}) — 기본 문안으로 발송:`, err);
    return null;
  }
}

/**
 * 연체 독촉 발송. 템플릿 문안으로만 보내고, **발송 성공 시 email_log 에 기록한다** —
 * 그 기록이 곧 "이 단계는 이미 보냈다" 는 멱등 키다(lib/billing/rentDunning.ts).
 *
 * 기록에 실패하면 다음 크론에서 같은 단계를 다시 보내게 되므로, 로그 기록 실패는
 * 조용히 넘기지 않고 발송 실패로 취급한다 — 중복 독촉이 미발송보다 나쁘다.
 */
export async function sendDunningEmail(opts: {
  to: string;
  toName: string;
  templateKey: string;
  invoiceId: number;
  vars: Record<string, unknown>;
  lang?: string;
}): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY 없음 — 독촉 건너뜀 (${opts.templateKey} #${opts.invoiceId})`);
    return false;
  }

  const safeVars = Object.fromEntries(
    Object.entries(opts.vars).map(([k, v]) => [k, escapeHtml(String(v ?? ""))]));
  const copy = await resolveEmailCopy(opts.templateKey, opts.lang, safeVars);
  if (!copy) {
    // 독촉은 폴백 문안이 없다 — 문안 없이 임의로 보내면 법적 다툼의 근거가 흔들린다.
    console.error(`[email] 독촉 문안 없음 (${opts.templateKey}) — 발송하지 않음`);
    return false;
  }

  const brand = await resolveEmailBrand();
  const subject = copy.subject ?? `[${brand.name}] 납부 안내`;
  const html = renderEmailShell({ brand, body: copy.body });

  try {
    const { data, error } = await client.emails.send({
      ...emailSender(), to: [opts.to], subject, html,
    });
    if (error || !data?.id) {
      console.error(`[email] 독촉 발송 거부 (${opts.templateKey} #${opts.invoiceId}):`, error);
      return false;
    }
    // 발송 기록 = 멱등 키. 여기서 실패하면 다음 크론이 중복 발송한다.
    await db.insert(emailLogsTable).values({
      template_code: opts.templateKey,
      to_email: opts.to,
      to_name: opts.toName,
      subject,
      resend_message_id: data.id,
      status: "Sent",
      entity_type: "invoice",
      entity_id: opts.invoiceId,
    });
    console.log(`[email] 독촉 ${opts.templateKey} → ${opts.to} (인보이스 #${opts.invoiceId})`);
    return true;
  } catch (err) {
    console.error(`[email] 독촉 실패 (${opts.templateKey} #${opts.invoiceId}):`, err);
    return false;
  }
}

export interface PasswordResetEmailOptions {
  to: string;
  name: string;
  resetUrl: string;
  product?: "Admin" | "Guest" | "Partner";
  /** 문안 언어. 생략하면 테넌트 기본(DEFAULT_DOC_LANG). */
  lang?: string;
}

export async function sendPasswordResetEmail(opts: PasswordResetEmailOptions): Promise<boolean>;
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<boolean>;
export async function sendPasswordResetEmail(
  a: PasswordResetEmailOptions | string,
  b?: string,
  c?: string,
): Promise<boolean> {
  const opts: PasswordResetEmailOptions =
    typeof a === "string"
      ? { to: a, name: b!, resetUrl: c!, product: "Admin" }
      : { product: "Admin", ...a };

  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — password reset link: ${opts.resetUrl}`);
    return false;
  }

  // SECURITY: name + email are user-controlled; escape before interpolation.
  const safeNameVal = safeName(opts.name);
  const safeTo = escapeHtml(opts.to);
  const safeUrl = escapeHtml(opts.resetUrl);
  const productLabel = opts.product ?? "Admin";
  const brand = await resolveEmailBrand();

  const copy = await resolveEmailCopy("account.password_reset", opts.lang, {
    recipient: safeNameVal,
    product_label: escapeHtml(productLabel),
    url: safeUrl,
    expiry_minutes: 60,
    brand: escapeHtml(brand.name),
  });

  const html = renderEmailShell({
    brand,
    footerLines: [`This email was sent to ${safeTo}`],
    body: copy?.body ?? `
    <p class="lead">Hi <strong>${safeNameVal}</strong>,</p>
    <p>We received a request to reset the password for your ${escapeHtml(brand.name)} ${escapeHtml(productLabel)} account. Click the button below to set a new password:</p>
    <a href="${safeUrl}" class="btn">Reset My Password →</a>
    <p class="muted">⏱ This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p class="muted">If the button doesn't work, copy and paste this URL into your browser:<br>
      <span style="color:${brand.color};word-break:break-all;">${safeUrl}</span>
    </p>`,
  });
  try {
    await client.emails.send({
      ...emailSender(),
      to: [opts.to],
      subject: copy?.subject ?? `[${brand.name} ${productLabel}] Password Reset Request`,
      html,
    });
    console.log(`[email] Password reset sent to ${opts.to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send password reset:", err);
    return false;
  }
}

export async function sendRegistrationRequestEmail(to: string, name: string, adminPanelUrl: string): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — skipping registration notification`);
    return false;
  }
  const brand = await resolveEmailBrand();
  const copy = await resolveEmailCopy("account.registration_request", undefined, {
    applicant_name: safeName(name),
    applicant_email: escapeHtml(to),
    applicant_phone: "—",
    product_label: "Admin",
    date: new Date().toISOString().slice(0, 10),
    url: `${escapeHtml(adminPanelUrl)}/settings/users`,
    brand: escapeHtml(brand.name),
  });
  const html = renderEmailShell({
    brand,
    tag: copy ? null : "New Access Request",
    body: copy?.body ?? `
    <p class="lead">A new admin account request has been submitted and is awaiting your approval.</p>
    <div class="box">
      <strong>${safeName(name)}</strong><br>
      <span>${escapeHtml(to)}</span>
    </div>
    <p>Please log in to the admin panel and navigate to <strong>Settings → Users</strong> to review and approve or reject this request.</p>
    <a href="${escapeHtml(adminPanelUrl)}/settings/users" class="btn">Review in Admin Panel →</a>`,
  });
  try {
    await client.emails.send({ ...emailSender(), to: [to], subject: copy?.subject ?? `[${brand.name} Admin] New Account Request`, html });
    console.log(`[email] Registration notification sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send registration notification:", err);
    return false;
  }
}

export interface BookingConfirmationData {
  to: string;
  guestName: string;
  bookingRef: string;
  spaceName: string;
  propertyAddress: string;
  checkIn: string;
  checkOut: string;
  weeklyRate?: number | null;
  totalDue?: number | null;
  currency?: string;
  isLongTerm?: boolean;
}

export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log("[email] RESEND_API_KEY not set — skipping confirmation email");
    return false;
  }

  const { to, guestName, bookingRef, spaceName, propertyAddress, checkIn, checkOut, weeklyRate, totalDue, currency = "AUD", isLongTerm } = data;

  // Bank-transfer details, env-driven so each tenant shows its own account — a
  // hardcoded AU account would send Korean guests to the wrong bank. A KRW
  // instance renders the KR layout (은행/예금주/계좌번호, no BSB); MillionStay
  // keeps the AU (BSB) layout.
  const company = await resolveCompanyInfo().catch(() => null);
  const KR = DEFAULT_CURRENCY === "KRW";
  const bank = {
    name: process.env.BANK_NAME ?? "Commonwealth Bank of Australia",
    accountName: process.env.BANK_ACCOUNT_NAME ?? company?.legalName ?? "MillionStay Pty Ltd",
    bsb: process.env.BANK_BSB ?? "063-000",
    accountNo: process.env.BANK_ACCOUNT_NO ?? "1234 5678",
  };
  const weeklyRateStr = weeklyRate ? formatDocMoney(weeklyRate, currency) : "";
  const totalDueStr = totalDue ? formatDocMoney(totalDue, currency) : "";

  const bankBox = KR
    ? `
    <div class="bank-box">
      <h3>🏦 무통장 입금 안내</h3>
      <div class="row"><span class="label">은행</span><span class="value">${escapeHtml(bank.name)}</span></div>
      <div class="row"><span class="label">예금주</span><span class="value">${escapeHtml(bank.accountName)}</span></div>
      <div class="row"><span class="label">계좌번호</span><span class="value">${escapeHtml(bank.accountNo)}</span></div>
      ${totalDueStr ? `<div class="row"><span class="label">입금액</span><span class="value">${escapeHtml(totalDueStr)}</span></div>` : ""}
      <div class="row"><span class="label">입금자명(참조)</span><span class="value">${escapeHtml(bookingRef)}</span></div>
      <p style="font-size:12px;color:#555;margin-top:10px;">⏱ <strong>48시간 이내</strong>에 입금해 주시기 바랍니다.</p>
    </div>`
    : `
    <div class="bank-box">
      <h3>🏦 Bank Transfer Details</h3>
      <div class="row"><span class="label">Bank</span><span class="value">${escapeHtml(bank.name)}</span></div>
      <div class="row"><span class="label">Account Name</span><span class="value">${escapeHtml(bank.accountName)}</span></div>
      <div class="row"><span class="label">BSB</span><span class="value">${escapeHtml(bank.bsb)}</span></div>
      <div class="row"><span class="label">Account No.</span><span class="value">${escapeHtml(bank.accountNo)}</span></div>
      <div class="row"><span class="label">Reference</span><span class="value">${escapeHtml(bookingRef)}</span></div>
      <p style="font-size:12px;color:#555;margin-top:10px;">⏱ Please complete the transfer within <strong>48 hours</strong>.</p>
    </div>`;

  const brand = await resolveEmailBrand();
  const html = renderEmailShell({
    brand,
    maxWidth: 600,
    tag: isLongTerm ? "Long-term Stay Application Received" : "Booking Application Submitted",
    footerLines: [`This email was sent to ${escapeHtml(to)}`],
    extraStyles: `
  .ref-hero{background:${brand.accentBg};border:2px solid ${brand.color};border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:24px;}
  .ref-hero .label{font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:${brand.inkMuted};}
  .ref-hero .ref{font-size:22px;font-weight:900;color:${brand.color};font-family:'SFMono-Regular',Menlo,monospace;letter-spacing:0.05em;}
  .section{margin-bottom:20px;}
  .section h3{font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:${brand.inkFaint};margin:0 0 10px;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${brand.border};font-size:14px;}
  .row:last-child{border-bottom:none;}
  .row .label{color:${brand.inkMuted};}
  .row .value{font-weight:600;color:${brand.ink};}
  .total-box{background:${brand.color};border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:20px;}
  .total-box span{color:#fff;font-weight:700;font-size:15px;}
  .total-box .amount{font-size:22px;}
  .bank-box{background:${brand.accentBg};border:1px solid ${brand.accentBorder};border-radius:12px;padding:16px;margin-top:20px;}
  .bank-box h3{color:${brand.color};margin:0 0 10px;font-size:14px;}`,
    body: `
    <p class="lead">Hi <strong>${safeName(guestName)}</strong>,</p>
    <p>
      ${isLongTerm
        ? "Your long-term stay application has been received. Our team will review and contact you within 24–48 hours."
        : "Your booking application has been submitted. Please complete the bank transfer to confirm your room."
      }
    </p>

    <div class="ref-hero">
      <div class="label">Booking Reference</div>
      <div class="ref">${escapeHtml(bookingRef)}</div>
    </div>

    <div class="section">
      <h3>Your Stay</h3>
      <div class="row"><span class="label">Property</span><span class="value">${escapeHtml(spaceName)}</span></div>
      <div class="row"><span class="label">Address</span><span class="value">${escapeHtml(propertyAddress)}</span></div>
      <div class="row"><span class="label">Check In</span><span class="value">${escapeHtml(checkIn)}</span></div>
      <div class="row"><span class="label">Check Out</span><span class="value">${escapeHtml(checkOut)}</span></div>
      ${weeklyRateStr ? `<div class="row"><span class="label">Weekly Rate</span><span class="value">${escapeHtml(weeklyRateStr)}/week</span></div>` : ""}
    </div>

    ${totalDue ? `
    <div class="total-box">
      <span>Amount Due</span>
      <span class="amount">${escapeHtml(totalDueStr)}</span>
    </div>
    ` : ""}

    ${!isLongTerm ? bankBox : ""}

    <a href="${PORTAL_URL}/portal/bookings" class="btn">
      Access Your Guest Portal →
    </a>

    <p class="muted">
      Questions? Contact us at <a href="mailto:${brand.supportEmail}">${escapeHtml(brand.supportEmail)}</a>
    </p>`,
  });

  try {
    await client.emails.send({
      ...emailSender(),
      to: [to],
      subject: `[${brand.name}] Booking Confirmed — ${bookingRef}`,
      html,
    });
    console.log(`[email] Confirmation sent to ${to} (${bookingRef})`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send confirmation:", err);
    return false;
  }
}

export interface LeadNotificationData {
  leadRef: string;
  inquiryType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  description?: string | null;
}

/**
 * Notify the operations team that a new public-form lead has come in.
 * Best-effort — always returns boolean, never throws.
 */
export async function sendLeadNotificationEmail(data: LeadNotificationData): Promise<boolean> {
  const to = process.env.LEADS_NOTIFY_EMAIL ?? (await resolveSupportEmail());
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — new lead ${data.leadRef} (${data.inquiryType}) from ${data.email}`);
    return false;
  }

  const fullName = escapeHtml(`${data.firstName} ${data.lastName}`.trim());
  const safeEmail = escapeHtml(data.email);
  const safePhone = escapeHtml(data.phone ?? "");
  const safeMessage = escapeHtml(data.message ?? "");
  const safeDesc = escapeHtml(data.description ?? "");
  const safeRef = escapeHtml(data.leadRef);
  const safeType = escapeHtml(data.inquiryType);

  const brand = await resolveEmailBrand();
  const html = renderEmailShell({
    brand,
    tag: `New ${safeType} inquiry`,
    footerLines: ["Internal notification"],
    extraStyles: `
  .ref{display:inline-block;background:${brand.accentBg};color:${brand.color};font-weight:700;padding:4px 10px;border-radius:6px;font-size:13px;}
  .msg{background:${brand.pageBg};border-radius:10px;padding:14px 16px;font-size:14px;color:${brand.inkMuted};white-space:pre-wrap;margin-top:6px;}`,
    body: `
    <h2>${fullName || "(no name)"} &nbsp; <span class="ref">${safeRef}</span></h2>
    <table class="kv">
      <tr><td class="k">Email</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
      ${safePhone ? `<tr><td class="k">Phone</td><td>${safePhone}</td></tr>` : ""}
      ${safeDesc ? `<tr><td class="k">Details</td><td style="white-space:pre-wrap;">${safeDesc}</td></tr>` : ""}
    </table>
    ${safeMessage ? `<p class="muted" style="margin:16px 0 4px;">Message:</p><div class="msg">${safeMessage}</div>` : ""}
    <p class="muted" style="margin-top:24px;">View this lead in the admin panel.</p>`,
  });

  try {
    await client.emails.send({
      ...emailSender(),
      to: [to],
      replyTo: data.email,
      subject: `[${brand.name} Lead] ${data.inquiryType} — ${fullName || data.email} (${data.leadRef})`,
      html,
    });
    console.log(`[email] Lead notification sent for ${data.leadRef} → ${to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send lead notification:", err);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Homestay host-family application — applicant-facing emails.
   English only, branded header. Best-effort: never throws.
   ───────────────────────────────────────────────────────────────────────── */
type HomestayEmailKind = "received" | "docs_requested" | "approved" | "rejected" | "placement_proposed" | "placement_signed";

interface HomestayHostEmailOptions {
  to: string;
  toName?: string | null;
  applicationRef: string;
  kind: HomestayEmailKind;
  /** Extra note (e.g. requested document list, rejection reason). */
  note?: string | null;
  /** Portal URL the host can log in to. */
  portalUrl?: string;
  /** Optional PDF attachments (e.g. the application copy on acknowledgment). */
  attachments?: Array<{ filename: string; content: Buffer }>;
}

const HOMESTAY_EMAIL_COPY: Record<HomestayEmailKind, { subject: (ref: string) => string; heading: string; body: (portalUrl: string) => string }> = {
  received: {
    subject: (ref) => `We received your Homestay Host application (${ref})`,
    heading: "Application received",
    body: (portalUrl) =>
      `Thank you for applying to become a MillionStay homestay host. Your application is now with our team for review.` +
      ` You can log in to your host portal at any time to track your status and complete any outstanding steps:` +
      ` <a href="${portalUrl}">${portalUrl}</a>.`,
  },
  docs_requested: {
    subject: (ref) => `Action needed: documents for your Homestay Host application (${ref})`,
    heading: "Additional documents requested",
    body: (portalUrl) =>
      `To continue reviewing your homestay host application, we need a few more documents.` +
      ` Please log in to your host portal to upload them: <a href="${portalUrl}">${portalUrl}</a>.`,
  },
  approved: {
    subject: (ref) => `You're approved as a MillionStay Homestay Host (${ref})`,
    heading: "Welcome — you're approved!",
    body: (portalUrl) =>
      `Congratulations! Your homestay host application has been approved.` +
      ` You can now activate your listing and start hosting. Log in to your host portal to get started:` +
      ` <a href="${portalUrl}">${portalUrl}</a>.`,
  },
  rejected: {
    subject: (ref) => `Update on your Homestay Host application (${ref})`,
    heading: "Application update",
    body: () =>
      `Thank you for your interest in hosting with MillionStay. After review, we're unable to approve your` +
      ` application at this time. If you believe this was in error or your circumstances change, please reply to this email.`,
  },
  placement_proposed: {
    subject: (ref) => `New student match for your homestay (${ref})`,
    heading: "You have a new student match",
    body: (portalUrl) =>
      `Great news — our team has matched a student with your homestay. Please log in to your host portal to` +
      ` review the placement details and accept the match: <a href="${portalUrl}">${portalUrl}</a>.`,
  },
  placement_signed: {
    subject: (ref) => `Your homestay placement agreement is signed (${ref})`,
    heading: "Placement agreement signed",
    body: (portalUrl) =>
      `The homestay placement agreement has been signed by all parties. A signed copy is attached/emailed` +
      ` separately. You can view the placement in your host portal: <a href="${portalUrl}">${portalUrl}</a>.`,
  },
};

export async function sendHomestayHostEmail(opts: HomestayHostEmailOptions): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[email] (skipped — no RESEND_API_KEY) homestay ${opts.kind} → ${opts.to}`);
    return false;
  }
  const copy = HOMESTAY_EMAIL_COPY[opts.kind];
  const brand = await resolveEmailBrand();
  const portalUrl = opts.portalUrl ?? `${PORTAL_URL}/host-portal`;
  const noteHtml = opts.note
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:14px;">${escapeHtml(opts.note)}</div>`
    : "";

  // Prefer an editable, published template; fall back to the hardcoded copy so a
  // missing/unpublished template never blocks the send.
  const tplKey = `homestay.${opts.kind === "received" ? "host_received" : opts.kind}`;
  const tpl = await resolveTemplate({ kind: "email", key: tplKey, locale: "en" });
  let subject: string;
  let cardInner: string;
  if (tpl && tpl.bodyHtml) {
    const vars = { ref: opts.applicationRef, name: safeName(opts.toName) || "there", portal_url: portalUrl, note: opts.note ?? "" };
    subject = renderString(tpl.subject || copy.subject(opts.applicationRef), vars);
    cardInner = `${renderString(tpl.bodyHtml, vars)}${noteHtml}
    <p style="font-size:13px;color:#9ca3af;margin:20px 0 0;">Application reference: <strong>${escapeHtml(opts.applicationRef)}</strong></p>`;
  } else {
    subject = copy.subject(opts.applicationRef);
    cardInner = `<h1 style="font-size:20px;margin:0 0 12px;color:#1f2937;">${escapeHtml(copy.heading)}</h1>
    <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0;">Hi ${safeName(opts.toName) || "there"},</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:12px 0 0;">${copy.body(portalUrl)}</p>
    ${noteHtml}
    <p style="font-size:13px;color:#9ca3af;margin:20px 0 0;">Application reference: <strong>${escapeHtml(opts.applicationRef)}</strong></p>`;
  }

  const html = renderEmailShell({
    brand,
    footerLines: [`Questions? Contact us at <a href="mailto:${brand.supportEmail}">${escapeHtml(brand.supportEmail)}</a>`],
    body: cardInner,
  });
  const attachments = (opts.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content.toString("base64") }));
  try {
    await client.emails.send({ ...emailSender(), to: [opts.to], subject, html, ...(attachments.length ? { attachments } : {}) });
    console.log(`[email] Homestay ${opts.kind} sent for ${opts.applicationRef} → ${opts.to}${tpl ? " (template)" : ""}${attachments.length ? " (+pdf)" : ""}`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send homestay ${opts.kind}:`, err);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Generic application acknowledgment email — sent to the applicant on
   submission of a Student / Landlord / Short-term application (the Homestay
   host intake keeps its own richer, template-backed `received` email above).
   Branded shell, English, best-effort. Optionally attaches the application PDF.
   Gated per-type by the application_emails settings at each call site.
   ───────────────────────────────────────────────────────────────────────── */
export interface ApplicationAckEmailOptions {
  to: string;
  toName?: string | null;
  /** Application type label, e.g. "Student Application". */
  appTypeLabel: string;
  /** Reference shown to the applicant, e.g. "HSR-2026-00001". */
  ref: string;
  /** Optional intro sentence override; defaults to generic received copy. */
  intro?: string | null;
  /** Optional application PDF to attach. */
  pdf?: Buffer | null;
  /** Attachment filename; defaults to `${ref}.pdf`. */
  filename?: string;
}

export async function sendApplicationAckEmail(opts: ApplicationAckEmailOptions): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[email] (skipped — no RESEND_API_KEY) ${opts.appTypeLabel} ack → ${opts.to}`);
    return false;
  }
  const brand = await resolveEmailBrand();
  const intro = opts.intro
    ?? `Thank you for submitting your ${opts.appTypeLabel.toLowerCase()} to ${brand.name}. We've received it and our team will be in touch shortly. Please keep your reference below for any follow-up.`;
  const pdfNote = opts.pdf
    ? `<p class="muted">A copy of your application is attached as a PDF for your records.</p>`
    : "";

  const html = renderEmailShell({
    brand,
    footerLines: [`Questions? Contact us at <a href="mailto:${brand.supportEmail}">${escapeHtml(brand.supportEmail)}</a>`],
    body: `
    <h2>Application received</h2>
    <p>Hi ${safeName(opts.toName) || "there"},</p>
    <p>${escapeHtml(intro)}</p>
    ${pdfNote}
    <p class="muted" style="margin-top:20px;">${escapeHtml(opts.appTypeLabel)} reference: <strong>${escapeHtml(opts.ref)}</strong></p>`,
  });

  const attachments = opts.pdf
    ? [{ filename: opts.filename ?? `${opts.ref}.pdf`, content: opts.pdf.toString("base64") }]
    : [];
  try {
    await client.emails.send({
      ...emailSender(),
      to: [opts.to],
      subject: `We received your ${opts.appTypeLabel} (${opts.ref})`,
      html,
      ...(attachments.length ? { attachments } : {}),
    });
    console.log(`[email] ${opts.appTypeLabel} ack sent for ${opts.ref} → ${opts.to}${attachments.length ? " (+pdf)" : ""}`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send ${opts.appTypeLabel} ack:`, err);
    return false;
  }
}

export interface MarketingEmailOptions {
  to: string;
  subject: string;
  /** Inner HTML body for the email (without the surrounding layout/footer). */
  bodyHtml: string;
  toName?: string | null;
  channel?: "email";
  /** Copy language for the compliance footer. Defaults to the tenant's document language. */
  lang?: string;
  /** When the recipient opted in — shown in the footer where the law requires it (KR). */
  consentedAt?: Date | string | null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Marketing compliance that varies by jurisdiction.

   The Australian rules (consent + unsubscribe + sender identity) are enforced
   unconditionally below. Korea's 「정보통신망법」 제50조 adds three obligations
   that Australian law does not have, so they are switched on per tenant:

     MARKETING_AD_PREFIX   subject must start with the ad marker, e.g. "(광고)"
     MARKETING_QUIET_HOURS "21-08" — no promotional send inside this window
     MARKETING_TZ          IANA zone the quiet hours are measured in

   A tenant that leaves these unset behaves exactly as before. Metheim sets all
   three in tenants/metheim/config.env.
   ───────────────────────────────────────────────────────────────────────── */

/** Prefix the subject with the ad marker unless it already carries one. */
function applyAdPrefix(subject: string): string {
  const prefix = (process.env.MARKETING_AD_PREFIX ?? "").trim();
  if (!prefix) return subject;
  return subject.startsWith(prefix) ? subject : `${prefix} ${subject}`;
}

/**
 * True when promotional sending is barred right now. Korea forbids advertising
 * messages between 21:00 and 08:00 without a separate night-time consent, and
 * we do not collect one — so we refuse rather than send and hope.
 */
export function inMarketingQuietHours(now = new Date()): { blocked: boolean; window?: string } {
  const raw = (process.env.MARKETING_QUIET_HOURS ?? "").trim();
  const m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(raw);
  if (!m) return { blocked: false };
  const [from, to] = [Number(m[1]), Number(m[2])];
  const tz = (process.env.MARKETING_TZ ?? "").trim();
  // Read the hour in the tenant's zone — the server clock is usually UTC, and
  // 22:00 in Seoul is 13:00 UTC. Comparing against the raw UTC hour would let
  // night-time sends through.
  const hour = tz
    ? Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now))
    : now.getHours();
  // from > to means the window wraps midnight (21-08).
  const blocked = from > to ? hour >= from || hour < to : hour >= from && hour < to;
  return { blocked, window: `${from}:00–${to}:00${tz ? ` ${tz}` : ""}` };
}

/** Consent-source + unsubscribe footer, in the recipient's language. */
function marketingFooter(lang: DocLang, brand: string, unsubUrl: string, consentedAt?: Date | string | null): string[] {
  const when = consentedAt
    ? new Date(consentedAt).toISOString().slice(0, 10)
    : null;
  const L: Record<DocLang, { source: (b: string, d: string | null) => string; unsub: string; privacy: string }> = {
    ko: {
      source: (b, d) => d
        ? `${d}에 ${b} 광고성 정보 수신에 동의하셔서 보내 드립니다.`
        : `${b} 광고성 정보 수신에 동의하셔서 보내 드립니다.`,
      unsub: "수신거부", privacy: "개인정보처리방침",
    },
    en: {
      source: (b, d) => d
        ? `You are receiving this because you opted in to marketing from ${b} on ${d}.`
        : `You are receiving this because you opted in to marketing from ${b}.`,
      unsub: "Unsubscribe", privacy: "Privacy Policy",
    },
    ja: {
      source: (b, d) => d
        ? `${d} に ${b} の広告メール受信に同意いただいたため、お送りしております。`
        : `${b} の広告メール受信に同意いただいたため、お送りしております。`,
      unsub: "配信停止", privacy: "個人情報保護方針",
    },
    zh: {
      source: (b, d) => d
        ? `您于 ${d} 同意接收 ${b} 的广告信息，故向您发送本邮件。`
        : `您已同意接收 ${b} 的广告信息，故向您发送本邮件。`,
      unsub: "退订", privacy: "隐私政策",
    },
    th: {
      source: (b, d) => d
        ? `ท่านได้ให้ความยินยอมรับข่าวสารโฆษณาจาก ${b} เมื่อวันที่ ${d} เราจึงส่งอีเมลฉบับนี้`
        : `ท่านได้ให้ความยินยอมรับข่าวสารโฆษณาจาก ${b} เราจึงส่งอีเมลฉบับนี้`,
      unsub: "ยกเลิกรับข่าวสาร", privacy: "นโยบายความเป็นส่วนตัว",
    },
    vi: {
      source: (b, d) => d
        ? `Quý khách đã đồng ý nhận thông tin quảng cáo từ ${b} vào ngày ${d}, nên chúng tôi gửi email này.`
        : `Quý khách đã đồng ý nhận thông tin quảng cáo từ ${b}, nên chúng tôi gửi email này.`,
      unsub: "Hủy nhận tin", privacy: "Chính sách bảo mật",
    },
  };
  const t = L[lang] ?? L.en;
  return [
    escapeHtml(t.source(brand, when)),
    `<a href="${unsubUrl}">${t.unsub}</a> · <a href="${PORTAL_URL}/privacy-policy">${t.privacy}</a>`,
  ];
}

/**
 * Send a MARKETING (promotional) email — the ONLY sanctioned path for
 * non-transactional email. Enforces Australian APP 7 / Spam Act 2003:
 *
 *   1. Consent gate — refuses to send unless the recipient has an active
 *      opt-in in `marketing_consents` that has not been withdrawn. (Express
 *      consent only; absence of a record = no consent = no send.)
 *   2. Functional unsubscribe — every message carries a one-click unsubscribe
 *      link in the body AND RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post`
 *      headers so mail clients can offer native one-click opt-out.
 *   3. Sender identification — the branded footer names the legal entity.
 *
 * Never call `client.emails.send` directly for promotional content — route it
 * through here so the consent check and unsubscribe link can never be skipped.
 */
export async function sendMarketingEmail(
  opts: MarketingEmailOptions,
): Promise<{ ok: boolean; skipped?: boolean; error?: string; id?: string }> {
  const to = opts.to.toLowerCase().trim();
  const channel = opts.channel ?? "email";

  // 1. Consent gate (APP 7.2 / Spam Act s.16).
  const [consent] = await db
    .select()
    .from(marketingConsentsTable)
    .where(and(eq(marketingConsentsTable.email, to), eq(marketingConsentsTable.channel, channel)))
    .limit(1);
  const optedIn = !!consent?.opted_in_at && !consent?.opted_out_at;
  if (!optedIn) {
    console.log(`[email] marketing send refused — no active consent for ${to}`);
    return { ok: false, skipped: true, error: "No active marketing consent" };
  }

  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — skipping marketing email to ${to}`);
    return { ok: false, skipped: true, error: "Email service not configured" };
  }

  // 2. Quiet hours (KR 정보통신망법 §50④ — night-time advertising needs its own
  //    consent, which we do not collect). Inert unless the tenant configures it.
  const quiet = inMarketingQuietHours();
  if (quiet.blocked) {
    console.log(`[email] marketing send refused — quiet hours ${quiet.window} for ${to}`);
    return { ok: false, skipped: true, error: `Marketing quiet hours (${quiet.window})` };
  }

  // 3. Unsubscribe link (Spam Act s.18) + consent source (KR §50).
  const unsubUrl = buildUnsubscribeUrl(to, channel);
  const brand = await resolveEmailBrand();
  const lang = normalizeLang(opts.lang ?? process.env.DEFAULT_DOC_LANG ?? "en");
  const html = renderEmailShell({
    brand,
    body: opts.bodyHtml,
    footerLines: marketingFooter(lang, brand.name, unsubUrl, opts.consentedAt ?? consent?.opted_in_at),
  });

  try {
    const result = await client.emails.send({
      ...emailSender(),
      to: [to],
      // 4. Ad marker in the subject (KR §50④). No-op where unset.
      subject: applyAdPrefix(opts.subject),
      html,
      // 3. RFC 8058 one-click unsubscribe headers.
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    const id = (result as any)?.data?.id ?? undefined;
    console.log(`[email] marketing email sent to ${to} (${id ?? "no-id"})`);
    return { ok: true, id };
  } catch (err) {
    console.error(`[email] Failed to send marketing email to ${to}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   세대점검표 — tenant signing-link invitation
   ═══════════════════════════════════════════════════════════════════════════ */

export interface InspectionSignLinkEmailOptions {
  to: string;
  toName?: string | null;
  /** Signing URL (token link). */
  url: string;
  /** move_in | move_out — decides the wording. */
  phase: "move_in" | "move_out";
  /** Unit identifier shown in the summary box, e.g. "101호 · B타입". */
  unit?: string | null;
  reportRef: string;
  expiresAt?: Date | string | null;
  /** Copy language. Defaults to the tenant's document language. */
  lang?: string;
}

// Tenant-facing copy. Korean leads because this is a Korean-lease document; the
// other locales exist so the same link works for foreign tenants.
const SIGN_LINK_COPY: Record<string, {
  subject: (brand: string, phase: string) => string;
  phase: Record<"move_in" | "move_out", string>;
  greeting: (name: string) => string;
  intro: (phase: string) => string;
  cta: string;
  unitLabel: string;
  refLabel: string;
  expiry: (date: string) => string;
  fallback: string;
  questions: (email: string) => string;
}> = {
  ko: {
    subject: (brand, phase) => `[${brand}] ${phase} 확인 및 서명 요청`,
    phase: { move_in: "입주 점검", move_out: "퇴거 점검" },
    greeting: (name) => (name ? `${name}님, 안녕하세요.` : "안녕하세요."),
    intro: (phase) => `${phase} 결과를 확인하실 수 있도록 세대점검표를 보내드립니다. 아래 버튼을 눌러 항목별 내용을 확인하시고, 다른 점이 있으면 이의제기와 함께 사진을 남겨 주세요. 확인이 끝나면 화면에서 바로 서명하실 수 있습니다.`,
    cta: "점검표 확인하고 서명하기",
    unitLabel: "세대",
    refLabel: "점검표 번호",
    expiry: (date) => `이 링크는 ${date}까지 사용하실 수 있습니다.`,
    fallback: "버튼이 열리지 않으면 아래 주소를 복사해 브라우저에 붙여 넣어 주세요.",
    questions: (email) => `문의사항은 ${email} 으로 회신해 주세요.`,
  },
  en: {
    subject: (brand, phase) => `[${brand}] ${phase} — please review and sign`,
    phase: { move_in: "Move-in inspection", move_out: "Move-out inspection" },
    greeting: (name) => (name ? `Hi ${name},` : "Hello,"),
    intro: (phase) => `Here is the unit inspection checklist from your ${phase.toLowerCase()}. Tap the button below to review each item. If anything differs from what you see, raise a dispute and attach a photo. You can sign directly on the same screen once you are done.`,
    cta: "Review and sign",
    unitLabel: "Unit",
    refLabel: "Reference",
    expiry: (date) => `This link is valid until ${date}.`,
    fallback: "If the button does not work, copy this address into your browser.",
    questions: (email) => `Questions? Just reply to ${email}.`,
  },
  ja: {
    subject: (brand, phase) => `[${brand}] ${phase}のご確認と署名のお願い`,
    phase: { move_in: "入居点検", move_out: "退去点検" },
    greeting: (name) => (name ? `${name} 様` : "お世話になっております。"),
    intro: (phase) => `${phase}の結果をご確認いただくため、住戸点検表をお送りします。下のボタンから各項目をご確認いただき、相違がある場合は異議と写真をお送りください。ご確認後、そのまま画面上で署名いただけます。`,
    cta: "点検表を確認して署名する",
    unitLabel: "住戸",
    refLabel: "点検表番号",
    expiry: (date) => `このリンクは ${date} までご利用いただけます。`,
    fallback: "ボタンが開かない場合は、下記のURLをブラウザに貼り付けてください。",
    questions: (email) => `ご不明な点は ${email} までご返信ください。`,
  },
  zh: {
    subject: (brand, phase) => `[${brand}] ${phase}确认与签名`,
    phase: { move_in: "入住点检", move_out: "退租点检" },
    greeting: (name) => (name ? `${name} 您好，` : "您好，"),
    intro: (phase) => `现将${phase}的房屋点检表发送给您。请点击下方按钮逐项确认，如与实际情况不符，可提出异议并上传照片。确认完成后即可在同一页面签名。`,
    cta: "查看点检表并签名",
    unitLabel: "房屋",
    refLabel: "点检表编号",
    expiry: (date) => `此链接有效期至 ${date}。`,
    fallback: "如果按钮无法打开，请复制以下网址到浏览器中打开。",
    questions: (email) => `如有疑问，请回复至 ${email}。`,
  },
  th: {
    subject: (brand, phase) => `[${brand}] ${phase} — กรุณาตรวจสอบและลงลายเซ็น`,
    phase: { move_in: "การตรวจตอนเข้าอยู่", move_out: "การตรวจตอนย้ายออก" },
    greeting: (name) => (name ? `เรียน คุณ${name}` : "สวัสดีค่ะ"),
    intro: (phase) => `นี่คือแบบตรวจสภาพห้องจาก${phase} กรุณากดปุ่มด้านล่างเพื่อตรวจสอบแต่ละรายการ หากมีจุดใดไม่ตรงกับสภาพจริง สามารถโต้แย้งพร้อมแนบรูปได้ และลงลายเซ็นได้ในหน้าเดียวกัน`,
    cta: "ตรวจสอบและลงลายเซ็น",
    unitLabel: "ห้องพัก",
    refLabel: "เลขที่แบบตรวจ",
    expiry: (date) => `ลิงก์นี้ใช้ได้ถึง ${date}`,
    fallback: "หากปุ่มไม่ทำงาน กรุณาคัดลอกลิงก์ด้านล่างไปเปิดในเบราว์เซอร์",
    questions: (email) => `หากมีข้อสงสัย กรุณาตอบกลับมาที่ ${email}`,
  },
};

/**
 * Email the tenant their 세대점검표 signing link.
 *
 * Best-effort like the other transactional senders: returns a result instead of
 * throwing, so issuing the link never fails because mail is misconfigured — the
 * admin can always copy the URL by hand.
 */
export async function sendInspectionSignLinkEmail(
  opts: InspectionSignLinkEmailOptions,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — inspection sign link: ${opts.url}`);
    return { ok: false, skipped: true, error: "Email service not configured" };
  }

  const lang = normalizeLang(opts.lang ?? process.env.DEFAULT_DOC_LANG ?? "en");
  const brand = await resolveEmailBrand();
  const supportEmail = brand.supportEmail;

  const copy = SIGN_LINK_COPY[lang] ?? SIGN_LINK_COPY.en!;
  const phaseLabel = copy.phase[opts.phase];
  const safeUrl = escapeHtml(opts.url);
  const expiry = opts.expiresAt
    ? copy.expiry(new Date(opts.expiresAt).toISOString().slice(0, 10))
    : null;

  const html = renderEmailShell({
    brand,
    footerLines: [escapeHtml(opts.to)],
    body: `
    <p class="lead">${escapeHtml(copy.greeting(safeName(opts.toName)))}</p>
    <p>${escapeHtml(copy.intro(phaseLabel))}</p>
    <div class="box">
      ${opts.unit ? `<div class="label">${escapeHtml(copy.unitLabel)}</div><div class="amount">${escapeHtml(opts.unit)}</div>` : ""}
      <div class="label" style="margin-top:${opts.unit ? "10px" : "0"};">${escapeHtml(copy.refLabel)}</div>
      <div class="ref">${escapeHtml(opts.reportRef)}</div>
    </div>
    <a href="${safeUrl}" class="btn">${escapeHtml(copy.cta)} →</a>
    ${expiry ? `<p class="muted">${escapeHtml(expiry)}</p>` : ""}
    <p class="muted">${escapeHtml(copy.fallback)}<br>
      <span style="color:${brand.color};word-break:break-all;">${safeUrl}</span>
    </p>
    <p class="muted">${escapeHtml(copy.questions(supportEmail))}</p>`,
  });

  try {
    const { data, error } = await client.emails.send({
      ...emailSender(),
      to: [opts.to],
      subject: copy.subject(brand.name, phaseLabel),
      html,
    });
    if (error || !data?.id) {
      const message = (error as { message?: string } | null)?.message ?? "Send returned no message id";
      console.error(`[email] Inspection sign link to ${opts.to} rejected:`, message);
      return { ok: false, error: message };
    }
    console.log(`[email] Inspection sign link ${opts.reportRef} sent to ${opts.to} (${data.id})`);
    return { ok: true };
  } catch (err) {
    console.error(`[email] Failed to send inspection sign link to ${opts.to}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

// ── 방문 약속 확정 메일 (인스펙션 · 현장 방문) ────────────────────────────────

export interface AppointmentConfirmationEmailOptions {
  to: string;
  toName?: string | null;
  /** Work-order reference, e.g. "MS-WO-2026-00042". */
  orderRef: string;
  /** Visit title — 점검 종류가 들어간 한 줄. */
  title: string;
  start: Date;
  end: Date;
  /** Unit / property label shown in the summary box and used as .ics LOCATION. */
  unit?: string | null;
  /** 집결지·주차·출입 안내. */
  locationNote?: string | null;
  /** Who to expect on site (staff or partner name). */
  visitorName?: string | null;
  /** Bumped on every re-send so calendar clients update rather than duplicate. */
  sequence?: number;
  /** Copy language. Defaults to the tenant's document language. */
  lang?: string;
}

interface AppointmentCopy {
  subject: (brand: string, date: string) => string;
  greeting: (name: string) => string;
  intro: string;
  whenLabel: string;
  unitLabel: string;
  visitorLabel: string;
  accessLabel: string;
  refLabel: string;
  icsNote: string;
  reschedule: (email: string) => string;
}

const APPOINTMENT_COPY: Record<DocLang, AppointmentCopy> = {
  en: {
    subject: (brand, date) => `[${brand}] Inspection appointment confirmed — ${date}`,
    greeting: (name) => (name ? `Dear ${name},` : "Hello,"),
    intro: "Your property inspection is confirmed for the time below. Please make sure someone can let us in, or let us know if the time no longer suits.",
    whenLabel: "Date & time",
    unitLabel: "Property",
    visitorLabel: "Visiting",
    accessLabel: "Access notes",
    refLabel: "Reference",
    icsNote: "The attached invite.ics adds this visit to your calendar.",
    reschedule: (email) => `To reschedule, reply to this email or contact ${email}.`,
  },
  ko: {
    subject: (brand, date) => `[${brand}] 세대 점검 방문 확정 — ${date}`,
    greeting: (name) => (name ? `${name}님 안녕하세요,` : "안녕하세요,"),
    intro: "아래 일정으로 세대 점검 방문이 확정되었습니다. 방문 시간에 출입이 가능하도록 준비 부탁드리며, 일정 변경이 필요하시면 미리 알려주세요.",
    whenLabel: "방문 일시",
    unitLabel: "대상 세대",
    visitorLabel: "방문자",
    accessLabel: "출입 안내",
    refLabel: "접수번호",
    icsNote: "첨부된 invite.ics 파일로 캘린더에 일정을 추가하실 수 있습니다.",
    reschedule: (email) => `일정 변경은 본 메일에 회신하시거나 ${email} 으로 연락 주세요.`,
  },
  ja: {
    subject: (brand, date) => `[${brand}] 点検訪問のご確定 — ${date}`,
    greeting: (name) => (name ? `${name} 様` : "こんにちは、"),
    intro: "下記の日程で住戸点検の訪問が確定しました。当日ご入室いただけるようご準備をお願いいたします。日程の変更が必要な場合はご連絡ください。",
    whenLabel: "訪問日時",
    unitLabel: "対象住戸",
    visitorLabel: "訪問者",
    accessLabel: "入室について",
    refLabel: "受付番号",
    icsNote: "添付の invite.ics からカレンダーに登録できます。",
    reschedule: (email) => `日程変更をご希望の場合は本メールにご返信いただくか、${email} までご連絡ください。`,
  },
  zh: {
    subject: (brand, date) => `[${brand}] 房屋检查预约已确认 — ${date}`,
    greeting: (name) => (name ? `${name} 您好，` : "您好，"),
    intro: "您的房屋检查已按以下时间确认。请确保届时可以入内，如需改期请提前告知我们。",
    whenLabel: "检查时间",
    unitLabel: "房屋",
    visitorLabel: "到访人员",
    accessLabel: "入内说明",
    refLabel: "编号",
    icsNote: "可通过附件 invite.ics 将此行程加入日历。",
    reschedule: (email) => `如需改期，请回复本邮件或联系 ${email}。`,
  },
  th: {
    subject: (brand, date) => `[${brand}] ยืนยันนัดตรวจสภาพห้อง — ${date}`,
    greeting: (name) => (name ? `เรียน คุณ${name}` : "สวัสดีค่ะ"),
    intro: "การเข้าตรวจสภาพห้องได้รับการยืนยันตามเวลาด้านล่าง กรุณาจัดเตรียมให้เจ้าหน้าที่เข้าห้องได้ หากต้องการเปลี่ยนเวลากรุณาแจ้งล่วงหน้า",
    whenLabel: "วันและเวลา",
    unitLabel: "ห้องพัก",
    visitorLabel: "ผู้เข้าตรวจ",
    accessLabel: "การเข้าห้อง",
    refLabel: "เลขที่อ้างอิง",
    icsNote: "ไฟล์แนบ invite.ics ใช้เพิ่มนัดหมายนี้ลงในปฏิทินของคุณได้",
    reschedule: (email) => `หากต้องการเลื่อนนัด กรุณาตอบกลับอีเมลนี้หรือติดต่อ ${email}`,
  },
  vi: {
    subject: (brand, date) => `[${brand}] Xác nhận lịch kiểm tra căn hộ — ${date}`,
    greeting: (name) => (name ? `Kính gửi ${name},` : "Xin chào,"),
    intro: "Lịch kiểm tra căn hộ của bạn đã được xác nhận vào thời gian dưới đây. Vui lòng thu xếp để chúng tôi có thể vào căn hộ, hoặc báo trước nếu bạn cần đổi lịch.",
    whenLabel: "Thời gian",
    unitLabel: "Căn hộ",
    visitorLabel: "Người đến kiểm tra",
    accessLabel: "Hướng dẫn ra vào",
    refLabel: "Mã tham chiếu",
    icsNote: "Tệp invite.ics đính kèm giúp bạn thêm lịch hẹn này vào lịch cá nhân.",
    reschedule: (email) => `Để đổi lịch, vui lòng trả lời email này hoặc liên hệ ${email}.`,
  },
};

/**
 * Email the tenant (or landlord) their confirmed inspection slot, with an
 * `invite.ics` attachment so the visit lands in their own calendar.
 *
 * Best-effort like the other transactional senders — a mail failure never blocks
 * the appointment itself.
 */
export async function sendAppointmentConfirmationEmail(
  opts: AppointmentConfirmationEmailOptions,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — appointment confirmation skipped: ${opts.orderRef}`);
    return { ok: false, skipped: true, error: "Email service not configured" };
  }

  const lang = normalizeLang(opts.lang ?? process.env.DEFAULT_DOC_LANG ?? "en");
  const brand = await resolveEmailBrand();
  const supportEmail = brand.supportEmail;

  const copy = APPOINTMENT_COPY[lang] ?? APPOINTMENT_COPY.en!;
  const locale = docLocale(lang);
  const tz = process.env.DEFAULT_TIMEZONE ?? undefined;
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "full", timeStyle: "short", ...(tz ? { timeZone: tz } : {}),
  });
  const timeOnly = new Intl.DateTimeFormat(locale, {
    timeStyle: "short", ...(tz ? { timeZone: tz } : {}),
  });
  const whenText = `${fmt.format(opts.start)} – ${timeOnly.format(opts.end)}`;
  const dateShort = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium", ...(tz ? { timeZone: tz } : {}),
  }).format(opts.start);

  const row = (label: string, value: string) => `
      <div class="label" style="margin-top:10px;">${escapeHtml(label)}</div>
      <div class="amount">${escapeHtml(value)}</div>`;

  const html = renderEmailShell({
    brand,
    footerLines: [escapeHtml(opts.to)],
    body: `
    <p class="lead">${escapeHtml(copy.greeting(safeName(opts.toName)))}</p>
    <p>${escapeHtml(copy.intro)}</p>
    <div class="box">
      <div class="label" style="margin-top:0;">${escapeHtml(copy.whenLabel)}</div>
      <div class="amount">${escapeHtml(whenText)}</div>
      ${opts.unit ? row(copy.unitLabel, opts.unit) : ""}
      ${opts.visitorName ? row(copy.visitorLabel, opts.visitorName) : ""}
      ${opts.locationNote ? row(copy.accessLabel, opts.locationNote) : ""}
      <div class="label" style="margin-top:10px;">${escapeHtml(copy.refLabel)}</div>
      <div class="ref">${escapeHtml(opts.orderRef)}</div>
    </div>
    <p class="muted">${escapeHtml(copy.icsNote)}</p>
    <p class="muted">${escapeHtml(copy.reschedule(supportEmail))}</p>`,
  });

  const ics = buildAppointmentIcs([{
    uid: `wo-${opts.orderRef}@millionstay`,
    start: opts.start,
    end: opts.end,
    summary: `[${brand.name}] ${opts.title}`,
    description: [opts.locationNote, copy.reschedule(supportEmail)].filter(Boolean).join("\n"),
    location: opts.unit ?? null,
    sequence: opts.sequence ?? 0,
    organizer: { name: brand.name, email: supportEmail },
  }], { calendarName: brand.name });

  try {
    const { data, error } = await client.emails.send({
      ...emailSender(),
      to: [opts.to],
      subject: copy.subject(brand.name, dateShort),
      html,
      attachments: [{ filename: "invite.ics", content: Buffer.from(ics, "utf8").toString("base64") }],
    });
    if (error || !data?.id) {
      const message = (error as { message?: string } | null)?.message ?? "Send returned no message id";
      console.error(`[email] Appointment confirmation to ${opts.to} rejected:`, message);
      return { ok: false, error: message };
    }
    console.log(`[email] Appointment confirmation ${opts.orderRef} sent to ${opts.to} (${data.id})`);
    return { ok: true };
  } catch (err) {
    console.error(`[email] Failed to send appointment confirmation to ${opts.to}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
