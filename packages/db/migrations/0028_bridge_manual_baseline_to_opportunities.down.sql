-- Remove promoted opportunities (idempotent: only the bridged ones)
DELETE FROM content_opportunities
WHERE source_references @> '[{"kind": "content_suggestion", "seed": "growth-organic-baseline-v1"}]'::jsonb
  AND status = 'new';

ALTER TABLE content_opportunities
  DROP CONSTRAINT IF EXISTS content_opportunities_status_check;
