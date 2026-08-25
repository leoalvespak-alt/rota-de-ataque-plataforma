BEGIN;

ALTER TABLE content_variants
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE content_variants AS variant
SET created_at = COALESCE(variant.created_at, item.created_at, now())
FROM content_items AS item
WHERE item.id = variant.content_item_id
  AND variant.created_at IS NULL;

UPDATE content_variants
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE content_variants
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE content_variants
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE content_variants
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE content_variants
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS content_variants_item_created_idx
  ON content_variants(content_item_id, created_at);

COMMIT;

