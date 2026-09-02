# Deploy — Plataforma Rota de Ataque

Deploy automático dos produtos de produção por GitHub Actions, GHCR e a VPS.
O Prospector editorial e o Design System desta fase rodam localmente pelo
compose versionado da Fase 7; a Rota de Ataque permanece fora deste expurgo.

## Fluxos automáticos

| Projeto | Repositório | Build | Ativação |
|---|---|---|---|
| Design System web/API | `rota-de-ataque-plataforma` | GitHub Actions → GHCR | nginx estático + systemd/Docker |
| Plataforma 2.0 | `rota-de-ataque-v2` | Docker build na VPS → GHCR | release versionada + PM2 |

Push direto para `main` dispara o workflow dos produtos de produção. O stack
editorial local usa somente o Compose canônico.

## Script canônico da VPS

O arquivo versionado é `deploy/rota-deploy.sh`; a instalação operacional fica em
`/opt/rota-deploy/deploy.sh` com modo `755`. Todos os deploys usam o lock global
`/run/lock/rota-deploy.lock`, inclusive o build longo da Plataforma 2.0.

Antes da ativação, o próprio workflow envia o script versionado como `.candidate`,
valida com `bash -n`, preserva `.previous` e instala em modo `755`. Isso evita
drift e torna a correção de permissão parte do fluxo automático.

```bash
deploy.sh design-web
deploy.sh design-api
deploy.sh plataforma-v2 <tag>   # artefato GHCR imutável → release PM2
deploy.sh status
deploy.sh cleanup
```

O stack local editorial é iniciado com `docker/docker-compose.phase7.yml`, usando
PostgreSQL e PgBouncer compartilhados por databases/roles separados.

O arquivo root-only `/etc/rota-deploy.env` (modo `600`) contém somente os
segredos operacionais necessários ao script. Nunca grave esses valores no Git,
nos workflows ou nesta documentação.

A API usa uma conta restrita no seu unit do systemd. O deploy usa separadamente
`DESIGN_MIGRATION_DATABASE_URL`, com o owner do schema, apenas dentro do
container efêmero de migration. Não conceda ownership/DDL à conta da aplicação.

## Gates obrigatórios

- Um lock global impede dois repositórios de alterarem a VPS ao mesmo tempo.
- Migrations rodam antes da troca do serviço e qualquer erro encerra o workflow.
- O loader remove defensivamente um BOM UTF-8 inicial, e a suíte proíbe novos
  arquivos SQL com BOM.
- O Design web é trocado de forma atômica e restaura os arquivos anteriores se
  o health check falhar.
- A Plataforma 2.0 valida `BUILD_ID`, release/PM2, workers, sidecar e HTTP pelo
  `activate-release.sh` antes de concluir.

## Stack local editorial da Fase 7

O compose canônico é `docker/docker-compose.phase7.yml`.
Ele sobe Caddy, Prospector web, Design web/API e o runtime auxiliar do Design;
as migrations são jobs one-shot com healthchecks e restart policies nos serviços
persistentes. O Prospector usa apenas as filas editoriais preservadas nesta fase.

## Secrets exigidos no GitHub

| Secret | Uso |
|---|---|
| `SSH_DEPLOY_KEY` | autenticação SSH da VPS, nos dois repositórios |
| `VPS_HOST` | host da VPS, nos dois repositórios |

O `GITHUB_TOKEN` efêmero é fornecido automaticamente pelo Actions. Na V2 ele usa
um `DOCKER_CONFIG` temporário para não sobrescrever a autenticação GHCR persistente
do usuário `root` na VPS.

## Verificação manual

```bash
ssh root@187.127.249.22 '/opt/rota-deploy/deploy.sh status'
```

O comando deve retornar `200` para Design web/API, Gazeta e Plataforma 2.0,
além de exit code zero. O stack local é validado pelo compose da Fase 7.
