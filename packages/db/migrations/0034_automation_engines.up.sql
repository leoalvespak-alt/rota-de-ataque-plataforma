BEGIN;

-- Etapa 1: Catálogo dos 7 motores de automação
-- GARANTIA: somente aditivo. Nenhuma linha existente é alterada. enabled NÃO aparece em nenhum UPDATE.

CREATE TABLE automation_engines (
  key          text PRIMARY KEY CHECK (key IN ('M0','M1','M2','M3','M4','M5','M6')),
  slug         text NOT NULL UNIQUE,
  name_pt      text NOT NULL,
  description_pt text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  always_on    boolean NOT NULL DEFAULT false,
  depends_on   text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO automation_engines (key, slug, name_pt, description_pt, sort_order, always_on, depends_on) VALUES
  ('M0', 'base-operacional',    'Base Operacional',              'Monitora saude do sistema e atualiza dados agregados. Sempre ativo.',                       0, true,  '{}'),
  ('M1', 'coleta-radar',        'Coleta e Radar',                'Captura noticias, RSS, Reddit, busca web, mencoes e concorrentes.',                         1, false, '{}'),
  ('M2', 'inteligencia',        'Inteligencia e Priorizacao',    'Classifica temas, extrai sentimento, ranqueia leads e calcula scores.',                     2, false, ARRAY['M1']),
  ('M3', 'motor-editorial',     'Motor Editorial',               'Transforma sinais em oportunidades de pauta e distribui formatos.',                         3, false, ARRAY['M2']),
  ('M4', 'publicacao',          'Publicacao',                    'Envia posts aprovados para Instagram e Threads. Exige aprovacao humana previa.',            4, false, ARRAY['M3']),
  ('M5', 'relacionamento',      'Relacionamento e Mensageria',   'Orquestra conversas, envios de e-mail, respostas privadas e WhatsApp.',                    5, false, ARRAY['M2']),
  ('M6', 'medicao-resultado',   'Medicao e Resultado',           'Calcula ROI por origem, conversoes de leads e retencao.',                                   6, false, ARRAY['M4','M5']);

ALTER TABLE worker_settings
  ADD COLUMN IF NOT EXISTS engine_key      text REFERENCES automation_engines(key),
  ADD COLUMN IF NOT EXISTS label_pt        text,
  ADD COLUMN IF NOT EXISTS description_pt  text,
  ADD COLUMN IF NOT EXISTS tier            text NOT NULL DEFAULT 'advanced' CHECK (tier IN ('basic','advanced')),
  ADD COLUMN IF NOT EXISTS schedulable     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS triggered_by    text,
  ADD COLUMN IF NOT EXISTS requires        jsonb NOT NULL DEFAULT '[]';

-- M0: Base Operacional
UPDATE worker_settings SET engine_key = 'M0', label_pt = 'Alertas', description_pt = 'Monitora dead-man e canary do sistema.', tier = 'advanced', schedulable = false, triggered_by = 'scheduler-fixo' WHERE worker_name = 'alerts';
UPDATE worker_settings SET engine_key = 'M0', label_pt = 'Qualidade de Dados', description_pt = 'Atualiza views materializadas e detecta inconsistencias.', tier = 'advanced', schedulable = true WHERE worker_name = 'data-quality';

-- M1: Coleta e Radar (12 workers)
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Radar de Noticias', description_pt = 'Captura noticias por RSS e fontes configuradas.', tier = 'basic', schedulable = true WHERE worker_name = 'news-radar';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Inteligencia Reddit', description_pt = 'Monitora subreddits e extrai mencoes e tendencias.', tier = 'advanced', schedulable = true WHERE worker_name = 'reddit-intelligence';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Rastreador Adaptativo', description_pt = 'Rastrea fontes com frequencia adaptativa por score.', tier = 'advanced', schedulable = true WHERE worker_name = 'adaptive-crawler';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Descoberta', description_pt = 'Descobre novos perfis e leads via busca e scraping.', tier = 'advanced', schedulable = false, triggered_by = 'campaign-event' WHERE worker_name = 'discovery';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Extracao', description_pt = 'Extrai dados de perfis descobertos.', tier = 'advanced', schedulable = false, triggered_by = 'discovery' WHERE worker_name = 'extraction';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Sincronizacao Meta', description_pt = 'Sincroniza dados com a API Meta (Instagram/WhatsApp).', tier = 'advanced', schedulable = false, triggered_by = 'meta-webhook-consumer' WHERE worker_name = 'meta-sync';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Webhook Meta', description_pt = 'Consome eventos de webhook da plataforma Meta.', tier = 'advanced', schedulable = false, triggered_by = 'meta-api' WHERE worker_name = 'meta-webhook-consumer';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Monitor de Mencoes', description_pt = 'Detecta mencoes a marca em tempo real.', tier = 'basic', schedulable = false, triggered_by = 'meta-webhook-consumer' WHERE worker_name = 'mention-monitor';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Mineracao de Seguidores', description_pt = 'Minera listas de seguidores para descoberta de leads.', tier = 'advanced', schedulable = false, triggered_by = 'campaign-event' WHERE worker_name = 'follower-mining';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Mineracao de Busca', description_pt = 'Minera resultados de busca por termos estrategicos.', tier = 'advanced', schedulable = false, triggered_by = 'campaign-event' WHERE worker_name = 'search-mining';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Monitor ao Vivo', description_pt = 'Monitora perfis em tempo real durante eventos ao vivo.', tier = 'advanced', schedulable = false, triggered_by = 'campaign-event' WHERE worker_name = 'live-monitor';
UPDATE worker_settings SET engine_key = 'M1', label_pt = 'Descoberta de Colabs', description_pt = 'Descobre oportunidades de colaboracao com criadores.', tier = 'advanced', schedulable = false, triggered_by = 'discovery' WHERE worker_name = 'collab-discovery';

-- M2: Inteligencia e Priorizacao (8 workers)
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Inteligencia Competitiva', description_pt = 'Analisa concorrentes e monitora posicionamento de mercado.', tier = 'basic', schedulable = true WHERE worker_name = 'competitive-intel';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Classificacao', description_pt = 'Classifica temas e extrai sentimento dos conteudos coletados.', tier = 'advanced', schedulable = false, triggered_by = 'news-radar' WHERE worker_name = 'classification';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Scoring de Leads', description_pt = 'Ranqueia leads por potencial de conversao.', tier = 'advanced', schedulable = false, triggered_by = 'extraction' WHERE worker_name = 'scoring';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Enriquecimento', description_pt = 'Enriquece perfis de leads com dados adicionais.', tier = 'advanced', schedulable = false, triggered_by = 'scoring' WHERE worker_name = 'enrichment';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Mapa de Comunidades', description_pt = 'Mapeia comunidades e clusters de interesse.', tier = 'advanced', schedulable = true WHERE worker_name = 'community-map';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Sobreposicao de Audiencia', description_pt = 'Detecta sobreposicao entre audiencias e fontes.', tier = 'advanced', schedulable = false, triggered_by = 'follower-mining' WHERE worker_name = 'audience-overlap';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Detector de Reciprocidade', description_pt = 'Detecta oportunidades de reciprocidade com seguidores.', tier = 'advanced', schedulable = false, triggered_by = 'extraction' WHERE worker_name = 'reciprocity-detector';
UPDATE worker_settings SET engine_key = 'M2', label_pt = 'Motor NBA', description_pt = 'Calcula a proxima melhor acao para cada lead.', tier = 'advanced', schedulable = false, triggered_by = 'scoring' WHERE worker_name = 'nba-engine';

-- M3: Motor Editorial (2 workers)
UPDATE worker_settings SET engine_key = 'M3', label_pt = 'Oportunidades de Conteudo', description_pt = 'Transforma sinais em oportunidades de pauta editorial.', tier = 'basic', schedulable = false, triggered_by = 'classification' WHERE worker_name = 'content-opportunity';
UPDATE worker_settings SET engine_key = 'M3', label_pt = 'Orquestrador Editorial', description_pt = 'Distribui conteudo aprovado para os formatos de publicacao.', tier = 'advanced', schedulable = false, triggered_by = 'content-opportunity' WHERE worker_name = 'content-item-orchestrator';

-- M4: Publicacao (3 workers)
UPDATE worker_settings SET engine_key = 'M4', label_pt = 'Publicacao Instagram', description_pt = 'Envia posts aprovados para o Instagram.', tier = 'basic', schedulable = true WHERE worker_name = 'publisher';
UPDATE worker_settings SET engine_key = 'M4', label_pt = 'Publicacao Threads', description_pt = 'Envia posts aprovados para o Threads.', tier = 'basic', schedulable = true WHERE worker_name = 'threads-publisher';
UPDATE worker_settings SET engine_key = 'M4', label_pt = 'Adaptador Threads', description_pt = 'Adapta conteudo para formato Threads antes da publicacao.', tier = 'advanced', schedulable = false, triggered_by = 'content-item-orchestrator' WHERE worker_name = 'threads-adapter';

-- M5: Relacionamento e Mensageria (11 workers)
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Motor de E-mail', description_pt = 'Orquestra envios de e-mail em fluxos automatizados.', tier = 'basic', schedulable = true WHERE worker_name = 'email-flow-engine';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Eventos de E-mail', description_pt = 'Consome eventos de e-mail (opens, clicks, bounces).', tier = 'advanced', schedulable = false, triggered_by = 'email-provider-webhook' WHERE worker_name = 'email-events-consumer';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'WhatsApp Recebimento', description_pt = 'Processa mensagens recebidas via WhatsApp.', tier = 'basic', schedulable = false, triggered_by = 'meta-webhook-consumer' WHERE worker_name = 'whatsapp-inbound';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'WhatsApp Envio', description_pt = 'Envia mensagens via WhatsApp com controle de politicas.', tier = 'basic', schedulable = false, triggered_by = 'contact-policy-engine' WHERE worker_name = 'whatsapp-outbound';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Agente de Conversa', description_pt = 'Gerencia o fluxo de conversas com leads.', tier = 'basic', schedulable = false, triggered_by = 'whatsapp-inbound' WHERE worker_name = 'conversation-agent';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Copiloto de DM', description_pt = 'Gera rascunhos de DM para revisao humana.', tier = 'advanced', schedulable = false, triggered_by = 'whatsapp-inbound' WHERE worker_name = 'dm-copilot';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Resposta Privada', description_pt = 'Envia respostas privadas aprovadas.', tier = 'advanced', schedulable = false, triggered_by = 'dm-copilot' WHERE worker_name = 'private-reply';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Engajamento', description_pt = 'Executa acoes de engajamento (follow, like, reply) aprovadas.', tier = 'advanced', schedulable = false, triggered_by = 'nba-engine' WHERE worker_name = 'engagement';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Motor de Politicas', description_pt = 'Avalia e aplica politicas de contato antes de envios.', tier = 'advanced', schedulable = false, triggered_by = 'conversation-agent' WHERE worker_name = 'contact-policy-engine';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Proximo Melhor Canal', description_pt = 'Decide qual canal usar para abordar cada lead.', tier = 'advanced', schedulable = false, triggered_by = 'nba-engine' WHERE worker_name = 'next-best-channel';
UPDATE worker_settings SET engine_key = 'M5', label_pt = 'Resolver Identidade', description_pt = 'Unifica identidades de leads entre canais.', tier = 'advanced', schedulable = false, triggered_by = 'enrichment' WHERE worker_name = 'identity-resolver';

-- M6: Medicao e Resultado (4 workers)
UPDATE worker_settings SET engine_key = 'M6', label_pt = 'ROI por Origem', description_pt = 'Calcula retorno sobre investimento por fonte de leads.', tier = 'basic', schedulable = false, triggered_by = 'scheduler-fixo' WHERE worker_name = 'source-roi';
UPDATE worker_settings SET engine_key = 'M6', label_pt = 'Rastreamento de Conversao', description_pt = 'Rastreia conversoes ao longo do funil.', tier = 'advanced', schedulable = false, triggered_by = 'engagement' WHERE worker_name = 'conversion-tracking';
UPDATE worker_settings SET engine_key = 'M6', label_pt = 'Rastreador de Retencao', description_pt = 'Monitora retencao e churn de leads convertidos.', tier = 'advanced', schedulable = false, triggered_by = 'scheduler-fixo' WHERE worker_name = 'retention-tracker';

CREATE TABLE engine_commands (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_key       text NOT NULL REFERENCES automation_engines(key),
  action           text NOT NULL CHECK (action IN ('enable','disable')),
  workers_affected text[] NOT NULL DEFAULT '{}',
  cascade          boolean NOT NULL DEFAULT false,
  requested_by     text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','rolled_back')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX engine_commands_engine_key_idx ON engine_commands(engine_key);
CREATE INDEX engine_commands_created_at_idx ON engine_commands(created_at DESC);

COMMIT;
