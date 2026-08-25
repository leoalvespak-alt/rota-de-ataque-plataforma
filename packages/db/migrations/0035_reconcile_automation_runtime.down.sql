BEGIN;

ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS created_at;

DROP INDEX IF EXISTS content_opportunities_source_suggestion_unique;
DROP INDEX IF EXISTS content_suggestions_opportunity_unique;
ALTER TABLE content_opportunities DROP COLUMN IF EXISTS source_suggestion_id;
ALTER TABLE content_suggestions DROP COLUMN IF EXISTS opportunity_id;

DROP INDEX IF EXISTS automation_incidents_open_idx;
DROP TABLE IF EXISTS automation_incidents;
DROP TABLE IF EXISTS automation_reason_codes;

ALTER TABLE worker_runs DROP CONSTRAINT IF EXISTS worker_runs_result_state_check;
ALTER TABLE worker_runs
  DROP COLUMN IF EXISTS duration_ms,
  DROP COLUMN IF EXISTS rejected_count,
  DROP COLUMN IF EXISTS output_count,
  DROP COLUMN IF EXISTS input_count,
  DROP COLUMN IF EXISTS reason_code,
  DROP COLUMN IF EXISTS result_state;
ALTER TABLE worker_settings DROP COLUMN IF EXISTS last_success_at;
ALTER TABLE worker_settings DROP COLUMN IF EXISTS required_account_role;

COMMIT;
