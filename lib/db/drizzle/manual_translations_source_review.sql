-- Translations: track AI-translate → manual-review provenance.
--
-- Non-destructive. `source` defaults to 'human' so every existing row is treated
-- as human-authored (no review badge). The AI translation endpoint writes
-- 'machine'; when a person saves a value the API sets source='human' and stamps
-- reviewed_at. The admin page-translation editor uses these to show an
-- "AI · unreviewed" badge.

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'human';

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
