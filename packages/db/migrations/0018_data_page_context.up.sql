ALTER TABLE scheduled_publications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns;

ALTER TABLE radar_findings
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns;

ALTER TABLE competitor_insights
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns;

ALTER TABLE content_suggestions
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns;

CREATE INDEX IF NOT EXISTS radar_findings_campaign_created_idx ON radar_findings(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS competitor_insights_campaign_created_idx ON competitor_insights(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_suggestions_campaign_created_idx ON content_suggestions(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scheduled_publications_campaign_scheduled_idx ON scheduled_publications(campaign_id, scheduled_for DESC);
