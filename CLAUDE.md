# Plataforma Rota de Ataque

Monorepo pnpm + Turborepo. `apps/design-system` permanece independente e não pode importar de `apps/web` nem de `workers`. Workers importam somente de `packages/*`. Consulte `../Docs/README.md` e o documento canônico do produto antes de mudanças estruturais.

## ⚠️ REGRA CRÍTICA — Branch e commit

**Sempre commitar diretamente em `main`. NUNCA criar branches nem PRs.**

A proteção de branch foi removida no GitHub. Fazer commit em `main` e `git push origin main` é o único fluxo correto — o CI/CD cuida do deploy automaticamente. Criar uma branch ou PR é erro operacional.

## Deploy

Deploy automático: push para `main` → GitHub Actions builda imagens GHCR → SSH deploya na VPS.

```powershell
# Deploy completo (todos os projetos)
.\deploy\deploy-all.ps1

# Projeto específico
.\deploy\deploy-all.ps1 -Only design       # Design System (web + API)
.\deploy\deploy-all.ps1 -Only design-api   # Só a API
.\deploy\deploy-all.ps1 -Only gazeta       # Gazeta
.\deploy\deploy-all.ps1 -Only plataforma   # Plataforma 2.0

# Sem commit/push (usa imagens já no GHCR)
.\deploy\deploy-all.ps1 -Only design -SkipPush

# Migrations locais do editorial/Design: docker/docker-compose.phase7.yml
```

Ver `deploy/DEPLOY.md` para detalhes. Pré-requisitos: chave SSH em `~/.ssh/id_rsa` e `gh` CLI autenticado.
