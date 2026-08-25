# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo, no formato Keep a Changelog.

## [Unreleased]

### Implemented (2026-08-24)

- Auditoria de fechamento (25/08): allowlist pública passou a respeitar método HTTP; `run-now` exige consumer `running`; scheduler remove recorrências de workers desligados; health exige a migration exata; runtime consulta papel/saúde da conta no banco; canário sintético conclui `worker_runs`; e o catálogo cobre todos os reason codes emitidos.
- Gate SQL executado em PostgreSQL descartável com as 35 migrations e 777 literais; corrigido o contrato de `whatsapp_messages.created_at`. O manifesto de runtime preserva scheduler e 41 consumidores, sem tocar a base de produção.
- Agendamentos cron agora fixam UTC tanto na prévia quanto no BullMQ, removendo divergência de horário entre Windows, CI e containers Linux.
- Os 41 consumidores foram consolidados em sete supervisores Node por motor, preservando filas, controles e heartbeats individuais. O manifesto é validado contra todos os entrypoints e o deploy exige scheduler + sete supervisores na imagem da release; a mudança elimina a saturação comprovada na VPS com 41 processos isolados.
- Pré-requisitos opcionais que bloqueiam o import de um worker agora geram diagnóstico estruturado e runtime de fallback pausado, sem derrubar os demais consumidores do motor; uma execução indevida falha com reason code catalogado.
- O runtime reserva o heartbeat canônico antes de qualquer leitura assíncrona de estado, evitando que métricas legadas publiquem `disabled` sobre o estado operacional `paused`.

- Entry point client-safe separado em `@plataforma/shared/client`; o Turbo agora aguarda o build do próprio pacote antes de lint, typecheck e testes, evitando corrida com `.next/types` e testes contra `dist` obsoleto.

- Reconciliado o branch local com `origin/main` sem reescrever a migration publicada `0034`; criada a `0035_reconcile_automation_runtime` com remapeamentos, proveniência editorial, estados/contagens de execução, reason codes e incidentes.
- Compose de deploy contém scheduler e sete supervisores que hospedam exatamente os 41 workers, além de checker estrutural do runtime; `check-runtime-deps` e o inventário de rotas passam localmente.
- Separados liveness, readiness e saúde operacional; `AppShell`, middleware e allowlist pública agora usam os contratos reais de health/webhooks sob o base path.
- Aprovação de sugestão deixou de criar publicação diretamente e passou a criar/ligar oportunidade; agendamento exige item e variante aprovados e o funil expõe proveniência e transições órfãs.
- Navegação principal consolidada em sete áreas, preservando recursos legados por redirects e abas avançadas.
- Validação pré-deploy: suíte monorepo verde, migrations reversíveis, SQL real e Compose renderizado. E2E autenticado, canário sem efeito externo e inspeção pós-deploy são executados na release publicada.

### Changed

- **Prospector — simplificação operacional completa** (22/08/2026):
  - migration aditiva `0034_automation_engines`, snapshot dos 41 workers e catálogo compartilhado de sete motores, sem escrita em `enabled`;
  - APIs transacionais de motores, pré-requisitos reais, cascata auditável, replay idempotente e execução imediata somente para workers schedulable;
  - Automações em Motores, Workers, Filas e Agendamentos, com presets, cron personalizado validado, preview e recusa HTTP 409 para workers acionados por evento;
  - sete destinos canônicos, Modo Simples/Avançado, Command Palette por aba e 27 redirects HTTP 308 que preservam os 28 pontos de entrada anteriores junto da raiz;
  - Centro de Comando Hoje, funil editorial, desempenho de conteúdo e ajuda contextual por rota, aba e motor;
  - testes de inventário, migration, scheduler, handlers, navegação, redirects e acessibilidade.

### Fixed

- **Prospector — correções P0 e plano de controle de workers** (19/08/2026):
  - C1: `news_sources.active` (não `enabled`) em `OverviewReadiness`; crash no `finally` corrigido para `catch` com `<EmptyState>`.
  - C2: `audit_log.at` aliasado como `created_at` na página de Contas.
  - C3: TanStack Table v9 — `ui-bridge` exporta `gridFeatures` com features e row models registrados; estado de paginação gerenciado externamente; `createColumnHelper` re-exportado; todos os consumidores atualizados.
  - C4: Saúde do Sistema lê `worker_settings` do banco (não env vars).
  - C5: `beat()` faz cleanup de heartbeats de instâncias antigas; migration `0027` remove heartbeats >2h e resolve alertas órfãos.
  - C6: Agendamento configurável via UI (coluna inline) e API (`set_schedule` com retorno antecipado antes do INSERT em `worker_commands`).
  - C7: Migration `0028` promove baseline manual a `content_opportunities` com CHECK constraint de status.
  - C8: `content_structure` (roteiro/legenda/slides/obs) adicionado a `scheduled_publications`, API e `SlotEditor`.
  - Migration `0029`: converte `hashtags`/`cta` de `text[]` para `jsonb` com cláusula `USING`.
  - Worker `alerts`: lê `worker_settings` do banco; workers desabilitados não disparam alertas dead-man.
  - Testes ui-bridge: 15/15 (9 arquivos).

