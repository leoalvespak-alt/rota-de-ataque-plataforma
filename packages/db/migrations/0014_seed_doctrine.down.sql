DELETE FROM worker_settings;
DELETE FROM news_sources;
DELETE FROM validated_hooks WHERE origin = 'manual' AND locked_at IS NOT NULL;
DELETE FROM audience_vocabulary WHERE origin = 'manual' AND locked_at IS NOT NULL;
DELETE FROM editorial_rules WHERE origin = 'manual' AND locked_at IS NOT NULL;
DELETE FROM format_playbook WHERE origin = 'manual' AND locked_at IS NOT NULL;
DELETE FROM content_pillars WHERE origin = 'manual' AND locked_at IS NOT NULL;
DELETE FROM candidate_sources WHERE origin = 'manual' AND locked_by = 'doctrine-seed';

ALTER TABLE candidate_sources
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS handle,
  DROP COLUMN IF EXISTS platform;
