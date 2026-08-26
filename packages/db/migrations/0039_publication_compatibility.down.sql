BEGIN;

DROP VIEW IF EXISTS scheduled_publications_compat;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS promoted_creative_id;
ALTER TABLE content_suggestions DROP COLUMN IF EXISTS promoted_creative_id;
DROP INDEX IF EXISTS unified_creatives_source_suggestion_idx;
DROP INDEX IF EXISTS unified_creatives_campaign_scheduled_idx;
ALTER TABLE unified_creatives
  DROP COLUMN IF EXISTS source_suggestion_id,
  DROP COLUMN IF EXISTS error,
  DROP COLUMN IF EXISTS locked_at,
  DROP COLUMN IF EXISTS campaign_id,
  DROP COLUMN IF EXISTS external_id;

COMMIT;
