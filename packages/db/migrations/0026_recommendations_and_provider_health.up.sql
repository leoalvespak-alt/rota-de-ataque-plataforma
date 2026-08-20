CREATE TABLE operational_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved','dismissed')),
  title text NOT NULL,
  detail text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(campaign_id, rule_key, status)
);

CREATE TABLE ai_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  model_id uuid REFERENCES ai_models(id) ON DELETE CASCADE,
  status text NOT NULL CHECK(status IN ('healthy','degraded','invalid','untested')),
  latency_ms integer,
  error_code text,
  tested_by text,
  tested_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS operational_recommendations_campaign_idx ON operational_recommendations(campaign_id, status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_provider_health_model_idx ON ai_provider_health(model_id, tested_at DESC);
