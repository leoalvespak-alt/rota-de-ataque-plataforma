# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo, no formato Keep a Changelog.

## [Unreleased]

### Added

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
