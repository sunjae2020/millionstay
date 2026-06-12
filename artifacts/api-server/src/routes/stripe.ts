import { Router } from "express";
import Stripe from "stripe";
import { db, invoicesTable, homestayPlacementsTable, homestayStudentRequestsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logAction } from "../utils/auditLog";

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
          await db.update(invoicesTable)
            .set({ status: "Paid", paid_at: new Date(), updated_at: new Date() })
            .where(eq(invoicesTable.id, invoiceId));
          await logAction({
            entityType: "invoice",
            entityId: invoiceId,
            action: "PAYMENT",
            newValue: { status: "Paid", stripe_payment_intent: pi.id, amount: pi.amount },
          });
        }
        console.log(`[Stripe] payment_intent.succeeded: ${pi.id}`);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const placementId = session.metadata?.placement_id ? Number(session.metadata.placement_id) : null;
        if (placementId && session.payment_status === "paid") {
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
