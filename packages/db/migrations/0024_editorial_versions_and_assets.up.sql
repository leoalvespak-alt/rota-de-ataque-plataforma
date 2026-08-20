CREATE TABLE thesis_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thesis_id, version)
);

CREATE TABLE content_item_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, revision)
);

CREATE TABLE content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES content_variants(id) ON DELETE SET NULL,
  storage_ref text NOT NULL,
  filename text,
  mime_type text,
  byte_size bigint CHECK(byte_size IS NULL OR byte_size >= 0),
  width integer CHECK(width IS NULL OR width > 0),
  height integer CHECK(height IS NULL OR height > 0),
  checksum text,
  status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('draft','pending_review','approved','rejected','archived')),
  source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','creative_bridge','ai_generated','imported')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS thesis_revisions_thesis_idx ON thesis_revisions(thesis_id, version DESC);
CREATE INDEX IF NOT EXISTS content_item_revisions_item_idx ON content_item_revisions(content_item_id, revision DESC);
CREATE INDEX IF NOT EXISTS content_assets_item_idx ON content_assets(content_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_assets_variant_idx ON content_assets(variant_id) WHERE variant_id IS NOT NULL;
