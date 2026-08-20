ALTER TABLE creative_bridge_deliveries
  ADD COLUMN IF NOT EXISTS nonce_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS return_payload jsonb,
  ADD COLUMN IF NOT EXISTS returned_asset_id uuid REFERENCES content_assets(id) ON DELETE SET NULL;

ALTER TABLE scheduled_publications
  ADD COLUMN IF NOT EXISTS content_structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX scheduled_publications_idempotency_key_unique
  ON scheduled_publications(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX creative_bridge_deliveries_status_idx ON creative_bridge_deliveries(status, created_at DESC);
