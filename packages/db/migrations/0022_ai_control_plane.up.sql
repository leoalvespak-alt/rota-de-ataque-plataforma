-- The browser manages references to server environment variables, never secrets.
ALTER TABLE ai_providers
  ADD COLUMN IF NOT EXISTS managed_origin text NOT NULL DEFAULT 'manual' CHECK (managed_origin IN ('manual','environment')),
  ADD COLUMN IF NOT EXISTS secret_env_name text,
  ADD COLUMN IF NOT EXISTS secret_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','missing_secret','tombstoned','error')),
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_reason text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Backfill a deterministic, dense ordering before enforcing uniqueness. The
-- previous schema had no priority column, so all legacy rows initially share
-- the default value.
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY provider_id ORDER BY is_default DESC, created_at, id)::int * 10 AS priority
  FROM ai_models
)
UPDATE ai_models model SET priority = ordered.priority FROM ordered WHERE ordered.id = model.id;

CREATE INDEX IF NOT EXISTS ai_providers_active_idx ON ai_providers (enabled, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_models_runtime_order_idx ON ai_models (is_default DESC, priority ASC) WHERE enabled;
CREATE UNIQUE INDEX IF NOT EXISTS ai_models_provider_priority_unique ON ai_models (provider_id, priority) WHERE enabled;

UPDATE ai_providers SET enabled = false, sync_status = 'missing_secret'
WHERE api_key_encrypted IS NOT NULL AND secret_env_name IS NULL;
