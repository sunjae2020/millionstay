-- Manual migration: homestay placement payment methods/surcharge + editable
-- document templates (Edubee port, single-tenant). Additive + idempotent.
-- Apply to prod Supabase like manual_homestay_workflow.sql.

-- 1) homestay_placement_payments — payment method + surcharge breakdown
ALTER TABLE homestay_placement_payments
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS base_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_info_id integer;

-- 2) document_templates — editable email/contract copy
CREATE TABLE IF NOT EXISTS document_templates (
  id serial PRIMARY KEY,
  kind text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  variables_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_document_templates_kind_key UNIQUE (kind, key)
);

-- 3) document_template_translations — per-locale content
CREATE TABLE IF NOT EXISTS document_template_translations (
  id serial PRIMARY KEY,
  template_id integer NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  locale text NOT NULL,
  subject text,
  body_html text,
  body_json jsonb,
  body_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_doc_template_translations_tpl_locale UNIQUE (template_id, locale)
);
