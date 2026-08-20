DELETE FROM content_suggestions
WHERE source_type = 'manual' AND evidence->>'seed' = 'growth-organic-baseline-v1';

DELETE FROM scheduled_publications
WHERE batch_id = 'c0a62026-0818-4020-8a00-000000000001'::uuid
  AND origin = 'manual'
  AND locked_by = 'growth-organic-baseline-v1';

DROP TRIGGER IF EXISTS theses_manual_guard_delete ON theses;
DROP TRIGGER IF EXISTS theses_manual_guard ON theses;

-- Teses potencialmente editadas ou já usadas permanecem como conteúdo normal no rollback.
ALTER TABLE theses
  DROP COLUMN IF EXISTS locked_by,
  DROP COLUMN IF EXISTS locked_at,
  DROP COLUMN IF EXISTS origin;
