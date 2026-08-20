-- Etapa 11 — idempotência, versão e estado operacional do enrichment.
CREATE TABLE enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  observation_id uuid NOT NULL REFERENCES provider_observations ON DELETE CASCADE,
  research_run_id uuid REFERENCES research_runs ON DELETE SET NULL,
  provider text NOT NULL,
  correlation_id uuid NOT NULL,
  input_version text NOT NULL,
  enrichment_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('running','persisting','completed','failed')) DEFAULT 'running',
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  reason_code text,
  actual_cost_usd numeric(18,4),
  next_enqueued_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(observation_id, enrichment_version)
);

CREATE INDEX enrichment_jobs_status_idx ON enrichment_jobs(status, updated_at);
CREATE INDEX enrichment_jobs_correlation_idx ON enrichment_jobs(correlation_id);
