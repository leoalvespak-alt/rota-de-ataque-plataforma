BEGIN;
DROP INDEX IF EXISTS mv_content_performance_by_thesis_lookup_idx;
DROP MATERIALIZED VIEW IF EXISTS mv_content_performance_by_thesis;
DROP INDEX IF EXISTS content_performance_channel_computed_idx;
DROP TABLE IF EXISTS content_performance;
ALTER TABLE repetition_alerts DROP COLUMN IF EXISTS channel_b, DROP COLUMN IF EXISTS channel_a;
DROP INDEX IF EXISTS generated_texts_item_channel_idx;
ALTER TABLE generated_texts DROP COLUMN IF EXISTS variant_id, DROP COLUMN IF EXISTS content_item_id, DROP COLUMN IF EXISTS channel;
COMMIT;
