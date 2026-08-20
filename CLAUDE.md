# Plataforma Rota de Ataque

Monorepo pnpm + Turborepo. `apps/design-system` permanece independente e não pode importar de `apps/web` nem de `workers`. Workers importam somente de `packages/*`. Consulte `../Docs/README.md` e o documento canônico do produto antes de mudanças estruturais.

## Deploy

O deploy é feito pelo script unificado `deploy/deploy-all.ps1`. Ele cobre tudo: Design System, Prospector (web + workers), migrations e validações.

```powershell
# Deploy completo (design system + prospector + migrations + workers)
.\deploy\deploy-all.ps1

# Só o Design System (build Vite local → SCP → swap atômico no nginx)
.\deploy\deploy-all.ps1 -Only design

# Só o Prospector (código → VPS → Docker build remoto → migrations → web + workers)
.\deploy\deploy-all.ps1 -Only prospector

# Pular build (publica o que já está em dist/ ou a imagem Docker existente)
.\deploy\deploy-all.ps1 -SkipBuild
```

Pré-requisitos: chave SSH em `~/.ssh/id_rsa` e `CREDENCIAIS_VPS.txt` na raiz do workspace. Ver `deploy/DEPLOY.md` para detalhes.

**Não use** os scripts antigos em `apps/design-system/deploy/` — foram removidos. O único script de deploy é `deploy/deploy-all.ps1`.
