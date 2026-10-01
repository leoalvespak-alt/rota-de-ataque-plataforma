BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE editorial.task_runs TO prospector_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE editorial.task_schedules TO prospector_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE editorial.task_outbox TO prospector_app';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE editorial.task_run_audit TO prospector_app';
    EXECUTE 'GRANT SELECT, UPDATE ON TABLE editorial.task_runtime_meta TO prospector_app';
  END IF;
END
$$;

COMMIT;