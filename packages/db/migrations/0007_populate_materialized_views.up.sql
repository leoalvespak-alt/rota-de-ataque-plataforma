BEGIN;

REFRESH MATERIALIZED VIEW mv_competitor_performance;
REFRESH MATERIALIZED VIEW mv_lead_rankings;
REFRESH MATERIALIZED VIEW mv_daily_acquisition;
REFRESH MATERIALIZED VIEW mv_campaign_performance;
REFRESH MATERIALIZED VIEW mv_engagement_effectiveness;
REFRESH MATERIALIZED VIEW mv_conversation_funnel;
REFRESH MATERIALIZED VIEW mv_content_performance;

COMMIT;
