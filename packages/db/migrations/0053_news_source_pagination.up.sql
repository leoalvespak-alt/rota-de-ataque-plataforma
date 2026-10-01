BEGIN;

ALTER TABLE public.news_sources
  ADD COLUMN pagination_cursor text,
  ADD COLUMN pagination_complete boolean NOT NULL DEFAULT false;

UPDATE public.news_sources
SET pagination_complete = true
WHERE source_type <> 'html' OR portal IS DISTINCT FROM 'pci-concursos';

COMMENT ON COLUMN public.news_sources.pagination_cursor IS
  'Same-origin continuation URL for a bounded source backfill; cleared after the listing is exhausted.';
COMMENT ON COLUMN public.news_sources.pagination_complete IS
  'Whether the current finite HTML listing backfill has reached its end.';

COMMIT;
