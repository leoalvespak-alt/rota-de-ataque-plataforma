BEGIN;

CREATE TABLE IF NOT EXISTS task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','running','completed','failed','retry_scheduled')),
  attempt integer NOT NULL DEFAULT 0,
  result jsonb,
  error text,
  schedule_time timestamptz,
  retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS task_runs_due_idx ON task_runs(task_name, status, schedule_time);

CREATE TABLE IF NOT EXISTS task_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL UNIQUE,
  destination text NOT NULL CHECK (destination IN ('cloud-run','cloud-tasks','local')),
  cadence text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO task_schedules(task_name,destination,cadence,enabled,configuration)
VALUES
 ('news-radar.daily','cloud-run','daily',false,'{"fallback":"local-one-shot"}'),
 ('editorial-batch.15day','cloud-run','every-15-days',false,'{"fallback":"local-one-shot"}'),
 ('publication.due','cloud-tasks','schedule-time',false,'{"fallback":"local-one-shot"}')
ON CONFLICT(task_name) DO UPDATE SET destination=EXCLUDED.destination,cadence=EXCLUDED.cadence;

COMMIT;
