ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS details_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS details_http_status smallint
    CHECK (details_http_status BETWEEN 0 AND 599);

CREATE TABLE IF NOT EXISTS editorial.news_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id uuid NOT NULL REFERENCES public.news_items(id) ON DELETE CASCADE,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  parser_version text NOT NULL,
  response_status smallint NOT NULL CHECK (response_status BETWEEN 200 AND 299),
  last_http_status smallint NOT NULL DEFAULT 200 CHECK (last_http_status BETWEEN 0 AND 599),
  title text,
  published_at timestamptz,
  content text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array'),
  etag text,
  last_modified text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (news_item_id, content_hash)
);

CREATE INDEX IF NOT EXISTS news_item_versions_latest_idx
  ON editorial.news_item_versions(news_item_id, last_checked_at DESC);

COMMENT ON TABLE editorial.news_item_versions IS
  'Versioned article details collected from same-host HTTPS source pages; attachments are references and are not downloaded.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON editorial.news_item_versions TO prospector_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_reader') THEN
    EXECUTE 'GRANT SELECT ON editorial.news_item_versions TO prospector_reader';
  END IF;
END $$;
