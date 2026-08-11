BEGIN;

DROP INDEX IF EXISTS scheduled_publications_variant_idx;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS variant_id;

COMMIT;
