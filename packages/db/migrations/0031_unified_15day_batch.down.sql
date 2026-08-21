BEGIN;
DELETE FROM scheduled_publications WHERE batch_id = 'd15db4a0-2026-4a08-8a15-d00000000031';
DELETE FROM content_opportunities WHERE id IN (SELECT id FROM content_opportunities WHERE evidence->>'source' = 'PLANO-DE-PUBLICACAO-15-DIAS-UNIFICADO');
COMMIT;
