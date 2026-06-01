import { Resend } from "resend";

let resend: Resend | null = null;

/** HTML-escape user-supplied text before interpolating into templates. */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape and clip a name for safe rendering. */
function safeName(name: string | null | undefined, max = 80): string {
  return escapeHtml((name ?? "").slice(0, max));
}

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.EMAIL_FROM ?? "MillionStay <noreply@contact.millionstay.com>";
const LOGO_URL = process.env.EMAIL_LOGO_URL ?? "https://www.millionstay.com/millionstay-logo.png";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "info@millionstay.com";
const PORTAL_URL = process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com";

export interface DocumentEmailOptions {
  to: string;
  toName?: string | null;
  subject: string;
  /** Human label of the document type, e.g. "Invoice", "Quotation". */
  docTypeLabel: string;
  ref: string;
  /** Optional amount line shown in the cover email, e.g. "1,450.00 AUD". */
  amountLabel?: string | null;
  /** Optional extra sentence (e.g. due date / validity). */
  note?: string | null;
  /** The rendered PDF to attach. */
  pdf: Buffer;
  filename: string;
}

/**
 * Send a customer-facing document (invoice / receipt / quote / contract) as a
 * branded cover email with the PDF attached. Best-effort: returns a result
 * object and never throws, so callers can record the outcome and continue.
 */
