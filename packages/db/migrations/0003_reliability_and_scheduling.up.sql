BEGIN;

CREATE TABLE IF NOT EXISTS canary_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  trace_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed')),
  latency_ms int NOT NULL,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE scheduled_publications
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
UPDATE scheduled_publications publication
SET account_id = (SELECT id FROM accounts WHERE role = 'actor' ORDER BY id LIMIT 1)
WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS canary_runs_pipeline_finished_idx
  ON canary_runs(pipeline, finished_at DESC);
CREATE INDEX IF NOT EXISTS scheduled_publications_due_idx
  ON scheduled_publications(account_id, scheduled_for) WHERE status IN ('scheduled', 'approved');
CREATE INDEX IF NOT EXISTS alerts_open_fingerprint_idx
  ON alerts(fingerprint, created_at DESC) WHERE resolved_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reciprocity_events_unique_kind_idx
  ON reciprocity_events(lead_id, account_id, reciprocal_kind);
CREATE INDEX IF NOT EXISTS worker_heartbeats_last_beat_idx
  ON worker_heartbeats(last_beat_at);
CREATE INDEX IF NOT EXISTS source_metrics_lookup_idx
  ON source_metrics(campaign_id, source_type, source_id, window_days, computed_at DESC);

UPDATE action_policies
SET hourly_limit = 5,
    daily_limit = 20,
    cooldown_seconds = 300,
    enabled = false,
    required_role = 'actor'
WHERE action_type = 'follow';

INSERT INTO crawl_schedule(
  source_type, source_id, campaign_id,
  current_interval_seconds, min_interval_seconds, max_interval_seconds, next_run_at
)
SELECT kind.source_type, competitor.id::text, campaign_competitor.campaign_id,
       kind.initial_seconds, kind.min_seconds, kind.max_seconds, now()
FROM campaign_competitors campaign_competitor
JOIN competitors competitor ON competitor.id = campaign_competitor.competitor_id
CROSS JOIN (VALUES
  ('follower', 86400, 21600, 604800),
  ('collab',   43200, 10800, 604800),
  ('live',      1800,   900,  21600)
) AS kind(source_type, initial_seconds, min_seconds, max_seconds)
WHERE campaign_competitor.status = 'active'
ON CONFLICT(source_type, source_id, campaign_id) DO NOTHING;

INSERT INTO crawl_schedule(
  source_type, source_id, campaign_id,
  current_interval_seconds, min_interval_seconds, max_interval_seconds, next_run_at
)
SELECT 'overlap', campaign.id::text, campaign.id, 21600, 3600, 86400, now()
FROM campaigns campaign WHERE campaign.status = 'active'
ON CONFLICT(source_type, source_id, campaign_id) DO NOTHING;

