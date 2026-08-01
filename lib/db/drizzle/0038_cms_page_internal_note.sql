-- 0038 — an internal note on a CMS page.
--
-- The page workspace shows every page of every site in one tree, where a title
-- alone does not say what a page actually contains. This is a staff-only note
-- ("Hero slides, company intro, stats…") and is never rendered publicly.

ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS internal_note text;
