-- ============================================================
-- Migration 0032 — unified_creatives (UP)
-- Cria tabela canônica que consolida criativos de ambos os apps.
--
-- NOTA DE AMBIENTE:
-- Na VPS de produção, as tabelas editorial_theses, editorial_plan_items
-- e content_items existem no schema 'design'. No CI (banco público vazio)
-- essas tabelas não existem ainda quando esta migration roda. Por isso
-- as FKs são definidas sem REFERENCES — as restrições de integridade
-- são garantidas pela aplicação e pelo schema Drizzle em tempo de desenvolvimento.
-- ============================================================

-- ── 1. Tabela principal ──────────────────────────────────────
CREATE TABLE unified_creatives (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências — sem FK a nível SQL para compatibilidade com CI e schema design/*
  thesis_id          uuid,       -- → theses (Prospector)
  ed_thesis_id       uuid,       -- → editorial_theses (Design System)
  plan_item_id       uuid,       -- → editorial_plan_items (Design System)
  content_item_id    uuid,       -- → content_items (Design System)

  -- Campos canônicos
  title              text,
  caption            text,
  channel            text,                  -- instagram | threads | feed | stories
  format             text,                  -- carrossel | reels | static | stories
  status             text        NOT NULL DEFAULT 'draft',
                                            -- draft → planned → scheduled → ready → published
  curation_status    text,
  scheduled_for      timestamptz,
  published_at       timestamptz,
  approved_by        text,

  -- Proveniência
  origin             text,                  -- 'design-system' | 'prospector' | 'batch'
  batch_id           uuid,

  -- Conteúdo gerado
  copy_data          jsonb       NOT NULL DEFAULT '{}',
  visual_direction   text,
  template_id        text,
  render_id          uuid,
  quality_score      jsonb,

  -- Estratégia editorial
  hook_strategy      text,
  depth_level        text,
  audience_stage     text,
  cta                text,
  sequence_position  int,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX unified_creatives_status_idx       ON unified_creatives (status);
CREATE INDEX unified_creatives_thesis_idx        ON unified_creatives (thesis_id)
  WHERE thesis_id IS NOT NULL;
CREATE INDEX unified_creatives_ed_thesis_idx     ON unified_creatives (ed_thesis_id)
  WHERE ed_thesis_id IS NOT NULL;
CREATE INDEX unified_creatives_scheduled_idx     ON unified_creatives (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
CREATE INDEX unified_creatives_batch_idx         ON unified_creatives (batch_id)
  WHERE batch_id IS NOT NULL;
CREATE INDEX unified_creatives_origin_idx        ON unified_creatives (origin)
  WHERE origin IS NOT NULL;

-- Auto-update de updated_at
CREATE OR REPLACE FUNCTION update_unified_creatives_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER unified_creatives_updated_at
  BEFORE UPDATE ON unified_creatives
  FOR EACH ROW EXECUTE FUNCTION update_unified_creatives_updated_at();

-- ── 2. Migrar dados de scheduled_publications (se existir) ───
-- Usa DO para ser idempotente em ambientes sem a tabela.
-- Verifica dinamicamente se a coluna copy_data existe (pode não existir em CI).
DO $$
DECLARE
  has_copy_data boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_publications') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'scheduled_publications' AND column_name = 'copy_data'
    ) INTO has_copy_data;

    IF has_copy_data THEN
      EXECUTE $q$
        INSERT INTO unified_creatives (
          thesis_id, channel, format, status, curation_status,
          scheduled_for, published_at, approved_by, batch_id,
          title, caption, copy_data, origin
        )
        SELECT
          sp.thesis_id,
          sp.channel,
          sp.format,
          sp.status,
          sp.curation_status,
          sp.scheduled_for,
          sp.published_at,
          sp.approved_by,
          sp.batch_id,
          COALESCE(sp.title, ''),
          sp.caption,
          COALESCE(sp.copy_data, '{}')::jsonb,
          COALESCE(sp.origin, 'prospector')
        FROM scheduled_publications sp
        ON CONFLICT DO NOTHING
      $q$;
    ELSE
      EXECUTE $q$
        INSERT INTO unified_creatives (
          thesis_id, channel, format, status, curation_status,
          scheduled_for, published_at, approved_by, batch_id,
          title, caption, copy_data, origin
        )
        SELECT
          sp.thesis_id,
          sp.channel,
          sp.format,
          sp.status,
          sp.curation_status,
          sp.scheduled_for,
          sp.published_at,
          sp.approved_by,
          sp.batch_id,
          COALESCE(sp.title, ''),
          sp.caption,
          '{}'::jsonb,
          COALESCE(sp.origin, 'prospector')
        FROM scheduled_publications sp
        ON CONFLICT DO NOTHING
      $q$;
    END IF;
  END IF;
END $$;

-- ── 3. Migrar dados de content_items (se existir) ────────────
-- Usa colunas mínimas garantidas; colunas opcionais (plan_item_id, template_id,
-- render_id, quality_score, copy_data) nem sempre existem (ex: ambiente CI).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_items') THEN
    EXECUTE $q$
      INSERT INTO unified_creatives (
        ed_thesis_id, format, status, origin
      )
      SELECT
        ci.thesis_id,
        ci.format,
        ci.status,
        'design-system'
      FROM content_items ci
      ON CONFLICT DO NOTHING
    $q$;
  END IF;
END $$;

-- ── 4. Enriquecer com editorial_plan_items (se existir) ──────
-- Usa EXECUTE para evitar falha de parse quando colunas opcionais
-- (hook_strategy, depth_level, etc.) não existem na tabela em CI.
DO $$
DECLARE
  has_cols boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'editorial_plan_items') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'editorial_plan_items' AND column_name = 'hook_strategy'
    ) INTO has_cols;

    IF has_cols THEN
      EXECUTE $q$
        UPDATE unified_creatives uc
        SET
          hook_strategy    = COALESCE(uc.hook_strategy, epi.hook_strategy),
          depth_level      = COALESCE(uc.depth_level, epi.depth_level),
          audience_stage   = COALESCE(uc.audience_stage, epi.audience_stage),
          cta              = COALESCE(uc.cta, epi.cta),
          visual_direction = COALESCE(uc.visual_direction, epi.visual_direction),
          sequence_position = COALESCE(uc.sequence_position, epi.sequence_position),
          updated_at       = now()
        FROM editorial_plan_items epi
        WHERE uc.plan_item_id = epi.id
          AND uc.plan_item_id IS NOT NULL
      $q$;
    END IF;
  END IF;
END $$;

-- ── 5. Views de compatibilidade retroativa ───────────────────

-- 5a. scheduled_publications_compat: Prospector continua lendo sem mudança
CREATE OR REPLACE VIEW scheduled_publications_compat AS
SELECT
  id,
  title,
  caption,
  channel,
  format,
  status,
  curation_status,
  scheduled_for,
  published_at,
  batch_id,
  thesis_id,
  approved_by,
  origin,
  copy_data,
  created_at,
  updated_at
FROM unified_creatives;

-- 5b. content_items_compat: Design System lê criativos sem alterar queries
CREATE OR REPLACE VIEW content_items_compat AS
SELECT
  id,
  plan_item_id,
  ed_thesis_id  AS thesis_id,
  format,
  copy_data,
  status,
  template_id,
  render_id,
  quality_score,
  origin        AS generation_model,
  created_at,
  updated_at
FROM unified_creatives
WHERE content_item_id IS NOT NULL OR ed_thesis_id IS NOT NULL;

COMMENT ON TABLE unified_creatives IS
  'Tabela canônica de criativos — substitui scheduled_publications + editorial_plan_items/content_items. '
  'Migration 0032. FKs sem REFERENCES SQL para compatibilidade CI/schema-design. '
  'Views: scheduled_publications_compat, content_items_compat.';
