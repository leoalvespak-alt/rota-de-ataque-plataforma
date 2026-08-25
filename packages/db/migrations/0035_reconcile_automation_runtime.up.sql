BEGIN;

-- 0034 is already present in production. Runtime and editorial reconciliation
-- belong in a new migration and never rewrite the applied catalog migration.

ALTER TABLE worker_settings
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS required_account_role text
    CHECK (required_account_role IS NULL OR required_account_role IN ('collector', 'actor'));

UPDATE worker_settings
SET required_account_role = 'collector'
WHERE worker_name IN (
  'collab-discovery', 'discovery', 'extraction', 'follower-mining',
  'live-monitor', 'news-radar', 'search-mining'
);

UPDATE worker_settings
SET required_account_role = 'actor'
WHERE worker_name IN (
  'conversation-agent', 'dm-copilot', 'engagement', 'meta-sync',
  'private-reply', 'publisher', 'retention-tracker', 'whatsapp-outbound'
);

-- Messages created before delivery need a stable ordering timestamp in the
-- consolidated relationship view.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE worker_runs
  ADD COLUMN IF NOT EXISTS result_state text,
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS input_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

UPDATE worker_runs
SET result_state = CASE
  WHEN status = 'completed' THEN 'succeeded'
  WHEN status = 'skipped' THEN 'skipped'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'blocked'
END
WHERE result_state IS NULL;

ALTER TABLE worker_runs
  ALTER COLUMN result_state SET DEFAULT 'running';

ALTER TABLE worker_runs DROP CONSTRAINT IF EXISTS worker_runs_result_state_check;
ALTER TABLE worker_runs ADD CONSTRAINT worker_runs_result_state_check
  CHECK (result_state IN ('succeeded','skipped','blocked','failed','running'));

CREATE INDEX IF NOT EXISTS worker_runs_worker_result_idx
  ON worker_runs(worker_name, result_state, started_at DESC);

CREATE TABLE IF NOT EXISTS automation_reason_codes (
  code text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('success','input','prerequisite','runtime','integration','policy','sql','external','human')),
  title_pt text NOT NULL,
  explanation_pt text NOT NULL,
  retryable boolean NOT NULL DEFAULT false,
  next_action_pt text NOT NULL,
  runbook_href text
);

