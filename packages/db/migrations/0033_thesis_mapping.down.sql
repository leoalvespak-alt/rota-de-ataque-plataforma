-- ============================================================
-- Migration 0033 — thesis_mapping (DOWN)
-- ============================================================

DROP TRIGGER IF EXISTS creative_status_audit ON unified_creatives;
DROP FUNCTION IF EXISTS audit_creative_published();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'editorial_theses') THEN
    ALTER TABLE editorial_theses DROP COLUMN IF EXISTS prospector_thesis_id;
  END IF;
END $$;
