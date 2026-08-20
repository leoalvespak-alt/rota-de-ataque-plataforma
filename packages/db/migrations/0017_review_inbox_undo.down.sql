DROP INDEX IF EXISTS review_inbox_undo_idx;
ALTER TABLE review_inbox
  DROP COLUMN IF EXISTS undo_token,
  DROP COLUMN IF EXISTS undo_until,
  DROP COLUMN IF EXISTS decision_version;
