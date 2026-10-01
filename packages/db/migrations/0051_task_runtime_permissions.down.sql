BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_app') THEN
    EXECUTE 'REVOKE SELECT, INSERT, UPDATE ON TABLE editorial.task_runs FROM prospector_app';
    EXECUTE 'REVOKE SELECT, INSERT, UPDATE ON TABLE editorial.task_schedules FROM prospector_app';
    EXECUTE 'REVOKE SELECT, INSERT, UPDATE ON TABLE editorial.task_outbox FROM prospector_app';
    EXECUTE 'REVOKE SELECT, INSERT ON TABLE editorial.task_run_audit FROM prospector_app';
    EXECUTE 'REVOKE SELECT, UPDATE ON TABLE editorial.task_runtime_meta FROM prospector_app';
  END IF;
END
$$;

COMMIT;