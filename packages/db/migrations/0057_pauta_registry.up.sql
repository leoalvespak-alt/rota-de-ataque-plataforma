BEGIN;

CREATE TABLE IF NOT EXISTS editorial.pauta_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text UNIQUE NOT NULL,
  categoria text,
  estado text,
  fase_ciclo text,
  title text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'posted', 'manual')),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  finding_id uuid,
  opportunity_id uuid,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pauta_registry_status_idx
  ON editorial.pauta_registry (status);

COMMIT;
