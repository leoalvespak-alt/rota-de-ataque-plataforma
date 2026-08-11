# Arquitetura

## Limites

`apps/design-system` é a SPA original e não depende da plataforma. `apps/web` consome somente `packages/*`; a UI chega pelo `ui-bridge`. Os 29 workers consomem contratos dos packages e nunca importam apps.

## Fluxo principal

Meta API/Playwright → filas idempotentes → classificação → scoring → Review Inbox → ação aprovada → reciprocidade/conversão → Source ROI. DM só responde a inbound; `collector` só coleta e `actor` só executa ações/API.

## Dados e idempotência

Postgres 16 + pgvector (384 dimensões) é a fonte de verdade. BullMQ usa `jobId` determinístico, DLQ por fila e grava `failed_jobs`, `events` e `error_events`. Migrations têm `up`/`down` e gate transacional.

## Operação

Redis mantém filas, mutex por conta, kill switches e AOF/RDB. Adaptive Crawling decide quando coletar; feature flags deixam todos os workers desligados no cutover inicial. Heartbeats, SLOs, canários, Sentry, Prometheus e notificações cobrem falhas silenciosas.

## Segurança

Tokens Meta usam AES-256-GCM em repouso, scrubbing de logs e rotação. Ações externas exigem aprovação humana até liberação explícita por campanha. Nenhum payload sensível usa query string.
