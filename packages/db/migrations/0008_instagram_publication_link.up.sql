BEGIN;

ALTER TABLE scheduled_publications
  ADD COLUMN variant_id uuid REFERENCES content_variants;

CREATE INDEX scheduled_publications_variant_idx
  ON scheduled_publications(variant_id)
  WHERE variant_id IS NOT NULL;

COMMIT;
