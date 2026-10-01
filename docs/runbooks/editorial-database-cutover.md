# Corte do banco editorial compartilhado

Este runbook registra o corte já aplicado e serve como referência para ensaios em banco descartável e recuperação. O database ativo prospector usa os schemas editorial e design; rota_design permanece preservado como origem histórica.

> **Estado em 28/09/2026:** o corte e a troca dos serviços já foram executados no banco ativo. Migrations 0046–0053 e 0000–0007, 0032 e 0033 estão registradas; Prospector e Design usam o banco compartilhado. A migration 0052 guarda versões dos detalhes do Radar; a 0053 guarda o cursor e a conclusão da paginação do PCI. O backup e a release ativa constam no registro de execução. Não repita transferência, migration ou ativação abaixo no banco ativo. Use-as em clone descartável ou recuperação planejada, com backups e comparações descritos neste documento.

## Pré-condições

- Use uma release imutável já compilada e aprovada. O push para `main` aciona o deploy de produção; não faça push para executar este runbook.
- Reserve uma janela sem escrita editorial, confirme a saúde do banco e gere novos dumps de `prospector`, `rota_design` e roles. Restaure os dumps em bancos descartáveis e confira os hashes antes de seguir.
- Obtenha uma conexão temporária de administrador/superuser para `prospector`. A migration `0048_unified_editorial_cutover` exige essa conexão para retirar a propriedade das cópias de arquivo. Não salve a URL em arquivos versionados nem a imprima no terminal.
- Defina `PROSPECTOR_APP_DATABASE_URL`, `PROSPECTOR_ADMIN_DATABASE_URL` e `DESIGN_SOURCE_DATABASE_URL` no ambiente protegido da sessão. A conexão de origem Design deve ser somente leitura.
- Confirme que o destino está no ponto `0045_task_runtime`, que os schedules editoriais seguem desativados e que o marcador de transferência ainda não existe no destino.
- Mantenha o publicador legado do Instagram como está. Este corte não transfere a tarefa SQLite; sua substituição pertence à Etapa 9.

## Preparar e transferir o Design

Execute no checkout da release, com `set +x` para evitar expansão de variáveis no log:

```bash
set -euo pipefail
set +x

export DATABASE_URL="$PROSPECTOR_APP_DATABASE_URL"
export DESIGN_MIGRATION_SCHEMA=design
pnpm --dir apps/design-system db:migrate

export DESIGN_SOURCE_DATABASE_URL
pnpm --dir apps/design-system db:transfer:design
pnpm --dir apps/design-system db:transfer:design -- --apply
```

A primeira chamada de transferência é somente leitura. Confira a saída por contagem de linhas e erros antes de usar `--apply`. O script compara tipos, contagens e hashes e recusa tabelas de destino ocupadas.

## Aplicar o corte

Rode as migrations de preparação e depois a migration de corte. Use o usuário administrativo para as três, mantendo a lista explícita:

```bash
export DATABASE_URL="$PROSPECTOR_ADMIN_DATABASE_URL"
export MIGRATIONS_ONLY=0046_shared_editorial_schemas,0047_editorial_schema_prep
pnpm --filter @plataforma/db migrate

export MIGRATIONS_ONLY=0048_unified_editorial_cutover
pnpm --filter @plataforma/db migrate
```

Confirme que `schema_migrations` registra `0048_unified_editorial_cutover`, que não há FKs inválidas e que as sete tabelas de arquivo pertencem ao operador e não podem ser lidas ou alteradas por `prospector_app` ou `prospector_reader`.

Ative os serviços com a mesma tag imutável, acrescentando o overlay que aponta as duas aplicações ao banco compartilhado:

```bash
export ROTA_EDITORIAL_COMPOSE_OVERRIDE_FILE="$PWD/docker/docker-compose.editorial-shared.yml"
bash ./deploy/deploy-editorial-production-local.sh "$RELEASE_SHA"
```

O overlay define os schemas e a tabela canônica de teses. O arquivo Compose de produção padrão permanece sem alterações de configuração até este corte.

## Reteste após ativação

- Abra Prospector e Design com contas operacionais. Leia a mesma tese, item e revisão nos dois serviços.
- Edite um item de teste e confirme o mesmo ID e incremento de revisão nos dois serviços.
- Leia publicações legadas pelas views `public.scheduled_publications` e `public.content_variants`; tente uma escrita comum e confirme que ela chega à linha canônica em `editorial.unified_creatives`.
- Confira `/prospector/api/health/ready`, `/api/ready`, logs e conexões. Não habilite schedules, canais ou publicação social nesta etapa.
- Salve hashes, contagens, release SHA e horários no registro de execução.

## Reversão

Antes de qualquer escrita editorial depois do corte, volte os serviços à configuração Compose anterior e rode `0048` down, depois `0047` down e `0046` down, com a conexão administrativa. O down de `0048` compara hashes e interrompe a reversão se o catálogo canônico mudou.

Se houve escrita após o corte, não force o down. Preserve o banco, compare a atividade desde o corte e escolha entre reconciliar os registros ou restaurar o backup validado. Uma reversão automática apagaria trabalho novo; o bloqueio é intencional.

Os ensaios descartáveis e o comparador de dados estão registrados no [log de execução](../EXECUCAO-FLUXO-EDITORIAL-UNIFICADO-2026-09-26.md) e no [comparador de dados](../../packages/db/scripts/verify-editorial-cutover.mjs).
