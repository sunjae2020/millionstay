-- Manual migration: monthly-rent billing anchor on placements. Additive.
ALTER TABLE homestay_placements
  ADD COLUMN IF NOT EXISTS next_billing_date text;
