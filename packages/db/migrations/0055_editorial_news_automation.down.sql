BEGIN;

UPDATE editorial.task_schedules
SET cadence = 'daily',
    enabled = false,
    configuration = '{}'::jsonb,
    next_run_at = NULL,
    updated_at = now()
WHERE task_name = 'news-radar.daily';

COMMIT;
