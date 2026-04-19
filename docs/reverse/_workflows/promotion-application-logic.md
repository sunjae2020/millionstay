# Promotion Application Logic

## 1. How a promotion is linked

| Linker | Column | Purpose |
|---|---|---|
| Product | `contract_products.promotion_id` | The contract product carries one promotion |
| Public listing | `accommodation_catalog.promotion_id` | Public-facing listing can show a promotion banner |

There is **no booking-level promotion linkage** — once a booking snapshots `agreed_weekly_rate`, the promotion that produced that rate is not preserved with the booking. Reporting "how much revenue did promotion X discount?" is therefore not directly possible without joining back to the product at booking time (and the product's promotion may have been changed since).

## 2. When the discount is applied

| Phase | What happens |
|---|---|
| Product save (admin) | `contract_products.effective_weekly_rate` is computed from `weekly_rate` × `(1 - promo.discount_amount/100)` (Percentage) or `weekly_rate − promo.discount_amount` (Fixed) and cached |
| Booking creation | `bookings.agreed_weekly_rate` is taken from the product's `effective_weekly_rate` (or admin-overridden) |
| Contract activation | `contracts.weekly_rate` carries the agreed rate; invoices are computed from this rate |

## 3. Expiry validation ⚠️

**Currently not validated at booking creation.** A promotion with `end_date < now()` will continue to discount new bookings if the product's `effective_weekly_rate` has not been refreshed.

**Rule (recommended):**

```ts
// At booking creation
const effective = await resolvePromotion(product.id);
// resolvePromotion checks promo.is_active && promo.end_date >= today
// If invalid, falls back to product.weekly_rate (no discount)
```

## 4. Stacking ❌

Single FK only — no stacking. The simplest fix if stacking is ever required is a join table `product_promotions(product_id, promotion_id, priority)` plus a deterministic resolver.

## 5. Original price preservation ⚠️

The product carries both `weekly_rate` (pre-discount) and `effective_weekly_rate` (post-discount), so the original is preserved at the product level. **However**, the booking only stores the agreed rate (`bookings.agreed_weekly_rate`) — the original product rate at booking time is **not** snapshotted on the booking.

**Recommendation:** add `bookings.list_weekly_rate` (the original) alongside `agreed_weekly_rate`, and `bookings.applied_promotion_id` so each booking shows which promotion was used. This unlocks accurate revenue-impact reporting on promotions.

## 6. Discount types implemented

| Type | Implemented | Detail |
|---|---|---|
| Percentage | ✅ | `discount_amount` is interpreted as percent (0–100) |
| Fixed AUD | ✅ | `discount_amount` is interpreted as flat AUD off the weekly rate |
| Tiered (e.g., longer stay = larger discount) | ❌ | not modeled |
| Code-based (coupon at checkout) | ❌ | not modeled |
| First-booking-only | ❌ | not modeled |

## 7. Audit

Promotion CRUD currently does **not** write `system_log` entries. Pricing changes are high-impact — this should be added.

## 8. Reporting gaps

- "What's our discount expense this month?" — not answerable without scanning every booking + back-resolving its product's promotion at the time. Solved by snapshotting at booking creation (see §5).
- "Which promotion converts best?" — same issue, no event source.
- "Are any expired promotions still discounting?" — no automated alert.
