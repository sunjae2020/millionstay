import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.EMAIL_FROM ?? "MillionStay <noreply@millionstay.com.au>";

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY not set — password reset link: ${resetUrl}`);
    return false;
  }
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f9fafb;color:#111;}
  .container{max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .header{background:linear-gradient(135deg,#E8621A,#c04c10);padding:28px 32px;color:white;}
  .header h1{margin:0;font-size:20px;font-weight:800;}
  .body{padding:32px;}
  .btn{display:block;text-align:center;background:#E8621A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin:24px 0;}
  .note{font-size:12px;color:#999;margin-top:16px;}
  .footer{padding:20px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;}
</style></head><body>
<div class="container">
  <div class="header"><h1>🏠 MillionStay Admin</h1></div>
  <div class="body">
    <p style="font-size:16px;">Hi <strong>${name}</strong>,</p>
    <p style="color:#555;font-size:14px;">We received a request to reset the password for your MillionStay admin account. Click the button below to set a new password:</p>
    <a href="${resetUrl}" class="btn">Reset My Password →</a>
    <p class="note">⏱ This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p style="font-size:13px;color:#999;">If the button doesn't work, copy and paste this URL into your browser:<br>
      <span style="color:#E8621A;word-break:break-all;">${resetUrl}</span>
    </p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} MillionStay Pty Ltd · This email was sent to ${to}</div>
</div></body></html>`;
  try {
    await client.emails.send({ from: FROM, to: [to], subject: "[MillionStay Admin] Password Reset Request", html });
    console.log(`[email] Password reset sent to ${to}`);
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
  .header{background:linear-gradient(135deg,#E8621A,#c04c10);padding:28px 32px;color:white;}
  .header h1{margin:0;font-size:20px;font-weight:800;}
  .body{padding:32px;}
  .info-box{background:#fff7f0;border:1px solid #fcd9b6;border-radius:10px;padding:16px;margin:16px 0;}
  .btn{display:block;text-align:center;background:#E8621A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin:20px 0;}
  .footer{padding:20px 32px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;}
</style></head><body>
<div class="container">
  <div class="header"><h1>🏠 MillionStay Admin — New Access Request</h1></div>
  <div class="body">
    <p style="font-size:15px;">A new admin account request has been submitted and is awaiting your approval.</p>
    <div class="info-box">
      <strong>${name}</strong><br>
      <span style="color:#555;">${to}</span>
    </div>
    <p style="font-size:14px;color:#555;">Please log in to the admin panel and navigate to <strong>Settings → Users</strong> to review and approve or reject this request.</p>
    <a href="${adminPanelUrl}/settings/users" class="btn">Review in Admin Panel →</a>
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
  .header { background: linear-gradient(135deg, #E8621A, #c04c10); padding: 32px; color: white; }
  .header h1 { margin: 0 0 4px; font-size: 24px; font-weight: 800; }
  .header p { margin: 0; opacity: 0.85; font-size: 14px; }
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
    <h1>🏠 MillionStay</h1>
    <p>${isLongTerm ? "Long-term Stay Application Received" : "Booking Application Submitted"}</p>
  </div>
  <div class="body">
    <p style="font-size:16px;">Hi <strong>${guestName}</strong>,</p>
    <p style="color:#555;font-size:14px;">
      ${isLongTerm
        ? "Your long-term stay application has been received. Our team will review and contact you within 24–48 hours."
        : "Your booking application has been submitted. Please complete the bank transfer to confirm your room."
      }
    </p>

    <div class="ref-box">
      <div class="label">Booking Reference</div>
      <div class="ref">${bookingRef}</div>
    </div>

    <div class="section">
      <h3>Your Stay</h3>
      <div class="row"><span class="label">Property</span><span class="value">${spaceName}</span></div>
      <div class="row"><span class="label">Address</span><span class="value">${propertyAddress}</span></div>
      <div class="row"><span class="label">Check In</span><span class="value">${checkIn}</span></div>
      <div class="row"><span class="label">Check Out</span><span class="value">${checkOut}</span></div>
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
      <div class="row"><span class="label">Reference</span><span class="value">${bookingRef}</span></div>
      <p style="font-size:12px;color:#555;margin-top:10px;">⏱ Please complete the transfer within <strong>48 hours</strong>.</p>
    </div>
    ` : ""}

    <a href="https://millionstay.com.au/portal/bookings" class="portal-btn">
      Access Your Guest Portal →
    </a>

    <p style="font-size:13px;color:#999;">
      Questions? Contact us at <a href="mailto:info@millionstay.com.au" style="color:#E8621A;">info@millionstay.com.au</a>
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
