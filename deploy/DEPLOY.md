# Deploy — Design System + Prospector

Este stack tem produção no host WSL2, com imagens construídas pelo GitHub
Actions e publicadas no GHCR. O WSL2 é o host de produção, não uma cópia de
desenvolvimento: o Cloudflare Tunnel publica o serviço sem expor PostgreSQL,
Docker ou portas administrativas.

## Fluxo de produção

1. Push para `main` dispara `.github/workflows/deploy.yml`.
2. O workflow constrói e publica quatro imagens no GHCR, todas com a tag curta
   do commit:
   - `rota-design-web`;
   - `rota-design-api`;
   - `prospector-platform-web`;
   - `prospector-platform-migrations`.
3. No host WSL2, o script faz pull da tag SHA, executa migrations idempotentes,
   sobe o Compose de produção e valida os healthchecks.
4. O hostname `design.rotadeataque.com.br` deve estar configurado no túnel
   Cloudflare ativo para `http://127.0.0.1:8080`.

O workflow não usa SSH para a VPS antiga, Dokploy, Redis, BullMQ, Qdrant ou
workers legados. A Rota principal continua com o próprio fluxo e stack.

## Primeiro setup do host

O arquivo de ambiente é root-only e não é versionado. Pode ficar, por exemplo,
em `/etc/rota-editorial/production.env`, ou continuar no caminho local legado
`docker/.env.phase7.local` durante a transição.

```bash
chmod 600 /etc/rota-editorial/production.env
export ROTA_EDITORIAL_ENV_FILE=/etc/rota-editorial/production.env
docker login ghcr.io
```

O arquivo deve conter os segredos usados pelo Compose de produção: credenciais
de PostgreSQL/PgBouncer, autenticação do Prospector e sessão/autorização da API
do Design. Os nomes públicos e URLs são definidos no Compose de produção.

## Deploy e rollback

O resumo da execução do GitHub Actions informa a tag SHA. Promova-a no WSL2:

```bash
./deploy/deploy-editorial-production-local.sh <sha-curto>
```

O script:

- valida o Compose sem iniciar nada;
- faz pull das imagens imutáveis no GHCR;
- executa as migrations do Prospector e do Design;
- promove os serviços no mesmo projeto Compose da Fase 7, evitando dois stacks
  disputando a porta `127.0.0.1:8080`;
- confirma os endpoints locais `/prospector/api/health/live` e `/api/health`.

Rollback é executar o mesmo comando com a tag SHA da release anterior.

## Validação pública

No host:

```bash
curl -fsS http://127.0.0.1:8080/prospector/api/health/live
curl -fsS http://127.0.0.1:8080/api/health
```

Externamente, depois de configurar o hostname do túnel:

```bash
curl -fsS https://design.rotadeataque.com.br/prospector/api/health/live
curl -fsS https://design.rotadeataque.com.br/api/health
```

Se o endereço público resolver para `187.127.249.22` e expirar, o problema é
DNS/túnel externo ao repositório. O registro não deve apontar para a VPS antiga;
deve usar o hostname público do túnel Cloudflare já ativo.

## Segurança e operação

- Nunca commitar `.env.*.local`, tokens GHCR, senhas, chaves SSH ou credenciais.
- Não expor PostgreSQL, PgBouncer ou Docker na Internet.
- Não apagar migrations históricas; o deploy só aplica migrations idempotentes.
- O Compose de desenvolvimento continua em `docker/docker-compose.phase7.yml`.
- O Compose de produção é `docker/docker-compose.production.yml` e nunca faz
  build local.
