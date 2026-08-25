BEGIN;

DROP INDEX IF EXISTS content_variants_item_created_idx;
ALTER TABLE content_variants
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_at;

COMMIT;

