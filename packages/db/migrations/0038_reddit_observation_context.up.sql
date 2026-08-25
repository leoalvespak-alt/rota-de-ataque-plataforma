ALTER TABLE provider_observations
  ADD COLUMN IF NOT EXISTS source_context jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS provider_observations_reddit_context_idx
  ON provider_observations USING gin (source_context)
  WHERE platform = 'reddit';
