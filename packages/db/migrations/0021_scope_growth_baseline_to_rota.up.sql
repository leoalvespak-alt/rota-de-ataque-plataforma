-- Correção de escopo para instalações que aplicaram a versão inicial da migration 0020.
-- O manual de crescimento orgânico pertence somente à campanha Rota de Ataque.

DELETE FROM content_suggestions suggestion
USING campaigns campaign
WHERE suggestion.campaign_id = campaign.id
  AND campaign.name <> 'Rota de Ataque'
  AND suggestion.source_type = 'manual'
  AND suggestion.evidence->>'seed' = 'growth-organic-baseline-v1';

DELETE FROM scheduled_publications publication
USING campaigns campaign
WHERE publication.campaign_id = campaign.id
  AND campaign.name <> 'Rota de Ataque'
  AND publication.batch_id = 'c0a62026-0818-4020-8a00-000000000001'::uuid
  AND publication.origin = 'manual'
  AND publication.locked_by = 'growth-organic-baseline-v1';

DELETE FROM theses thesis
USING campaigns campaign
WHERE thesis.campaign_id = campaign.id
  AND campaign.name <> 'Rota de Ataque'
  AND thesis.origin = 'manual'
  AND thesis.locked_by = 'growth-organic-baseline-v1';