INSERT INTO automation_reason_codes(code, category, title_pt, explanation_pt, retryable, next_action_pt, runbook_href)
VALUES
  ('NO_INPUT', 'input', 'Sem entrada', 'A execução terminou sem itens elegíveis para processar.', false, 'Revise a fonte e aguarde uma nova coleta.', '/docs/runbooks/automations'),
  ('PREREQUISITE_MISSING', 'prerequisite', 'Pré-requisito pendente', 'Uma dependência obrigatória ainda não está configurada.', false, 'Abra o checklist de prontidão e resolva o item indicado.', '/docs/runbooks/automations'),
  ('ACCOUNT_AUTH_REQUIRED', 'integration', 'Conta requer autenticação', 'A conta do canal não possui uma sessão válida.', false, 'Vincule ou reautorize a conta do canal.', '/docs/runbooks/automations'),
  ('PROVIDER_NOT_CONFIGURED', 'integration', 'Provedor não configurado', 'O provedor necessário está desligado ou sem segredo disponível.', false, 'Configure o provedor e valide um canário.', '/docs/runbooks/automations'),
  ('BUDGET_NOT_CONFIGURED', 'prerequisite', 'Orçamento não configurado', 'Não existe um teto de consumo válido para esta execução.', false, 'Defina um orçamento antes de ativar o motor.', '/docs/runbooks/automations'),
  ('MIGRATION_DRIFT', 'runtime', 'Migration divergente', 'O schema esperado pelo worker não corresponde ao banco em execução.', false, 'Aplique as migrations pendentes e rode o gate SQL.', '/docs/runbooks/automations'),
  ('RUNTIME_UNAVAILABLE', 'runtime', 'Runtime indisponível', 'O comando foi aceito, mas não há consumer saudável para processá-lo.', true, 'Suba o scheduler/consumer e tente novamente.', '/docs/runbooks/automations'),
  ('QUEUE_UNAVAILABLE', 'runtime', 'Fila indisponível', 'Redis ou a fila do motor não respondeu dentro do timeout.', true, 'Verifique Redis e o scheduler antes de repetir.', '/docs/runbooks/automations'),
  ('SQL_CONTRACT_ERROR', 'sql', 'Contrato SQL inválido', 'A execução encontrou uma query incompatível com o schema atual.', false, 'Corrija a query, rode o gate SQL e valide um canário.', '/docs/runbooks/automations'),
  ('EXTERNAL_PROVIDER_ERROR', 'external', 'Provedor externo falhou', 'O canal externo recusou ou não concluiu a operação.', true, 'Confira o detalhe do provedor e o limite da conta.', '/docs/runbooks/automations'),
  ('POLICY_BLOCKED', 'policy', 'Bloqueado por política', 'A política de contato ou o kill-switch impediu a ação.', false, 'Revise a política e a aprovação humana.', '/docs/runbooks/automations'),
  ('HUMAN_APPROVAL_REQUIRED', 'human', 'Aprovação humana necessária', 'A ação não pode prosseguir sem uma decisão explícita do operador.', false, 'Abra a fila de decisões e aprove ou rejeite o item.', '/docs/runbooks/automations'),
  ('ALREADY_DONE', 'success', 'Ação já concluída', 'O efeito solicitado já existia e não precisou ser repetido.', false, 'Nenhuma ação necessária.', NULL),
  ('PROFILE_UNAVAILABLE', 'input', 'Perfil indisponível', 'O perfil necessário não pôde ser localizado ou lido.', true, 'Confirme o perfil de origem e tente novamente.', '/docs/runbooks/automations'),
  ('ACTION_REJECTED', 'policy', 'Ação rejeitada', 'A política do canal ou uma regra de segurança rejeitou a ação.', false, 'Revise a política aplicável antes de tentar novamente.', '/docs/runbooks/automations'),
  ('AUTH_REQUIRED', 'integration', 'Autenticação necessária', 'A sessão usada pela automação expirou ou não está autenticada.', false, 'Reautorize a conta e valide o estado da sessão.', '/docs/runbooks/automations'),
  ('CHECKPOINT', 'integration', 'Checkpoint do canal', 'O canal apresentou um desafio de segurança e interrompeu a automação.', false, 'Resolva o checkpoint manualmente antes de reativar o worker.', '/docs/runbooks/automations'),
  ('NAVIGATION_FAILED', 'external', 'Navegação falhou', 'O navegador não conseguiu concluir o fluxo esperado no canal externo.', true, 'Confira o trace e valide se a interface do canal mudou.', '/docs/runbooks/automations'),
  ('TIMEOUT', 'external', 'Tempo limite excedido', 'A operação não respondeu dentro do tempo permitido.', true, 'Verifique a disponibilidade do serviço e repita com segurança.', '/docs/runbooks/automations'),
  ('RATE_LIMITED', 'external', 'Limite de requisições atingido', 'O provedor reduziu temporariamente o volume aceito.', true, 'Aguarde a janela indicada pelo provedor antes de repetir.', '/docs/runbooks/automations'),
  ('API_ERROR', 'external', 'Erro na API externa', 'A API do canal retornou uma falha durante a operação.', true, 'Consulte o detalhe e o status do provedor antes de repetir.', '/docs/runbooks/automations'),
  ('HUMAN_REJECTED', 'human', 'Rejeitado pelo operador', 'Um operador rejeitou explicitamente a ação proposta.', false, 'Revise a decisão registrada; não repita sem nova aprovação.', '/docs/runbooks/automations'),
  ('DM_COLD_BLOCKED', 'policy', 'Mensagem fria bloqueada', 'A política proíbe iniciar mensagem privada sem interação elegível.', false, 'Aguarde uma interação de entrada ou resposta privada permitida.', '/docs/runbooks/automations'),
  ('ROLE_MISMATCH', 'prerequisite', 'Papel de conta incompatível', 'O worker requer uma conta saudável com outro papel operacional.', false, 'Configure uma conta com o papel indicado e reative o worker.', '/docs/runbooks/automations'),
  ('PREFLIGHT_FAILED', 'prerequisite', 'Verificação de prontidão falhou', 'Uma validação obrigatória do worker falhou antes da execução.', false, 'Abra o detalhe da execução e resolva o pré-requisito indicado.', '/docs/runbooks/automations'),
  ('SYNTHETIC_EXTERNAL_BLOCKED', 'policy', 'Ação externa bloqueada no canário', 'Um teste sintético tentou executar uma ação em serviço externo.', false, 'Mantenha o canário sem efeitos externos e revise o worker.', '/docs/runbooks/automations'),
  ('UNKNOWN', 'runtime', 'Falha não classificada', 'A execução falhou sem um código de causa reconhecido.', true, 'Abra o runbook e preserve o trace para investigação.', '/docs/runbooks/automations'),
  ('SUCCESS', 'success', 'Concluído', 'A execução produziu o resultado esperado.', false, 'Nenhuma ação necessária.', NULL)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  title_pt = EXCLUDED.title_pt,
  explanation_pt = EXCLUDED.explanation_pt,
  retryable = EXCLUDED.retryable,
  next_action_pt = EXCLUDED.next_action_pt,
  runbook_href = EXCLUDED.runbook_href;

CREATE TABLE IF NOT EXISTS automation_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  run_id uuid REFERENCES worker_runs(id) ON DELETE SET NULL,
  reason_code text NOT NULL REFERENCES automation_reason_codes(code),
  title_pt text NOT NULL,
  explanation_pt text NOT NULL,
  impact_pt text NOT NULL,
  next_action_pt text NOT NULL,
  runbook_href text,
  trace_id text,
  retryable boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  acknowledgment_note text,
  resolved_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS automation_incidents_open_idx
  ON automation_incidents(worker_name, occurred_at DESC)
  WHERE resolved_at IS NULL;

-- Preserve the 41-worker catalog while correcting the two mappings that were
-- discovered after 0034 was published.
UPDATE worker_settings
SET engine_key = 'M2', triggered_by = 'content-item-orchestrator'
WHERE worker_name = 'threads-adapter';

UPDATE worker_settings
SET engine_key = 'M6', triggered_by = 'engagement'
WHERE worker_name = 'reciprocity-detector';

ALTER TABLE content_suggestions
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES content_opportunities(id) ON DELETE SET NULL;

ALTER TABLE content_opportunities
  ADD COLUMN IF NOT EXISTS source_suggestion_id uuid REFERENCES content_suggestions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_suggestions_opportunity_unique
  ON content_suggestions(opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_opportunities_source_suggestion_unique
  ON content_opportunities(source_suggestion_id)
  WHERE source_suggestion_id IS NOT NULL;

COMMIT;
