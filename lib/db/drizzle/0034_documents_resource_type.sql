-- Documents: record which Cloudinary resource_type the asset was stored under.
--
-- Uploads went through Cloudinary's image pipeline, which rejects anything it
-- cannot decode as an image or PDF — an Office file or archive came back as
-- "Unsupported ZIP file" and the upload failed. Company paperwork arrives in
-- every format, so uploads now use resource_type "auto" and we persist what it
-- resolved to; signed URLs and deletes must address the asset with the same
-- resource_type or Cloudinary 404s.
--
-- Additive and defaulted: existing rows were all uploaded as images, which is
-- exactly the default, so no backfill is required.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS resource_type varchar(16) NOT NULL DEFAULT 'image';
