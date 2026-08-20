-- E5.1: Canonical status vocabulary for content_opportunities
-- Normalise any non-standard existing values before adding the constraint
UPDATE content_opportunities
SET status = 'new'
WHERE status NOT IN ('new', 'pending', 'review', 'approved', 'rejected', 'expired');

ALTER TABLE content_opportunities
  ADD CONSTRAINT content_opportunities_status_check
  CHECK (status IN ('new', 'pending', 'review', 'approved', 'rejected', 'expired'));

-- E5.2: Promote manual baseline suggestions to content_opportunities
-- Identifies suggestions by their seed evidence key so the insert is idempotent
INSERT INTO content_opportunities (
  campaign_id, thesis, angle, hook, evidence,
  opportunity_score, score_version, confidence,
  source_references, status
)
SELECT
  cs.campaign_id,
  COALESCE(t.title, cs.title),               -- use thesis title when available
  cs.title,                                   -- suggestion title becomes the angle
  NULL,                                        -- hook to be filled by the editor
  cs.evidence || jsonb_build_object(
    'content_suggestion_id', cs.id,
    'origin', 'manual'
  ),
  60,                                          -- baseline score for manually curated items
  'manual-v1',
  0.8,
  jsonb_build_array(jsonb_build_object(
    'kind', 'content_suggestion',
    'id', cs.id,
    'seed', cs.evidence->>'seed',
    'source', cs.evidence->>'source'
  )),
  'new'
FROM content_suggestions cs
LEFT JOIN theses t ON t.id = cs.thesis_id
WHERE cs.evidence->>'seed' = 'growth-organic-baseline-v1'
  AND cs.curation_status = 'proposed'
  AND NOT EXISTS (
    SELECT 1
    FROM content_opportunities co
    WHERE co.source_references @> jsonb_build_array(
      jsonb_build_object('kind', 'content_suggestion', 'id', cs.id)
    )
  );
