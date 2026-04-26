# Payment Workflow

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.


## 1. Payment schedule generation

**Trigger:** `POST /api/v1/contracts/:id/activate` → calls `generateContractInvoicesAndSchedules(contractId)` in `routes/contracts.ts:55`.

**Pre-condition:** contract status must be `Signed`.

**Flow:**

```ts
// pseudo-code derived from contracts.ts
export async function generateContractInvoicesAndSchedules(contractId: number) {
  const contract = await getById(contractId);
  if (!contract) throw new Error("Contract not found");

  // 1) Wipe any unpaid pre-existing invoices/schedules so re-activation is idempotent
  await db.delete(invoicesTable)
    .where(and(eq(invoicesTable.contract_id, contractId), ne(invoicesTable.status, "Paid")));
  await db.delete(recurringScheduleTable).where(eq(recurringScheduleTable.contract_id, contractId));

  // 2) Generate per-period invoices
  let current = parseDate(contract.start_date);
  const end   = parseDate(contract.end_date);
  while (current < end) {
    const nextDate = (() => {
      switch (contract.billing_frequency) {
        case "Weekly":   return addDays(current, 7);
        case "Biweekly": return addDays(current, 14);
        case "Monthly":  return addMonths(current, 1);
      }
    })();
    const periodEnd = nextDate > end ? end : nextDate;
    const periodDays = differenceInDays(periodEnd, current);
    const amount = roundMoney(contract.weekly_rate * (periodDays / 7));
    await db.insert(invoicesTable).values({
      invoice_ref:   nextRef("INV"),
      contract_id:   contractId,
      booking_id:    contract.booking_id,
      account_id:    contract.tenant_account_id,
      amount,
      currency:      contract.currency,
      status:        "Sent",
      due_date:      formatISO(current),
      description:   `Rent ${formatISO(current)} – ${formatISO(periodEnd)}`,
    });
    current = nextDate;
  }

  // 3) Recurring schedule rows for tracking next due dates
  await db.insert(recurringScheduleTable).values({...});

  // 4) Move linked booking to Active
  await db.update(bookingsTable)
    .set({ booking_status: "Active" })
    .where(eq(bookingsTable.id, contract.booking_id));
}
```

| Frequency | Step |
|---|---|
| `Weekly` | `addDays(current, 7)` |
| `Biweekly` | `addDays(current, 14)` |
| `Monthly` | `addMonths(current, 1)` |

**Last partial period:** capped at `end_date`; pro-rated by `days/7 × weekly_rate`.

**Short-term vs long-term:** there is no separate code path. The `billing_frequency` field on the contract controls the cadence — typically `Biweekly` for short-term, `Monthly` for long-term, but operators are free to choose any. The generator does not force a special "two-week" rule.

## 2. Invoice lifecycle

```
Draft ─── send ──► Sent ─── pay ──► Paid
                     │
                     ├── (due_date < now) ──► Overdue   (no automated job today)
                     └── void ──► Void
```

| Action | Endpoint | Status guard | Side effects |
|---|---|---|---|
| Create | `POST /v1/invoices` | n/a | none |
| Send | `POST /v1/invoices/:id/send` | `Draft` | sets `status=Sent`; could trigger email (currently does not) |
| Pay | `POST /v1/invoices/:id/pay` or Stripe webhook | `Sent` | sets `paid_at`, `status=Paid`, `payment_method` |
| Void | `POST /v1/invoices/:id/void` | not `Paid` | sets `status=Void` |

**Stripe path:** guest pays via `POST /v1/guest/invoices/:id/pay` which creates a Stripe Checkout session, returning `stripe_checkout_url`. On Stripe webhook delivery, the invoice is flipped to `Paid` and `stripe_payment_intent_id` is stored.

## 3. Overdue handling ❌

There is **no** scheduled job that flips `Sent` invoices to `Overdue` when their `due_date` passes. Overdue is currently a manual / queryable state only.

**Recommended job (Postgres-side):**

```sql
UPDATE invoices
   SET status = 'Overdue', updated_at = now()
 WHERE status = 'Sent'
   AND due_date < CURRENT_DATE
   AND deleted_at IS NULL;
```

Run nightly + insert a system_log entry per affected invoice + send a reminder email via `lib/email.ts`.

## 4. Bond refund flow ⚠️

**Status: not modeled.**

- Bond is stored on `contracts.bond_amount`.
- There is no `bond_refunds` or `bond_disputes` table.
- There is no API endpoint to record a refund.
- **Workaround in production:** an admin would issue a manual negative-amount invoice or a side note in the contract — neither is auditable.

**Recommendation:** add `bond_refunds (id, contract_id, requested_at, amount_refunded, amount_withheld, withheld_reason, status, processed_at, work_order_ids[])`.

## 5. Receipt generation ⚠️

There is **no `receipts` table**. A "receipt" today is the paid invoice itself (the `Paid` status with `paid_at` timestamp serves as the receipt record). When the operations team needs a printable receipt, they re-render the invoice page.

This is acceptable for ATO purposes (ATO accepts paid invoices as evidence) but means there is **no separate receipt number** — the original `invoice_ref` doubles as the receipt reference.

## 6. Payment methods supported

| Method | Status |
|---|---|
| Stripe Checkout (card) | ✅ |
| Bank transfer (manual marking) | ✅ via `POST /v1/invoices/:id/pay` with `payment_method: "BankTransfer"` |
| Cash | ✅ (manual marking) |
| BPAY | ❌ not implemented |
| Direct debit | ❌ not implemented |

## 7. Audit log on financial events

`logAction()` is called for: invoice send, pay, void, schedule add/update/delete. Bond refund (when added) must follow the same pattern.
