ALTER TABLE scheduled_publications DROP CONSTRAINT IF EXISTS scheduled_publications_status_check;
ALTER TABLE scheduled_publications ADD CONSTRAINT scheduled_publications_status_check
  CHECK(status IN ('scheduled','approved','publishing','published','failed'));

ALTER TABLE scheduled_publications
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS recurrence_rule,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS format,
  DROP COLUMN IF EXISTS pillar,
  DROP COLUMN IF EXISTS thesis_id,
  DROP COLUMN IF EXISTS cta,
  DROP COLUMN IF EXISTS media_ref,
  DROP COLUMN IF EXISTS hashtags,
  DROP COLUMN IF EXISTS subtype;

DROP TABLE IF EXISTS news_items;
DROP TABLE IF EXISTS news_sources;
DROP TABLE IF EXISTS validated_hooks;
DROP TABLE IF EXISTS audience_vocabulary;
DROP TABLE IF EXISTS editorial_rules;
DROP TABLE IF EXISTS format_playbook;
DROP TABLE IF EXISTS content_pillars;
