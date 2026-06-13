-- CS Tickets: generalize ticket requester to support partner-portal users
-- (agent / owner / service_host) in addition to guests.
--
-- Non-destructive: makes guest_user_id nullable and adds requester_type +
-- partner_user_id. Existing rows backfill to requester_type = 'guest' via the
-- column default, so the guest flow is unaffected.

ALTER TABLE cs_tickets ALTER COLUMN guest_user_id DROP NOT NULL;

ALTER TABLE cs_tickets
  ADD COLUMN IF NOT EXISTS requester_type text NOT NULL DEFAULT 'guest';

ALTER TABLE cs_tickets
  ADD COLUMN IF NOT EXISTS partner_user_id integer;

CREATE INDEX IF NOT EXISTS cs_tickets_partner_user_id_idx
  ON cs_tickets (partner_user_id);
