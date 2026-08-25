BEGIN;

DROP INDEX IF EXISTS market_watches_campaign_idx;
DROP INDEX IF EXISTS market_watches_due_idx;
DROP TABLE IF EXISTS market_watches;

COMMIT;

