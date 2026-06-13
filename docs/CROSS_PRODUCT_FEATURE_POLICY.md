# Cross-Product Feature Policy

> **Policy (set 2026-06-13):** Every feature built from now on is applied across
> **all three products — Homestay, Short-term, Long-term — without distinction**,
> wherever it is *applicable*. Build shared/generic by default; do not silently
> scope a capability to one product. **When applicability is unclear, confirm by
> text message before deciding.**

## What this means in practice

1. **Default to shared.** New backend logic goes in a generic module keyed by a
   discriminator (`context_type`, `kind`, `entity_type`, a product enum, …) and
   is wired into every product where it makes sense — not duplicated per product.
2. **Applicability is the only filter.** Apply a feature to a product only when it
   genuinely fits that product's workflow. If it fits all three, wire all three.
3. **Confirm when unsure.** If it is not obvious whether a feature applies to a
   given product (or how it should behave there), **ask the user by text first**;
   do not guess and silently narrow or widen scope.
4. **Don't regress the others.** Shared code is touched by every product —
   additive changes only to shared dispatch (if-chains, webhooks, crons); keep
   existing product branches byte-identical. Verify `pnpm typecheck` stays green.

## Why

The Homestay build produced infrastructure (e-signature, editable document
templates, Stripe Checkout collection, recurring billing) that was generic by
design but initially wired only to Homestay. We then generalized it to
short/long-term operations. To avoid that lag in future, shared-by-default is now
the standing rule.

## Reference — shared modules already cross-wired (extend these, don't fork)

| Capability | Shared module | Discriminator |
| --- | --- | --- |
| E-signature (sign PDF + email + audit) | `artifacts/api-server/src/services/contractSigning.ts`, `services/applicationDocs.ts`, `routes/contract-signing.ts` | `contract_signing_requests.context_type` (`host_app` \| `student_app` \| `placement_contract` \| `contract`) — free-text, no migration to add a value |
| Branded PDF/email shell | `lib/documents/theme.ts`, `lib/email.ts` (`sendDocumentEmail`, `resolveDocEmailCopy`) | n/a (generic) |
| Editable templates (Studio) | `lib/documents/templateEngine.ts` (`resolveTemplate` → fallback), `routes/document-templates.ts`, `scripts/seed-document-templates.mjs` | `document_templates.(kind, key)` |
| Stripe Checkout + webhook | `routes/stripe.ts` (`getStripe`, `checkout.session.completed` switch) | `metadata.{invoice_id \| placement_payment_id \| placement_id}` (guard new branches) |
| Recurring billing crons | `lib/homestay/monthlyBilling.ts` (placements), `lib/billing/recurringInvoices.ts` (contracts) | `billing_mode='incremental'`; cron gated by `RECURRING_INVOICES_ENABLED` |
| Signing UI / payment result | `million-stay-web/src/pages/sign.tsx`, `pages/payment-result.tsx`; `property-admin/src/components/HomestaySignatureCard.tsx` | conditional on `context_type` / product |

When adding a feature, check this table first: if a shared module exists, extend
its discriminator rather than building a parallel implementation.

## Checklist for any new feature

- [ ] Built in a shared module with a discriminator (not product-forked)?
- [ ] Wired into every product it applies to (Homestay + Short-term + Long-term)?
- [ ] Any product where applicability is unclear → **confirmed by text** before deciding?
- [ ] Shared dispatch changes are additive; existing branches unchanged?
- [ ] `pnpm typecheck` green across the workspace?
