ALTER TABLE review_inbox
  ADD COLUMN IF NOT EXISTS decision_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undo_until timestamptz,
  ADD COLUMN IF NOT EXISTS undo_token uuid;

CREATE INDEX IF NOT EXISTS review_inbox_undo_idx
  ON review_inbox(undo_until)
  WHERE undo_token IS NOT NULL;
