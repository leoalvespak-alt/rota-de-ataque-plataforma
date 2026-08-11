BEGIN;

ALTER TABLE generated_texts
  ADD COLUMN channel text CHECK(channel IN ('instagram','threads','email','whatsapp_dm','whatsapp_group')),
  ADD COLUMN content_item_id uuid REFERENCES content_items,
  ADD COLUMN variant_id uuid REFERENCES content_variants;
CREATE INDEX generated_texts_item_channel_idx ON generated_texts(content_item_id, channel) WHERE content_item_id IS NOT NULL;

ALTER TABLE repetition_alerts ADD COLUMN channel_a text, ADD COLUMN channel_b text;

CREATE TABLE content_performance (
  variant_id uuid PRIMARY KEY REFERENCES content_variants ON DELETE CASCADE,
  channel text NOT NULL CHECK(channel IN ('instagram','threads','email','whatsapp_dm','whatsapp_group')),
  impressions int NOT NULL DEFAULT 0,
  reach int NOT NULL DEFAULT 0,
  engagements int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  replies int NOT NULL DEFAULT 0,
  saves int NOT NULL DEFAULT 0,
  shares int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  window_days int NOT NULL DEFAULT 30 CHECK(window_days > 0),
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_performance_channel_computed_idx ON content_performance(channel, computed_at DESC);

CREATE MATERIALIZED VIEW mv_content_performance_by_thesis AS
SELECT item.campaign_id, item.thesis_id, performance.channel,
       count(*) variants,
       sum(performance.impressions) impressions,
       sum(performance.engagements) engagements,
       sum(performance.clicks) clicks,
       sum(performance.replies) replies,
       sum(performance.conversions) conversions,
       sum(performance.revenue) revenue,
       max(performance.computed_at) computed_at
FROM content_performance performance
JOIN content_variants variant ON variant.id = performance.variant_id
JOIN content_items item ON item.id = variant.content_item_id
GROUP BY item.campaign_id, item.thesis_id, performance.channel WITH NO DATA;
CREATE INDEX mv_content_performance_by_thesis_lookup_idx ON mv_content_performance_by_thesis(campaign_id, thesis_id, channel);

COMMIT;
