// Agent commission accrual for homestay placements.
//
// When a placement is activated (upfront payment received — both the bank
// mark-paid path and the Stripe webhook), the attributed agent earns a
// one-time commission based on their active commission plan. One ledger row per
// placement (Pending → Approved → Paid). Idempotent: re-running never duplicates.
//
//   base       = upfront payment = placement_fee + deposit
//   fixed      = plan.fixed_referral_fee
//   percentage = base × plan.percentage_rate%
//   amount     = stack ? fixed + percentage : (fixed > 0 ? fixed : percentage)
//
// Money/rate columns are numeric → strings; wrap reads in Number(), writes in String().
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  homestayPlacementsTable,
  homestayCommissionPlansTable,
  agentCommissionLedgerTable,
} from "@workspace/db";
import { postCommissionAccrued, postCommissionPaid } from "../billing/gl.js";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Accrue the agent commission for a placement (idempotent). Returns the ledger
 * row id, or null when there's no attributed agent or no active plan. Throws
 * only on unexpected DB errors (callers wrap best-effort).
 */
export async function createCommissionForPlacement(placementId: number): Promise<number | null> {
  // Idempotent: one ledger row per placement.
  const [existing] = await db
    .select({ id: agentCommissionLedgerTable.id })
    .from(agentCommissionLedgerTable)
    .where(eq(agentCommissionLedgerTable.placement_id, placementId))
    .limit(1);
  if (existing) return existing.id;

  const [placement] = await db
    .select()
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.id, placementId))
    .limit(1);
  if (!placement || placement.agent_account_id == null) return null;

  // Most recent active plan for this agent.
  const [plan] = await db
    .select()
    .from(homestayCommissionPlansTable)
    .where(
      and(
        eq(homestayCommissionPlansTable.account_id, placement.agent_account_id),
        eq(homestayCommissionPlansTable.status, "Active"),
        isNull(homestayCommissionPlansTable.deleted_at),
      ),
    )
    .orderBy(desc(homestayCommissionPlansTable.id))
    .limit(1);
  if (!plan) return null;

  const base = round2(Number(placement.placement_fee) + Number(placement.deposit));
  const fixed = round2(Number(plan.fixed_referral_fee));
  const percentage = round2((base * Number(plan.percentage_rate)) / 100);

  let fixed_component = 0;
  let percentage_component = 0;
  if (plan.stack) {
    fixed_component = fixed;
    percentage_component = percentage;
  } else if (fixed > 0) {
    fixed_component = fixed;
  } else {
    percentage_component = percentage;
  }
  const amount = round2(fixed_component + percentage_component);

  const [row] = await db
    .insert(agentCommissionLedgerTable)
    .values({
      placement_id: placementId,
      agent_account_id: placement.agent_account_id,
      plan_id: plan.id,
      base_amount: String(base),
      fixed_component: String(fixed_component),
      percentage_component: String(percentage_component),
      amount: String(amount),
      currency: placement.currency || "AUD",
      status: "Pending",
    })
    .returning({ id: agentCommissionLedgerTable.id });

  // Auto-post the GL accrual (best-effort; never blocks the accrual flow).
  void postCommissionAccrued({ id: row!.id, amount: Number(amount), currency: placement.currency || "AUD" });

  return row!.id;
}

/** Advance a commission Pending → Approved (no-op if not Pending). */
export async function approveCommission(id: number): Promise<typeof agentCommissionLedgerTable.$inferSelect | null> {
  const [row] = await db
    .update(agentCommissionLedgerTable)
    .set({ status: "Approved", approved_at: new Date(), updated_at: new Date() })
    .where(and(eq(agentCommissionLedgerTable.id, id), eq(agentCommissionLedgerTable.status, "Pending")))
    .returning();
  return row ?? null;
}

/** Advance a commission Approved → Paid (no-op if not Approved). */
export async function markCommissionPaid(id: number): Promise<typeof agentCommissionLedgerTable.$inferSelect | null> {
  const [row] = await db
    .update(agentCommissionLedgerTable)
    .set({ status: "Paid", paid_at: new Date(), updated_at: new Date() })
    .where(and(eq(agentCommissionLedgerTable.id, id), eq(agentCommissionLedgerTable.status, "Approved")))
    .returning();
  // Auto-post the GL payment (best-effort; never blocks the pay flow).
  if (row) void postCommissionPaid({ id: row.id, amount: Number(row.amount), currency: row.currency });
  return row ?? null;
}
