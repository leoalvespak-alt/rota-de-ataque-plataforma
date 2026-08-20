-- Etapa 2 — Proveniência e imutabilidade do conteúdo manual
-- Automação nunca edita nem apaga o que foi definido manualmente.

-- 2.1 Colunas de proveniência em tabelas do Prospector

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS curation_status text CHECK(curation_status IN ('raw','proposed','approved','rejected')),
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES content_items(id);

ALTER TABLE content_variants
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS curation_status text CHECK(curation_status IN ('raw','proposed','approved','rejected')),
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES content_variants(id);

ALTER TABLE scheduled_publications
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS curation_status text CHECK(curation_status IN ('raw','proposed','approved','rejected')),
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES scheduled_publications(id);

ALTER TABLE candidate_sources
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

-- 2.2 Trava no banco por trigger

CREATE OR REPLACE FUNCTION enforce_manual_immutability()
RETURNS trigger AS $$
DECLARE
  actor_type text;
BEGIN
  BEGIN
    actor_type := current_setting('app.actor_type', true);
  EXCEPTION WHEN OTHERS THEN
    actor_type := 'human';
  END;

  IF actor_type IS NULL THEN
    actor_type := 'human';
  END IF;

  IF actor_type = 'automation' THEN
    IF OLD.origin = 'manual' OR OLD.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'MANUAL_IMMUTABILITY_VIOLATION: automation cannot modify manual or locked record %', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_manual_immutability_delete()
RETURNS trigger AS $$
DECLARE
  actor_type text;
BEGIN
  BEGIN
    actor_type := current_setting('app.actor_type', true);
  EXCEPTION WHEN OTHERS THEN
    actor_type := 'human';
  END;

  IF actor_type IS NULL THEN
    actor_type := 'human';
  END IF;

  IF actor_type = 'automation' THEN
    IF OLD.origin = 'manual' OR OLD.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'MANUAL_IMMUTABILITY_VIOLATION: automation cannot delete manual or locked record %', OLD.id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers às tabelas com proveniência
CREATE TRIGGER content_items_manual_guard
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability();

CREATE TRIGGER content_items_manual_guard_delete
  BEFORE DELETE ON content_items
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability_delete();

CREATE TRIGGER content_variants_manual_guard
  BEFORE UPDATE ON content_variants
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability();

CREATE TRIGGER content_variants_manual_guard_delete
  BEFORE DELETE ON content_variants
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability_delete();

CREATE TRIGGER scheduled_publications_manual_guard
  BEFORE UPDATE ON scheduled_publications
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability();

CREATE TRIGGER scheduled_publications_manual_guard_delete
  BEFORE DELETE ON scheduled_publications
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability_delete();

CREATE TRIGGER candidate_sources_manual_guard
  BEFORE UPDATE ON candidate_sources
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability();

CREATE TRIGGER candidate_sources_manual_guard_delete
  BEFORE DELETE ON candidate_sources
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability_delete();

-- 2.4 Tabelas de estágio separadas para automação

CREATE TABLE radar_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id uuid,
  title text NOT NULL,
  summary text,
  source_url text,
  source_name text,
  concurso_alvo text CHECK(concurso_alvo IN ('PM','PP','PC','PF','PRF','GCM','outro')),
  estado text,
  banca text,
  fase_ciclo text CHECK(fase_ciclo IN ('autorizacao','comissao','banca_definida','edital_publicado','retificacao','resultado','outro')),
  relevance_score numeric NOT NULL DEFAULT 0,
  thesis_id uuid,
  pillar text,
  processed boolean NOT NULL DEFAULT false,
  promoted_to_calendar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX radar_findings_created_idx ON radar_findings(created_at DESC);
CREATE INDEX radar_findings_unprocessed_idx ON radar_findings(processed) WHERE NOT processed;

CREATE TABLE competitor_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_source_id uuid REFERENCES candidate_sources(id),
  competitor_handle text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  insight_type text NOT NULL CHECK(insight_type IN ('outlier','format_trend','hook_pattern','cta_pattern','posting_time','general')),
  title text NOT NULL,
  description text,
  evidence jsonb NOT NULL DEFAULT '{}',
  metrics jsonb NOT NULL DEFAULT '{}',
  is_outlier boolean NOT NULL DEFAULT false,
  outlier_multiplier numeric,
  hypothesis text,
  thesis_id uuid,
  pillar text,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competitor_insights_created_idx ON competitor_insights(created_at DESC);
CREATE INDEX competitor_insights_unprocessed_idx ON competitor_insights(processed) WHERE NOT processed;

CREATE TABLE content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK(source_type IN ('radar','competitor','manual','ai')),
  source_id uuid,
  title text NOT NULL,
  description text,
  suggested_format text,
  suggested_channel text,
  thesis_id uuid,
  pillar text,
  evidence jsonb NOT NULL DEFAULT '{}',
  editorial_rules_validated boolean NOT NULL DEFAULT false,
  curation_status text NOT NULL DEFAULT 'proposed' CHECK(curation_status IN ('proposed','approved','rejected','expired')),
  rejection_reason text,
  approved_by text,
  approved_at timestamptz,
  promoted_publication_id uuid REFERENCES scheduled_publications(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_suggestions_status_idx ON content_suggestions(curation_status);
CREATE INDEX content_suggestions_created_idx ON content_suggestions(created_at DESC);

-- Worker settings table for runtime control (Etapa 6)
CREATE TABLE worker_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  cadence text,
  domain text NOT NULL DEFAULT 'general' CHECK(domain IN ('radar','intelligence','publishing','messaging','maintenance','general')),
  last_execution_at timestamptz,
  next_execution_at timestamptz,
  items_processed bigint NOT NULL DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
