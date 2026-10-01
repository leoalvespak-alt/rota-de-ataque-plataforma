SELECT pg_advisory_xact_lock(742901366);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user AND rolsuper
  ) THEN
    RAISE EXCEPTION 'Editorial cutover requires a database superuser connection to isolate rollback archives';
  END IF;

  IF to_regclass('design.design_data_migrations') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM design.design_data_migrations
       WHERE version = 'design-data-2026-09-27-v1'
     ) THEN
    RAISE EXCEPTION 'Design transfer marker is missing; run and verify the transfer before this cutover';
  END IF;

  IF to_regclass('public.campaigns') IS NULL
     OR to_regclass('public.theses') IS NULL
     OR to_regclass('public.content_items') IS NULL
     OR to_regclass('public.content_variants') IS NULL
     OR to_regclass('public.content_publications') IS NULL
     OR to_regclass('public.scheduled_publications') IS NULL
     OR to_regclass('public.unified_creatives') IS NULL
     OR to_regclass('design.editorial_theses') IS NULL
     OR to_regclass('design.content_items') IS NULL
     OR to_regclass('design.unified_creatives') IS NULL THEN
    RAISE EXCEPTION 'Required source relations are missing; refusing partial cutover';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.scheduled_publications'::regclass
      AND contype = 'f'
      AND confrelid = 'public.content_variants'::regclass
      AND (array_length(conkey, 1) > 1 OR array_length(confkey, 1) > 1)
  ) THEN
    RAISE EXCEPTION 'Unexpected composite FK from scheduled_publications to content_variants';
  END IF;
END
$$;

CREATE TABLE pg_temp.cutover_archive_owners (
  source_relation text PRIMARY KEY,
  owner_name text NOT NULL,
  prospector_app_privileges text[] NOT NULL,
  prospector_reader_privileges text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.cutover_archive_owners(
  source_relation, owner_name, prospector_app_privileges, prospector_reader_privileges
)
SELECT source_relation,
       pg_get_userbyid(relation_row.relowner),
       ARRAY(
         SELECT privilege_name
         FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) privilege(privilege_name)
         WHERE has_table_privilege('prospector_app', source_relation, privilege_name)
       ),
       ARRAY(
         SELECT privilege_name
         FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) privilege(privilege_name)
         WHERE has_table_privilege('prospector_reader', source_relation, privilege_name)
       )
FROM (VALUES
  ('public.scheduled_publications'),
  ('public.content_variants'),
  ('design.editorial_theses'),
  ('design.content_items'),
  ('design.unified_creatives'),
  ('design.editorial_thesis_versions'),
  ('design.content_versions')
) AS source(source_relation)
JOIN pg_class relation_row ON relation_row.oid = to_regclass(source.source_relation);

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_temp.cutover_archive_owners) <> 7 THEN
    RAISE EXCEPTION 'Could not record ownership of all rollback archive relations';
  END IF;
END
$$;

-- The physical Prospector relations move with their OIDs, so existing foreign
-- keys continue to point at the same data while public compatibility views are
-- installed at the end of this migration.
ALTER TABLE public.campaigns SET SCHEMA editorial;
ALTER TABLE public.theses SET SCHEMA editorial;
ALTER TABLE public.content_items SET SCHEMA editorial;
ALTER TABLE public.unified_creatives SET SCHEMA editorial;
ALTER TABLE public.editorial_batches SET SCHEMA editorial;
ALTER TABLE public.thesis_revisions SET SCHEMA editorial;
ALTER TABLE public.content_item_revisions SET SCHEMA editorial;
ALTER TABLE public.content_assets SET SCHEMA editorial;
ALTER TABLE public.content_publications SET SCHEMA editorial;
ALTER TABLE public.task_runs SET SCHEMA editorial;
ALTER TABLE public.task_schedules SET SCHEMA editorial;

INSERT INTO editorial.shared_cutover_snapshots(source_relation, record_id, row_data)
SELECT 'public.theses', id, to_jsonb(source) FROM editorial.theses source
ON CONFLICT DO NOTHING;
INSERT INTO editorial.shared_cutover_snapshots(source_relation, record_id, row_data)
SELECT 'public.content_items', id, to_jsonb(source) FROM editorial.content_items source
ON CONFLICT DO NOTHING;
INSERT INTO editorial.shared_cutover_snapshots(source_relation, record_id, row_data)
SELECT 'public.unified_creatives', id, to_jsonb(source) FROM editorial.unified_creatives source
ON CONFLICT DO NOTHING;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.theses', id, id FROM editorial.theses
ON CONFLICT DO NOTHING;
INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.content_items', id, id FROM editorial.content_items
ON CONFLICT DO NOTHING;
INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.unified_creatives', id, id FROM editorial.unified_creatives
ON CONFLICT DO NOTHING;
INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.thesis_revisions', id, id FROM editorial.thesis_revisions
ON CONFLICT DO NOTHING;
INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.content_item_revisions', id, id FROM editorial.content_item_revisions
ON CONFLICT DO NOTHING;

ALTER TABLE public.scheduled_publications RENAME TO scheduled_publications_legacy;
ALTER TABLE public.scheduled_publications_legacy SET SCHEMA editorial;
ALTER TABLE public.content_variants RENAME TO content_variants_legacy;
ALTER TABLE public.content_variants_legacy SET SCHEMA editorial;

-- Design-owned editorial tables move into the shared editorial schema. The
-- overlapping thesis, content-item, creative, and version tables are merged
-- below, while their original rows remain in archive relations for rollback.
ALTER TABLE design.editorial_thesis_arguments SET SCHEMA editorial;
ALTER TABLE design.editorial_thesis_objections SET SCHEMA editorial;
ALTER TABLE design.editorial_thesis_examples SET SCHEMA editorial;
ALTER TABLE design.editorial_thesis_evidence SET SCHEMA editorial;
ALTER TABLE design.editorial_thesis_relations SET SCHEMA editorial;
ALTER TABLE design.knowledge_documents SET SCHEMA editorial;
ALTER TABLE design.knowledge_chunks SET SCHEMA editorial;
ALTER TABLE design.rag_embeddings SET SCHEMA editorial;
ALTER TABLE design.editorial_intents SET SCHEMA editorial;
ALTER TABLE design.editorial_angles SET SCHEMA editorial;
ALTER TABLE design.editorial_hooks SET SCHEMA editorial;
ALTER TABLE design.editorial_depth_levels SET SCHEMA editorial;
ALTER TABLE design.editorial_campaigns SET SCHEMA editorial;
ALTER TABLE design.editorial_plans SET SCHEMA editorial;
ALTER TABLE design.editorial_plan_items SET SCHEMA editorial;
ALTER TABLE design.content_briefs SET SCHEMA editorial;
ALTER TABLE design.content_reviews SET SCHEMA editorial;
ALTER TABLE design.content_similarity_scores SET SCHEMA editorial;
ALTER TABLE design.content_usage_ledger SET SCHEMA editorial;
ALTER TABLE design.generation_jobs SET SCHEMA editorial;
ALTER TABLE design.prompt_templates SET SCHEMA editorial;
ALTER TABLE design.prompt_versions SET SCHEMA editorial;

