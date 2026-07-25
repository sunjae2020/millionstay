import { Router } from "express";
import Stripe from "stripe";
import { db, invoicesTable, homestayPlacementsTable, homestayStudentRequestsTable, homestayPlacementPaymentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logAction } from "../utils/auditLog";
import { createCommissionForPlacement } from "../lib/homestay/commission";
import { postInvoicePaid, postPlacementPaymentPaid } from "../lib/billing/gl";
import { createRentScheduleForPlacement } from "../lib/homestay/rentSchedule";
import { notifyPlacementActivated } from "../lib/homestay/notify";
import { formatPersonName } from "../lib/nameFormat";

const router = Router();

export function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

router.get("/v1/stripe/config", (_req, res): void => {
  const publishableKey = process.env["STRIPE_PUBLISHABLE_KEY"];
  const isLive = publishableKey?.startsWith("pk_live_") ?? false;
  res.json({
    publishable_key: publishableKey ?? null,
    mode: isLive ? "live" : "test",
    configured: !!publishableKey,
  });
});

router.post("/v1/stripe/webhook", async (req, res): Promise<void> => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: "Missing stripe-signature or webhook secret" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, Array.isArray(sig) ? sig[0] : sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
    res.status(400).json({ error: msg });
    return;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoice_id ? Number(pi.metadata.invoice_id) : null;
        if (invoiceId) {
          const now = new Date();
          const [inv] = await db.update(invoicesTable)
            .set({ status: "Paid", paid_at: now, updated_at: now })
            .where(eq(invoicesTable.id, invoiceId))
            .returning();
          await logAction({
            entityType: "invoice",
            entityId: invoiceId,
            action: "PAYMENT",
            newValue: { status: "Paid", stripe_payment_intent: pi.id, amount: pi.amount },
          });
          // Auto-post the GL entry (best-effort; never blocks the webhook).
          if (inv) void postInvoicePaid({ id: inv.id, amount: Number(inv.amount), currency: inv.currency, paidAt: now.toISOString() });
        }
        console.log(`[Stripe] payment_intent.succeeded: ${pi.id}`);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paid = session.payment_status === "paid";

        // Preferred path: a specific placement-payment charge (upfront or monthly).
        const placementPaymentId = session.metadata?.placement_payment_id ? Number(session.metadata.placement_payment_id) : null;
        if (placementPaymentId && paid) {
          const now = new Date();
          const [pay] = await db.update(homestayPlacementPaymentsTable)
            .set({
              status: "paid", paid_at: now,
              stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
            })
            .where(and(eq(homestayPlacementPaymentsTable.id, placementPaymentId), eq(homestayPlacementPaymentsTable.status, "pending")))
            .returning();
          if (pay && pay.kind === "upfront") {
            const [pl] = await db.update(homestayPlacementsTable)
              .set({ status: "Active", confirmed_at: now, stripe_customer_id: typeof session.customer === "string" ? session.customer : undefined, updated_at: now })
              .where(and(eq(homestayPlacementsTable.id, pay.placement_id), eq(homestayPlacementsTable.status, "AwaitingPayment")))
              .returning();
            if (pl) {
              await db.update(homestayStudentRequestsTable).set({ status: "Placed", updated_at: now }).where(eq(homestayStudentRequestsTable.id, pl.student_request_id));
              // Anchor monthly billing (first cycle on move-in, or today if past/unset).
              if (!pl.next_billing_date && Number(pl.monthly_fee) > 0) {
                const anchor = pl.move_in_date || now.toISOString().slice(0, 10);
                await db.update(homestayPlacementsTable).set({ next_billing_date: anchor }).where(eq(homestayPlacementsTable.id, pl.id));
              }
              // Accrue the agent commission on activation (best-effort, idempotent).
              try { await createCommissionForPlacement(pl.id); } catch (e) { console.error("[Stripe] commission accrual failed:", e); }
              // Set up unified monthly-rent billing on the booking (best-effort, idempotent).
              try { await createRentScheduleForPlacement(pl.id); } catch (e) { console.error("[Stripe] rent schedule failed:", e); }
              // Notify the student + guardian of activation (best-effort).
              try {
                const [stu] = await db.select().from(homestayStudentRequestsTable)
                  .where(eq(homestayStudentRequestsTable.id, pl.student_request_id)).limit(1);
                if (stu) {
                  void notifyPlacementActivated({
                    studentEmail: stu.student_email,
                    guardianEmail: stu.guardian_email,
                    studentName: formatPersonName(stu.student_first_name, stu.student_last_name),
                    placementRef: pl.placement_ref,
                    moveInDate: pl.move_in_date,
                  }).catch((e) => console.error("[Stripe] activation notify failed:", e));
                }
              } catch (e) { console.error("[Stripe] activation notify load failed:", e); }
            }
          }
          // Book the payment to the GL (best-effort, idempotent). The deposit
          // portion of an upfront payment lands in Deposits Held (2100); the rest
          // is revenue. The placement-payment path otherwise never touched the GL.
          if (pay) {
            let deposit = 0;
            if (pay.kind === "upfront") {
              const [plForDep] = await db.select({ deposit: homestayPlacementsTable.deposit }).from(homestayPlacementsTable).where(eq(homestayPlacementsTable.id, pay.placement_id)).limit(1);
              deposit = Number(plForDep?.deposit ?? 0);
            }
            void postPlacementPaymentPaid({ paymentId: pay.id, kind: pay.kind, amount: Number(pay.amount), deposit, currency: pay.currency, paidAt: now.toISOString() });
          }
          await logAction({ entityType: "homestay_placement", entityId: pay?.placement_id ?? 0, action: "PAYMENT", newValue: { placement_payment_id: placementPaymentId, kind: pay?.kind, stripe_session: session.id } }).catch(() => {});
          console.log(`[Stripe] checkout.session.completed → placement_payment ${placementPaymentId} paid`);
          break;
        }

        // Invoice path: a session tagged with invoice_id (regular ops). Guarded
        // so a placement session (which also carries placement_id) never falls here.
        const invoiceId = session.metadata?.invoice_id ? Number(session.metadata.invoice_id) : null;
        if (invoiceId && !placementPaymentId && paid) {
          const now = new Date();
          const [inv] = await db.update(invoicesTable)
            .set({ status: "Paid", payment_method: "Card", paid_at: now, updated_at: now })
            .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.status, "Sent")))
            .returning();
          if (inv) {
            await logAction({
              entityType: "invoice", entityId: invoiceId, action: "PAYMENT",
              newValue: { status: "Paid", stripe_session: session.id, amount_total: session.amount_total },
            }).catch(() => {});
            // Auto-post the GL entry (best-effort; never blocks the webhook).
            void postInvoicePaid({ id: inv.id, amount: Number(inv.amount), currency: inv.currency, paidAt: now.toISOString() });
          }
          console.log(`[Stripe] checkout.session.completed → invoice ${invoiceId} paid`);
          break;
        }

        // Back-compat path: a session tagged only with placement_id (Phase E upfront).
        const placementId = session.metadata?.placement_id ? Number(session.metadata.placement_id) : null;
        if (placementId && paid) {
          const now = new Date();
          const [pl] = await db.update(homestayPlacementsTable)
            .set({
              status: "Active",
              confirmed_at: now,
              stripe_customer_id: typeof session.customer === "string" ? session.customer : undefined,
              updated_at: now,
            })
            .where(and(eq(homestayPlacementsTable.id, placementId), eq(homestayPlacementsTable.status, "AwaitingPayment")))
            .returning();
          if (pl) {
            await db.update(homestayStudentRequestsTable)
              .set({ status: "Placed", updated_at: now })
              .where(eq(homestayStudentRequestsTable.id, pl.student_request_id));
            await logAction({
              entityType: "homestay_placement", entityId: placementId, action: "PAYMENT",
              newValue: { status: "Active", stripe_session: session.id, amount_total: session.amount_total },
            });
          }
          console.log(`[Stripe] checkout.session.completed → placement ${placementId} Active`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoice_id ? Number(pi.metadata.invoice_id) : null;
        if (invoiceId) {
          await logAction({
            entityType: "invoice",
            entityId: invoiceId,
            action: "STATUS_CHANGE",
            newValue: { stripe_status: "payment_failed", stripe_payment_intent: pi.id },
          });
        }
        console.log(`[Stripe] payment_intent.payment_failed: ${pi.id}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const invoiceId = charge.metadata?.invoice_id ? Number(charge.metadata.invoice_id) : null;
        if (invoiceId) {
          await logAction({
            entityType: "invoice",
            entityId: invoiceId,
            action: "STATUS_CHANGE",
            newValue: { stripe_status: "refunded", charge_id: charge.id, amount_refunded: charge.amount_refunded },
          });
        }
        console.log(`[Stripe] charge.refunded: ${charge.id}`);
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe] Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
    return;
  }

  res.json({ received: true, type: event.type });
});

export default router;
