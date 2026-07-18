-- 0001_space_blocked_dates_unique
-- H-301: prevent double-booking. space_blocked_dates had only a PK on id, so the
-- onConflictDoNothing() insert in blockDatesForBooking() never conflicted and two
-- concurrent booking confirms could claim the same space/date. Add a unique
-- constraint on (space_id, date) so the block insert is an atomic first-come claim.
--
-- Safe/additive: verified 0 existing (space_id, date) duplicates and 0 NULLs in
-- prod before applying (harness [0] measurement). No data cleanup required.
--
-- Rollback:
--   ALTER TABLE public.space_blocked_dates DROP CONSTRAINT space_blocked_dates_space_id_date_uq;

ALTER TABLE public.space_blocked_dates
  ADD CONSTRAINT space_blocked_dates_space_id_date_uq UNIQUE (space_id, date);
