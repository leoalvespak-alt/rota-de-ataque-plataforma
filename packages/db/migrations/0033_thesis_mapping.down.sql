-- ============================================================
-- Migration 0033 — thesis_mapping (DOWN)
-- ============================================================

DROP TRIGGER IF EXISTS creative_status_audit ON unified_creatives;
DROP FUNCTION IF EXISTS audit_creative_published();

DO $$
DECLARE
  editorial_theses_table regclass;
BEGIN
  editorial_theses_table := COALESCE(
    to_regclass('design.editorial_theses'),
    to_regclass('public.editorial_theses')
  );

  IF editorial_theses_table IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE %s DROP COLUMN IF EXISTS prospector_thesis_id',
      editorial_theses_table
    );
  END IF;
END $$;
