BEGIN;

DO $$
BEGIN
  IF to_regclass('editorial.social_inbox_events') IS NOT NULL
     AND EXISTS (SELECT 1 FROM editorial.social_inbox_events) THEN
    RAISE EXCEPTION 'Cannot roll back Meta inbox migration after social inbox events have been recorded';
  END IF;

  IF to_regclass('editorial.task_runs') IS NOT NULL
     AND EXISTS (SELECT 1 FROM editorial.task_runs WHERE task_name IN ('inbox.message', 'inbox.retention.cleanup')) THEN
    RAISE EXCEPTION 'Cannot roll back Meta inbox migration while inbox task runs exist';
  END IF;
END
$$;

DELETE FROM editorial.task_schedules WHERE task_name = 'inbox.retention.cleanup';
DROP TABLE IF EXISTS editorial.social_inbox_events;

COMMIT;