CREATE OR REPLACE FUNCTION seed_competitor_crawl_schedules() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO crawl_schedule(
    source_type, source_id, campaign_id,
    current_interval_seconds, min_interval_seconds, max_interval_seconds, next_run_at
  )
  SELECT kind.source_type, NEW.competitor_id::text, NEW.campaign_id,
         kind.initial_seconds, kind.min_seconds, kind.max_seconds, now()
  FROM (VALUES
    ('follower', 86400, 21600, 604800),
    ('collab',   43200, 10800, 604800),
    ('live',      1800,   900,  21600)
  ) AS kind(source_type, initial_seconds, min_seconds, max_seconds)
  ON CONFLICT(source_type, source_id, campaign_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS campaign_competitor_seed_schedules ON campaign_competitors;
CREATE TRIGGER campaign_competitor_seed_schedules
AFTER INSERT OR UPDATE OF status ON campaign_competitors
FOR EACH ROW WHEN (NEW.status = 'active')
EXECUTE FUNCTION seed_competitor_crawl_schedules();

CREATE MATERIALIZED VIEW mv_competitor_performance AS
SELECT competitor.id competitor_id, competitor.username,
       count(DISTINCT post.id) posts,
       count(DISTINCT comment.id) comments,
       count(DISTINCT source.lead_id) leads,
       count(DISTINCT conversion.id) conversions
FROM competitors competitor
LEFT JOIN posts post ON post.competitor_id = competitor.id
LEFT JOIN comments comment ON comment.post_id = post.id
LEFT JOIN lead_sources source ON source.competitor_id = competitor.id
LEFT JOIN conversion_events conversion ON conversion.lead_id = source.lead_id
GROUP BY competitor.id, competitor.username WITH NO DATA;

CREATE MATERIALIZED VIEW mv_lead_rankings AS
SELECT score.campaign_id, score.lead_id, lead.username_current, score.priority,
       score.base_score, score.intent_score, score.relationship_score,
       score.audience_overlap_score, score.final_score, score.computed_at
FROM lead_scores score JOIN leads lead ON lead.id = score.lead_id WITH NO DATA;

CREATE MATERIALIZED VIEW mv_daily_acquisition AS
WITH days AS (
  SELECT date_trunc('day', value)::date AS day FROM generate_series(now() - interval '90 days', now(), interval '1 day') value
), comments_by_day AS (SELECT collected_at::date AS day, count(*) comments FROM comments GROUP BY 1),
leads_by_day AS (SELECT first_seen_at::date AS day, count(*) leads FROM leads GROUP BY 1),
approved_by_day AS (SELECT updated_at::date AS day, count(*) approved FROM prospect_status WHERE status = 'approved' GROUP BY 1),
followed_by_day AS (SELECT completed_at::date AS day, count(*) followed FROM engagement_actions WHERE action_type = 'follow' AND status = 'done' GROUP BY 1),
engaged_by_day AS (SELECT at::date AS day, count(DISTINCT lead_id) engaged FROM lead_interactions WHERE direction = 'inbound' GROUP BY 1),
converted_by_day AS (SELECT at::date AS day, count(*) converted FROM conversion_events GROUP BY 1)
SELECT days.day, COALESCE(comments, 0) comments, COALESCE(leads, 0) leads,
       COALESCE(approved, 0) approved, COALESCE(followed, 0) followed,
       COALESCE(engaged, 0) engaged, COALESCE(converted, 0) converted
FROM days LEFT JOIN comments_by_day USING(day) LEFT JOIN leads_by_day USING(day)
LEFT JOIN approved_by_day USING(day) LEFT JOIN followed_by_day USING(day)
LEFT JOIN engaged_by_day USING(day) LEFT JOIN converted_by_day USING(day) WITH NO DATA;

CREATE MATERIALIZED VIEW mv_campaign_performance AS
SELECT campaign.id campaign_id, campaign.name,
       count(DISTINCT source.lead_id) leads,
       count(DISTINCT conversion.id) conversions,
       count(DISTINCT action.id) FILTER (WHERE action.status = 'done') completed_actions,
       count(DISTINCT recommendation.id) recommendations
FROM campaigns campaign
LEFT JOIN lead_sources source ON source.campaign_id = campaign.id
LEFT JOIN conversion_events conversion ON conversion.campaign_id = campaign.id
LEFT JOIN engagement_actions action ON action.campaign_id = campaign.id
LEFT JOIN nba_recommendations recommendation ON recommendation.campaign_id = campaign.id
GROUP BY campaign.id, campaign.name WITH NO DATA;

DROP MATERIALIZED VIEW IF EXISTS mv_engagement_effectiveness;
CREATE MATERIALIZED VIEW mv_engagement_effectiveness AS
SELECT action.campaign_id, action.action_type, count(*) actions,
       count(*) FILTER (WHERE action.status = 'done') successes,
       count(DISTINCT reciprocity.id)::numeric / NULLIF(count(*) FILTER (WHERE action.status = 'done'), 0) reciprocity_rate
FROM engagement_actions action
LEFT JOIN reciprocity_events reciprocity ON reciprocity.trigger_action_id = action.id
GROUP BY action.campaign_id, action.action_type WITH NO DATA;

CREATE MATERIALIZED VIEW mv_conversation_funnel AS
SELECT thread.account_id,
       count(DISTINCT draft.id) drafts,
       count(DISTINCT draft.id) FILTER (WHERE draft.status = 'sent') sent,
       count(DISTINCT message.id) FILTER (WHERE message.direction = 'inbound') replied,
       count(DISTINCT conversion.id) converted
FROM own_dm_threads thread
LEFT JOIN dm_drafts draft ON draft.thread_id = thread.id
LEFT JOIN own_dm_messages message ON message.thread_id = thread.id
LEFT JOIN leads lead ON lead.instagram_user_id = thread.participant_ig_user_id
LEFT JOIN conversion_events conversion ON conversion.lead_id = lead.id
GROUP BY thread.account_id WITH NO DATA;

CREATE MATERIALIZED VIEW mv_content_performance AS
SELECT media.account_id, media.id media_id, opportunity.id opportunity_id, opportunity.thesis,
       media.posted_at, media.insights,
       COALESCE((media.insights->>'reach')::numeric, 0) reach,
       COALESCE((media.insights->>'impressions')::numeric, 0) impressions
FROM own_media media
LEFT JOIN content_opportunities opportunity ON opportunity.id = media.content_opportunity_id WITH NO DATA;

COMMIT;
