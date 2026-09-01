BEGIN;

-- F10: the active radar collection surface is exactly three specialist,
-- non-official portals. HTML means ordinary HTTP fetch + parsing, never a
-- browser, headless session, CAPTCHA bypass, or an external scraping service.
ALTER TABLE news_sources DROP CONSTRAINT IF EXISTS news_sources_source_type_check;

UPDATE news_sources
SET active = false,
    source_type = 'html',
    disabled_reason = COALESCE(disabled_reason, 'F10: historical source type retired'),
    updated_at = now()
WHERE source_type NOT IN ('rss', 'atom', 'html', 'api');

ALTER TABLE news_sources ADD CONSTRAINT news_sources_source_type_check
  CHECK (source_type IN ('rss', 'atom', 'html', 'api'));

ALTER TABLE radar_findings DROP CONSTRAINT IF EXISTS radar_findings_concurso_alvo_check;
ALTER TABLE radar_findings ADD CONSTRAINT radar_findings_concurso_alvo_check
  CHECK (concurso_alvo IN ('PM','PP','PC','PF','PRF','GCM','BOMBEIROS','TRANSITO','SOCIOEDUCATIVO','outro'));
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'outro';
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 0;
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS factuality_score numeric NOT NULL DEFAULT 0;
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'review';
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS auto_content_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS classification_reason text;
ALTER TABLE radar_findings ADD COLUMN IF NOT EXISTS classified_by text;
ALTER TABLE radar_findings ADD CONSTRAINT radar_findings_review_status_check
  CHECK (review_status IN ('approved', 'review', 'rejected'));
ALTER TABLE radar_findings ADD CONSTRAINT radar_findings_scores_check
  CHECK (confidence BETWEEN 0 AND 1 AND factuality_score BETWEEN 0 AND 1 AND relevance_score BETWEEN 0 AND 1);
CREATE UNIQUE INDEX IF NOT EXISTS radar_findings_fingerprint_unique
  ON radar_findings(fingerprint) WHERE fingerprint IS NOT NULL;

-- Retire any historical source rows without deleting their collected history.
UPDATE news_sources SET active = false, disabled_reason = 'F10 source registry: outside the three selected portals', updated_at = now()
WHERE portal IS NULL OR portal NOT IN ('pci-concursos', 'ache-concursos', 'folha-qconcursos');

INSERT INTO news_sources (name, url, feed_url, source_type, portal, active)
VALUES
  ('PCI Concursos', 'https://www.pciconcursos.com.br/noticias', NULL, 'html', 'pci-concursos', true),
  ('Ache Concursos', 'https://www.acheconcursos.com.br/noticias', NULL, 'html', 'ache-concursos', true),
  ('Folha Dirigida por Qconcursos', 'https://folha.qconcursos.com/', NULL, 'html', 'folha-qconcursos', true)
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  feed_url = EXCLUDED.feed_url,
  source_type = EXCLUDED.source_type,
  portal = EXCLUDED.portal,
  active = true,
  disabled_reason = NULL,
  updated_at = now();

UPDATE worker_settings
SET cadence = 'daily', enabled = false
WHERE worker_name = 'news-radar';

COMMIT;
