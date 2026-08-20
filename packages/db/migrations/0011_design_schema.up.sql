-- Etapa 1 — Namespace para as tabelas do Design System
-- As 49 tabelas do Design System vivem em design.*, resolvendo colisões
-- de content_items, content_briefs e content_usage_ledger com o Prospector.

CREATE SCHEMA IF NOT EXISTS design;

-- View que expõe teses do Design System para os workers do Prospector.
-- O banco do Prospector pode ser instalado sem a tabela do Design System:
-- nesse caso, mantém-se o contrato com uma view vazia até a consolidação.
DO $migration$
BEGIN
  IF to_regclass('design.editorial_theses') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW theses_from_design AS
      SELECT
        et.id,
        et.title,
        et.slug,
        COALESCE(et.summary, '') AS description,
        jsonb_build_array() AS tenets,
        COALESCE(et."forbiddenWords", '{}')::jsonb AS forbidden_angles,
        jsonb_build_object(
          'tone', COALESCE(et.tone, ''),
          'depth_level', COALESCE(et."depthLevel", ''),
          'vocabulary', COALESCE(et.vocabulary, '')
        ) AS tone_guidelines,
        COALESCE(et."recommendedFormats", '{}')::jsonb AS example_hooks,
        NULL::vector(384) AS centroid_embedding,
        et.version,
        CASE WHEN et.status = 'active' THEN true ELSE false END AS active,
        et."createdAt" AS created_at,
        et."updatedAt" AS updated_at
      FROM design.editorial_theses et
    $view$;
  ELSE
    EXECUTE $view$
      CREATE OR REPLACE VIEW theses_from_design AS
      SELECT
        NULL::uuid AS id,
        NULL::text AS title,
        NULL::text AS slug,
        NULL::text AS description,
        NULL::jsonb AS tenets,
        NULL::jsonb AS forbidden_angles,
        NULL::jsonb AS tone_guidelines,
        NULL::jsonb AS example_hooks,
        NULL::vector(384) AS centroid_embedding,
        NULL::integer AS version,
        NULL::boolean AS active,
        NULL::timestamptz AS created_at,
        NULL::timestamptz AS updated_at
      WHERE false
    $view$;
  END IF;
END
$migration$;

-- Rede Docker compartilhada (documentação; a rede real é criada no docker-compose)
COMMENT ON SCHEMA design IS 'Design System tables — consolidated from rota_design database';
