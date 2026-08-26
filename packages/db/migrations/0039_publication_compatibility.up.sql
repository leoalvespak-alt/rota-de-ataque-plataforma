BEGIN;

-- 0039 keeps unified_creatives as the single write source while exposing the
-- legacy publication shape to Prospector readers and recording provenance.
ALTER TABLE unified_creatives
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS source_suggestion_id uuid,
  ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE content_suggestions
  ADD COLUMN IF NOT EXISTS promoted_creative_id uuid;

ALTER TABLE radar_findings
  ADD COLUMN IF NOT EXISTS promoted_creative_id uuid;

CREATE INDEX IF NOT EXISTS unified_creatives_campaign_scheduled_idx
  ON unified_creatives(campaign_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS unified_creatives_source_suggestion_idx
  ON unified_creatives(source_suggestion_id)
  WHERE source_suggestion_id IS NOT NULL;

DROP VIEW IF EXISTS scheduled_publications_compat;

CREATE VIEW scheduled_publications_compat AS
SELECT
  id,
  title,
  caption,
  channel,
  format,
  format AS subtype,
  status,
  curation_status,
  scheduled_for,
  published_at,
  batch_id,
  thesis_id,
  approved_by,
  origin,
  copy_data,
  COALESCE(copy_data->'hashtags', '[]'::jsonb) AS hashtags,
  COALESCE(copy_data->>'pillar', NULL) AS pillar,
  cta,
  copy_data AS content_structure,
  campaign_id,
  locked_at,
  error,
  COALESCE(external_id, id::text) AS external_id,
  created_at,
  updated_at
FROM unified_creatives;

COMMENT ON VIEW scheduled_publications_compat IS
  'Read compatibility projection for Prospector. Writes belong to unified_creatives.';

COMMIT;
