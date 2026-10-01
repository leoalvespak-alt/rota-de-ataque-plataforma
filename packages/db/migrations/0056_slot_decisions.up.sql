BEGIN;

CREATE TABLE IF NOT EXISTS editorial.slot_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL,
  brief jsonb NOT NULL,
  decision jsonb,
  provider text,
  status text NOT NULL DEFAULT 'composed' CHECK (status IN ('composed', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slot_decisions_finding_idx
  ON editorial.slot_decisions (finding_id);

COMMIT;