export async function sendDocumentEmail(
  opts: DocumentEmailOptions,
): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — skipping ${opts.docTypeLabel} ${opts.ref} to ${opts.to}`);
    return { ok: false, skipped: true, error: "Email service not configured" };
  }

  const greeting = opts.toName ? `Hi <strong>${safeName(opts.toName)}</strong>,` : "Hello,";
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'Inter',-apple-system,sans-serif;margin:0;padding:0;background:#f9fafb;color:#111;}
  .container{max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .header{background:#fff;padding:28px 32px;border-bottom:1px solid #f0f0f0;}
  .header img{height:36px;width:auto;display:block;}
  .body{padding:32px;}
  .ref-box{background:#FFF7F0;border:1px solid #FCD9B6;border-radius:10px;padding:16px 20px;margin:20px 0;}
  .ref-box .label{font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#999;}
  .ref-box .ref{font-size:18px;font-weight:700;color:#E8621A;font-family:monospace;letter-spacing:0.04em;}
  .amount{font-size:15px;color:#111;margin-top:8px;font-weight:600;}
  .footer{padding:20px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;}
</style></head><body>
<div class="container">
  <div class="header"><img src="${LOGO_URL}" alt="MillionStay" /></div>
  <div class="body">
    <p style="font-size:16px;">${greeting}</p>
    <p style="color:#555;font-size:14px;">Please find your ${escapeHtml(opts.docTypeLabel.toLowerCase())} attached as a PDF.</p>
    <div class="ref-box">
      <div class="label">${escapeHtml(opts.docTypeLabel)}</div>
      <div class="ref">${escapeHtml(opts.ref)}</div>
      ${opts.amountLabel ? `<div class="amount">${escapeHtml(opts.amountLabel)}</div>` : ""}
    </div>
    ${opts.note ? `<p style="font-size:13px;color:#555;">${escapeHtml(opts.note)}</p>` : ""}
    <p style="font-size:13px;color:#999;">Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#E8621A;">${SUPPORT_EMAIL}</a>.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} MillionStay Pty Ltd · This email was sent to ${escapeHtml(opts.to)}</div>
</div></body></html>`;

  try {
    const result = await client.emails.send({
      from: FROM,
      to: [opts.to],
      subject: opts.subject,
      html,
      attachments: [{ filename: opts.filename, content: opts.pdf.toString("base64") }],
    });
    const id = (result as any)?.data?.id ?? undefined;
    console.log(`[email] ${opts.docTypeLabel} ${opts.ref} sent to ${opts.to} (${id ?? "no-id"})`);
    return { ok: true, id };
  } catch (err) {
    console.error(`[email] Failed to send ${opts.docTypeLabel} ${opts.ref}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

export interface PasswordResetEmailOptions {
  to: string;
  name: string;
  resetUrl: string;
  product?: "Admin" | "Guest" | "Partner";
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

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f9fafb;color:#111;}
  .container{max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .header{background:#fff;padding:28px 32px;border-bottom:1px solid #f0f0f0;text-align:left;}
  .header img{height:36px;width:auto;display:block;}
  .body{padding:32px;}
  .btn{display:block;text-align:center;background:#E8621A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin:24px 0;}
  .note{font-size:12px;color:#999;margin-top:16px;}
  .footer{padding:20px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;}
</style></head><body>
<div class="container">
  <div class="header"><img src="${LOGO_URL}" alt="MillionStay" /></div>
  <div class="body">
    <p style="font-size:16px;">Hi <strong>${safeNameVal}</strong>,</p>
    <p style="color:#555;font-size:14px;">We received a request to reset the password for your MillionStay ${escapeHtml(productLabel)} account. Click the button below to set a new password:</p>
    <a href="${safeUrl}" class="btn">Reset My Password →</a>
    <p class="note">⏱ This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p style="font-size:13px;color:#999;">If the button doesn't work, copy and paste this URL into your browser:<br>
      <span style="color:#E8621A;word-break:break-all;">${safeUrl}</span>
    </p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} MillionStay Pty Ltd · This email was sent to ${safeTo}</div>
</div></body></html>`;
  try {
    await client.emails.send({
      from: FROM,
      to: [opts.to],
      subject: `[MillionStay ${productLabel}] Password Reset Request`,
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
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f9fafb;color:#111;}
  .container{max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .header{background:#fff;padding:28px 32px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;}
  .header img{height:36px;width:auto;}
  .header .tag{font-size:13px;font-weight:600;color:#E8621A;}
  .body{padding:32px;}
  .info-box{background:#fff7f0;border:1px solid #fcd9b6;border-radius:10px;padding:16px;margin:16px 0;}
  .btn{display:block;text-align:center;background:#E8621A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin:20px 0;}
  .footer{padding:20px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;}
</style></head><body>
<div class="container">
  <div class="header"><img src="${LOGO_URL}" alt="MillionStay" /><span class="tag">New Access Request</span></div>
  <div class="body">
    <p style="font-size:15px;">A new admin account request has been submitted and is awaiting your approval.</p>
    <div class="info-box">
      <strong>${safeName(name)}</strong><br>
      <span style="color:#555;">${escapeHtml(to)}</span>
    </div>
    <p style="font-size:14px;color:#555;">Please log in to the admin panel and navigate to <strong>Settings → Users</strong> to review and approve or reject this request.</p>
    <a href="${escapeHtml(adminPanelUrl)}/settings/users" class="btn">Review in Admin Panel →</a>
  </div>
  <div class="footer">© ${new Date().getFullYear()} MillionStay Pty Ltd</div>
</div></body></html>`;
  try {
    await client.emails.send({ from: FROM, to: [to], subject: "[MillionStay Admin] New Account Request", html });
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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; background: #f9fafb; color: #111; }
  .container { max-width: 600px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { background: #fff; padding: 28px 32px; border-bottom: 1px solid #f0f0f0; }
  .header img { height: 40px; width: auto; display: block; margin-bottom: 8px; }
  .header p { margin: 0; color: #E8621A; font-weight: 600; font-size: 14px; }
  .body { padding: 32px; }
  .ref-box { background: #fff7f0; border: 2px solid #E8621A; border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 24px; }
  .ref-box .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
  .ref-box .ref { font-size: 22px; font-weight: 900; color: #E8621A; font-family: monospace; letter-spacing: 0.05em; }
  .section { margin-bottom: 20px; }
  .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #999; margin: 0 0 10px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .row .label { color: #555; }
  .row .value { font-weight: 600; color: #111; }
  .total-box { background: #E8621A; border-radius: 12px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .total-box span { color: white; font-weight: 700; font-size: 15px; }
  .total-box .amount { font-size: 22px; }
  .portal-btn { display: block; text-align: center; background: #E8621A; color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 24px 0; }
  .footer { padding: 24px 32px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; text-align: center; }
  .bank-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-top: 20px; }
  .bank-box h3 { color: #1d4ed8; margin: 0 0 10px; font-size: 14px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <img src="${LOGO_URL}" alt="MillionStay" />
    <p>${isLongTerm ? "Long-term Stay Application Received" : "Booking Application Submitted"}</p>
  </div>
  <div class="body">
    <p style="font-size:16px;">Hi <strong>${safeName(guestName)}</strong>,</p>
    <p style="color:#555;font-size:14px;">
      ${isLongTerm
        ? "Your long-term stay application has been received. Our team will review and contact you within 24–48 hours."
        : "Your booking application has been submitted. Please complete the bank transfer to confirm your room."
      }
    </p>

    <div class="ref-box">
      <div class="label">Booking Reference</div>
      <div class="ref">${escapeHtml(bookingRef)}</div>
    </div>

    <div class="section">
      <h3>Your Stay</h3>
      <div class="row"><span class="label">Property</span><span class="value">${escapeHtml(spaceName)}</span></div>
      <div class="row"><span class="label">Address</span><span class="value">${escapeHtml(propertyAddress)}</span></div>
      <div class="row"><span class="label">Check In</span><span class="value">${escapeHtml(checkIn)}</span></div>
      <div class="row"><span class="label">Check Out</span><span class="value">${escapeHtml(checkOut)}</span></div>
      ${weeklyRate ? `<div class="row"><span class="label">Weekly Rate</span><span class="value">$${weeklyRate.toLocaleString()} ${currency}/week</span></div>` : ""}
    </div>

    ${totalDue ? `
    <div class="total-box">
      <span>Amount Due</span>
      <span class="amount">$${totalDue.toLocaleString()} ${currency}</span>
    </div>
    ` : ""}

    ${!isLongTerm ? `
    <div class="bank-box">
      <h3>🏦 Bank Transfer Details</h3>
      <div class="row"><span class="label">Bank</span><span class="value">Commonwealth Bank of Australia</span></div>
      <div class="row"><span class="label">Account Name</span><span class="value">MillionStay Pty Ltd</span></div>
      <div class="row"><span class="label">BSB</span><span class="value">063-000</span></div>
      <div class="row"><span class="label">Account No.</span><span class="value">1234 5678</span></div>
      <div class="row"><span class="label">Reference</span><span class="value">${escapeHtml(bookingRef)}</span></div>
      <p style="font-size:12px;color:#555;margin-top:10px;">⏱ Please complete the transfer within <strong>48 hours</strong>.</p>
    </div>
    ` : ""}

    <a href="${PORTAL_URL}/portal/bookings" class="portal-btn">
      Access Your Guest Portal →
    </a>

    <p style="font-size:13px;color:#999;">
      Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#E8621A;">${SUPPORT_EMAIL}</a>
    </p>
  </div>
  <div class="footer">
    © ${new Date().getFullYear()} MillionStay Pty Ltd · Melbourne Student &amp; Nomad Accommodation<br>
    This email was sent to ${to}
  </div>
</div>
</body>
</html>`;

  try {
    await client.emails.send({
      from: FROM,
      to: [to],
      subject: `[MillionStay] Booking Confirmed — ${bookingRef}`,
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
  const to = process.env.LEADS_NOTIFY_EMAIL ?? SUPPORT_EMAIL;
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

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f9fafb;color:#111;}
  .container{max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .header{background:#fff;padding:28px 32px;border-bottom:1px solid #f0f0f0;}
  .header img{height:36px;width:auto;display:block;}
  .body{padding:24px 32px;}
  .ref{display:inline-block;background:#FFF3EC;color:#E8621A;font-weight:700;padding:4px 10px;border-radius:6px;font-size:13px;}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;}
  td{padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;}
  td.k{color:#6b7280;width:120px;}
  .msg{background:#f9fafb;border-radius:10px;padding:14px 16px;font-size:14px;color:#374151;white-space:pre-wrap;margin-top:6px;}
  .footer{padding:18px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;}
</style></head><body>
<div class="container">
  <div class="header"><img src="${LOGO_URL}" alt="MillionStay" /></div>
  <div class="body">
    <p style="font-size:14px;color:#6b7280;margin:0 0 6px;">New ${safeType} inquiry</p>
    <h2 style="margin:0 0 12px;font-size:20px;">${fullName || "(no name)"} &nbsp; <span class="ref">${safeRef}</span></h2>
    <table>
      <tr><td class="k">Email</td><td><a href="mailto:${safeEmail}" style="color:#E8621A;">${safeEmail}</a></td></tr>
      ${safePhone ? `<tr><td class="k">Phone</td><td>${safePhone}</td></tr>` : ""}
      ${safeDesc ? `<tr><td class="k">Details</td><td style="white-space:pre-wrap;">${safeDesc}</td></tr>` : ""}
    </table>
    ${safeMessage ? `<p style="font-size:13px;color:#6b7280;margin:16px 0 4px;">Message:</p><div class="msg">${safeMessage}</div>` : ""}
    <p style="font-size:13px;color:#9ca3af;margin-top:24px;">View this lead in the admin panel.</p>
  </div>
  <div class="footer">
    © ${new Date().getFullYear()} MillionStay · Internal notification
  </div>
</div>
</body></html>`;

  try {
    await client.emails.send({
      from: FROM,
      to: [to],
      replyTo: data.email,
      subject: `[MillionStay Lead] ${data.inquiryType} — ${fullName || data.email} (${data.leadRef})`,
      html,
    });
    console.log(`[email] Lead notification sent for ${data.leadRef} → ${to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send lead notification:", err);
    return false;
  }
}
