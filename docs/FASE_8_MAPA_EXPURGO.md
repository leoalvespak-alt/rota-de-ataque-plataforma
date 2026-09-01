# Fase 8 — Mapa pré-expurgo

Data do levantamento: 2026-08-31

Repo autoritativo:

C:/Users/Lenovo/Desktop/Rota de Ataque/Sistema de Design/plataforma

Este arquivo foi criado antes das exclusões e registra o escopo e as referências encontradas.

## Estado inicial verificável

- 41 diretórios em workers;
- 18 packages internos;
- 41 entradas em QUEUE_NAMES;
- catálogo AUTOMATION_ENGINES com 7 engines M0–M6;
- Prospector: 39 migrations aplicadas, última 0039_publication_compatibility;
- Prospector: 141 tabelas públicas no banco novo da Fase 7;
- Design: 7 migrations aplicadas, última 0033_thesis_mapping.sql;
- compose legado com Postgres, Redis, embeddings, web, migrate, scheduler, cron, Caddy, Prometheus, Grafana e workers individuais;
- compose Dokploy com scheduler e serviços worker-engine-m0 até worker-engine-m6.

O banco da Rota de Ataque não faz parte deste inventário.

## Workers

### Remover — 35 alvos definidos no plano

discovery, adaptive-crawler, extraction, competitive-intel, reddit-intelligence, audience-overlap, collab-discovery, community-map, follower-mining, search-mining, live-monitor, mention-monitor, reciprocity-detector, source-roi, enrichment, engagement, whatsapp-inbound, whatsapp-outbound, conversation-agent, dm-copilot, private-reply, contact-policy-engine, next-best-channel, nba-engine, identity-resolver, scoring, classification, email-flow-engine, email-events-consumer, meta-sync, meta-webhook-consumer, conversion-tracking, retention-tracker, threads-adapter, threads-publisher.

### Preservar

news-radar, content-opportunity e content-item-orchestrator.

publisher, alerts e data-quality são substitutos de fases posteriores; não serão executados nesta fase e seus diretórios legados serão removidos para que o runtime final contenha somente as três lógicas solicitadas.

## Filas, engines e supervisão

Referências encontradas:

- packages/shared/src/queue-names.ts lista 41 workers;
- packages/shared/src/automation-engines.ts descreve M0–M6;
- packages/shared/src/automation-engines.test.ts congela 41 workers e 7 engines;
- packages/queue/src/index.ts cria uma Queue BullMQ por entrada de QUEUE_NAMES e contém políticas específicas de workers mortos;
- packages/queue/src/scheduler.ts e packages/queue/src/index.ts configuram schedulers fixos e MANAGED_SCHEDULER_CONFIG;
- docker/worker-entrypoint.sh, docker/worker-supervisor.mts e docker/worker-supervisors.json executam/agregam os workers antigos;
- docker/docker-compose.yml cria os workers antigos e a observabilidade associada;
- docker/docker-compose.dokploy.yml cria scheduler e worker-engine-m0..m6.

Decisão de Fase 8: remover o scheduler/supervisor de Prospector, o catálogo M0–M6 e o pacote interno BullMQ do Prospector. O Redis que permanece no compose Fase 7 serve apenas ao runtime editorial atual do Design System; a remoção completa de Redis é Fase 9.

## Packages e dependências

### Packages exclusivos da arquitetura removida

apify-api, bright-data-api, browser, channel-router, email-provider, exa-api, humanizer, meta-api, nlp, notifications, reddit-api, threads-api, whatsapp-cloud.

As referências foram encontradas nos workers de scraping/inteligência, outbound/CRM, webhooks e nos scripts/configurações de runtime.

### Packages preservados

db, shared, ui-bridge e organic-intelligence permanecem por serem usados pelo núcleo editorial/web. queue não será mantido como package BullMQ do Prospector; suas referências restantes serão removidas ou adaptadas para não reintroduzir filas antigas.

Dependências diretas a remover do workspace/app web: email-provider, meta-api, notifications e whatsapp-cloud. A dependência de meta-api no package.json raiz também é morta.

## Rotas API a remover

- api/market-watches;
- api/market-watches/canary;
- api/admin/research/run;
- api/engagement/actions;
- api/engagement/actions/[id];
- api/engagement/approve;
- api/identities/candidates;
- api/identities/candidates/[id]/[action];
- api/identities/rollback/[id];
- api/meta/oauth;
- api/meta/webhook;
- api/whatsapp;
- api/email/confirm;
- api/email/webhook;
- api/email/flows;
- api/email/subscribe;
- api/leads;
- api/contact-policies;
- api/reddit;
- api/admin/competitors;
- api/admin/competitor-insights;
- api/admin/organic-budgets;
- api/admin/organic-metrics;
- api/admin/notifications/test;
- api/admin/whatsapp-groups;
- api/performance/source-roi.

As rotas editoriais mantidas são content-items, content-opportunities, theses, radar/findings, publicações, review-inbox e creative-bridge. APIs que misturam dados mortos serão revisadas depois da remoção dos arquivos e dos imports.

## Telas a remover

accounts, leads, prospeccao, relacionamento, conversations, identities, communities, community, contact-policies, email-flows, engagement-queue, competitive-intel, source-roi, inteligencia/comunidades, inteligencia/concorrentes, inteligencia/mercado, publico, decisoes/engajamento, performance/roi, organic-budgets, sistema/avancado/scoring, sistema/avancado/workers, sistema/avancado/filas, sistema/motores, automations e automacoes.

Preservar explicitamente: radar, market-radar, inteligencia/radar, theses, planejamento, content-items, content-opportunity, conteudo, publicacao, publishing, review-inbox, creative-bridge, ai-settings, configs, desempenho, performance/conteudo, timeline, sistema/saude e login.

## Tabelas e critério de DROP

Inventário pré-expurgo no banco prospector: 141 tabelas públicas.

Domínio preservado: news_sources, news_items, radar_findings, theses, thesis_revisions, editorial_rules, todas as tabelas content_*, opportunities, post_radar, scheduled_publications, publication_metric_snapshots, unified_creatives e creative_bridge_deliveries.

O conjunto CRM/outbound e market_watches foi mapeado por nomes e por imports/rotas. Antes de qualquer DROP, a migration nova será limitada a tabelas comprovadamente sem referência ativa após o expurgo. Tabelas email_*, worker_*, audit/operacionais e outras com uso ou dependência ambígua serão preservadas nesta fase.

O backup/checkpoint do banco prospector será criado antes da aplicação da migration destrutiva. A migration histórica não será apagada nem editada.

## Docker, envs e testes

Remover os manifests legados de Prospector/Dokploy que iniciam workers, engines, scheduler, embeddings, observabilidade e Postgres próprio. Preservar docker/docker-compose.phase7.yml, Caddyfile.phase7 e o Dockerfile de migrations usado pelo stack mínimo.

Remover dos exemplos e contratos apenas envs que não tiverem referência após o expurgo. Não alterar envs da Rota.

Remover ou reescrever testes cujo único contrato seja 41 workers/7 engines/filas BullMQ antigas. Manter testes do núcleo editorial, banco, ui-bridge, Design System e health.

## Método de validação pós-exclusão

1. rg sem referências aos 35 workers removidos, aos 7 engines e aos packages exclusivos;
2. pnpm install/lockfile consistente;
3. build, TypeScript e testes relevantes;
4. migrations e contagem de tabelas;
5. Prospector e Design iniciam pelo compose Fase 7;
6. liveness/ready, endpoints editoriais e integração Prospector → Design;
7. restart/persistência;
8. Rota novamente saudável.
