import { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, contractPayoutTermsTable } from "@workspace/db";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { logAction } from "../utils/auditLog";

// 지급 조건 (contract payout terms) — the rules deciding who gets paid out of a
// contract's receipts. See docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §2.
const router: IRouter = Router();
const ENTITY = "contract_payout_term";

const PartyType = z.enum(["landlord", "service_host", "agent"]);
const Basis = z.enum(["percent_of_rent", "fixed_monthly", "fixed_once"]);
const Trigger = z.enum(["on_ar_paid", "manual"]);
const Cadence = z.enum(["monthly", "once", "per_job"]);

const TermBody = z
  .object({
    party_type: PartyType,
    payee_account_id: z.number().int().positive().nullish(),
    payee_name: z.string().trim().default(""),
    basis: Basis,
    rate: z.number().min(0).max(100).nullish(),
    amount: z.number().min(0).nullish(),
    currency: z.string().default(DEFAULT_CURRENCY),
    trigger: Trigger.default("on_ar_paid"),
    cadence: Cadence.default("monthly"),
    effective_from: z.string().nullish(),
    effective_to: z.string().nullish(),
    status: z.string().default("Active"),
    notes: z.string().nullish(),
  })
  // A payout row nobody can identify is unauditable — one of the two must be set.
  .refine((v) => !!v.payee_account_id || v.payee_name.length > 0, {
    message: "payee_account_id or payee_name is required",
    path: ["payee_name"],
  })
  // The figure the basis depends on has to actually be there, or the term
  // silently computes nothing at receipt time.
  .refine((v) => (v.basis === "percent_of_rent" ? (v.rate ?? 0) > 0 : (v.amount ?? 0) > 0), {
    message: "percent_of_rent requires rate; fixed_* requires amount",
    path: ["basis"],
  });

/** Terms attached to one contract. */
router.get("/v1/contracts/:contractId/payout-terms", async (req, res): Promise<void> => {
  try {
    const contractId = Number(req.params.contractId);
    if (!Number.isFinite(contractId)) { res.status(400).json({ error: "Invalid contract id" }); return; }
    const rows = await db
      .select()
      .from(contractPayoutTermsTable)
      .where(and(eq(contractPayoutTermsTable.contract_id, contractId), isNull(contractPayoutTermsTable.deleted_at)))
      .orderBy(asc(contractPayoutTermsTable.party_type), asc(contractPayoutTermsTable.id));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list payout terms" });
  }
});

router.post("/v1/contracts/:contractId/payout-terms", async (req, res): Promise<void> => {
  const contractId = Number(req.params.contractId);
  if (!Number.isFinite(contractId)) { res.status(400).json({ error: "Invalid contract id" }); return; }
  const parsed = TermBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  try {
    const [row] = await db
      .insert(contractPayoutTermsTable)
      .values({
        contract_id: contractId,
        party_type: b.party_type,
        payee_account_id: b.payee_account_id ?? null,
        payee_name: b.payee_name,
        basis: b.basis,
        rate: b.rate != null ? String(b.rate) : null,
        amount: b.amount != null ? String(b.amount) : null,
        currency: b.currency,
        trigger: b.trigger,
        cadence: b.cadence,
        effective_from: b.effective_from ?? null,
        effective_to: b.effective_to ?? null,
        status: b.status,
        notes: b.notes ?? null,
      })
      .returning();
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", newValue: { contract_id: contractId, party_type: b.party_type, basis: b.basis } });
    res.status(201).json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to create payout term" });
  }
});

router.put("/v1/payout-terms/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = TermBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  try {
    const [row] = await db
      .update(contractPayoutTermsTable)
      .set({
        party_type: b.party_type,
        payee_account_id: b.payee_account_id ?? null,
        payee_name: b.payee_name,
        basis: b.basis,
        rate: b.rate != null ? String(b.rate) : null,
        amount: b.amount != null ? String(b.amount) : null,
        currency: b.currency,
        trigger: b.trigger,
        cadence: b.cadence,
        effective_from: b.effective_from ?? null,
        effective_to: b.effective_to ?? null,
        status: b.status,
        notes: b.notes ?? null,
        updated_at: new Date(),
      })
      .where(and(eq(contractPayoutTermsTable.id, id), isNull(contractPayoutTermsTable.deleted_at)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { basis: b.basis, rate: b.rate, amount: b.amount } });
    res.json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to update payout term" });
  }
});

router.delete("/v1/payout-terms/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    // Soft delete only. Settlements already generated keep their term_id so the
    // "why this amount" trail survives the rule being retired.
    const [row] = await db
      .update(contractPayoutTermsTable)
      .set({ deleted_at: new Date(), status: "Inactive", updated_at: new Date() })
      .where(and(eq(contractPayoutTermsTable.id, id), isNull(contractPayoutTermsTable.deleted_at)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    void logAction({ entityType: ENTITY, entityId: id, action: "DELETE" });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete payout term" });
  }
});

export default router;
