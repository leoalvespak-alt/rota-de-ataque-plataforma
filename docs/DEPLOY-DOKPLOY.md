# Deploy — Dokploy

> Estado: implementado e verificado em 20/08/2026.

## Configuração no Dokploy

- **Tipo:** Compose
- **Repo:** leoalvespak-alt/rota-de-ataque-plataforma
- **Branch:** eat/ui-ux-prospector-completion
- **Compose Path:** docker/docker-compose.yml
- **Trigger:** Autodeploy ativo (push dispara rebuild)
- **URL do painel:** http://187.127.249.22:3000

## Variáveis de ambiente (aba Environment do Dokploy)

> NUNCA usar env_file no docker-compose.yml — o Dokploy apaga a pasta antes de cada deploy.

`
NODE_ENV=production
DATABASE_URL=postgresql://prospector:YOUR_PASSWORD@postgres:5432/prospector
REDIS_URL=redis://redis:6379
APP_URL=https://prospector.rotadeataque.com.br
META_API_VERSION=v21.0
META_APP_SECRET=YOUR_VALUE
META_WEBHOOK_VERIFY_TOKEN=YOUR_VALUE
EMBEDDINGS_PROVIDER=local
EMBEDDINGS_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDINGS_ENDPOINT=http://tei:8080
EMBEDDING_DIM=384
TOKEN_ENCRYPTION_KEY=YOUR_32_CHAR_MIN_KEY
WORKERS_DEFAULT_ENABLED=false
OTP_SECRET=YOUR_VALUE
RESEND_API_KEY=YOUR_VALUE
RESEND_FROM=no-reply@rotadeataque.com.br
`

## Serviços do Compose

| Serviço | Imagem | Papel |
|---|---|---|
| postgres | pgvector/pgvector:pg16 | Banco principal + pgvector (embeddings) |
| edis | edis:7.4-alpine | Filas BullMQ + locks + cache |
| embeddings | ghcr.io/huggingface/text-embeddings-inference:cpu-1.8 | TEI local (dim=384) |
| web | build local | Next.js 15 (dashboard) |
| worker-* (40x) | build local | Workers BullMQ |
| cron | build local | Backup agendado |
| prometheus | prom/prometheus:v3.2.1 | Métricas |
| grafana | grafana/grafana:11.5.2 | Dashboards |

## Deploy passo a passo

1. Acesse http://187.127.249.22:3000
2. Vá em **Projects → rotadeataque → prospector**
3. Clique em **Deploy**
4. Acompanhe em **Deployments** → log do deploy
5. O primeiro build demora ~15 min (download de imagens + compilação)

## Restore do banco após primeiro deploy

`ash
# SSH na VPS
ssh root@187.127.249.22

# Identificar o container postgres do Compose
docker ps | grep prospector

# Restaurar dump
cat /opt/prospector-platform/shared/backups/NOME.dump \
  | docker exec -i NOME_CONTAINER_POSTGRES \
    pg_restore -U prospector -d prospector -1 --no-owner --role=prospector
`

## Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| env_file not found | Dokploy apaga pasta antes do deploy | Remover env_file do docker-compose.yml; usar aba Environment |
| Build cancelado em ~14 min | CPU 100% — timeout de imagem | Deploy novamente; builds longos normais no primeiro |
| Workers não sobem | WORKERS_DEFAULT_ENABLED=false | Esperado no cutover inicial. Habilitar por campanha |
| Module not found: @/lib/X | Arquivo ausente no web app | Criar o arquivo em pps/web/src/lib/ |
| Build 1/40+ com #CANCELED | Timeout Docker buildx | O Dokploy vai tentar de novo no próximo deploy |
