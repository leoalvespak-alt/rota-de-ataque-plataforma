BEGIN;

WITH local_windows AS (
  SELECT (days.local_today + offset_days.day_offset + windows.window_time) AT TIME ZONE 'America/Sao_Paulo' AS run_at
  FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS local_today) days
  CROSS JOIN generate_series(0, 1) AS offset_days(day_offset)
  CROSS JOIN unnest(ARRAY['12:00'::time, '20:00'::time]) AS windows(window_time)
)
UPDATE editorial.task_schedules
SET cadence = 'twice-daily',
    enabled = true,
    configuration = configuration || jsonb_build_object(
      'mode', 'incremental',
      'timeZone', 'America/Sao_Paulo',
      'times', jsonb_build_array('12:00', '20:00')
    ),
    next_run_at = (SELECT min(run_at) FROM local_windows WHERE run_at > now()),
    updated_at = now()
WHERE task_name = 'news-radar.daily'
  AND destination = 'local';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM editorial.task_schedules
    WHERE task_name = 'news-radar.daily' AND destination = 'local' AND cadence = 'twice-daily'
  ) THEN
    RAISE EXCEPTION 'Expected local news-radar.daily schedule was not seeded';
  END IF;
END $$;

COMMIT;
