ALTER TABLE campaign_scoring_config
  ADD COLUMN IF NOT EXISTS p0_threshold numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS p1_threshold numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS p2_threshold numeric NOT NULL DEFAULT 25;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS last_meta_sync_at timestamptz;

CREATE INDEX IF NOT EXISTS comments_username_idx ON comments(username, commented_at DESC);
CREATE INDEX IF NOT EXISTS own_comments_account_fetched_idx ON own_comments(account_id, fetched_at DESC);
