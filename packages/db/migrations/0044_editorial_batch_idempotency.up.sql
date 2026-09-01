BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS content_items_batch_hook_unique
  ON content_items(batch_id, hook, funnel_stage)
  WHERE batch_id IS NOT NULL;

COMMIT;
