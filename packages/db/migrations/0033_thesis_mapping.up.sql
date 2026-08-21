-- ============================================================
-- Migration 0033 — thesis_mapping (UP)
-- Mapeamento bidirecional de teses e trigger de audit log
-- ============================================================

-- 1. Adicionar mapeamento na editorial_theses (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'editorial_theses') THEN
    -- Adicionamos sem FK estrita (REFERENCES) para não quebrar no CI onde o schema `public` está limpo, 
    -- da mesma forma que fizemos na migration 0032.
    ALTER TABLE editorial_theses 
      ADD COLUMN IF NOT EXISTS prospector_thesis_id uuid;
      
    CREATE INDEX IF NOT EXISTS editorial_theses_prospector_idx 
      ON editorial_theses (prospector_thesis_id)
      WHERE prospector_thesis_id IS NOT NULL;
  END IF;
END $$;

-- 2. Trigger para log de auditoria de criativos publicados
CREATE OR REPLACE FUNCTION audit_creative_published()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Se o status mudou para 'published'
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    -- Inserir no audit_log de forma segura, se a tabela audit_log existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
      INSERT INTO audit_log(actor_id, action, target, after)
      VALUES (
        'system',
        'creative.status_changed',
        NEW.id::text,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'origin', NEW.origin,
          'published_at', now()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creative_status_audit ON unified_creatives;
CREATE TRIGGER creative_status_audit
  AFTER UPDATE OF status ON unified_creatives
  FOR EACH ROW
  EXECUTE FUNCTION audit_creative_published();
