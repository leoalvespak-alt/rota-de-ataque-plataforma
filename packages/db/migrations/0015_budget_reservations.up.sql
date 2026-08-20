-- 0010 already owns this table. Reconcile its run/budget shape with the
-- provider-oriented budget gate without replacing or dropping historical rows.
ALTER TABLE organic_budget_reservations
  ADD COLUMN IF NOT EXISTS provider text;

WITH provider_candidates AS (
  SELECT reservation.id AS reservation_id,
    array_agg(DISTINCT NULLIF(trim(provider_plan_item.item->>'provider'), ''))
      FILTER (WHERE NULLIF(trim(provider_plan_item.item->>'provider'), '') IS NOT NULL) AS providers
  FROM organic_budget_reservations reservation
  JOIN research_runs run ON run.id = reservation.research_run_id
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(run.provider_plan) = 'array' THEN run.provider_plan ELSE '[]'::jsonb END
  ) AS provider_plan_item(item) ON true
  WHERE reservation.provider IS NULL
  GROUP BY reservation.id
)
UPDATE organic_budget_reservations reservation
SET provider = provider_candidates.providers[1]
FROM provider_candidates
WHERE reservation.id = provider_candidates.reservation_id
  AND cardinality(provider_candidates.providers) = 1;

CREATE TABLE IF NOT EXISTS organic_budget_reservation_quarantine (
  reservation_id uuid PRIMARY KEY REFERENCES organic_budget_reservations(id) ON DELETE CASCADE,
  reason text NOT NULL,
  provider_plan jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO organic_budget_reservation_quarantine(reservation_id, reason, provider_plan)
SELECT reservation.id, 'provider_unresolved', run.provider_plan
FROM organic_budget_reservations reservation
LEFT JOIN research_runs run ON run.id = reservation.research_run_id
WHERE reservation.provider IS NULL
ON CONFLICT (reservation_id) DO NOTHING;

ALTER TABLE organic_budget_reservations
  ALTER COLUMN budget_id DROP NOT NULL,
  ALTER COLUMN research_run_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organic_budget_reservations
    WHERE estimated_usd <> round(estimated_usd, 4)
       OR (actual_usd IS NOT NULL AND actual_usd <> round(actual_usd, 4))
  ) THEN
    RAISE EXCEPTION '0015 migration blocked: reservation amounts require more than four decimal places';
  END IF;
END $$;

ALTER TABLE organic_budget_reservations
  ALTER COLUMN estimated_usd TYPE numeric(18,4) USING estimated_usd,
  ALTER COLUMN actual_usd TYPE numeric(18,4) USING actual_usd;

ALTER TABLE organic_budget_reservations
  DROP CONSTRAINT IF EXISTS organic_budget_reservations_status_check;

ALTER TABLE organic_budget_reservations
  ADD CONSTRAINT organic_budget_reservations_status_check
  CHECK (status IN ('reserved', 'reconciled', 'released', 'refunded', 'expired'));

ALTER TABLE organic_budget_reservations
  ADD CONSTRAINT organic_budget_reservations_provider_check
  CHECK (provider IS NULL OR length(btrim(provider)) > 0),
  ADD CONSTRAINT organic_budget_reservations_actual_usd_check
  CHECK (actual_usd IS NULL OR actual_usd >= 0);

CREATE INDEX IF NOT EXISTS idx_budget_reservations_provider
  ON organic_budget_reservations(provider, status);
CREATE INDEX IF NOT EXISTS idx_budget_reservations_created
  ON organic_budget_reservations(created_at);
