DROP INDEX IF EXISTS ai_models_provider_priority_unique;
DROP INDEX IF EXISTS ai_models_runtime_order_idx;
DROP INDEX IF EXISTS ai_providers_active_idx;
ALTER TABLE ai_models DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS priority;
ALTER TABLE ai_providers DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS deleted_reason, DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS last_reconciled_at, DROP COLUMN IF EXISTS sync_status, DROP COLUMN IF EXISTS secret_configured, DROP COLUMN IF EXISTS secret_env_name, DROP COLUMN IF EXISTS managed_origin;
