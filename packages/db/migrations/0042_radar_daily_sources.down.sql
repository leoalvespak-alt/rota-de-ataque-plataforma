BEGIN;
DROP INDEX IF EXISTS radar_findings_fingerprint_unique;
ALTER TABLE radar_findings DROP CONSTRAINT IF EXISTS radar_findings_scores_check;
ALTER TABLE radar_findings DROP CONSTRAINT IF EXISTS radar_findings_review_status_check;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS classified_by;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS classification_reason;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS fingerprint;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS auto_content_allowed;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS review_status;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS factuality_score;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS confidence;
ALTER TABLE radar_findings DROP COLUMN IF EXISTS categoria;
ALTER TABLE radar_findings DROP CONSTRAINT IF EXISTS radar_findings_concurso_alvo_check;
ALTER TABLE radar_findings ADD CONSTRAINT radar_findings_concurso_alvo_check
  CHECK (concurso_alvo IN ('PM','PP','PC','PF','PRF','GCM','outro'));
ALTER TABLE news_sources DROP CONSTRAINT IF EXISTS news_sources_source_type_check;
ALTER TABLE news_sources ADD CONSTRAINT news_sources_source_type_check
  CHECK (source_type IN ('rss','scrape','api'));
COMMIT;
