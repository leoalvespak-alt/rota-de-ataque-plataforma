BEGIN;

ALTER TABLE public.news_sources
  DROP COLUMN pagination_cursor,
  DROP COLUMN pagination_complete;

COMMIT;
