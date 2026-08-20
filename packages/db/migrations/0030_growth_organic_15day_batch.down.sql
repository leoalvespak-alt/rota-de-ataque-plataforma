-- 0030 down — Remove o ciclo orgânico de 15 dias sem tocar em nenhum outro dado.
-- Ordem de remoção respeita as FKs e os triggers de imutabilidade (sessão humana).

BEGIN;

DELETE FROM scheduled_publications
WHERE batch_id = 'd15db4a0-2026-4a08-8a15-d00000000030'::uuid;

DELETE FROM content_variants
WHERE content_item_id IN (
  SELECT id FROM content_items WHERE locked_by = 'organic-15day-batch-v1'
);

DELETE FROM content_items
WHERE locked_by = 'organic-15day-batch-v1';

DELETE FROM content_opportunities
WHERE evidence->>'seed' = 'organic-15day-batch-v1';

DELETE FROM theses
WHERE slug = 'escolha-a-farda-certa'
  AND locked_by = 'organic-15day-batch-v1';

COMMIT;
