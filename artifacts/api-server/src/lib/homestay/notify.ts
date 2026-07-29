// Homestay lifecycle transactional notifications (student + guardian).
//
// Small best-effort email module mirroring studentPortalInvite.ts's Resend
// setup: shared emailSender()/renderEmailShell() tenant branding and the
// "RESEND_API_KEY not set → console.log + return false" contract. These are
// strictly transactional placement-lifecycle emails and are ALWAYS best-effort:
// they never throw, so they can never block the main flow that triggers them.
//
// English only (project i18n policy: transactional lifecycle emails are English).
import { Resend } from "resend";
import { emailSender } from "../email";
import { resolveEmailBrand, renderEmailShell } from "../emailBrand";
import { escapeHtml } from "../htmlEscape";

/**
 * Send a branded homestay lifecycle email to the student (CC the guardian when
 * provided). Best-effort: when RESEND_API_KEY is unset, logs + returns false;
 * never throws. `bodyHtml` is the caller-composed inner HTML and is inserted
 * verbatim — builders below pre-escape all interpolated text.
 */
export async function sendHomestayNotification(opts: {
  to: string;
  ccGuardian?: string | null;
  subject: string;
  heading: string;
  bodyHtml: string;
}): Promise<boolean> {
  const to = (opts.to ?? "").trim();
  if (!to) return false;
  const cc = (opts.ccGuardian ?? "").trim();

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — homestay notification "${opts.subject}" to ${to}${cc ? ` (cc ${cc})` : ""}`);
    return false;
  }

  const safeHeading = escapeHtml(opts.heading);
  const safeTo = escapeHtml(to);

  const brand = await resolveEmailBrand();
  const html = renderEmailShell({
    brand,
    footerLines: [`This email was sent to ${safeTo}`],
    body: `
    <h2>${safeHeading}</h2>
    ${opts.bodyHtml}`,
  });

  try {
    const client = new Resend(key);
    await client.emails.send({
      ...emailSender(),
      to: [to],
      ...(cc ? { cc: [cc] } : {}),
      subject: opts.subject,
      html,
    });
    console.log(`[email] Homestay notification "${opts.subject}" sent to ${to}${cc ? ` (cc ${cc})` : ""}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send homestay notification:", err);
    return false;
  }
}

function greeting(studentName: string | null | undefined): string {
  const name = (studentName ?? "").trim();
  return `<p style="font-size:16px;">Hi <strong>${escapeHtml(name || "there")}</strong>,</p>`;
}

/** "We've found a homestay match" — placement created (Proposed). */
export function notifyPlacementProposed(opts: {
  studentEmail: string | null | undefined;
  guardianEmail?: string | null;
  studentName?: string | null;
  placementRef: string;
}): Promise<boolean> {
  const to = (opts.studentEmail ?? "").trim();
  if (!to) return Promise.resolve(false);
  const ref = escapeHtml(opts.placementRef);
  const bodyHtml = `
    ${greeting(opts.studentName)}
    <p style="color:#555;font-size:14px;">Good news — we've found a homestay match for you. Your placement reference is <strong>${ref}</strong>.</p>
    <p style="color:#555;font-size:14px;">Our team will follow up shortly with the homestay agreement to review and sign. No action is needed from you right now.</p>`;
  return sendHomestayNotification({
    to,
    ccGuardian: opts.guardianEmail ?? null,
    subject: `We've found a homestay match (${opts.placementRef})`,
    heading: "We've found a homestay match",
    bodyHtml,
  });
}

/** "Your homestay placement is confirmed" — activation (→ Active). */
export function notifyPlacementActivated(opts: {
  studentEmail: string | null | undefined;
  guardianEmail?: string | null;
  studentName?: string | null;
  placementRef: string;
  moveInDate?: string | null;
}): Promise<boolean> {
  const to = (opts.studentEmail ?? "").trim();
  if (!to) return Promise.resolve(false);
  const ref = escapeHtml(opts.placementRef);
  const moveIn = (opts.moveInDate ?? "").trim();
  const moveInLine = moveIn
    ? `<p style="color:#555;font-size:14px;">Your move-in date is <strong>${escapeHtml(moveIn)}</strong>.</p>`
    : "";
  const bodyHtml = `
    ${greeting(opts.studentName)}
    <p style="color:#555;font-size:14px;">Your homestay placement <strong>${ref}</strong> is now confirmed. Welcome!</p>
    ${moveInLine}
    <p style="color:#555;font-size:14px;">You can log into your student portal any time to view your placement, invoices and payments.</p>`;
  return sendHomestayNotification({
    to,
    ccGuardian: opts.guardianEmail ?? null,
    subject: `Your homestay placement is confirmed (${opts.placementRef})`,
    heading: "Your homestay placement is confirmed",
    bodyHtml,
  });
}

/** "Payment reminder" — ops-triggered nudge for a pending charge. */
export function notifyPaymentReminder(opts: {
  studentEmail: string | null | undefined;
  guardianEmail?: string | null;
  studentName?: string | null;
  placementRef: string;
  amount: number;
  currency: string;
  payUrl?: string | null;
}): Promise<boolean> {
  const to = (opts.studentEmail ?? "").trim();
  if (!to) return Promise.resolve(false);
  const ref = escapeHtml(opts.placementRef);
  const amountStr = escapeHtml(
    `${opts.currency} ${Number(opts.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
  );
  const payUrl = (opts.payUrl ?? "").trim();
  const payLine = payUrl
    ? `<a href="${escapeHtml(payUrl)}" class="btn">Pay Now →</a>`
    : `<p style="color:#555;font-size:14px;">Please get in touch with our team to complete this payment.</p>`;
  const bodyHtml = `
    ${greeting(opts.studentName)}
    <p style="color:#555;font-size:14px;">This is a friendly reminder that a homestay payment of <strong>${amountStr}</strong> for placement <strong>${ref}</strong> is still outstanding.</p>
    ${payLine}`;
  return sendHomestayNotification({
    to,
    ccGuardian: opts.guardianEmail ?? null,
    subject: `Payment reminder (${opts.placementRef})`,
    heading: "Payment reminder",
    bodyHtml,
  });
}
