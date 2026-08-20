DROP TABLE IF EXISTS content_suggestions;
DROP TABLE IF EXISTS competitor_insights;
DROP TABLE IF EXISTS radar_findings;
DROP TABLE IF EXISTS worker_settings;

DROP TRIGGER IF EXISTS candidate_sources_manual_guard_delete ON candidate_sources;
DROP TRIGGER IF EXISTS candidate_sources_manual_guard ON candidate_sources;
DROP TRIGGER IF EXISTS scheduled_publications_manual_guard_delete ON scheduled_publications;
DROP TRIGGER IF EXISTS scheduled_publications_manual_guard ON scheduled_publications;
DROP TRIGGER IF EXISTS content_variants_manual_guard_delete ON content_variants;
DROP TRIGGER IF EXISTS content_variants_manual_guard ON content_variants;
DROP TRIGGER IF EXISTS content_items_manual_guard_delete ON content_items;
DROP TRIGGER IF EXISTS content_items_manual_guard ON content_items;

DROP FUNCTION IF EXISTS enforce_manual_immutability_delete();
DROP FUNCTION IF EXISTS enforce_manual_immutability();

ALTER TABLE candidate_sources DROP COLUMN IF EXISTS locked_by;
ALTER TABLE candidate_sources DROP COLUMN IF EXISTS locked_at;
ALTER TABLE candidate_sources DROP COLUMN IF EXISTS origin;

ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS superseded_by;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS curation_status;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS locked_by;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS locked_at;
ALTER TABLE scheduled_publications DROP COLUMN IF EXISTS origin;

ALTER TABLE content_variants DROP COLUMN IF EXISTS superseded_by;
ALTER TABLE content_variants DROP COLUMN IF EXISTS curation_status;
ALTER TABLE content_variants DROP COLUMN IF EXISTS locked_by;
ALTER TABLE content_variants DROP COLUMN IF EXISTS locked_at;
ALTER TABLE content_variants DROP COLUMN IF EXISTS origin;

ALTER TABLE content_items DROP COLUMN IF EXISTS superseded_by;
ALTER TABLE content_items DROP COLUMN IF EXISTS curation_status;
ALTER TABLE content_items DROP COLUMN IF EXISTS locked_by;
ALTER TABLE content_items DROP COLUMN IF EXISTS locked_at;
ALTER TABLE content_items DROP COLUMN IF EXISTS origin;
