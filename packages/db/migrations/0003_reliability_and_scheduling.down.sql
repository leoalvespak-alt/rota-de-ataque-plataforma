BEGIN;
DROP MATERIALIZED VIEW IF EXISTS mv_content_performance;
DROP MATERIALIZED VIEW IF EXISTS mv_conversation_funnel;
DROP MATERIALIZED VIEW IF EXISTS mv_campaign_performance;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_acquisition;
DROP MATERIALIZED VIEW IF EXISTS mv_lead_rankings;
DROP MATERIALIZED VIEW IF EXISTS mv_competitor_performance;
DROP MATERIALIZED VIEW IF EXISTS mv_engagement_effectiveness;
CREATE MATERIALIZED VIEW mv_engagement_effectiveness AS
  SELECT campaign_id, action_type, count(*) actions,
         count(*) FILTER(WHERE status='done') successes
  FROM engagement_actions GROUP BY campaign_id, action_type WITH NO DATA;
DROP INDEX IF EXISTS scheduled_publications_due_idx;
ALTER TABLE scheduled_publications
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS account_id;
DROP TRIGGER IF EXISTS campaign_competitor_seed_schedules ON campaign_competitors;
DROP FUNCTION IF EXISTS seed_competitor_crawl_schedules();
DROP INDEX IF EXISTS source_metrics_lookup_idx;
DROP INDEX IF EXISTS worker_heartbeats_last_beat_idx;
DROP INDEX IF EXISTS reciprocity_events_unique_kind_idx;
DROP INDEX IF EXISTS alerts_open_fingerprint_idx;
DROP INDEX IF EXISTS canary_runs_pipeline_finished_idx;
DROP TABLE IF EXISTS canary_runs;
COMMIT;
