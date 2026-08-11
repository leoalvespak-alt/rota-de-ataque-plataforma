# Plataforma integrada Rota de Ataque

Monorepo que mantém dois produtos isoláveis:

- `apps/design-system`: SPA React/Vite original, preservada como `@plataforma/design-system`.
- `apps/web`: dashboard Next.js da gestão de redes sociais e prospecção.

## Pré-requisitos

Node 22.18.0, Corepack e Docker Compose. Ative o gerenciador fixado com `corepack enable`, copie `.env.example` para `.env` e preencha apenas os segredos necessários ao ambiente.

## Comandos

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm --filter @plataforma/design-system dev
pnpm --filter @plataforma/web dev
```

Workers são habilitados individualmente por feature flags `WORKER_<NOME>_ENABLED`; todos iniciam desligados fora de testes.
