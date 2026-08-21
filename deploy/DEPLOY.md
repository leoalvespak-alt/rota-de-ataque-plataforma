# Deploy — Plataforma Rota de Ataque

Deploy automatizado via GitHub Actions + GHCR + Dokploy + VPS.

## Arquitetura

| Projeto | Repo | Imagem GHCR | Deploy VPS | Porta |
|---------|------|-------------|------------|-------|
| Design System (SPA) | rota-de-ataque-plataforma | rota-design-web | nginx static files | 443 (nginx) |
| Design System (API) | rota-de-ataque-plataforma | rota-design-api | systemd + Docker | 3002 |
| Prospector | rota-de-ataque-plataforma | prospector-platform-web/worker | Dokploy compose | 3010 |
| Gazeta | gazetacon | (build no Dokploy) | Dokploy app | 3020 |
| Plataforma 2.0 | rota-de-ataque-v2 | plataforma-2.0 | Dokploy app | 3030 |

## Fluxo automático (push → produção)

1. Push para `main` em qualquer repo
2. GitHub Actions builda imagem Docker e envia ao GHCR
3. CI faz SSH para VPS e executa `/opt/rota-deploy/deploy.sh`
4. Script puxa imagem, reinicia serviço, roda migrations, limpa imagens antigas
5. Health check valida que o serviço está respondendo

## Uso manual

```powershell
cd plataforma

# Deploy completo (todos os projetos)
.\deploy\deploy-all.ps1

# Projeto específico
.\deploy\deploy-all.ps1 -Only design       # Design System web + API
.\deploy\deploy-all.ps1 -Only design-api   # Só a API
.\deploy\deploy-all.ps1 -Only prospector   # Prospector
.\deploy\deploy-all.ps1 -Only gazeta       # Gazeta
.\deploy\deploy-all.ps1 -Only plataforma   # Plataforma 2.0

# Sem commit/push (usa imagens já no GHCR)
.\deploy\deploy-all.ps1 -Only design -SkipPush

# Sem migrations
.\deploy\deploy-all.ps1 -Only prospector -NoMigrate

# Mensagem de commit personalizada
.\deploy\deploy-all.ps1 -Only design -Message "feat: new brand tokens"
```

## VPS deploy script

O script `/opt/rota-deploy/deploy.sh` na VPS aceita:

```bash
deploy.sh design-web          # Extrai SPA do container nginx → /var/www/
deploy.sh design-api --migrate # Reinicia systemd + migrations Drizzle
deploy.sh prospector --migrate # Dokploy compose redeploy + migrations
deploy.sh gazeta              # Dokploy app redeploy
deploy.sh plataforma          # Dokploy app redeploy
deploy.sh all                 # Todos os projetos
deploy.sh cleanup             # Remove imagens antigas (mantém latest + 1)
deploy.sh status              # Health check de todos os serviços
```

## Para IDE AI ("faça deploy")

O AI deve:
1. Identificar qual projeto foi alterado
2. Executar: `.\deploy\deploy-all.ps1 -Only <projeto>`
3. Ou via SSH direto: `ssh root@187.127.249.22 '/opt/rota-deploy/deploy.sh <projeto> --migrate'`

## Secrets necessários (GitHub Actions)

| Secret | Descrição | Repos |
|--------|-----------|-------|
| SSH_DEPLOY_KEY | Chave SSH privada (ed25519) para VPS | ambos |
| VPS_HOST | IP do VPS (187.127.249.22) | ambos |
| DOKPLOY_WEBHOOK_URL | URL webhook Dokploy | ambos |

## Pré-requisitos locais

1. SSH configurado (`~/.ssh/id_rsa` autorizado no VPS)
2. `gh` CLI autenticado
3. `git` com acesso push aos repos
