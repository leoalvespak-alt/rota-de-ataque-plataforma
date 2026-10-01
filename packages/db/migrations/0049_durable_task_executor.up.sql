BEGIN;

ALTER TABLE editorial.task_runs
  ADD COLUMN IF NOT EXISTS available_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS max_attempts smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkpoint jsonb,
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS revision_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE editorial.task_runs
SET available_at = COALESCE(retry_at, schedule_time, created_at)
WHERE available_at IS NULL;

ALTER TABLE editorial.task_runs
  ALTER COLUMN available_at SET DEFAULT now(),
  ALTER COLUMN available_at SET NOT NULL,
  ADD CONSTRAINT task_runs_lane_check CHECK (lane IN ('default','heavy','publishing','inbound')),
  ADD CONSTRAINT task_runs_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 100),
  ADD CONSTRAINT task_runs_priority_check CHECK (priority BETWEEN 0 AND 1000);

CREATE INDEX task_runs_claim_idx
  ON editorial.task_runs(lane, priority DESC, available_at, created_at)
  WHERE status IN ('accepted','retry_scheduled');
CREATE INDEX task_runs_expired_lease_idx
  ON editorial.task_runs(lease_until)
  WHERE status = 'running' AND lease_until IS NOT NULL;
CREATE UNIQUE INDEX task_runs_business_identity_idx
  ON editorial.task_runs(task_name, item_id, revision_id, account_id)
  WHERE item_id IS NOT NULL AND revision_id IS NOT NULL AND account_id IS NOT NULL;

ALTER TABLE editorial.task_schedules
  ALTER COLUMN destination SET DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 50;

ALTER TABLE editorial.task_schedules
  DROP CONSTRAINT IF EXISTS task_schedules_destination_check,
  DROP CONSTRAINT IF EXISTS task_schedules_lane_check;

UPDATE editorial.task_schedules
SET destination = 'local', enabled = false,
    lane = CASE task_name
      WHEN 'news-radar.daily' THEN 'heavy'
      WHEN 'editorial-batch.15day' THEN 'heavy'
      WHEN 'publication.due' THEN 'publishing'
      ELSE 'default'
    END,
    priority = CASE task_name
      WHEN 'publication.due' THEN 100
      WHEN 'news-radar.daily' THEN 30
      WHEN 'editorial-batch.15day' THEN 20
      ELSE 50
    END,
    next_run_at = CASE WHEN cadence IN ('daily','every-15-days') THEN now() ELSE NULL END,
    updated_at = now();

ALTER TABLE editorial.task_schedules
  ADD CONSTRAINT task_schedules_destination_check CHECK (destination = 'local'),
  ADD CONSTRAINT task_schedules_lane_check CHECK (lane IN ('default','heavy','publishing','inbound'));

CREATE TABLE editorial.task_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES editorial.task_runs(id) ON DELETE RESTRICT,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX task_outbox_claim_idx
  ON editorial.task_outbox(available_at, created_at)
  WHERE status IN ('pending','failed');

CREATE TABLE editorial.task_run_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_run_id uuid NOT NULL REFERENCES editorial.task_runs(id) ON DELETE RESTRICT,
  actor text NOT NULL,
  action text NOT NULL CHECK (action IN ('retry')),
  previous_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_run_audit_created_idx ON editorial.task_run_audit(created_at DESC);

CREATE TABLE editorial.task_runtime_meta (
  key text PRIMARY KEY,
  version text NOT NULL,
  used_at timestamptz
);
INSERT INTO editorial.task_runtime_meta(key, version) VALUES ('editorial-executor', '0049_durable_task_executor');

COMMIT;
