-- 0004_signing_content_snapshot
-- H-201: e-signature integrity. The signed document was never frozen — /preview
-- and /pdf re-rendered live from the underlying record, so later edits silently
-- changed what a "signed" document showed, with no way to detect tampering.
-- Capture the exact rendered document at sign time (signed_snapshot.html) plus its
-- sha256 (content_hash); downstream views serve the snapshot verbatim.
--
-- Additive, safe: two nullable columns. Existing signed rows have no snapshot and
-- fall back to live render (unchanged behavior) until re-signed.
--
-- Rollback:
--   ALTER TABLE public.contract_signing_requests DROP COLUMN signed_snapshot;
--   ALTER TABLE public.contract_signing_requests DROP COLUMN content_hash;

ALTER TABLE public.contract_signing_requests ADD COLUMN content_hash text;
ALTER TABLE public.contract_signing_requests ADD COLUMN signed_snapshot jsonb;