ALTER TABLE editorial.theses
  ADD COLUMN IF NOT EXISTS design_thesis_id uuid,
  ADD COLUMN IF NOT EXISTS design_slug text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS core_statement text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_text text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight numeric(8,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS depth_level text,
  ADD COLUMN IF NOT EXISTS audience_stage text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE editorial.thesis_revisions
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE editorial.content_items
  ADD COLUMN IF NOT EXISTS plan_item_id uuid,
  ADD COLUMN IF NOT EXISTS brief_id uuid,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS copy_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS render_id uuid,
  ADD COLUMN IF NOT EXISTS quality_score jsonb,
  ADD COLUMN IF NOT EXISTS similarity_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS generation_model text,
  ADD COLUMN IF NOT EXISTS generation_cost numeric(12,6),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE editorial.content_items
  ALTER COLUMN brand_voice_version SET DEFAULT 'editorial-v1';

ALTER TABLE editorial.content_item_revisions
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE editorial.unified_creatives
  ADD COLUMN IF NOT EXISTS content_opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS media_asset_ref text,
  ADD COLUMN IF NOT EXISTS media_ref text,
  ADD COLUMN IF NOT EXISTS ig_media_id text,
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS publication_variant_id uuid,
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS hashtags jsonb,
  ADD COLUMN IF NOT EXISTS publication_cta jsonb,
  ADD COLUMN IF NOT EXISTS pillar text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS content_structure jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS superseded_by uuid,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variant_status text,
  ADD COLUMN IF NOT EXISTS humanization_signature text,
  ADD COLUMN IF NOT EXISTS similarity_score numeric,
  ADD COLUMN IF NOT EXISTS generated_by text,
  ADD COLUMN IF NOT EXISTS external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variant_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS variant_timezone text,
  ADD COLUMN IF NOT EXISTS variant_origin text,
  ADD COLUMN IF NOT EXISTS variant_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS variant_locked_by text,
  ADD COLUMN IF NOT EXISTS variant_curation_status text,
  ADD COLUMN IF NOT EXISTS variant_superseded_by uuid;

UPDATE editorial.theses
SET status = CASE WHEN active THEN 'active' ELSE 'archived' END
WHERE status IS NULL OR status = 'active' AND NOT active OR status = 'archived' AND active;

CREATE UNIQUE INDEX IF NOT EXISTS theses_design_thesis_id_uidx
  ON editorial.theses(design_thesis_id) WHERE design_thesis_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS theses_design_slug_uidx
  ON editorial.theses(design_slug) WHERE design_slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unified_creatives_source_suggestion_uidx
  ON editorial.unified_creatives(source_suggestion_id) WHERE source_suggestion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unified_creatives_content_variant_uidx
  ON editorial.unified_creatives(content_item_id, channel, format);
CREATE UNIQUE INDEX IF NOT EXISTS unified_creatives_idempotency_uidx
  ON editorial.unified_creatives(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS unified_creatives_opportunity_idx
  ON editorial.unified_creatives(content_opportunity_id) WHERE content_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS unified_creatives_publication_variant_idx
  ON editorial.unified_creatives(publication_variant_id) WHERE publication_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_items_thesis_status_format_idx
  ON editorial.content_items(thesis_id, status, format);

CREATE TABLE pg_temp.cutover_thesis_map (
  design_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE,
  design_slug text NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF EXISTS (
    SELECT prospector_thesis_id
    FROM design.editorial_theses
    WHERE prospector_thesis_id IS NOT NULL
    GROUP BY prospector_thesis_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple Design theses map to one Prospector thesis';
  END IF;
  IF EXISTS (
    SELECT 1 FROM design.editorial_theses source
    LEFT JOIN editorial.theses target ON target.id = source.prospector_thesis_id
    WHERE source.prospector_thesis_id IS NOT NULL AND target.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A Design thesis points to a missing Prospector thesis';
  END IF;
END
$$;

INSERT INTO pg_temp.cutover_thesis_map(design_id, canonical_id, design_slug)
SELECT source.id,
       COALESCE(source.prospector_thesis_id,
         CASE WHEN target.id IS NULL THEN source.id ELSE gen_random_uuid() END),
       source.slug
FROM design.editorial_theses source
LEFT JOIN editorial.theses target ON target.id = source.id;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'design.editorial_theses', design_id, canonical_id
FROM pg_temp.cutover_thesis_map;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM editorial.unified_creatives creative
    WHERE creative.ed_thesis_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM editorial.legacy_editorial_ids mapping
        WHERE mapping.source_relation = 'design.editorial_theses'
          AND mapping.legacy_id = creative.ed_thesis_id
      )
  ) THEN
    RAISE EXCEPTION 'A Prospector creative points to an unmapped Design thesis';
  END IF;
END
$$;

UPDATE editorial.unified_creatives creative
SET thesis_id = COALESCE(creative.thesis_id, mapping.canonical_id),
    ed_thesis_id = NULL
FROM editorial.legacy_editorial_ids mapping
WHERE mapping.source_relation = 'design.editorial_theses'
  AND mapping.legacy_id = creative.ed_thesis_id;

INSERT INTO editorial.theses(
  id, campaign_id, slug, title, description, tenets, forbidden_angles,
  tone_guidelines, example_hooks, centroid_embedding, version, active, origin,
  design_thesis_id, design_slug, summary, core_statement, full_text, priority,
  weight, tone, depth_level, audience_stage, status, created_at, updated_at
)
SELECT map.canonical_id, NULL, source.slug, source.title,
       COALESCE(source.description, source.summary, ''),
       COALESCE(source.tenets, '[]'::jsonb), COALESCE(to_jsonb(source.forbidden_words), '[]'::jsonb),
       source.tone, '[]'::jsonb, NULL,
       COALESCE(source.version, 1), source.status = 'active', COALESCE(source.origin, 'design-import'),
       source.id, source.slug, source.summary, source.core_statement, source.full_text,
       COALESCE(source.priority, 0), COALESCE(source.weight, 1), source.tone,
       source.depth_level, source.audience_stage, COALESCE(source.status, 'draft'),
       COALESCE(source.created_at, now()), COALESCE(source.updated_at, now())
FROM design.editorial_theses source
JOIN pg_temp.cutover_thesis_map map ON map.design_id = source.id
LEFT JOIN editorial.theses existing ON existing.id = map.canonical_id
WHERE existing.id IS NULL;

UPDATE editorial.theses target
SET design_thesis_id = source.id,
    design_slug = source.slug,
    summary = COALESCE(NULLIF(target.summary, ''), source.summary),
    core_statement = COALESCE(NULLIF(target.core_statement, ''), source.core_statement, ''),
    full_text = COALESCE(target.full_text, source.full_text),
    priority = CASE WHEN target.priority = 0 THEN COALESCE(source.priority, 0) ELSE target.priority END,
    weight = CASE WHEN target.weight = 1 THEN COALESCE(source.weight, 1) ELSE target.weight END,
    tone = COALESCE(target.tone, source.tone),
    depth_level = COALESCE(target.depth_level, source.depth_level),
    audience_stage = COALESCE(target.audience_stage, source.audience_stage),
    updated_at = now()
FROM design.editorial_theses source
JOIN pg_temp.cutover_thesis_map map ON map.design_id = source.id
WHERE target.id = map.canonical_id;

CREATE TABLE pg_temp.cutover_content_item_map (
  design_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO pg_temp.cutover_content_item_map(design_id, canonical_id)
SELECT source.id,
       CASE WHEN existing.id IS NULL THEN source.id ELSE gen_random_uuid() END
FROM design.content_items source
LEFT JOIN editorial.content_items existing ON existing.id = source.id;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'design.content_items', design_id, canonical_id
FROM pg_temp.cutover_content_item_map;

INSERT INTO editorial.content_items(
  id, campaign_id, thesis_id, audience_segment, funnel_stage, objective, angle,
  hook, arguments, cta, intelligence_sources, brand_voice_version, status,
  created_by, approved_by, created_at, approved_at, frozen_at, parent_id,
  opportunity_id, content_version, origin, locked_at, locked_by, curation_status,
  superseded_by, batch_id, plan_item_id, brief_id, format, copy_data, template_id,
  render_id, quality_score, similarity_score, generation_model, generation_cost,
  version, updated_at
)
SELECT map.canonical_id, NULL, thesis_map.canonical_id, NULL, NULL, NULL,
       COALESCE(source.copy_data->>'angle', source.copy_data->>'coreArgument'),
       COALESCE(source.copy_data->>'hook', source.copy_data->>'headline'),
       COALESCE(source.copy_data->'arguments', '[]'::jsonb),
       COALESCE(source.copy_data->'cta', '{}'::jsonb), '[]'::jsonb,
       'design-import-v1',
       CASE WHEN source.status IN ('draft','approved','producing','published','archived','forked','ready_for_approval','needs_revision','generating','rejected')
            THEN source.status ELSE 'draft' END,
       NULL, NULL, COALESCE(source.created_at, now()), NULL, NULL, NULL, NULL,
       COALESCE(source.version, 1), 'design-import', NULL, NULL, NULL, NULL, NULL,
       source.plan_item_id, source.brief_id, source.format, source.copy_data,
       source.template_id, source.render_id, source.quality_score,
       source.similarity_score, source.generation_model, source.generation_cost,
       COALESCE(source.version, 1), COALESCE(source.updated_at, now())
FROM design.content_items source
JOIN pg_temp.cutover_content_item_map map ON map.design_id = source.id
LEFT JOIN pg_temp.cutover_thesis_map thesis_map ON thesis_map.design_id = source.thesis_id;

CREATE TABLE pg_temp.cutover_schedule_map (
  legacy_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE,
  matched_existing boolean NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM editorial.scheduled_publications_legacy schedule
    JOIN editorial.unified_creatives creative
      ON creative.title IS NOT DISTINCT FROM schedule.title
     AND creative.caption IS NOT DISTINCT FROM schedule.caption
     AND creative.channel IS NOT DISTINCT FROM schedule.channel
     AND creative.format IS NOT DISTINCT FROM schedule.format
     AND creative.scheduled_for IS NOT DISTINCT FROM schedule.scheduled_for
    GROUP BY schedule.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A legacy schedule row matches multiple unified creatives';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM editorial.scheduled_publications_legacy schedule
    JOIN editorial.unified_creatives creative
      ON creative.title IS NOT DISTINCT FROM schedule.title
     AND creative.caption IS NOT DISTINCT FROM schedule.caption
     AND creative.channel IS NOT DISTINCT FROM schedule.channel
     AND creative.format IS NOT DISTINCT FROM schedule.format
     AND creative.scheduled_for IS NOT DISTINCT FROM schedule.scheduled_for
    WHERE creative.campaign_id IS NOT NULL
      AND schedule.campaign_id IS NOT NULL
      AND creative.campaign_id <> schedule.campaign_id
  ) THEN
    RAISE EXCEPTION 'Matched schedule and creative rows have conflicting campaign IDs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM editorial.scheduled_publications_legacy schedule
    JOIN editorial.unified_creatives creative
      ON creative.title IS NOT DISTINCT FROM schedule.title
     AND creative.caption IS NOT DISTINCT FROM schedule.caption
     AND creative.channel IS NOT DISTINCT FROM schedule.channel
     AND creative.format IS NOT DISTINCT FROM schedule.format
     AND creative.scheduled_for IS NOT DISTINCT FROM schedule.scheduled_for
    WHERE creative.status IS DISTINCT FROM schedule.status
       OR creative.curation_status IS DISTINCT FROM schedule.curation_status
  ) THEN
    RAISE EXCEPTION 'Matched schedule and creative rows have conflicting workflow states';
  END IF;
END
$$;

INSERT INTO pg_temp.cutover_schedule_map(legacy_id, canonical_id, matched_existing)
SELECT schedule.id,
       COALESCE(creative.id,
         CASE WHEN occupied.id IS NULL THEN schedule.id ELSE gen_random_uuid() END),
       creative.id IS NOT NULL
FROM editorial.scheduled_publications_legacy schedule
LEFT JOIN editorial.unified_creatives creative
  ON creative.title IS NOT DISTINCT FROM schedule.title
 AND creative.caption IS NOT DISTINCT FROM schedule.caption
 AND creative.channel IS NOT DISTINCT FROM schedule.channel
 AND creative.format IS NOT DISTINCT FROM schedule.format
 AND creative.scheduled_for IS NOT DISTINCT FROM schedule.scheduled_for
LEFT JOIN editorial.unified_creatives occupied ON occupied.id = schedule.id;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.scheduled_publications', legacy_id, canonical_id
FROM pg_temp.cutover_schedule_map;

CREATE TABLE pg_temp.cutover_design_creative_map (
  design_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE,
  matched_existing boolean NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF EXISTS (
    SELECT source.id
    FROM design.unified_creatives source
    JOIN editorial.unified_creatives target
      ON (source.content_item_id IS NOT NULL
          AND target.content_item_id = source.content_item_id
          AND target.channel IS NOT DISTINCT FROM source.channel
          AND target.format IS NOT DISTINCT FROM source.format)
      OR (target.title IS NOT DISTINCT FROM source.title
          AND target.caption IS NOT DISTINCT FROM source.caption
          AND target.channel IS NOT DISTINCT FROM source.channel
          AND target.format IS NOT DISTINCT FROM source.format
          AND target.scheduled_for IS NOT DISTINCT FROM source.scheduled_for)
    GROUP BY source.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A Design creative matches multiple unified creatives';
  END IF;

  IF EXISTS (
    SELECT 1 FROM design.unified_creatives source
    JOIN pg_temp.cutover_thesis_map thesis_map ON thesis_map.design_id = source.ed_thesis_id
    WHERE source.thesis_id IS NOT NULL AND source.thesis_id <> thesis_map.canonical_id
  ) THEN
    RAISE EXCEPTION 'A Design creative has conflicting thesis references';
  END IF;
END
$$;

INSERT INTO pg_temp.cutover_design_creative_map(design_id, canonical_id, matched_existing)
SELECT source.id,
       COALESCE(match.creative_id,
         CASE WHEN occupied.id IS NULL THEN source.id ELSE gen_random_uuid() END),
       match.creative_id IS NOT NULL
FROM design.unified_creatives source
LEFT JOIN LATERAL (
  SELECT target.id AS creative_id
  FROM editorial.unified_creatives target
  WHERE (source.content_item_id IS NOT NULL
         AND target.content_item_id = source.content_item_id
         AND target.channel IS NOT DISTINCT FROM source.channel
         AND target.format IS NOT DISTINCT FROM source.format)
     OR (target.title IS NOT DISTINCT FROM source.title
         AND target.caption IS NOT DISTINCT FROM source.caption
         AND target.channel IS NOT DISTINCT FROM source.channel
         AND target.format IS NOT DISTINCT FROM source.format
         AND target.scheduled_for IS NOT DISTINCT FROM source.scheduled_for)
  ORDER BY target.id
  LIMIT 1
) match ON true
LEFT JOIN editorial.unified_creatives occupied ON occupied.id = source.id;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'design.unified_creatives', design_id, canonical_id
FROM pg_temp.cutover_design_creative_map;

UPDATE editorial.unified_creatives target
SET thesis_id = COALESCE(target.thesis_id, thesis_map.canonical_id),
    plan_item_id = COALESCE(target.plan_item_id, source.plan_item_id),
    content_item_id = COALESCE(target.content_item_id, content_map.canonical_id),
    title = COALESCE(target.title, source.title),
    caption = COALESCE(target.caption, source.caption),
    channel = COALESCE(target.channel, source.channel),
    format = COALESCE(target.format, source.format),
    status = COALESCE(source.status, target.status),
    curation_status = COALESCE(target.curation_status, source.curation_status),
    scheduled_for = COALESCE(target.scheduled_for, source.scheduled_for),
    published_at = COALESCE(target.published_at, source.published_at),
    approved_by = COALESCE(target.approved_by, source.approved_by),
    origin = COALESCE(target.origin, source.origin),
    batch_id = COALESCE(target.batch_id, source.batch_id),
    copy_data = CASE WHEN target.copy_data IS NULL OR target.copy_data = '{}'::jsonb THEN COALESCE(source.copy_data, '{}'::jsonb) ELSE target.copy_data END,
    visual_direction = COALESCE(target.visual_direction, source.visual_direction),
    template_id = COALESCE(target.template_id, source.template_id),
    render_id = COALESCE(target.render_id, source.render_id),
    quality_score = COALESCE(target.quality_score, source.quality_score),
    hook_strategy = COALESCE(target.hook_strategy, source.hook_strategy),
    depth_level = COALESCE(target.depth_level, source.depth_level),
    audience_stage = COALESCE(target.audience_stage, source.audience_stage),
    cta = COALESCE(target.cta, source.cta),
    sequence_position = COALESCE(target.sequence_position, source.sequence_position),
    ed_thesis_id = NULL,
    updated_at = now()
FROM design.unified_creatives source
JOIN pg_temp.cutover_design_creative_map map ON map.design_id = source.id AND map.matched_existing
LEFT JOIN pg_temp.cutover_thesis_map thesis_map ON thesis_map.design_id = source.ed_thesis_id
LEFT JOIN pg_temp.cutover_content_item_map content_map ON content_map.design_id = source.content_item_id
WHERE target.id = map.canonical_id;

INSERT INTO editorial.unified_creatives(
  id, thesis_id, plan_item_id, content_item_id, title, caption,
  channel, format, status, curation_status, scheduled_for, published_at,
  approved_by, origin, batch_id, copy_data, visual_direction, template_id,
  render_id, quality_score, hook_strategy, depth_level, audience_stage, cta,
  sequence_position, created_at, updated_at
)
SELECT map.canonical_id, COALESCE(source.thesis_id, thesis_map.canonical_id),
       source.plan_item_id, content_map.canonical_id,
       source.title, source.caption, source.channel, source.format,
       COALESCE(source.status, 'draft'), source.curation_status,
       source.scheduled_for, source.published_at, source.approved_by,
       source.origin, source.batch_id, COALESCE(source.copy_data, '{}'::jsonb),
       source.visual_direction, source.template_id, source.render_id,
       source.quality_score, source.hook_strategy, source.depth_level,
       source.audience_stage, source.cta, source.sequence_position,
       COALESCE(source.created_at, now()), COALESCE(source.updated_at, now())
FROM design.unified_creatives source
JOIN pg_temp.cutover_design_creative_map map ON map.design_id = source.id AND NOT map.matched_existing
LEFT JOIN pg_temp.cutover_thesis_map thesis_map ON thesis_map.design_id = source.ed_thesis_id
LEFT JOIN pg_temp.cutover_content_item_map content_map ON content_map.design_id = source.content_item_id;

CREATE TABLE pg_temp.cutover_variant_map (
  legacy_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE,
  matched_existing boolean NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM editorial.content_variants_legacy variant
    JOIN editorial.unified_creatives creative
      ON creative.content_item_id = variant.content_item_id
     AND creative.channel = variant.channel
     AND creative.format = variant.format
    GROUP BY variant.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A content variant matches multiple unified creatives';
  END IF;
END
$$;

INSERT INTO pg_temp.cutover_variant_map(legacy_id, canonical_id, matched_existing)
SELECT variant.id,
       COALESCE(match.creative_id,
         CASE WHEN occupied.id IS NULL THEN variant.id ELSE gen_random_uuid() END),
       match.creative_id IS NOT NULL
FROM editorial.content_variants_legacy variant
LEFT JOIN LATERAL (
  SELECT creative.id AS creative_id
  FROM editorial.unified_creatives creative
  WHERE creative.content_item_id = variant.content_item_id
    AND creative.channel = variant.channel
    AND creative.format = variant.format
  ORDER BY creative.id
  LIMIT 1
) match ON true
LEFT JOIN editorial.unified_creatives occupied ON occupied.id = variant.id;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'public.content_variants', legacy_id, canonical_id
FROM pg_temp.cutover_variant_map;

UPDATE editorial.unified_creatives creative
SET payload = COALESCE(variant.payload, '{}'::jsonb),
    variant_status = variant.status,
    humanization_signature = variant.humanization_signature,
    similarity_score = variant.similarity_score,
    generated_by = variant.generated_by,
    external_ref = COALESCE(variant.external_ref, '{}'::jsonb),
    variant_scheduled_for = variant.scheduled_for,
    variant_timezone = variant.timezone,
    variant_origin = variant.origin,
    variant_locked_at = variant.locked_at,
    variant_locked_by = variant.locked_by,
    variant_curation_status = variant.curation_status,
    variant_superseded_by = variant.superseded_by,
    approved_by = COALESCE(creative.approved_by, variant.approved_by),
    published_at = COALESCE(creative.published_at, variant.published_at),
    updated_at = now()
FROM editorial.content_variants_legacy variant
JOIN pg_temp.cutover_variant_map map ON map.legacy_id = variant.id AND map.matched_existing
WHERE creative.id = map.canonical_id;

INSERT INTO editorial.unified_creatives(
  id, content_item_id, channel, format, status, variant_status, payload,
  humanization_signature, similarity_score, generated_by, external_ref,
  variant_scheduled_for, variant_timezone, variant_origin, variant_locked_at,
  variant_locked_by, variant_curation_status, variant_superseded_by,
  approved_by, published_at, created_at, updated_at
)
SELECT map.canonical_id, variant.content_item_id, variant.channel, variant.format,
       COALESCE(variant.status, 'draft'), variant.status,
       COALESCE(variant.payload, '{}'::jsonb), variant.humanization_signature,
       variant.similarity_score, variant.generated_by,
       COALESCE(variant.external_ref, '{}'::jsonb), variant.scheduled_for,
       variant.timezone, variant.origin, variant.locked_at, variant.locked_by,
       variant.curation_status, variant.superseded_by, variant.approved_by,
       variant.published_at, COALESCE(variant.created_at, now()),
       COALESCE(variant.updated_at, now())
FROM editorial.content_variants_legacy variant
JOIN pg_temp.cutover_variant_map map ON map.legacy_id = variant.id AND NOT map.matched_existing;

UPDATE editorial.unified_creatives creative
SET campaign_id = COALESCE(creative.campaign_id, schedule.campaign_id),
    content_opportunity_id = COALESCE(creative.content_opportunity_id, schedule.content_opportunity_id),
    media_asset_ref = COALESCE(creative.media_asset_ref, schedule.media_asset_ref),
    media_ref = COALESCE(creative.media_ref, schedule.media_ref),
    ig_media_id = COALESCE(creative.ig_media_id, schedule.ig_media_id),
    account_id = COALESCE(creative.account_id, schedule.account_id),
    correlation_id = COALESCE(creative.correlation_id, schedule.correlation_id),
    subtype = COALESCE(creative.subtype, schedule.subtype),
    hashtags = COALESCE(creative.hashtags, schedule.hashtags),
    publication_cta = COALESCE(creative.publication_cta, schedule.cta),
    pillar = COALESCE(creative.pillar, schedule.pillar),
    timezone = COALESCE(creative.timezone, schedule.timezone),
    recurrence_rule = COALESCE(creative.recurrence_rule, schedule.recurrence_rule),
    content_structure = COALESCE(creative.content_structure, schedule.content_structure),
    idempotency_key = COALESCE(creative.idempotency_key, schedule.idempotency_key),
    locked_by = COALESCE(creative.locked_by, schedule.locked_by),
    error = COALESCE(creative.error, schedule.error),
    publication_variant_id = COALESCE(variant_map.canonical_id, creative.publication_variant_id),
    superseded_by = COALESCE(successor_map.canonical_id, creative.superseded_by),
    copy_data = CASE
      WHEN creative.copy_data IS NULL OR creative.copy_data = '{}'::jsonb
        THEN COALESCE(schedule.content_structure, '{}'::jsonb)
      ELSE creative.copy_data
    END,
    updated_at = now()
FROM editorial.scheduled_publications_legacy schedule
JOIN pg_temp.cutover_schedule_map schedule_map ON schedule_map.legacy_id = schedule.id
LEFT JOIN pg_temp.cutover_variant_map variant_map ON variant_map.legacy_id = schedule.variant_id
LEFT JOIN pg_temp.cutover_schedule_map successor_map ON successor_map.legacy_id = schedule.superseded_by
WHERE creative.id = schedule_map.canonical_id;

INSERT INTO editorial.unified_creatives(
  id, content_opportunity_id, media_asset_ref, caption, scheduled_for, status,
  ig_media_id, error, account_id, approved_by, published_at,
  publication_variant_id, channel, correlation_id, origin, locked_at, locked_by,
  curation_status, superseded_by, subtype, hashtags, media_ref, publication_cta,
  pillar, format, timezone, recurrence_rule, batch_id, title, campaign_id,
  content_structure, idempotency_key, thesis_id, copy_data
)
SELECT schedule_map.canonical_id, schedule.content_opportunity_id,
       schedule.media_asset_ref, schedule.caption, schedule.scheduled_for,
       schedule.status, schedule.ig_media_id, schedule.error, schedule.account_id,
       schedule.approved_by, schedule.published_at, variant_map.canonical_id,
       schedule.channel, schedule.correlation_id, COALESCE(schedule.origin, 'prospector'),
       schedule.locked_at, schedule.locked_by, schedule.curation_status,
       successor_map.canonical_id, schedule.subtype, schedule.hashtags,
       schedule.media_ref, schedule.cta, schedule.pillar, schedule.format,
       schedule.timezone, schedule.recurrence_rule, schedule.batch_id,
       schedule.title, schedule.campaign_id, schedule.content_structure,
       schedule.idempotency_key, schedule.thesis_id,
       COALESCE(schedule.content_structure, '{}'::jsonb)
FROM editorial.scheduled_publications_legacy schedule
JOIN pg_temp.cutover_schedule_map schedule_map ON schedule_map.legacy_id = schedule.id AND NOT schedule_map.matched_existing
LEFT JOIN pg_temp.cutover_variant_map variant_map ON variant_map.legacy_id = schedule.variant_id
LEFT JOIN pg_temp.cutover_schedule_map successor_map ON successor_map.legacy_id = schedule.superseded_by;

CREATE FUNCTION pg_temp.retarget_editorial_foreign_keys(
  p_source_parent regclass,
  p_target_parent regclass,
  p_source_relation_name text,
  p_child_schema text DEFAULT NULL,
  p_skipped_child text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  fk record;
  child_column text;
  parent_column text;
  delete_action text;
  update_action text;
  match_action text;
  missing_count bigint;
  add_suffix text;
BEGIN
  FOR fk IN
    SELECT constraint_row.*,
           child_namespace.nspname AS child_schema,
           child_relation.relname AS child_name,
           array_length(constraint_row.conkey, 1) AS child_key_count,
           array_length(constraint_row.confkey, 1) AS parent_key_count
    FROM pg_constraint constraint_row
    JOIN pg_class child_relation ON child_relation.oid = constraint_row.conrelid
    JOIN pg_namespace child_namespace ON child_namespace.oid = child_relation.relnamespace
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = p_source_parent
      AND (p_child_schema IS NULL OR child_namespace.nspname = p_child_schema)
      AND (p_skipped_child IS NULL OR constraint_row.conrelid::regclass::text <> p_skipped_child)
    ORDER BY constraint_row.conrelid, constraint_row.conname
  LOOP
    IF fk.child_key_count <> 1 OR fk.parent_key_count <> 1 THEN
      RAISE EXCEPTION 'Composite foreign key %.% requires manual mapping', fk.child_name, fk.conname;
    END IF;

    SELECT attribute.attname INTO child_column
    FROM pg_attribute attribute
    WHERE attribute.attrelid = fk.conrelid AND attribute.attnum = fk.conkey[1];
    SELECT attribute.attname INTO parent_column
    FROM pg_attribute attribute
    WHERE attribute.attrelid = fk.confrelid AND attribute.attnum = fk.confkey[1];
    IF parent_column <> 'id' THEN
      RAISE EXCEPTION 'Foreign key %.% points to a non-id column', fk.child_name, fk.conname;
    END IF;

    INSERT INTO editorial.legacy_editorial_foreign_keys(
      source_relation, child_relation, child_relation_oid, constraint_name, child_columns,
      parent_columns, delete_action, update_action, match_type,
      is_deferrable, is_initially_deferred, was_validated
    ) VALUES (
      p_source_relation_name, fk.conrelid::regclass::text, fk.conrelid, fk.conname,
      fk.conkey, fk.confkey, fk.confdeltype, fk.confupdtype, fk.confmatchtype,
      fk.condeferrable, fk.condeferred, fk.convalidated
    ) ON CONFLICT DO NOTHING;

    EXECUTE format(
      'SELECT count(*) FROM %s AS child WHERE child.%I IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM editorial.legacy_editorial_ids mapping
         WHERE mapping.source_relation = $1 AND mapping.legacy_id = child.%I
       )',
      fk.conrelid::regclass, child_column, child_column
    ) INTO missing_count USING p_source_relation_name;
    IF missing_count > 0 THEN
      RAISE EXCEPTION 'Foreign key %.% contains % unmapped IDs', fk.child_name, fk.conname, missing_count;
    END IF;

    EXECUTE format(
      'UPDATE %s AS child SET %I = mapping.canonical_id
       FROM editorial.legacy_editorial_ids mapping
       WHERE mapping.source_relation = $1 AND mapping.legacy_id = child.%I',
      fk.conrelid::regclass, child_column, child_column
    ) USING p_source_relation_name;

    delete_action := CASE fk.confdeltype
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END;
    update_action := CASE fk.confupdtype
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END;
    match_action := CASE fk.confmatchtype
      WHEN 's' THEN 'SIMPLE' WHEN 'f' THEN 'FULL' WHEN 'p' THEN 'PARTIAL' END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.conrelid::regclass, fk.conname);
    add_suffix := CASE
      WHEN fk.condeferrable AND fk.condeferred THEN ' DEFERRABLE INITIALLY DEFERRED'
      WHEN fk.condeferrable THEN ' DEFERRABLE INITIALLY IMMEDIATE'
      ELSE ' NOT DEFERRABLE'
    END;
    IF NOT fk.convalidated THEN add_suffix := add_suffix || ' NOT VALID'; END IF;
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s (%I) MATCH %s ON UPDATE %s ON DELETE %s%s',
      fk.conrelid::regclass, fk.conname, child_column, p_target_parent,
      parent_column, match_action, update_action, delete_action, add_suffix
    );
  END LOOP;
END
$$;

SELECT pg_temp.retarget_editorial_foreign_keys(
  'design.editorial_theses'::regclass, 'editorial.theses'::regclass,
  'design.editorial_theses', 'editorial'
);
SELECT pg_temp.retarget_editorial_foreign_keys(
  'design.content_items'::regclass, 'editorial.content_items'::regclass,
  'design.content_items', 'editorial'
);
SELECT pg_temp.retarget_editorial_foreign_keys(
  'editorial.scheduled_publications_legacy'::regclass, 'editorial.unified_creatives'::regclass,
  'public.scheduled_publications', NULL, 'editorial.scheduled_publications_legacy'
);
SELECT pg_temp.retarget_editorial_foreign_keys(
  'editorial.content_variants_legacy'::regclass, 'editorial.unified_creatives'::regclass,
  'public.content_variants', NULL, 'editorial.content_variants_legacy'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM design.editorial_thesis_versions source
    JOIN pg_temp.cutover_thesis_map map ON map.design_id = source.thesis_id
    JOIN editorial.thesis_revisions target
      ON target.thesis_id = map.canonical_id AND target.version = source.version
    WHERE target.snapshot IS DISTINCT FROM source.snapshot
  ) THEN
    RAISE EXCEPTION 'Design and Prospector thesis revision histories conflict';
  END IF;

  IF EXISTS (
    SELECT 1 FROM design.content_versions source
    JOIN pg_temp.cutover_content_item_map map ON map.design_id = source.content_item_id
    JOIN editorial.content_item_revisions target
      ON target.content_item_id = map.canonical_id AND target.revision = source.version
    WHERE target.snapshot IS DISTINCT FROM jsonb_build_object(
      'copy_data', source.copy_data, 'template_id', source.template_id, 'version', source.version
    )
  ) THEN
    RAISE EXCEPTION 'Design and Prospector content revision histories conflict';
  END IF;
END
$$;

CREATE TABLE pg_temp.cutover_thesis_revision_map (
  design_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE,
  matched_existing boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.cutover_thesis_revision_map(design_id, canonical_id, matched_existing)
SELECT source.id,
       COALESCE(existing.id,
         CASE WHEN occupied.id IS NULL THEN source.id ELSE gen_random_uuid() END),
       existing.id IS NOT NULL
FROM design.editorial_thesis_versions source
JOIN pg_temp.cutover_thesis_map thesis_map ON thesis_map.design_id = source.thesis_id
LEFT JOIN editorial.thesis_revisions existing
  ON existing.thesis_id = thesis_map.canonical_id AND existing.version = source.version
LEFT JOIN editorial.thesis_revisions occupied ON occupied.id = source.id;

CREATE TABLE pg_temp.cutover_content_revision_map (
  design_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL UNIQUE,
  matched_existing boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.cutover_content_revision_map(design_id, canonical_id, matched_existing)
SELECT source.id,
       COALESCE(existing.id,
         CASE WHEN occupied.id IS NULL THEN source.id ELSE gen_random_uuid() END),
       existing.id IS NOT NULL
FROM design.content_versions source
JOIN pg_temp.cutover_content_item_map item_map ON item_map.design_id = source.content_item_id
LEFT JOIN editorial.content_item_revisions existing
  ON existing.content_item_id = item_map.canonical_id AND existing.revision = source.version
LEFT JOIN editorial.content_item_revisions occupied ON occupied.id = source.id;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'design.editorial_thesis_versions', design_id, canonical_id
FROM design.editorial_thesis_versions source
JOIN pg_temp.cutover_thesis_revision_map mapping ON mapping.design_id = source.id
ON CONFLICT DO NOTHING;

INSERT INTO editorial.legacy_editorial_ids(source_relation, legacy_id, canonical_id)
SELECT 'design.content_versions', design_id, canonical_id
FROM design.content_versions source
JOIN pg_temp.cutover_content_revision_map mapping ON mapping.design_id = source.id
ON CONFLICT DO NOTHING;

INSERT INTO editorial.thesis_revisions(id, thesis_id, version, snapshot, changed_by, change_reason, created_at)
SELECT revision_map.canonical_id, thesis_map.canonical_id, source.version, source.snapshot,
       source.changed_by, source.change_reason, source.created_at
FROM design.editorial_thesis_versions source
JOIN pg_temp.cutover_thesis_map thesis_map ON thesis_map.design_id = source.thesis_id
JOIN pg_temp.cutover_thesis_revision_map revision_map ON revision_map.design_id = source.id
WHERE NOT revision_map.matched_existing;

INSERT INTO editorial.content_item_revisions(
  id, content_item_id, revision, snapshot, changed_by, created_at,
  template_id, change_reason
)
SELECT revision_map.canonical_id, item_map.canonical_id, source.version,
       jsonb_build_object('copy_data', source.copy_data, 'template_id', source.template_id, 'version', source.version),
       NULL, source.created_at, source.template_id, source.change_reason
FROM design.content_versions source
JOIN pg_temp.cutover_content_item_map item_map ON item_map.design_id = source.content_item_id
JOIN pg_temp.cutover_content_revision_map revision_map ON revision_map.design_id = source.id
WHERE NOT revision_map.matched_existing;

UPDATE editorial.content_items item
SET version = GREATEST(
      COALESCE(item.version, 1), COALESCE(item.content_version, 1),
      COALESCE((SELECT max(revision) FROM editorial.content_item_revisions revision WHERE revision.content_item_id = item.id), 1)
    ),
    content_version = GREATEST(
      COALESCE(item.version, 1), COALESCE(item.content_version, 1),
      COALESCE((SELECT max(revision) FROM editorial.content_item_revisions revision WHERE revision.content_item_id = item.id), 1)
    );

INSERT INTO editorial.content_item_revisions(content_item_id, revision, snapshot, changed_by, template_id)
SELECT item.id, item.version, to_jsonb(item), item.created_by, item.template_id
FROM editorial.content_items item
WHERE NOT EXISTS (
  SELECT 1 FROM editorial.content_item_revisions revision
  WHERE revision.content_item_id = item.id AND revision.revision = item.version
)
ON CONFLICT (content_item_id, revision) DO NOTHING;

ALTER TABLE design.editorial_theses RENAME TO editorial_theses_legacy;
ALTER TABLE design.content_items RENAME TO content_items_legacy;
ALTER TABLE design.unified_creatives RENAME TO unified_creatives_legacy;
ALTER TABLE design.editorial_thesis_versions RENAME TO editorial_thesis_versions_legacy;
ALTER TABLE design.content_versions RENAME TO content_versions_legacy;

UPDATE editorial.unified_creatives creative
SET variant_superseded_by = mapping.canonical_id
FROM editorial.legacy_editorial_ids mapping
WHERE mapping.source_relation = 'public.content_variants'
  AND mapping.legacy_id = creative.variant_superseded_by;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM editorial.scheduled_publications_legacy schedule
    WHERE schedule.variant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM editorial.legacy_editorial_ids mapping
        WHERE mapping.source_relation = 'public.content_variants'
          AND mapping.legacy_id = schedule.variant_id
      )
  ) THEN
    RAISE EXCEPTION 'A scheduled publication references an unmapped content variant';
  END IF;
END
$$;

DO $$
DECLARE
  constraint_row record;
BEGIN
  CREATE TABLE pg_temp.cutover_content_item_checks (
    constraint_name text NOT NULL,
    definition text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO pg_temp.cutover_content_item_checks(constraint_name, definition)
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'editorial.content_items'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'editorial.content_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE editorial.content_items DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END
$$;

ALTER TABLE editorial.content_items
  ADD CONSTRAINT content_items_shared_status_check
  CHECK (status IN ('draft','ready_for_approval','approved','producing','published','archived','forked','needs_revision','generating','rejected'));

CREATE OR REPLACE FUNCTION editorial.sync_thesis_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL OR NEW.status = '' THEN
      NEW.status := CASE WHEN NEW.active THEN 'active' ELSE 'archived' END;
    END IF;
    IF NEW.status <> 'active' THEN
      NEW.active := false;
    ELSIF NOT NEW.active THEN
      NEW.status := 'archived';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.active IS NOT DISTINCT FROM OLD.active THEN
    NEW.active := NEW.status = 'active';
  ELSIF NEW.active IS DISTINCT FROM OLD.active AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.status := CASE WHEN NEW.active THEN 'active' ELSE 'archived' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.active IS DISTINCT FROM OLD.active
        AND NEW.active IS DISTINCT FROM (NEW.status = 'active') THEN
    RAISE EXCEPTION 'Thesis status and active state must agree';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS shared_thesis_state_sync ON editorial.theses;
CREATE TRIGGER shared_thesis_state_sync
BEFORE INSERT OR UPDATE OF status, active ON editorial.theses
FOR EACH ROW EXECUTE FUNCTION editorial.sync_thesis_state();

CREATE OR REPLACE FUNCTION editorial.sync_content_item_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := GREATEST(COALESCE(NEW.version, 1), COALESCE(NEW.content_version, 1));
    NEW.content_version := NEW.version;
    NEW.updated_at := COALESCE(NEW.updated_at, now());
    RETURN NEW;
  END IF;

  changed := (to_jsonb(NEW) - ARRAY['updated_at','version','content_version'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at','version','content_version']);
  IF changed THEN
    NEW.version := GREATEST(COALESCE(OLD.version, 1), COALESCE(OLD.content_version, 1)) + 1;
    NEW.content_version := NEW.version;
    NEW.updated_at := now();
  ELSE
    NEW.version := OLD.version;
    NEW.content_version := OLD.content_version;
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION editorial.record_content_item_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO editorial.content_item_revisions(
    content_item_id, revision, snapshot, changed_by, template_id, change_reason
  ) VALUES (
    NEW.id, NEW.version, to_jsonb(NEW),
    COALESCE(NULLIF(current_setting('app.actor_email', true), ''), NEW.created_by),
    NEW.template_id, NULLIF(current_setting('app.change_reason', true), '')
  ) ON CONFLICT (content_item_id, revision) DO NOTHING;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS shared_content_item_version_sync ON editorial.content_items;
CREATE TRIGGER shared_content_item_version_sync
BEFORE INSERT OR UPDATE ON editorial.content_items
FOR EACH ROW EXECUTE FUNCTION editorial.sync_content_item_version();

DROP TRIGGER IF EXISTS shared_content_item_revision_insert ON editorial.content_items;
CREATE TRIGGER shared_content_item_revision_insert
AFTER INSERT ON editorial.content_items
FOR EACH ROW EXECUTE FUNCTION editorial.record_content_item_revision();

DROP TRIGGER IF EXISTS shared_content_item_revision_update ON editorial.content_items;
CREATE TRIGGER shared_content_item_revision_update
AFTER UPDATE ON editorial.content_items
FOR EACH ROW WHEN (NEW.version IS DISTINCT FROM OLD.version)
EXECUTE FUNCTION editorial.record_content_item_revision();

ALTER TABLE editorial.unified_creatives
  ADD CONSTRAINT unified_creatives_thesis_shared_fk
    FOREIGN KEY (thesis_id) REFERENCES editorial.theses(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_content_item_shared_fk
    FOREIGN KEY (content_item_id) REFERENCES editorial.content_items(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_plan_item_shared_fk
    FOREIGN KEY (plan_item_id) REFERENCES editorial.editorial_plan_items(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_campaign_shared_fk
    FOREIGN KEY (campaign_id) REFERENCES editorial.campaigns(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_opportunity_shared_fk
    FOREIGN KEY (content_opportunity_id) REFERENCES public.content_opportunities(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_account_shared_fk
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_publication_variant_shared_fk
    FOREIGN KEY (publication_variant_id) REFERENCES editorial.unified_creatives(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_superseded_shared_fk
    FOREIGN KEY (superseded_by) REFERENCES editorial.unified_creatives(id) ON DELETE SET NULL,
  ADD CONSTRAINT unified_creatives_variant_superseded_shared_fk
    FOREIGN KEY (variant_superseded_by) REFERENCES editorial.unified_creatives(id) ON DELETE SET NULL;

ALTER TABLE editorial.content_items
  ADD CONSTRAINT content_items_plan_item_shared_fk
    FOREIGN KEY (plan_item_id) REFERENCES editorial.editorial_plan_items(id) ON DELETE SET NULL,
  ADD CONSTRAINT content_items_brief_shared_fk
    FOREIGN KEY (brief_id) REFERENCES editorial.content_briefs(id) ON DELETE SET NULL;

CREATE VIEW public.campaigns AS SELECT * FROM editorial.campaigns;
CREATE VIEW public.theses AS SELECT * FROM editorial.theses;
CREATE VIEW public.content_items AS SELECT * FROM editorial.content_items;
CREATE VIEW public.content_variants AS
  SELECT id, content_item_id, channel, format, payload, humanization_signature,
         similarity_score, generated_by, variant_status AS status, approved_by,
         published_at, external_ref, variant_scheduled_for AS scheduled_for,
         variant_timezone AS timezone, variant_origin AS origin,
         variant_locked_at AS locked_at, variant_locked_by AS locked_by,
         variant_curation_status AS curation_status,
         variant_superseded_by AS superseded_by, created_at, updated_at
  FROM editorial.unified_creatives
  WHERE content_item_id IS NOT NULL AND payload IS NOT NULL
  WITH LOCAL CHECK OPTION;
CREATE VIEW public.content_publications AS SELECT * FROM editorial.content_publications;
CREATE VIEW public.content_assets AS SELECT * FROM editorial.content_assets;
CREATE VIEW public.content_item_revisions AS SELECT * FROM editorial.content_item_revisions;
CREATE VIEW public.thesis_revisions AS SELECT * FROM editorial.thesis_revisions;
CREATE VIEW public.editorial_batches AS SELECT * FROM editorial.editorial_batches;
CREATE VIEW public.task_runs AS SELECT * FROM editorial.task_runs;
CREATE VIEW public.task_schedules AS SELECT * FROM editorial.task_schedules;
CREATE VIEW public.unified_creatives AS SELECT * FROM editorial.unified_creatives;
CREATE VIEW public.scheduled_publications AS
  SELECT id, content_opportunity_id, media_asset_ref, caption, scheduled_for,
         status, ig_media_id, error, account_id, approved_by, published_at,
         publication_variant_id AS variant_id, channel, correlation_id, origin,
         locked_at, locked_by, curation_status, superseded_by, subtype, hashtags,
         media_ref, publication_cta AS cta, pillar, format, timezone,
         recurrence_rule, batch_id, title, campaign_id, content_structure,
         idempotency_key
  FROM editorial.unified_creatives;

CREATE VIEW design.content_items AS SELECT * FROM editorial.content_items;
CREATE VIEW design.unified_creatives AS SELECT * FROM editorial.unified_creatives;

GRANT USAGE ON SCHEMA editorial, design TO prospector_app, prospector_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA editorial, design TO prospector_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA editorial, design TO prospector_app;
GRANT SELECT ON ALL TABLES IN SCHEMA editorial, design TO prospector_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns, public.theses,
  public.content_items, public.content_variants, public.content_publications,
  public.content_assets, public.content_item_revisions, public.thesis_revisions,
  public.editorial_batches, public.task_runs, public.task_schedules,
  public.unified_creatives, public.scheduled_publications TO prospector_app;
GRANT SELECT ON public.campaigns, public.theses, public.content_items,
  public.content_variants, public.content_publications, public.content_assets,
  public.content_item_revisions, public.thesis_revisions, public.editorial_batches,
  public.task_runs, public.task_schedules, public.unified_creatives,
  public.scheduled_publications TO prospector_reader;
ALTER TABLE editorial.scheduled_publications_legacy OWNER TO CURRENT_USER;
ALTER TABLE editorial.content_variants_legacy OWNER TO CURRENT_USER;
ALTER TABLE design.editorial_theses_legacy OWNER TO CURRENT_USER;
ALTER TABLE design.content_items_legacy OWNER TO CURRENT_USER;
ALTER TABLE design.unified_creatives_legacy OWNER TO CURRENT_USER;
ALTER TABLE design.editorial_thesis_versions_legacy OWNER TO CURRENT_USER;
ALTER TABLE design.content_versions_legacy OWNER TO CURRENT_USER;
REVOKE ALL ON
  editorial.scheduled_publications_legacy,
  editorial.content_variants_legacy,
  design.editorial_theses_legacy,
  design.content_items_legacy,
  design.unified_creatives_legacy,
  design.editorial_thesis_versions_legacy,
  design.content_versions_legacy
FROM prospector_app, prospector_reader;

DO $$
DECLARE
  archive_relation text;
  owner_name text;
  role_name text;
  privilege_name text;
BEGIN
  FOREACH archive_relation IN ARRAY ARRAY[
    'editorial.scheduled_publications_legacy',
    'editorial.content_variants_legacy',
    'design.editorial_theses_legacy',
    'design.content_items_legacy',
    'design.unified_creatives_legacy',
    'design.editorial_thesis_versions_legacy',
    'design.content_versions_legacy'
  ] LOOP
    SELECT pg_get_userbyid(relation_row.relowner)
      INTO owner_name
      FROM pg_class relation_row
     WHERE relation_row.oid = to_regclass(archive_relation);
    IF owner_name IS NULL OR owner_name IN ('prospector_app', 'prospector_reader') THEN
      RAISE EXCEPTION 'Rollback archive % has unsafe owner %', archive_relation, owner_name;
    END IF;

    FOREACH role_name IN ARRAY ARRAY['prospector_app', 'prospector_reader'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(role_name, archive_relation, privilege_name) THEN
          RAISE EXCEPTION 'Rollback archive % remains accessible to % with %', archive_relation, role_name, privilege_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END
$$;

INSERT INTO editorial.shared_cutover_state(migration_version, source_database, details)
VALUES (
  '0048_unified_editorial_cutover', current_database(),
  jsonb_build_object(
    'design_theses', (SELECT count(*) FROM design.editorial_theses_legacy),
    'design_content_items', (SELECT count(*) FROM design.content_items_legacy),
    'design_creatives', (SELECT count(*) FROM design.unified_creatives_legacy),
    'scheduled_publications', (SELECT count(*) FROM editorial.scheduled_publications_legacy),
    'content_variants', (SELECT count(*) FROM editorial.content_variants_legacy),
    'canonical_creatives', (SELECT count(*) FROM editorial.unified_creatives),
    'canonical_creatives_updated_at', (SELECT max(updated_at)::text FROM editorial.unified_creatives),
    'canonical_content_items', (SELECT count(*) FROM editorial.content_items),
    'canonical_content_items_updated_at', (SELECT max(updated_at)::text FROM editorial.content_items),
    'canonical_theses', (SELECT count(*) FROM editorial.theses),
    'canonical_theses_updated_at', (SELECT max(updated_at)::text FROM editorial.theses),
    'thesis_revision_count', (SELECT count(*) FROM editorial.thesis_revisions),
    'content_revision_count', (SELECT count(*) FROM editorial.content_item_revisions),
    'original_content_item_checks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', constraint_name, 'definition', definition))
      FROM pg_temp.cutover_content_item_checks
    ), '[]'::jsonb),
    'archive_owners', (SELECT jsonb_object_agg(source_relation, owner_name) FROM pg_temp.cutover_archive_owners),
    'archive_acl', (SELECT jsonb_object_agg(
      source_relation,
      jsonb_build_object(
        'prospector_app', to_jsonb(prospector_app_privileges),
        'prospector_reader', to_jsonb(prospector_reader_privileges)
      )
    ) FROM pg_temp.cutover_archive_owners),
    'hashes', jsonb_build_object(
      'campaigns', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.campaigns row_data),
      'theses', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.theses row_data),
      'content_items', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.content_items row_data),
      'unified_creatives', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.unified_creatives row_data),
      'thesis_revisions', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.thesis_revisions row_data),
      'content_item_revisions', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.content_item_revisions row_data),
      'scheduled_publications_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.scheduled_publications_legacy row_data),
      'content_variants_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM editorial.content_variants_legacy row_data),
      'editorial_theses_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM design.editorial_theses_legacy row_data),
      'design_content_items_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM design.content_items_legacy row_data),
      'design_unified_creatives_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM design.unified_creatives_legacy row_data),
      'editorial_thesis_versions_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM design.editorial_thesis_versions_legacy row_data),
      'design_content_versions_legacy', (SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM design.content_versions_legacy row_data)
    )
  )
);
