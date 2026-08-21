-- ============================================================
-- Migration 0032 — unified_creatives (UP)
-- Cria tabela canônica que consolida criativos de ambos os apps.
-- Migra dados existentes de scheduled_publications e
-- editorial_plan_items/content_items.
-- Cria views de compatibilidade retroativa.
-- ============================================================

-- ── 1. Tabela principal ──────────────────────────────────────
CREATE TABLE unified_creatives (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FKs para as tabelas-fonte (nullable = dado veio só de um lado)
  thesis_id          uuid        REFERENCES theses(id)              ON DELETE SET NULL,
  ed_thesis_id       uuid        REFERENCES editorial_theses(id)    ON DELETE SET NULL,
  plan_item_id       uuid        REFERENCES editorial_plan_items(id) ON DELETE SET NULL,
  content_item_id    uuid        REFERENCES content_items(id)       ON DELETE SET NULL,

  -- Campos canônicos
  title              text,
  caption            text,
  channel            text,                 -- instagram | threads | feed | stories
  format             text,                 -- carrossel | reels | static | stories
  status             text        NOT NULL DEFAULT 'draft',
                                           -- draft → planned → scheduled → ready → published
  curation_status    text,
  scheduled_for      timestamptz,
  published_at       timestamptz,
  approved_by        text,

  -- Proveniência
  origin             text,                 -- 'design-system' | 'prospector' | 'batch'
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
CREATE INDEX unified_creatives_thesis_idx        ON unified_creatives (thesis_id);
CREATE INDEX unified_creatives_ed_thesis_idx     ON unified_creatives (ed_thesis_id);
CREATE INDEX unified_creatives_scheduled_idx     ON unified_creatives (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
CREATE INDEX unified_creatives_batch_idx         ON unified_creatives (batch_id)
  WHERE batch_id IS NOT NULL;

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

-- ── 2. Migrar dados de scheduled_publications ────────────────
-- Importa publicações existentes do Prospector
INSERT INTO unified_creatives (
  thesis_id, channel, format, status, curation_status,
  scheduled_for, published_at, approved_by, batch_id,
  title, caption, copy_data, origin, created_at, updated_at
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
  COALESCE(sp.origin, 'prospector'),
  sp.created_at,
  sp.updated_at
FROM scheduled_publications sp
ON CONFLICT DO NOTHING;

-- ── 3. Migrar dados de content_items (Design System) ────────
-- Faz merge por thesis_id + scheduled_for quando possível
INSERT INTO unified_creatives (
  ed_thesis_id, plan_item_id, content_item_id,
  format, status, copy_data,
  template_id, render_id, quality_score,
  origin, created_at, updated_at
)
SELECT
  ci.thesis_id,
  ci.plan_item_id,
  ci.id,
  ci.format,
  ci.status,
  ci.copy_data,
  ci.template_id,
  ci.render_id,
  ci.quality_score,
  'design-system',
  ci.created_at,
  ci.updated_at
FROM content_items ci
-- Evita duplicar criativos que já foram sincronizados via scheduled_publications
WHERE NOT EXISTS (
  SELECT 1 FROM unified_creatives uc
  WHERE uc.content_item_id = ci.id
)
ON CONFLICT DO NOTHING;

-- ── 4. Enriquecer com dados do editorial_plan_items ──────────
UPDATE unified_creatives uc
SET
  plan_item_id    = epi.id,
  hook_strategy   = COALESCE(uc.hook_strategy, epi.hook_strategy),
  depth_level     = COALESCE(uc.depth_level, epi.depth_level),
  audience_stage  = COALESCE(uc.audience_stage, epi.audience_stage),
  cta             = COALESCE(uc.cta, epi.cta),
  visual_direction = COALESCE(uc.visual_direction, epi.visual_direction),
  sequence_position = COALESCE(uc.sequence_position, epi.sequence_position),
  updated_at      = now()
FROM editorial_plan_items epi
WHERE uc.plan_item_id = epi.id
  AND uc.plan_item_id IS NOT NULL;

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
  origin        AS generation_model,   -- mapeamento aproximado
  created_at,
  updated_at
FROM unified_creatives
WHERE content_item_id IS NOT NULL OR ed_thesis_id IS NOT NULL;

COMMENT ON TABLE unified_creatives IS
  'Tabela canônica de criativos — substitui scheduled_publications + editorial_plan_items/content_items. '
  'Migration 0032. Views de compatibilidade: scheduled_publications_compat, content_items_compat.';
