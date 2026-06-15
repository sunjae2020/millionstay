-- Unify homestay / self-board / share onto the booking entity (Phase 0).
-- A booking now carries its own product-classification snapshot so that
-- homestay ⇄ self-board ⇄ share conversions are attribute changes on one row,
-- plus links to the host family and the internal staff owner.
-- See docs/proposals/HOMESTAY_WORKFLOW.md and the unification plan.
-- Idempotent / additive — safe to re-run. Reuses the existing accommodation
-- enums (contract_term, room_type, meal_plan) created with accommodation_catalog.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "room_type" "room_type";
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "meal_plan" "meal_plan";
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "contract_term" "contract_term";

-- Host family this booking is placed with (homestay only; NULL for share).
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "host_application_id" integer;

-- Internal ops owner of this booking (담당직원). → users.id
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "assigned_staff_user_id" integer;

-- Look up a booking by the host family it is placed with.
CREATE INDEX IF NOT EXISTS "idx_bookings_host_application"
  ON "bookings" ("host_application_id");
