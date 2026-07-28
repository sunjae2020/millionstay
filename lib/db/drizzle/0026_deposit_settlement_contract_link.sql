-- Additive: let a deposit settlement hang off a CONTRACT as well as a booking.
-- Korean monthly leases (2026 임대리스트 migration) are recorded straight on
-- `contracts` with no booking spine, but their deposits are still settled at
-- move-out — including rent months deducted from the deposit (보증금에서 차감).
-- booking_id becomes nullable; existing booking-based settlements are untouched.
ALTER TABLE "deposit_settlements" ALTER COLUMN "booking_id" DROP NOT NULL;
ALTER TABLE "deposit_settlements" ADD COLUMN IF NOT EXISTS "contract_id" integer;
CREATE INDEX IF NOT EXISTS "idx_deposit_settlements_contract" ON "deposit_settlements" ("contract_id");
