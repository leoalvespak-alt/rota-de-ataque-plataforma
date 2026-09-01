-- Fase 8: expurgo explícito do runtime legado.
--
-- O checkpoint prospector_pre_expurgo_20260831.dump foi criado antes desta
-- migration. O mapa docs/FASE_8_MAPA_EXPURGO.md registra referências, imports,
-- APIs, telas, envs, Docker e testes auditados. O Radar/editorial atual usa
-- news_*, radar_*, theses, content_* e research_runs; nenhum deles é tocado.
--
-- A lista abaixo foi confirmada sem referências ativas fora de migrations,
-- fixtures históricas e testes de contrato removidos nesta fase. DROP não usa
-- operações de cascata, para impedir remoção acidental de tabela ambígua.

BEGIN;

DELETE FROM worker_settings
WHERE worker_name NOT IN ('news-radar', 'content-opportunity', 'content-item-orchestrator');

DELETE FROM worker_heartbeats
WHERE worker NOT IN ('news-radar', 'content-opportunity', 'content-item-orchestrator');

ALTER TABLE worker_settings DROP CONSTRAINT IF EXISTS worker_settings_engine_key_fkey;
ALTER TABLE worker_settings DROP COLUMN IF EXISTS engine_key;

DROP TABLE IF EXISTS public.notification_deliveries;
DROP TABLE IF EXISTS public.alerts;
DROP TABLE IF EXISTS public.engine_commands;
DROP TABLE IF EXISTS public.automation_engines;
DROP TABLE IF EXISTS public.enrichment_jobs;
DROP TABLE IF EXISTS public.search_hits;
DROP TABLE IF EXISTS public.search_terms;
DROP TABLE IF EXISTS public.follower_deltas;
DROP TABLE IF EXISTS public.follower_snapshots;
DROP TABLE IF EXISTS public.live_interactions;
DROP TABLE IF EXISTS public.live_events;
DROP TABLE IF EXISTS public.crawl_schedule_history;
DROP TABLE IF EXISTS public.crawl_schedule;
DROP TABLE IF EXISTS public.reddit_evidence;
DROP TABLE IF EXISTS public.reddit_watches;
DROP TABLE IF EXISTS public.lead_community_membership;
DROP TABLE IF EXISTS public.community_edges;
DROP TABLE IF EXISTS public.communities;
DROP TABLE IF EXISTS public.competitor_candidates;

COMMIT;
