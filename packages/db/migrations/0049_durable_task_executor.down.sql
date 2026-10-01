BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM editorial.task_runtime_meta WHERE key='editorial-executor' AND used_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM editorial.task_outbox)
     OR EXISTS (SELECT 1 FROM editorial.task_run_audit)
     OR EXISTS (SELECT 1 FROM editorial.task_runs WHERE checkpoint IS NOT NULL OR lease_owner IS NOT NULL) THEN
    RAISE EXCEPTION 'Durable task runtime has been used; preserve its queue and outbox state';
  END IF;
END $$;

DROP TABLE editorial.task_runtime_meta;
DROP INDEX editorial.task_run_audit_created_idx;
DROP TABLE editorial.task_run_audit;
DROP TABLE editorial.task_outbox;
DROP INDEX editorial.task_runs_business_identity_idx;
DROP INDEX editorial.task_runs_expired_lease_idx;
DROP INDEX editorial.task_runs_claim_idx;
ALTER TABLE editorial.task_runs
  DROP CONSTRAINT task_runs_lane_check,
  DROP CONSTRAINT task_runs_max_attempts_check,
  DROP CONSTRAINT task_runs_priority_check,
  DROP COLUMN updated_at,
  DROP COLUMN revision_id,
  DROP COLUMN item_id,
  DROP COLUMN account_id,
  DROP COLUMN checkpoint,
  DROP COLUMN heartbeat_at,
  DROP COLUMN lease_until,
  DROP COLUMN lease_owner,
  DROP COLUMN max_attempts,
  DROP COLUMN lane,
  DROP COLUMN priority,
  DROP COLUMN available_at;
ALTER TABLE editorial.task_schedules
  DROP CONSTRAINT task_schedules_destination_check,
  DROP CONSTRAINT task_schedules_lane_check,
  DROP COLUMN priority,
  DROP COLUMN lane,
  DROP COLUMN last_run_at,
  DROP COLUMN next_run_at,
  ALTER COLUMN destination DROP DEFAULT,
  ADD CONSTRAINT task_schedules_destination_check CHECK (destination IN ('cloud-run','cloud-tasks','local'));

COMMIT;
