-- Phase 1 of the homestay/share unification: link a placement to its booking,
-- and let a student request carry its ops owner (담당직원).
-- Idempotent / additive — safe to re-run.

-- The booking auto-created when ops brokers a match. The placement stays the
-- CRM match record; the booking is the operational/financial spine.
ALTER TABLE "homestay_placements" ADD COLUMN IF NOT EXISTS "booking_id" integer;
CREATE INDEX IF NOT EXISTS "idx_homestay_placements_booking"
  ON "homestay_placements" ("booking_id");

-- Ops owner of the request; copied onto the booking on placement.
ALTER TABLE "homestay_student_requests" ADD COLUMN IF NOT EXISTS "assigned_staff_user_id" integer;
