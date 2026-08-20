DROP INDEX IF EXISTS scheduled_publications_campaign_scheduled_idx;
DROP INDEX IF EXISTS content_suggestions_campaign_created_idx;
DROP INDEX IF EXISTS competitor_insights_campaign_created_idx;
DROP INDEX IF EXISTS radar_findings_campaign_created_idx;
ALTER TABLE content_suggestions DROP COLUMN IF EXISTS campaign_id;
ALTER TABLE competitor_insights DROP COLUMN IF EXISTS campaign_id;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS campaign_id;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS campaign_id, DROP COLUMN IF EXISTS title;
