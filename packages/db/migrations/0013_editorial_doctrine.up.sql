-- Etapa 3 — Estruturas para a doutrina editorial
-- Pilares, formatos, regras, vocabulário e hooks validados.

CREATE TABLE content_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  weekly_weight numeric NOT NULL CHECK(weekly_weight >= 0 AND weekly_weight <= 1),
  thesis_id uuid,
  primary_objective text NOT NULL,
  origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  locked_at timestamptz,
  locked_by text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE format_playbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format_name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  function_description text NOT NULL,
  structure text,
  frequency_min integer NOT NULL DEFAULT 0,
  frequency_max integer NOT NULL DEFAULT 0,
  frequency_unit text NOT NULL DEFAULT 'week' CHECK(frequency_unit IN ('day','week','month')),
  primary_objective text NOT NULL,
  channel text NOT NULL DEFAULT 'instagram' CHECK(channel IN ('instagram','threads','stories','all')),
  origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  locked_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE editorial_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL CHECK(rule_type IN ('do','dont')),
  scope text NOT NULL DEFAULT 'global' CHECK(scope IN ('global','format','channel','pillar')),
  scope_ref text,
  rule_text text NOT NULL,
  justification text,
  severity text NOT NULL DEFAULT 'warning' CHECK(severity IN ('block','warning','suggestion')),
  origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  locked_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_rules_type_idx ON editorial_rules(rule_type, active);

CREATE TABLE audience_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  context text,
  evidence_source text,
  evidence_url text,
  category text CHECK(category IN ('pain','desire','jargon','objection','question','cta')),
  origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audience_vocabulary_category_idx ON audience_vocabulary(category);

CREATE TABLE validated_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_text text NOT NULL,
  source_profile text,
  source_platform text DEFAULT 'instagram',
  result_metric text,
  result_value text,
  result_multiplier numeric,
  thesis_id uuid,
  pillar text,
  format text,
  origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai_generated','automation')),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabelas do radar de notícias (Etapa 4)

CREATE TABLE news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  feed_url text,
  source_type text NOT NULL CHECK(source_type IN ('rss','scrape','api')),
  portal text,
  active boolean NOT NULL DEFAULT true,
  last_fetched_at timestamptz,
  etag text,
  last_modified text,
  failure_count integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  disabled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  url text NOT NULL,
  url_hash text NOT NULL,
  title text NOT NULL,
  summary text,
  content text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  classified boolean NOT NULL DEFAULT false,
  classification jsonb,
  watermark timestamptz,
  UNIQUE(source_id, external_id)
);
CREATE INDEX news_items_url_hash_idx ON news_items(url_hash);
CREATE INDEX news_items_published_idx ON news_items(published_at DESC);
CREATE INDEX news_items_unclassified_idx ON news_items(classified) WHERE NOT classified;

-- Ampliar scheduled_publications para calendário gerenciável (Etapa 7)

ALTER TABLE scheduled_publications
  ADD COLUMN IF NOT EXISTS subtype text CHECK(subtype IN ('feed','reels','stories','carousel','threads','static')),
  ADD COLUMN IF NOT EXISTS hashtags text[],
  ADD COLUMN IF NOT EXISTS media_ref text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS thesis_id uuid,
  ADD COLUMN IF NOT EXISTS pillar text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Ampliar status para Kanban (Etapa 7)
ALTER TABLE scheduled_publications DROP CONSTRAINT IF EXISTS scheduled_publications_status_check;
ALTER TABLE scheduled_publications ADD CONSTRAINT scheduled_publications_status_check
  CHECK(status IN ('idea','draft','ready','approved','scheduled','publishing','published','failed','awaiting_manual_publish','cancelled'));
