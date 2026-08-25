DROP INDEX IF EXISTS provider_observations_reddit_context_idx;
ALTER TABLE provider_observations DROP COLUMN IF EXISTS source_context;
