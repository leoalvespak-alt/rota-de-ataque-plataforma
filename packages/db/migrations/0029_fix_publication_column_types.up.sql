-- X1: 0025 silently failed for hashtags and cta because the columns already existed
-- as text[] and text respectively. Convert them now with explicit USING clauses.
ALTER TABLE scheduled_publications
  ALTER COLUMN hashtags TYPE jsonb USING to_jsonb(hashtags),
  ALTER COLUMN cta      TYPE jsonb USING to_json(cta)::jsonb;

-- X2: 0025 created indexes without IF NOT EXISTS — add them now with guards
-- (they may or may not exist depending on whether 0025 ran successfully)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'scheduled_publications'
      AND indexname  = 'scheduled_publications_idempotency_key_unique'
  ) THEN
    CREATE UNIQUE INDEX scheduled_publications_idempotency_key_unique
      ON scheduled_publications(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'creative_bridge_deliveries'
      AND indexname  = 'creative_bridge_deliveries_status_idx'
  ) THEN
    CREATE INDEX creative_bridge_deliveries_status_idx
      ON creative_bridge_deliveries(status, created_at DESC);
  END IF;
END $$;
