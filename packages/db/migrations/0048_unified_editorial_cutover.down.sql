SELECT pg_advisory_xact_lock(742901366);

DO $$
DECLARE
  state_row editorial.shared_cutover_state%ROWTYPE;
  check_row record;
  relation_schema text;
  relation_name text;
  relation_sql text;
  actual_hash text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user AND rolsuper
  ) THEN
    RAISE EXCEPTION 'Editorial rollback requires a database superuser connection';
  END IF;

  SELECT * INTO state_row
  FROM editorial.shared_cutover_state
  WHERE migration_version = '0048_unified_editorial_cutover';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cutover state is missing; refusing rollback';
  END IF;
  IF NOT (state_row.details ? 'archive_acl') THEN
    RAISE EXCEPTION 'Cutover archive grants are missing; refusing rollback';
  END IF;

  FOR check_row IN SELECT key, value FROM jsonb_each_text(state_row.details->'hashes') LOOP
    relation_schema := CASE
      WHEN check_row.key IN ('scheduled_publications_legacy','content_variants_legacy') THEN 'editorial'
      WHEN check_row.key IN ('editorial_theses_legacy','design_content_items_legacy','design_unified_creatives_legacy') THEN 'design'
      WHEN check_row.key IN ('editorial_thesis_versions_legacy','design_content_versions_legacy') THEN 'design'
      ELSE 'editorial'
    END;
    relation_name := CASE check_row.key
      WHEN 'design_content_items_legacy' THEN 'content_items_legacy'
      WHEN 'design_unified_creatives_legacy' THEN 'unified_creatives_legacy'
      WHEN 'design_content_versions_legacy' THEN 'content_versions_legacy'
      WHEN 'thesis_revisions' THEN 'thesis_revisions'
      WHEN 'content_item_revisions' THEN 'content_item_revisions'
      ELSE check_row.key
    END;
    relation_sql := format('%I.%I', relation_schema, relation_name);
    IF to_regclass(relation_sql) IS NULL THEN
      RAISE EXCEPTION 'Rollback source relation % is missing', relation_sql;
    END IF;

    EXECUTE format(
      'SELECT md5(COALESCE(string_agg(to_jsonb(row_data)::text, E''\n'' ORDER BY row_data.id), '''')) FROM %s row_data',
      relation_sql
    ) INTO actual_hash;
    IF actual_hash IS DISTINCT FROM check_row.value THEN
      RAISE EXCEPTION 'Rollback blocked because % changed after cutover', relation_sql;
    END IF;
  END LOOP;
END
$$;

DROP VIEW IF EXISTS design.unified_creatives;
DROP VIEW IF EXISTS design.content_items;
DROP VIEW IF EXISTS public.scheduled_publications;
DROP VIEW IF EXISTS public.unified_creatives;
DROP VIEW IF EXISTS public.task_schedules;
DROP VIEW IF EXISTS public.task_runs;
DROP VIEW IF EXISTS public.editorial_batches;
DROP VIEW IF EXISTS public.thesis_revisions;
DROP VIEW IF EXISTS public.content_item_revisions;
DROP VIEW IF EXISTS public.content_assets;
DROP VIEW IF EXISTS public.content_publications;
DROP VIEW IF EXISTS public.content_variants;
DROP VIEW IF EXISTS public.content_items;
DROP VIEW IF EXISTS public.theses;
DROP VIEW IF EXISTS public.campaigns;

DROP TRIGGER IF EXISTS shared_content_item_revision_update ON editorial.content_items;
DROP TRIGGER IF EXISTS shared_content_item_revision_insert ON editorial.content_items;
DROP TRIGGER IF EXISTS shared_content_item_version_sync ON editorial.content_items;
DROP TRIGGER IF EXISTS shared_thesis_state_sync ON editorial.theses;

ALTER TABLE editorial.unified_creatives
  DROP CONSTRAINT IF EXISTS unified_creatives_thesis_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_content_item_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_plan_item_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_campaign_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_opportunity_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_account_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_publication_variant_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_superseded_shared_fk,
  DROP CONSTRAINT IF EXISTS unified_creatives_variant_superseded_shared_fk;
ALTER TABLE editorial.content_items
  DROP CONSTRAINT IF EXISTS content_items_plan_item_shared_fk,
  DROP CONSTRAINT IF EXISTS content_items_brief_shared_fk,
  DROP CONSTRAINT IF EXISTS content_items_shared_status_check;

DO $$
DECLARE
  fk record;
  child_column text;
  target_parent text;
  target_parent_oid oid;
  parent_column text;
  delete_action text;
  update_action text;
  match_action text;
  suffix text;
BEGIN
  FOR fk IN
    SELECT * FROM editorial.legacy_editorial_foreign_keys
    ORDER BY source_relation, child_relation, constraint_name
  LOOP
    SELECT attribute.attname INTO child_column
    FROM pg_attribute attribute
    WHERE attribute.attrelid = fk.child_relation_oid
      AND attribute.attnum = fk.child_columns[1];
    IF child_column IS NULL THEN
      RAISE EXCEPTION 'Rollback child column is missing for %.%', fk.child_relation, fk.constraint_name;
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
      fk.child_relation_oid::regclass, fk.constraint_name);
    EXECUTE format(
      'UPDATE %s AS child SET %I = mapping.legacy_id
       FROM editorial.legacy_editorial_ids mapping
       WHERE mapping.source_relation = $1 AND mapping.canonical_id = child.%I',
      fk.child_relation_oid::regclass, child_column, child_column
    ) USING fk.source_relation;
  END LOOP;
END
$$;

DELETE FROM editorial.content_item_revisions revision
WHERE NOT EXISTS (
  SELECT 1 FROM editorial.legacy_editorial_ids mapping
  WHERE mapping.source_relation = 'public.content_item_revisions'
    AND mapping.legacy_id = revision.id
);
DELETE FROM editorial.thesis_revisions revision
WHERE NOT EXISTS (
  SELECT 1 FROM editorial.legacy_editorial_ids mapping
  WHERE mapping.source_relation = 'public.thesis_revisions'
    AND mapping.legacy_id = revision.id
);
DELETE FROM editorial.content_items item
WHERE NOT EXISTS (
  SELECT 1 FROM editorial.legacy_editorial_ids mapping
  WHERE mapping.source_relation = 'public.content_items'
    AND mapping.legacy_id = item.id
);
DELETE FROM editorial.theses thesis
WHERE NOT EXISTS (
  SELECT 1 FROM editorial.legacy_editorial_ids mapping
  WHERE mapping.source_relation = 'public.theses'
    AND mapping.legacy_id = thesis.id
);
DELETE FROM editorial.unified_creatives creative
WHERE NOT EXISTS (
  SELECT 1 FROM editorial.legacy_editorial_ids mapping
  WHERE mapping.source_relation = 'public.unified_creatives'
    AND mapping.legacy_id = creative.id
);

ALTER TABLE editorial.theses DISABLE TRIGGER USER;
ALTER TABLE editorial.content_items DISABLE TRIGGER USER;
ALTER TABLE editorial.unified_creatives DISABLE TRIGGER USER;

DO $$
DECLARE
  restore_row record;
  columns_sql text;
BEGIN
  FOR restore_row IN
    SELECT * FROM (VALUES
      ('theses', 'public.theses'),
      ('content_items', 'public.content_items'),
      ('unified_creatives', 'public.unified_creatives')
    ) AS tables(table_name, source_relation)
  LOOP
    SELECT string_agg(format('%I = restored.%I', key_name, key_name), ', ' ORDER BY key_name)
      INTO columns_sql
    FROM (
      SELECT DISTINCT row_key.key_name
      FROM editorial.shared_cutover_snapshots snapshot
      CROSS JOIN LATERAL jsonb_object_keys(snapshot.row_data) AS row_key(key_name)
      WHERE snapshot.source_relation = restore_row.source_relation
    ) original_columns
    WHERE key_name <> 'id';

    IF columns_sql IS NOT NULL THEN
      EXECUTE format(
        'UPDATE editorial.%I AS target SET %s
         FROM editorial.shared_cutover_snapshots AS snapshot
         CROSS JOIN LATERAL jsonb_populate_record(NULL::editorial.%I, snapshot.row_data) AS restored
         WHERE snapshot.source_relation = $1 AND target.id = snapshot.record_id',
        restore_row.table_name, columns_sql, restore_row.table_name
      ) USING restore_row.source_relation;
    END IF;
  END LOOP;
END
$$;

ALTER TABLE editorial.theses ENABLE TRIGGER USER;
ALTER TABLE editorial.content_items ENABLE TRIGGER USER;
ALTER TABLE editorial.unified_creatives ENABLE TRIGGER USER;

DROP FUNCTION IF EXISTS editorial.record_content_item_revision();
DROP FUNCTION IF EXISTS editorial.sync_content_item_version();
DROP FUNCTION IF EXISTS editorial.sync_thesis_state();

DROP INDEX IF EXISTS editorial.theses_design_thesis_id_uidx;
DROP INDEX IF EXISTS editorial.theses_design_slug_uidx;
DROP INDEX IF EXISTS editorial.unified_creatives_source_suggestion_uidx;
DROP INDEX IF EXISTS editorial.unified_creatives_content_variant_uidx;
DROP INDEX IF EXISTS editorial.unified_creatives_idempotency_uidx;
DROP INDEX IF EXISTS editorial.unified_creatives_opportunity_idx;
DROP INDEX IF EXISTS editorial.unified_creatives_publication_variant_idx;
DROP INDEX IF EXISTS editorial.content_items_thesis_status_format_idx;

ALTER TABLE editorial.theses
  DROP COLUMN IF EXISTS design_thesis_id,
  DROP COLUMN IF EXISTS design_slug,
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS core_statement,
  DROP COLUMN IF EXISTS full_text,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS weight,
  DROP COLUMN IF EXISTS tone,
  DROP COLUMN IF EXISTS depth_level,
  DROP COLUMN IF EXISTS audience_stage,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE editorial.thesis_revisions DROP COLUMN IF EXISTS change_reason;
ALTER TABLE editorial.content_items
  ALTER COLUMN brand_voice_version DROP DEFAULT,
  DROP COLUMN IF EXISTS plan_item_id,
  DROP COLUMN IF EXISTS brief_id,
  DROP COLUMN IF EXISTS format,
  DROP COLUMN IF EXISTS copy_data,
  DROP COLUMN IF EXISTS template_id,
  DROP COLUMN IF EXISTS render_id,
  DROP COLUMN IF EXISTS quality_score,
  DROP COLUMN IF EXISTS similarity_score,
  DROP COLUMN IF EXISTS generation_model,
  DROP COLUMN IF EXISTS generation_cost,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE editorial.content_item_revisions
  DROP COLUMN IF EXISTS template_id,
  DROP COLUMN IF EXISTS change_reason;
ALTER TABLE editorial.unified_creatives
  DROP COLUMN IF EXISTS content_opportunity_id,
  DROP COLUMN IF EXISTS media_asset_ref,
  DROP COLUMN IF EXISTS media_ref,
  DROP COLUMN IF EXISTS ig_media_id,
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS correlation_id,
  DROP COLUMN IF EXISTS publication_variant_id,
  DROP COLUMN IF EXISTS subtype,
  DROP COLUMN IF EXISTS hashtags,
  DROP COLUMN IF EXISTS publication_cta,
  DROP COLUMN IF EXISTS pillar,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS recurrence_rule,
  DROP COLUMN IF EXISTS content_structure,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS superseded_by,
  DROP COLUMN IF EXISTS locked_by,
  DROP COLUMN IF EXISTS payload,
  DROP COLUMN IF EXISTS variant_status,
  DROP COLUMN IF EXISTS humanization_signature,
  DROP COLUMN IF EXISTS similarity_score,
  DROP COLUMN IF EXISTS generated_by,
  DROP COLUMN IF EXISTS external_ref,
  DROP COLUMN IF EXISTS variant_scheduled_for,
  DROP COLUMN IF EXISTS variant_timezone,
  DROP COLUMN IF EXISTS variant_origin,
  DROP COLUMN IF EXISTS variant_locked_at,
  DROP COLUMN IF EXISTS variant_locked_by,
  DROP COLUMN IF EXISTS variant_curation_status,
  DROP COLUMN IF EXISTS variant_superseded_by;

ALTER TABLE editorial.scheduled_publications_legacy SET SCHEMA public;
ALTER TABLE public.scheduled_publications_legacy RENAME TO scheduled_publications;
ALTER TABLE editorial.content_variants_legacy SET SCHEMA public;
ALTER TABLE public.content_variants_legacy RENAME TO content_variants;

ALTER TABLE editorial.campaigns SET SCHEMA public;
ALTER TABLE editorial.theses SET SCHEMA public;
ALTER TABLE editorial.content_items SET SCHEMA public;
ALTER TABLE editorial.unified_creatives SET SCHEMA public;
ALTER TABLE editorial.editorial_batches SET SCHEMA public;
ALTER TABLE editorial.thesis_revisions SET SCHEMA public;
ALTER TABLE editorial.content_item_revisions SET SCHEMA public;
ALTER TABLE editorial.content_assets SET SCHEMA public;
ALTER TABLE editorial.content_publications SET SCHEMA public;
ALTER TABLE editorial.task_runs SET SCHEMA public;
ALTER TABLE editorial.task_schedules SET SCHEMA public;

ALTER TABLE design.editorial_theses_legacy RENAME TO editorial_theses;
ALTER TABLE design.content_items_legacy RENAME TO content_items;
ALTER TABLE design.unified_creatives_legacy RENAME TO unified_creatives;
ALTER TABLE design.editorial_thesis_versions_legacy RENAME TO editorial_thesis_versions;
ALTER TABLE design.content_versions_legacy RENAME TO content_versions;

ALTER TABLE editorial.editorial_thesis_arguments SET SCHEMA design;
ALTER TABLE editorial.editorial_thesis_objections SET SCHEMA design;
ALTER TABLE editorial.editorial_thesis_examples SET SCHEMA design;
ALTER TABLE editorial.editorial_thesis_evidence SET SCHEMA design;
ALTER TABLE editorial.editorial_thesis_relations SET SCHEMA design;
ALTER TABLE editorial.knowledge_documents SET SCHEMA design;
ALTER TABLE editorial.knowledge_chunks SET SCHEMA design;
ALTER TABLE editorial.rag_embeddings SET SCHEMA design;
ALTER TABLE editorial.editorial_intents SET SCHEMA design;
ALTER TABLE editorial.editorial_angles SET SCHEMA design;
ALTER TABLE editorial.editorial_hooks SET SCHEMA design;
ALTER TABLE editorial.editorial_depth_levels SET SCHEMA design;
ALTER TABLE editorial.editorial_campaigns SET SCHEMA design;
ALTER TABLE editorial.editorial_plans SET SCHEMA design;
ALTER TABLE editorial.editorial_plan_items SET SCHEMA design;
ALTER TABLE editorial.content_briefs SET SCHEMA design;
ALTER TABLE editorial.content_reviews SET SCHEMA design;
ALTER TABLE editorial.content_similarity_scores SET SCHEMA design;
ALTER TABLE editorial.content_usage_ledger SET SCHEMA design;
ALTER TABLE editorial.generation_jobs SET SCHEMA design;
ALTER TABLE editorial.prompt_templates SET SCHEMA design;
ALTER TABLE editorial.prompt_versions SET SCHEMA design;

DO $$
DECLARE
  fk record;
  target_parent text;
  target_parent_oid oid;
  child_column text;
  parent_column text;
  delete_action text;
  update_action text;
  match_action text;
  suffix text;
BEGIN
  FOR fk IN
    SELECT * FROM editorial.legacy_editorial_foreign_keys
    ORDER BY source_relation, child_relation, constraint_name
  LOOP
    target_parent := CASE fk.source_relation
      WHEN 'design.editorial_theses' THEN 'design.editorial_theses'
      WHEN 'design.content_items' THEN 'design.content_items'
      WHEN 'public.scheduled_publications' THEN 'public.scheduled_publications'
      WHEN 'public.content_variants' THEN 'public.content_variants'
      ELSE NULL
    END;
    IF target_parent IS NULL THEN
      RAISE EXCEPTION 'Unknown rollback FK source relation %', fk.source_relation;
    END IF;
    target_parent_oid := to_regclass(target_parent)::oid;
    IF target_parent_oid IS NULL THEN
      RAISE EXCEPTION 'Rollback FK parent relation % is missing', target_parent;
    END IF;
    SELECT attribute.attname INTO child_column
    FROM pg_attribute attribute
    WHERE attribute.attrelid = fk.child_relation_oid
      AND attribute.attnum = fk.child_columns[1];
    SELECT attribute.attname INTO parent_column
    FROM pg_attribute attribute
    WHERE attribute.attrelid = target_parent_oid
      AND attribute.attnum = fk.parent_columns[1];
    delete_action := CASE fk.delete_action
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END;
    update_action := CASE fk.update_action
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END;
    match_action := CASE fk.match_type
      WHEN 's' THEN 'SIMPLE' WHEN 'f' THEN 'FULL' WHEN 'p' THEN 'PARTIAL' END;
    suffix := CASE
      WHEN fk.is_deferrable AND fk.is_initially_deferred THEN ' DEFERRABLE INITIALLY DEFERRED'
      WHEN fk.is_deferrable THEN ' DEFERRABLE INITIALLY IMMEDIATE'
      ELSE ' NOT DEFERRABLE'
    END;
    IF NOT fk.was_validated THEN suffix := suffix || ' NOT VALID'; END IF;
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s (%I) MATCH %s ON UPDATE %s ON DELETE %s%s',
      fk.child_relation_oid::regclass, fk.constraint_name, child_column,
      target_parent_oid::regclass, parent_column, match_action, update_action,
      delete_action, suffix
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  state_details jsonb;
  archive record;
  target_relation text;
  target_owner text;
  role_name text;
  privilege_name text;
BEGIN
  SELECT details INTO state_details
  FROM editorial.shared_cutover_state
  WHERE migration_version = '0048_unified_editorial_cutover';

  FOR archive IN
    SELECT key AS source_relation, value AS owner_name
    FROM jsonb_each_text(state_details->'archive_owners')
  LOOP
    target_relation := CASE archive.source_relation
      WHEN 'public.scheduled_publications' THEN 'public.scheduled_publications'
      WHEN 'public.content_variants' THEN 'public.content_variants'
      WHEN 'design.editorial_theses' THEN 'design.editorial_theses'
      WHEN 'design.content_items' THEN 'design.content_items'
      WHEN 'design.unified_creatives' THEN 'design.unified_creatives'
      WHEN 'design.editorial_thesis_versions' THEN 'design.editorial_thesis_versions'
      WHEN 'design.content_versions' THEN 'design.content_versions'
      ELSE NULL
    END;
    IF target_relation IS NULL OR to_regclass(target_relation) IS NULL THEN
      RAISE EXCEPTION 'Rollback archive relation % is missing', archive.source_relation;
    END IF;
    EXECUTE format('ALTER TABLE %s OWNER TO %I', target_relation, archive.owner_name);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM prospector_app, prospector_reader', target_relation);

    FOREACH role_name IN ARRAY ARRAY['prospector_app', 'prospector_reader'] LOOP
      FOR privilege_name IN
        SELECT jsonb_array_elements_text(state_details->'archive_acl'->archive.source_relation->role_name)
      LOOP
        IF privilege_name NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') THEN
          RAISE EXCEPTION 'Unknown saved privilege % for %', privilege_name, archive.source_relation;
        END IF;
        EXECUTE format('GRANT %s ON TABLE %s TO %I', privilege_name, target_relation, role_name);
      END LOOP;
    END LOOP;

    EXECUTE format('SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass(%L)', target_relation)
      INTO target_owner;
    IF target_owner IS DISTINCT FROM archive.owner_name THEN
      RAISE EXCEPTION 'Rollback owner mismatch for %: expected %, found %', archive.source_relation, archive.owner_name, target_owner;
    END IF;

    FOREACH role_name IN ARRAY ARRAY['prospector_app', 'prospector_reader'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(role_name, target_relation, privilege_name)
           IS DISTINCT FROM (state_details->'archive_acl'->archive.source_relation->role_name ? privilege_name) THEN
          RAISE EXCEPTION 'Rollback privilege mismatch for % on %', role_name, archive.source_relation;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END
$$;

DO $$
DECLARE
  check_row jsonb;
BEGIN
  FOR check_row IN
    SELECT value
    FROM editorial.shared_cutover_state state_row
    CROSS JOIN LATERAL jsonb_array_elements(state_row.details->'original_content_item_checks') value
    WHERE state_row.migration_version = '0048_unified_editorial_cutover'
  LOOP
    EXECUTE format('ALTER TABLE public.content_items ADD CONSTRAINT %I %s',
      check_row->>'name', check_row->>'definition');
  END LOOP;
END
$$;

DELETE FROM editorial.shared_cutover_state
WHERE migration_version = '0048_unified_editorial_cutover';
DELETE FROM editorial.shared_cutover_snapshots
WHERE source_relation IN ('public.theses','public.content_items','public.unified_creatives');
DELETE FROM editorial.legacy_editorial_ids
WHERE source_relation IN (
  'public.theses','public.content_items','public.unified_creatives',
  'public.thesis_revisions','public.content_item_revisions',
  'public.scheduled_publications','public.content_variants',
  'design.editorial_theses','design.content_items','design.unified_creatives',
  'design.editorial_thesis_versions','design.content_versions'
);
DELETE FROM editorial.legacy_editorial_foreign_keys
WHERE source_relation IN (
  'design.editorial_theses','design.content_items',
  'public.scheduled_publications','public.content_variants'
);
