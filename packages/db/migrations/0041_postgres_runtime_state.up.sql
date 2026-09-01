-- Fase 9: estado pequeno e persistente para rate limits e controles operacionais.
-- Substitui somente estado efêmero que antes dependia de Redis; não remove tabelas editoriais.
CREATE TABLE IF NOT EXISTS runtime_rate_limits (
  bucket_key text PRIMARY KEY,
  window_expires_at timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runtime_rate_limits_expiry_idx ON runtime_rate_limits(window_expires_at);

CREATE TABLE IF NOT EXISTS runtime_controls (
  control_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runtime_control_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  control_key text NOT NULL,
  account_id uuid,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runtime_control_audit_created_idx ON runtime_control_audit(created_at DESC);
