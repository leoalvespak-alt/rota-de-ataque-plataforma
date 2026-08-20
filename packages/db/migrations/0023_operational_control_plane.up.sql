CREATE TABLE worker_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('enable','disable','pause','resume','run_now','clear_dlq')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by text,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','enqueued','completed','failed','cancelled')),
  job_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS worker_commands_worker_created_idx ON worker_commands(worker_name, created_at DESC);

CREATE TABLE worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  job_id text NOT NULL,
  command_id uuid REFERENCES worker_commands(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('running','completed','failed','skipped')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(worker_name, job_id)
);

CREATE INDEX IF NOT EXISTS worker_runs_worker_started_idx ON worker_runs(worker_name, started_at DESC);
