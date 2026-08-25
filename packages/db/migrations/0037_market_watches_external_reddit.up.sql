BEGIN;

CREATE TABLE IF NOT EXISTS market_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'reddit' CHECK (platform = 'reddit'),
  kind text NOT NULL CHECK (kind IN ('subreddit','search_query','user','keyword_across')),
  value text NOT NULL CHECK (char_length(value) BETWEEN 2 AND 500),
  provider_preference text NOT NULL DEFAULT 'auto' CHECK (provider_preference IN ('auto','apify','bright_data')),
  budget_scope text,
  cadence_seconds integer NOT NULL DEFAULT 900 CHECK (cadence_seconds BETWEEN 60 AND 86400),
  active boolean NOT NULL DEFAULT true,
  last_state text NOT NULL DEFAULT 'pending' CHECK (last_state IN ('pending','running','succeeded','failed','blocked')),
  reason_code text,
  last_provider text,
  last_cost_usd numeric(18,6),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, kind, value)
);

INSERT INTO market_watches (id, campaign_id, kind, value, cadence_seconds, active, last_run_at, next_run_at, created_at, updated_at)
SELECT id, campaign_id, kind, value, COALESCE(min_interval_seconds, 900), active, last_run_at, next_run_at, now(), now()
FROM reddit_watches
ON CONFLICT (platform, kind, value) DO NOTHING;

CREATE INDEX IF NOT EXISTS market_watches_due_idx ON market_watches(next_run_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS market_watches_campaign_idx ON market_watches(campaign_id, platform, active);

COMMIT;

