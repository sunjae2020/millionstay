// Homestay monthly rent — per-cycle automation. A daily cron calls
// generateMonthlyPlacementCharges(): for each Active placement whose
// next_billing_date is due, it creates a `monthly` homestay_placement_payments
// charge (card, +2% surcharge), emails the student a Stripe Checkout link, and
// advances next_billing_date by one month. Best-effort per placement.
//
// Bank-transfer monthly payers are handled manually by ops (Charge monthly →
// bank in the admin); this automation only generates card payment links.
import { Resend } from "resend";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  homestayPlacementsTable,
  homestayPlacementPaymentsTable,
  homestayStudentRequestsTable,
} from "@workspace/db";
import { getStripe } from "../../routes/stripe.js";
import { resolveTemplate, renderString } from "../documents/templateEngine.js";

const SURCHARGE_RATE = 0.02;
const FROM = process.env.EMAIL_FROM ?? "MillionStay <noreply@contact.millionstay.com>";

/** Today's date in Sydney as YYYY-MM-DD (matches the cron timezone). */
function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

/** Add one calendar month to a YYYY-MM-DD string, clamping the day-of-month. */
function addOneMonth(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + 1);
  const daysInNext = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, daysInNext));
  return base.toISOString().slice(0, 10);
}

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface MonthlyBillingResult { scanned: number; charged: number; skipped: number; errors: number }

export async function generateMonthlyPlacementCharges(): Promise<MonthlyBillingResult> {
  const today = sydneyToday();
  const result: MonthlyBillingResult = { scanned: 0, charged: 0, skipped: 0, errors: 0 };

  const due = await db.select().from(homestayPlacementsTable)
    .where(and(
      eq(homestayPlacementsTable.status, "Active"),
      isNull(homestayPlacementsTable.deleted_at),
      lte(homestayPlacementsTable.next_billing_date, today),
      sql`${homestayPlacementsTable.monthly_fee} > 0`,
    ));
  result.scanned = due.length;
  if (due.length === 0) return result;

  const stripe = getStripe();
  const resendKey = process.env.RESEND_API_KEY;
  const webBase = (process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com").replace(/\/+$/, "");

  for (const pl of due) {
    try {
      if (!stripe) { result.skipped++; continue; } // can't create a link without Stripe
      const periodStart = pl.next_billing_date!;
      const periodEnd = addOneMonth(periodStart);

      // Skip if a charge for this exact period already exists (idempotent).
      const [dup] = await db.select({ id: homestayPlacementPaymentsTable.id }).from(homestayPlacementPaymentsTable)
        .where(and(
          eq(homestayPlacementPaymentsTable.placement_id, pl.id),
          eq(homestayPlacementPaymentsTable.kind, "monthly"),
          eq(homestayPlacementPaymentsTable.period_start, periodStart),
        )).limit(1);
      if (dup) {
        await db.update(homestayPlacementsTable).set({ next_billing_date: periodEnd, updated_at: new Date() }).where(eq(homestayPlacementsTable.id, pl.id));
        result.skipped++;
        continue;
      }

      const base = Number(pl.monthly_fee);
      const surcharge = Math.round(base * SURCHARGE_RATE * 100) / 100;
      const total = Math.round((base + surcharge) * 100) / 100;
      const currency = pl.currency || "AUD";

      const [pay] = await db.insert(homestayPlacementPaymentsTable).values({
        placement_id: pl.id, kind: "monthly", method: "card", status: "pending",
        base_amount: String(base), surcharge_amount: String(surcharge), amount: String(total), currency,
        period_start: periodStart, period_end: periodEnd,
      }).returning();

      const [student] = await db.select().from(homestayStudentRequestsTable)
        .where(eq(homestayStudentRequestsTable.id, pl.student_request_id)).limit(1);
      const studentEmail = student?.student_email || student?.guardian_email || null;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price_data: { currency: currency.toLowerCase(), product_data: { name: `Homestay ${pl.placement_ref} — monthly fee ${periodStart} (incl. 2% card fee)` }, unit_amount: Math.round(total * 100) }, quantity: 1 }],
        metadata: { placement_payment_id: String(pay!.id), placement_id: String(pl.id), placement_ref: pl.placement_ref, kind: "monthly" },
        customer_email: studentEmail || undefined,
        success_url: `${webBase}/payment-result?status=success&ref=${encodeURIComponent(pl.placement_ref)}`,
        cancel_url: `${webBase}/payment-result?status=cancelled&ref=${encodeURIComponent(pl.placement_ref)}`,
      });

      // Email the student the payment link (template → fallback). Best-effort.
      if (studentEmail && resendKey && session.url) {
        const vars = {
          ref: pl.placement_ref,
          name: student ? `${student.student_first_name} ${student.student_last_name}`.trim() : "there",
          amount: money(total, currency),
          period: periodStart,
          pay_url: session.url,
        };
        const tpl = await resolveTemplate({ kind: "email", key: "homestay.payment_due", locale: "en" });
        const subject = tpl ? renderString(tpl.subject || `Homestay monthly fee due (${pl.placement_ref})`, vars) : `Homestay monthly fee due (${pl.placement_ref})`;
        const inner = tpl
          ? renderString(tpl.bodyHtml, vars)
          : `<h1 style="font-size:20px;margin:0 0 12px;color:#1f2937;">Monthly homestay fee</h1>
             <p style="font-size:14px;color:#4b5563;line-height:1.6;">Hi ${vars.name}, your homestay monthly fee of <strong>${vars.amount}</strong> for the period starting ${vars.period} is due. Please pay securely here:</p>
             <p style="margin:18px 0;"><a href="${vars.pay_url}" style="background:#E8621A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay now</a></p>
             <p style="font-size:12px;color:#9ca3af;">A 2% card processing fee is included. Reference: ${vars.ref}.</p>`;
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border:1px solid #eee;border-radius:14px;padding:28px;">${inner}</div></div></body></html>`;
        try { await new Resend(resendKey).emails.send({ from: FROM, to: [studentEmail], subject, html }); } catch (e) { console.error("[monthlyBilling] email failed:", e); }
      }

      await db.update(homestayPlacementsTable).set({ next_billing_date: periodEnd, updated_at: new Date() }).where(eq(homestayPlacementsTable.id, pl.id));
      result.charged++;
    } catch (err) {
      console.error(`[monthlyBilling] placement ${pl.id} failed:`, err);
      result.errors++;
    }
  }
  return result;
}
