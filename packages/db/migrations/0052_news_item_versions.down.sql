DROP TABLE IF EXISTS editorial.news_item_versions;

ALTER TABLE public.news_items
  DROP COLUMN IF EXISTS details_http_status,
  DROP COLUMN IF EXISTS details_checked_at;
