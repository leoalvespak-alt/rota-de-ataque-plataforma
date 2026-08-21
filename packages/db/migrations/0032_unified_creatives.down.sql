-- ============================================================
-- Migration 0032 — unified_creatives (DOWN / rollback)
-- Remove views de compatibilidade, trigger, função e tabela.
-- ATENÇÃO: dados inseridos diretamente em unified_creatives
-- após a migration UP NÃO são revertidos automaticamente para
-- as tabelas originais — faça backup antes do rollback.
-- ============================================================

-- 1. Remove views de compatibilidade
DROP VIEW IF EXISTS content_items_compat;
DROP VIEW IF EXISTS scheduled_publications_compat;

-- 2. Remove trigger e função
DROP TRIGGER IF EXISTS unified_creatives_updated_at ON unified_creatives;
DROP FUNCTION IF EXISTS update_unified_creatives_updated_at();

-- 3. Remove tabela principal (CASCADE remove índices)
DROP TABLE IF EXISTS unified_creatives CASCADE;
