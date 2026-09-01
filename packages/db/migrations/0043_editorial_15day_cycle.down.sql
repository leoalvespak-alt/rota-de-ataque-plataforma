BEGIN;
DROP INDEX IF EXISTS editorial_batches_campaign_start_idx;
DROP INDEX IF EXISTS content_items_batch_idx;
ALTER TABLE content_items DROP COLUMN IF EXISTS batch_id;
DROP TABLE IF EXISTS editorial_batches;
COMMIT;
