BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.content_opportunities WHERE status='archived') THEN
    RAISE EXCEPTION 'Cannot remove archived status while archived opportunities exist';
  END IF;
END $$;
ALTER TABLE public.content_opportunities
  DROP CONSTRAINT IF EXISTS content_opportunities_status_check;
ALTER TABLE public.content_opportunities
  ADD CONSTRAINT content_opportunities_status_check
  CHECK (status IN ('new','pending','review','approved','rejected','expired'));
COMMIT;