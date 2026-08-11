DROP INDEX IF EXISTS own_comments_account_fetched_idx;
DROP INDEX IF EXISTS comments_username_idx;
ALTER TABLE accounts DROP COLUMN IF EXISTS last_meta_sync_at;
ALTER TABLE campaign_scoring_config
  DROP COLUMN IF EXISTS p2_threshold,
  DROP COLUMN IF EXISTS p1_threshold,
  DROP COLUMN IF EXISTS p0_threshold;
