DROP INDEX IF EXISTS competitor_insights_action_status_idx;
DROP INDEX IF EXISTS radar_findings_action_status_idx;
DROP INDEX IF EXISTS content_suggestions_organic_source_unique;

ALTER TABLE competitor_insights DROP CONSTRAINT IF EXISTS competitor_insights_action_status_check;
ALTER TABLE competitor_insights DROP COLUMN IF EXISTS action_status;

ALTER TABLE radar_findings DROP CONSTRAINT IF EXISTS radar_findings_action_status_check;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS promoted_publication_id;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS action_status;
