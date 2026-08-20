# Plataforma Rota de Ataque

Monorepo pnpm + Turborepo. `apps/design-system` permanece independente e nÃ£o pode importar de `apps/web` nem de `workers`. Workers importam somente de `packages/*`. Consulte `docs/architecture/README.md` e o plano mestre na pasta superior antes de mudanÃ§as estruturais.

# Deploy

Este monorepo é servido via **Dokploy** (Compose) na VPS 187.127.249.22:3000.
Consulte docs/DEPLOY-DOKPLOY.md para o guia completo de deploy, variáveis de ambiente e restore de banco.

Regras críticas:
- **Nunca adicionar env_file no docker-compose.yml** — o Dokploy apaga a pasta antes de cada deploy.
- Workers iniciam com WORKERS_DEFAULT_ENABLED=false no cutover inicial.
- Para migrations, use o profile 'tools' do Compose: docker compose --profile tools run migrate.
