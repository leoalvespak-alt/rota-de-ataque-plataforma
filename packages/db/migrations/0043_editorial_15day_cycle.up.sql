BEGIN;

CREATE TABLE IF NOT EXISTS editorial_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  cycle_days integer NOT NULL DEFAULT 15 CHECK (cycle_days = 15),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','cancelled','completed')),
  source_mix jsonb NOT NULL DEFAULT '{}',
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, starts_on)
);

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES editorial_batches ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS content_items_batch_idx ON content_items(batch_id, status, created_at);
CREATE INDEX IF NOT EXISTS editorial_batches_campaign_start_idx ON editorial_batches(campaign_id, starts_on DESC);

COMMIT;
