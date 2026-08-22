BEGIN;

-- Reverter Etapa 1
DROP TABLE IF EXISTS engine_commands;

ALTER TABLE worker_settings
  DROP COLUMN IF EXISTS engine_key,
  DROP COLUMN IF EXISTS label_pt,
  DROP COLUMN IF EXISTS description_pt,
  DROP COLUMN IF EXISTS tier,
  DROP COLUMN IF EXISTS schedulable,
  DROP COLUMN IF EXISTS triggered_by,
  DROP COLUMN IF EXISTS requires;

DROP TABLE IF EXISTS automation_engines;

COMMIT;
