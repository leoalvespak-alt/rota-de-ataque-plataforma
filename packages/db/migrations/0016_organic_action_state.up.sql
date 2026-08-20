-- Etapa 4 — estado explícito e idempotência das ações orgânicas.

ALTER TABLE radar_findings
  ADD COLUMN action_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN promoted_publication_id uuid REFERENCES scheduled_publications(id);

ALTER TABLE radar_findings
  ADD CONSTRAINT radar_findings_action_status_check
  CHECK (action_status IN ('pending', 'approved', 'dismissed'));

UPDATE radar_findings
SET action_status = CASE
  WHEN promoted_to_calendar THEN 'approved'
  WHEN processed THEN 'dismissed'
  ELSE 'pending'
END;

ALTER TABLE competitor_insights
  ADD COLUMN action_status text NOT NULL DEFAULT 'pending';

ALTER TABLE competitor_insights
  ADD CONSTRAINT competitor_insights_action_status_check
  CHECK (action_status IN ('pending', 'seen', 'suggestion_created'));

UPDATE competitor_insights
SET action_status = CASE WHEN processed THEN 'seen' ELSE 'pending' END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM content_suggestions
    WHERE source_id IS NOT NULL AND source_type IN ('radar', 'competitor')
    GROUP BY source_type, source_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'organic suggestion source duplicates require reconciliation before 0016';
  END IF;
END $$;

CREATE UNIQUE INDEX content_suggestions_organic_source_unique
  ON content_suggestions(source_type, source_id)
  WHERE source_id IS NOT NULL AND source_type IN ('radar', 'competitor');

CREATE INDEX radar_findings_action_status_idx ON radar_findings(action_status);
CREATE INDEX competitor_insights_action_status_idx ON competitor_insights(action_status);
