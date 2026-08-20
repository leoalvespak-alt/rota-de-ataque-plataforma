DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organic_budget_reservations
    WHERE status = 'released'
       OR budget_id IS NULL
       OR research_run_id IS NULL
  ) THEN
    RAISE EXCEPTION '0015 rollback blocked: provider-only or released reservations require a restore or data migration';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_budget_reservations_provider;
DROP INDEX IF EXISTS idx_budget_reservations_created;
DROP TABLE IF EXISTS organic_budget_reservation_quarantine;

ALTER TABLE organic_budget_reservations
  DROP CONSTRAINT IF EXISTS organic_budget_reservations_actual_usd_check,
  DROP CONSTRAINT IF EXISTS organic_budget_reservations_provider_check,
  DROP CONSTRAINT IF EXISTS organic_budget_reservations_status_check;

ALTER TABLE organic_budget_reservations
  DROP COLUMN IF EXISTS provider,
  ALTER COLUMN estimated_usd TYPE numeric USING estimated_usd,
  ALTER COLUMN actual_usd TYPE numeric USING actual_usd,
  ALTER COLUMN budget_id SET NOT NULL,
  ALTER COLUMN research_run_id SET NOT NULL;

ALTER TABLE organic_budget_reservations
  ADD CONSTRAINT organic_budget_reservations_status_check
  CHECK (status IN ('reserved', 'reconciled', 'refunded', 'expired'));
