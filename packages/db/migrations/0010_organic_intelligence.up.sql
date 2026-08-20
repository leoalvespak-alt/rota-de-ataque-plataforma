ALTER TABLE candidate_sources DROP CONSTRAINT IF EXISTS candidate_sources_discovered_via_check;
ALTER TABLE candidate_sources ADD CONSTRAINT candidate_sources_discovered_via_check CHECK(discovered_via IN ('collab','tag','mention','community_map','search','live','exa','apify','bright_data','manual'));

CREATE TABLE research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid REFERENCES campaigns ON DELETE CASCADE,
  purpose text NOT NULL, status text NOT NULL CHECK(status IN ('planned','running','completed','failed','budget_blocked','cancelled')),
  correlation_id uuid NOT NULL UNIQUE, provider_plan jsonb NOT NULL DEFAULT '[]', parameters jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz, finished_at timestamptz, error_code text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), research_run_id uuid NOT NULL REFERENCES research_runs ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('exa','apify','bright_data','meta','reddit_official','manual')),
  platform text NOT NULL CHECK(platform IN ('web','instagram','threads','tiktok','youtube','reddit','x','google','news','forum','blog')),
  external_id text NOT NULL, canonical_url text NOT NULL, logical_entity_key text NOT NULL,
  author_external_id text, title text, text_content text, metrics jsonb NOT NULL DEFAULT '{}', raw_schema_version text NOT NULL,
  observed_at timestamptz NOT NULL, published_at timestamptz, quarantined_at timestamptz, quarantine_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,platform,external_id,observed_at)
);
CREATE INDEX provider_observations_logical_idx ON provider_observations(logical_entity_key, observed_at DESC);

CREATE TABLE provider_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), research_run_id uuid REFERENCES research_runs ON DELETE SET NULL,
  provider text NOT NULL, operation text NOT NULL, units numeric NOT NULL DEFAULT 0, estimated_cost_usd numeric NOT NULL DEFAULT 0,
  actual_cost_usd numeric, currency text NOT NULL DEFAULT 'USD', duration_ms integer, attempts integer NOT NULL DEFAULT 1,
  outcome text NOT NULL DEFAULT 'completed', cache_hit boolean NOT NULL DEFAULT false, fallback_reason text,
  external_reference text, pricing_version text NOT NULL DEFAULT 'unknown',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organic_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL CHECK(scope IN ('global','provider','campaign')),
  scope_id text NOT NULL DEFAULT 'global', period text NOT NULL CHECK(period IN ('daily','monthly')),
  limit_usd numeric NOT NULL CHECK(limit_usd >= 0), spent_usd numeric NOT NULL DEFAULT 0, reserved_usd numeric NOT NULL DEFAULT 0,
  period_started_at timestamptz NOT NULL, hard_limit boolean NOT NULL DEFAULT true, UNIQUE(scope,scope_id,period,period_started_at)
);
CREATE TABLE organic_budget_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), budget_id uuid NOT NULL REFERENCES organic_budgets ON DELETE CASCADE,
  research_run_id uuid NOT NULL REFERENCES research_runs ON DELETE CASCADE, estimated_usd numeric NOT NULL CHECK(estimated_usd >= 0),
  actual_usd numeric, status text NOT NULL CHECK(status IN ('reserved','reconciled','refunded','expired')) DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(), reconciled_at timestamptz, UNIQUE(budget_id,research_run_id)
);

CREATE TABLE cross_platform_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('creator','source','content','topic')),
  canonical_key text NOT NULL UNIQUE, display_name text, confidence numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'candidate',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cross_platform_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES cross_platform_entities ON DELETE CASCADE,
  platform text NOT NULL, external_id text NOT NULL, handle text, canonical_url text, provenance_observation_id uuid REFERENCES provider_observations,
  verified boolean NOT NULL DEFAULT false, UNIQUE(platform,external_id)
);

