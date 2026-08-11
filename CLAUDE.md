# Plataforma Rota de Ataque

Monorepo pnpm + Turborepo. `apps/design-system` permanece independente e não pode importar de `apps/web` nem de `workers`. Workers importam somente de `packages/*`. Consulte `docs/architecture/README.md` e o plano mestre na pasta superior antes de mudanças estruturais.
