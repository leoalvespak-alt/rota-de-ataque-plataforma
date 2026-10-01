BEGIN;
ALTER TABLE public.content_opportunities
  DROP CONSTRAINT IF EXISTS content_opportunities_status_check;
ALTER TABLE public.content_opportunities
  ADD CONSTRAINT content_opportunities_status_check
  CHECK (status IN ('new','pending','review','approved','rejected','expired','archived'));
COMMIT;