CREATE TABLE content_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), observation_id uuid NOT NULL REFERENCES provider_observations ON DELETE CASCADE,
  captured_at timestamptz NOT NULL, followers bigint, views bigint, impressions bigint, reach bigint, likes bigint, comments bigint,
  shares bigint, saves bigint, source text NOT NULL, UNIQUE(observation_id,captured_at)
);
CREATE TABLE publication_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), publication_id uuid NOT NULL REFERENCES content_publications ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES content_variants ON DELETE CASCADE, channel text NOT NULL,
  metric_window text NOT NULL CHECK(metric_window IN ('1h','6h','24h','72h','7d')), captured_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL, source text NOT NULL, UNIQUE(publication_id,metric_window)
);
CREATE TABLE organic_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), observation_id uuid NOT NULL REFERENCES provider_observations ON DELETE CASCADE,
  provider_external_id text NOT NULL, author_hash text, text_content text NOT NULL, sentiment text, selected_reason text,
  created_at timestamptz, UNIQUE(observation_id,provider_external_id)
);
CREATE TABLE content_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), observation_id uuid NOT NULL REFERENCES provider_observations ON DELETE CASCADE,
  source text NOT NULL, license_status text NOT NULL, language text, status text NOT NULL, text_content text,
  chunks jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(observation_id,source)
);

CREATE TABLE organic_intelligence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), observation_id uuid REFERENCES provider_observations ON DELETE CASCADE,
  entity_id uuid REFERENCES cross_platform_entities ON DELETE CASCADE, signal_type text NOT NULL, value jsonb NOT NULL,
  evidence_ids uuid[] NOT NULL DEFAULT '{}', model_version text, score_version text, confidence numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_opportunities ADD COLUMN score_components jsonb NOT NULL DEFAULT '{}';
ALTER TABLE content_opportunities ADD COLUMN score_version text;
ALTER TABLE content_opportunities ADD COLUMN confidence numeric NOT NULL DEFAULT 0;
ALTER TABLE content_opportunities ADD COLUMN predicted_cost_usd numeric NOT NULL DEFAULT 0;
ALTER TABLE content_opportunities ADD COLUMN source_references jsonb NOT NULL DEFAULT '[]';
ALTER TABLE content_items ADD COLUMN opportunity_id uuid REFERENCES content_opportunities ON DELETE SET NULL;
ALTER TABLE content_items ADD COLUMN content_version integer NOT NULL DEFAULT 1;
ALTER TABLE content_variants ADD COLUMN scheduled_for timestamptz;
ALTER TABLE content_variants ADD COLUMN timezone text;
ALTER TABLE scheduled_publications ADD COLUMN channel text NOT NULL DEFAULT 'instagram' CHECK(channel IN ('instagram','threads'));
ALTER TABLE scheduled_publications ADD COLUMN correlation_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX scheduled_publications_variant_channel_unique ON scheduled_publications(variant_id,channel) WHERE variant_id IS NOT NULL;
CREATE INDEX scheduled_publications_channel_due_idx ON scheduled_publications(channel,scheduled_for) WHERE status IN ('scheduled','approved');
ALTER TABLE content_publications ADD COLUMN correlation_id uuid;
ALTER TABLE content_publications ADD COLUMN metric_window text;
CREATE UNIQUE INDEX content_publications_variant_window_unique ON content_publications(variant_id,metric_window) WHERE metric_window IS NOT NULL;
CREATE UNIQUE INDEX content_publications_variant_channel_once ON content_publications(variant_id,channel) WHERE metric_window IS NULL;

CREATE TABLE organic_learning_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL, sample_size integer NOT NULL, coverage numeric NOT NULL,
  current_weights jsonb NOT NULL, recommended_weights jsonb NOT NULL, rationale jsonb NOT NULL, model_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('proposed','approved','rejected','activated','rolled_back')) DEFAULT 'proposed',
  approved_by text, created_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz
);

CREATE TABLE creative_bridge_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_item_id uuid NOT NULL REFERENCES content_items,
  variant_id uuid NOT NULL REFERENCES content_variants, schema_version text NOT NULL, correlation_id uuid NOT NULL UNIQUE,
  payload jsonb NOT NULL, status text NOT NULL CHECK(status IN ('created','accepted','rejected','completed')) DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
