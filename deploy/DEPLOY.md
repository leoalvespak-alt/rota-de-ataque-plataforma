# Deploy — Plataforma Rota de Ataque

Deploy automático dos três produtos por GitHub Actions, GHCR e a mesma VPS.
O Prospector usa Dokploy Compose; Design System e Plataforma 2.0 mantêm os
runtimes comprovados em produção (nginx/systemd e PM2, respectivamente).

## Fluxos automáticos

| Projeto | Repositório | Build | Ativação |
|---|---|---|---|
| Design System web/API | `rota-de-ataque-plataforma` | GitHub Actions → GHCR | nginx estático + systemd/Docker |
| Prospector | `rota-de-ataque-plataforma` | GitHub Actions → GHCR | Dokploy Compose |
| Plataforma 2.0 | `rota-de-ataque-v2` | Docker build na VPS → GHCR | release versionada + PM2 |

Push direto para `main` dispara o workflow do repositório. Não é necessário PR,
clique no Dokploy ou deploy local complementar.

## Script canônico da VPS

O arquivo versionado é `deploy/rota-deploy.sh`; a instalação operacional fica em
`/opt/rota-deploy/deploy.sh` com modo `755`. Todos os deploys usam o lock global
`/run/lock/rota-deploy.lock`, inclusive o build longo da Plataforma 2.0.

```bash
deploy.sh design-prospector [tag] # Design web + API + Prospector, com migrations
deploy.sh design-web
deploy.sh design-api
deploy.sh prospector
deploy.sh plataforma-v2 <tag>   # artefato GHCR imutável → release PM2
deploy.sh status
deploy.sh cleanup
```

O CI passa a tag curta do commit para `design-prospector`; assim o script puxa e
verifica exatamente as quatro imagens produzidas pelo workflow. Sem tag, os comandos
manuais preservam o comportamento de usar `latest`.

O arquivo root-only `/etc/rota-deploy.env` (modo `600`) contém somente os
segredos operacionais necessários ao script. Nunca grave esses valores no Git,
nos workflows ou nesta documentação.

## Gates obrigatórios

- Um lock global impede dois repositórios de alterarem a VPS ao mesmo tempo.
- Migrations rodam antes da troca do serviço e qualquer erro encerra o workflow.
- O loader remove defensivamente um BOM UTF-8 inicial, e a suíte proíbe novos
  arquivos SQL com BOM.
- O deploy do Prospector confere que o container usa a imagem recém-publicada;
  um health check da versão anterior não produz falso positivo.
- O Design web é trocado de forma atômica e restaura os arquivos anteriores se
  o health check falhar.
- A Plataforma 2.0 valida `BUILD_ID`, release/PM2, workers, sidecar e HTTP pelo
  `activate-release.sh` antes de concluir.

## Dokploy e ambiente do Prospector

O compose gerenciado pelo Dokploy materializa o ambiente em `.env`. Por isso o
serviço web usa `env_file: .env`; essa linha é parte do contrato atual e não deve
ser removida sem substituir explicitamente todas as variáveis no bloco
`environment`.

As migrations usam o compose efetivo em
`/etc/dokploy/compose/*prospector*/code/docker/docker-compose.yml` e o profile
`tools`. O script não aceita mais “warning” de migration como sucesso.

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

O comando deve retornar `200` para Design web/API, Prospector, Gazeta e
Plataforma 2.0, além de exit code zero.
