DROP INDEX IF EXISTS creative_bridge_deliveries_status_idx;
DROP INDEX IF EXISTS scheduled_publications_idempotency_key_unique;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS idempotency_key, DROP COLUMN IF EXISTS cta, DROP COLUMN IF EXISTS hashtags, DROP COLUMN IF EXISTS content_structure;
ALTER TABLE creative_bridge_deliveries DROP COLUMN IF EXISTS returned_asset_id, DROP COLUMN IF EXISTS return_payload, DROP COLUMN IF EXISTS failure_code, DROP COLUMN IF EXISTS returned_at, DROP COLUMN IF EXISTS opened_at, DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS nonce_hash;
