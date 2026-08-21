// Student portal login provisioning (ops-triggered).
//
// Placed homestay students get an `accounts` row (account_type='Guest') from
// Phase 1's booking creation, but NO `guest_users` login — so they cannot reach
// the existing guest portal (/portal/*) that already surfaces their booking,
// invoices and payments. This module provisions that login on demand and emails
// a set-password link, REUSING the existing guest password-reset flow verbatim:
//
//   - token  = crypto.randomBytes(32).toString("hex")            (same RNG)
//   - hash   = sha256(rawToken)  → guest_users.reset_token_hash  (same hashing)
//   - expiry = now + 1h          → guest_users.reset_token_expires_at
//   - link   = ${PUBLIC_WEB_URL || CLIENT_URL || fallback}/reset-password#token=${rawToken}
//
// These match guest-auth.ts's /v1/auth/guest/forgot-password exactly, so the
// existing /v1/auth/guest/reset-password handler consumes the token unchanged.
// English only (project i18n policy: transactional auth emails are English).
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { emailSender, resendClient } from "../email";
import { resolveEmailBrand, renderEmailShell } from "../emailBrand";
import { escapeHtml } from "../htmlEscape";
import { eq } from "drizzle-orm";
import { db, guestUsersTable, homestayStudentRequestsTable } from "@workspace/db";
import { formatPersonName } from "../../lib/nameFormat";

// Mirror guest-auth.ts constants so the provisioned token is interchangeable
// with the existing reset flow.
const BCRYPT_COST = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — matches guest-auth.ts

export interface StudentPortalInviteResult {
  ok: true;
  emailed: boolean;
  guest_user_id: number;
}

/**
 * Provision (or reuse) a guest_users login for a placed homestay student and
 * email a set-password link. Best-effort on email: when RESEND_API_KEY is unset
 * (or the send fails) the login + token are still persisted and we return
 * { emailed: false }, so ops can re-send.
 *
 * @throws Error when the request is missing, has no email, or has no account yet.
 */
export async function sendStudentPortalInvite(
  studentRequestId: number,
): Promise<StudentPortalInviteResult> {
  const [request] = await db
    .select()
    .from(homestayStudentRequestsTable)
    .where(eq(homestayStudentRequestsTable.id, studentRequestId))
    .limit(1);

  if (!request) {
    throw new Error("Student request not found");
  }

  const email = (request.student_email ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Student has no email");
  }

  if (request.account_id == null) {
    throw new Error("Student has no account yet — create the placement/booking first");
  }
  const accountId = request.account_id;

  // ── Ensure a guest_users row for this email ──────────────────────────────
  const [existing] = await db
    .select()
    .from(guestUsersTable)
    .where(eq(guestUsersTable.email, email))
    .limit(1);

  let guestUserId: number;
  if (existing) {
    guestUserId = existing.id;
    // Backfill account_id only when it's missing; never overwrite a non-null
    // value (it may legitimately point elsewhere — proceed regardless).
    if (existing.account_id == null) {
      await db
        .update(guestUsersTable)
        .set({ account_id: accountId })
        .where(eq(guestUsersTable.id, existing.id));
    }
  } else {
    // Throwaway password — the student never uses it; they set their own via
    // the reset link. password_hash is NOT NULL so we must store something.
    const throwaway = crypto.randomBytes(32).toString("hex");
    const password_hash = await bcrypt.hash(throwaway, BCRYPT_COST);
    const [created] = await db
      .insert(guestUsersTable)
      .values({
        email,
        password_hash,
        account_id: accountId,
        first_name: request.student_first_name ?? null,
        last_name: request.student_last_name ?? null,
        is_active: true,
      })
      .returning({ id: guestUsersTable.id });
    guestUserId = created!.id;
  }

  // ── Issue a reset token (identical to guest-auth forgot-password) ────────
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db
    .update(guestUsersTable)
    .set({ reset_token_hash: tokenHash, reset_token_expires_at: expires })
    .where(eq(guestUsersTable.id, guestUserId));

  const baseUrl =
    process.env["PUBLIC_WEB_URL"] || process.env["CLIENT_URL"] || "https://millionstay.com";
  const inviteUrl = `${baseUrl}/reset-password#token=${rawToken}`;

  const emailed = await sendInviteEmail({
    to: email,
    name: formatPersonName(request.student_first_name, request.student_last_name) || email,
    inviteUrl,
  });

  return { ok: true, emailed, guest_user_id: guestUserId };
}

/**
 * Branded set-password invite email — same Resend sender/layout as
 * lib/email.ts's password-reset, but with student-portal wording. Best-effort:
 * returns false (never throws) when email isn't configured or the send fails.
 */
async function sendInviteEmail(opts: {
  to: string;
  name: string;
  inviteUrl: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — student portal invite link: ${opts.inviteUrl}`);
    return false;
  }

  const safeNameVal = escapeHtml(opts.name.slice(0, 80));
  const safeTo = escapeHtml(opts.to);
  const safeUrl = escapeHtml(opts.inviteUrl);

  const brand = await resolveEmailBrand();
  const html = renderEmailShell({
    brand,
    footerLines: [`This email was sent to ${safeTo}`],
    body: `
    <p class="lead">Hi <strong>${safeNameVal}</strong>,</p>
    <p>Your ${escapeHtml(brand.name)} student portal is ready. Set your password to log in and view your homestay placement, invoices and payments in one place.</p>
    <a href="${safeUrl}" class="btn">Set Up My Portal →</a>
    <p class="muted">⏱ This link expires in <strong>1 hour</strong>. If you weren't expecting this, you can safely ignore this email.</p>
    <p class="muted">If the button doesn't work, copy and paste this URL into your browser:<br>
      <span style="color:${brand.color};word-break:break-all;">${safeUrl}</span>
    </p>`,
  });

  try {
    const client = resendClient(key)!;
    await client.emails.send({
      ...emailSender(brand.name),
      to: [opts.to],
      subject: `Set up your ${brand.name} student portal`,
      html,
    });
    console.log(`[email] Student portal invite sent to ${opts.to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send student portal invite:", err);
    return false;
  }
}