- **Prospector — hotfix auth/basePath** (19/08/2026): corrigidos 5 bugs críticos que impediam login e causavam loop de redirect com 502:
  - Middleware: `NextURL.clone()` duplicava `/prospector` no header `Location` → trocado por `new URL()` puro.
  - Middleware: `/login` não era isento, causando loop infinito de redirect.
  - Middleware: matcher não cobria a raiz `/prospector` → bypass de autenticação silencioso.
  - Login: `signIn()` do next-auth apontava para `/api/auth` (app errado no nginx) → `SessionProvider basePath={appPath('/api/auth')}` via `NextAuthBasePath`.
  - `NEXTAUTH_URL` corrigido para terminar em `/api/auth` (contrato do next-auth v4).
  - `appPath()` removido de `router.push`/`<Link href>` em `ContentItemsClient` e `ContentItemActions`.

### Added

- Baseline editorial manual da campanha Rota de Ataque, derivado do documento
  canônico de crescimento: 6 teses, 7 ideias de calendário e 20 sugestões
  prioritárias, com migrations idempotentes e correção de escopo.
- Endpoint administrativo para criação e edição humana de publicações manuais,
  com transação, auditoria e contexto da campanha ativa.
- Monorepo pnpm/Turborepo para Design System, dashboard, packages e 29 workers.
- Baseline SHA-256 e logs de não regressão do Design System.
- Infra Docker Compose com Postgres/pgvector, Redis, embeddings, Caddy, observabilidade, web, cron de backup e todos os workers.
- Pacotes compartilhados de dados, filas, browser, Meta API, NLP, humanização, notificações e ponte visual.
- Dashboard Next.js com autenticação/RBAC, 16 áreas operacionais, APIs, webhooks, SSE, publicação e ponte de criativos.
- Migrações transacionais `up`/`down`, seeds, runbooks e políticas de cutover por feature flag.
- Backups diários de Postgres/Redis e backup semanal criptografado dos perfis Chromium.
- Deploy atômico no VPS compartilhado, com verificação independente de health e garantia de não reinício dos containers da Gazeta.
- Campanhas de produção `Rota de Ataque` e `Gazeta Concursos` criadas pela migration inicial.

### Changed

- O layout usa o papel real da sessão; viewers não consultam nem exibem o
  contador administrativo de notificações. A rota protegida responde 401/403
  em falhas de autorização, em vez de propagar erro 500.
- O calendário respeita o `basePath` do Prospector, edita o slot correto e
  inclui publicações manuais autônomas nas consultas por campanha.
- Sem preferência salva, o contexto abre Rota de Ataque como campanha inicial;
  seleções explícitas continuam persistidas normalmente.
- O deploy integral de 18/08/2026 aplicou as migrations `0020` e `0021`,
  publicou Design System e Prospector completos e confirmou o baseline `6/7/20`
  somente na campanha Rota de Ataque.
- `@plataforma/ui-bridge` passou a exportar sua camada visual completa; o
  Prospector agora consome botões, KPIs, campos, tabelas, drawers e gráficos com
  raios e bordas suaves, além de todos os aliases semânticos necessários.
- O tema ECharts resolve variáveis CSS para cores concretas antes de desenhar no
  canvas. O Overview ganhou funil, comparação por campanha e mix operacional
  baseados em dados reais, com estados vazios sem números simulados.
- O deploy integral de 17/08/2026 reconstruiu Design System, API, Prospector,
  scheduler e os 40 workers; backups, migrations e health checks passaram.
- O Prospector agora aplica `check:runtime-deps` dentro dos Dockerfiles, cria
  backup PostgreSQL antes de migrations e valida o ledger até `0019` no deploy.
- Migrations 0011/0014 ficaram compatíveis com instalações Prospector-only e
  schemas legados de `candidate_sources`, sem exigir marcação manual no ledger.
- WhatsApp individual mantém resposta escrita por humano, validada por `validateChannelText('whatsapp_dm', ...)`; o copiloto automático foi adiado conscientemente para reduzir risco operacional e o `conversation-agent` permanece exclusivo de Instagram DM.
- Insights cumulativos de publicações Instagram passam a alimentar `content_performance` sem duplicar métricas entre sincronizações.

- Design System movido integralmente para `apps/design-system` e renomeado para `@plataforma/design-system`.
- `class-variance-authority`, `clsx` e `tailwind-merge` reclassificados como dependências de runtime conforme decisão D1.
- `playwright` declarado como dependência de runtime após o gate H.1.2 detectar uso em `src/server/render/playwrightRenderer.ts`.
- Exceção de peer documentada para preservar a combinação Storybook 10.5.5/add-ons 8.6.14 já existente, sem alterar versões durante a migração.
- Override `storybook@^10.5.5 → 10.5.5` para impedir que a primeira resolução pnpm altere a versão comprovada no baseline npm.
- Build `standalone` do Next.js restrito ao Linux/Docker; no Windows o build evita symlinks que exigem privilégio de desenvolvedor.
- Modelo local de embeddings ajustado para `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensões e suporte multilíngue), pois o identificador planejado `bge-small-pt` não existe no registry.

- Testes E2E do Design System alinhados à interface vigente após inspeção visual: a mudança em `tests/` foi autorizada para remover expectativas órfãs, mantendo a gate de não regressão verde; o hash correspondente foi regenerado.

### Security

- Separação estrutural entre contas `collector` e `actor` e bloqueio de DM fria incorporados aos contratos.

## [0.1.0] - 2026-08-08

### Added

- Fundação inicial da plataforma.
