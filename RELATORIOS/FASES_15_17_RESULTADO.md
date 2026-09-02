# Resultado das Fases 15–17

Data da auditoria: 2026-09-02  
Repositório autoritativo: `C:\Users\Lenovo\Desktop\Rota de Ataque\Sistema de Design\plataforma`  
Branch: `main`

## Escopo e evidências disponíveis

O plano R2 e os relatórios formais das Fases 0–14 não estavam disponíveis no checkout nem nas pastas de migração encontradas no Desktop. Foi localizado apenas o mapa histórico `docs/FASE_8_MAPA_EXPURGO.md`. A execução foi baseada no código versionado, no histórico Git e na documentação vigente. Referências históricas, migrations e snapshots não foram apagados ou reescritos.

As alterações válidas das Fases 9–14 já estavam versionadas e sincronizadas antes da Fase 15. Não havia trabalho pendente para fazer commit nesse checkpoint.

## Fase 15 — pgvector documental

- `apps/design-system/drizzle/0006_pgvector_rag.sql` habilita `vector`, cria `rag_embeddings` com dimensão 768, metadata JSONB, hash de conteúdo e unicidade por chunk/modelo/versão.
- O índice HNSW usa distância cosseno; índices GIN e de chunk sustentam filtros e manutenção.
- `IVectorStore` foi integrado a `PgVectorStore`, com upsert, busca por similaridade e atualização de metadata sem duplicação.
- A busca editorial gera embedding de consulta e conserva a ordem por similaridade.
- A ingestão calcula apenas chunks novos, alterados ou sem vetor; reexecuções idênticas são idempotentes.
- `RAG_EMBEDDING_ENDPOINT` aceita um provedor OpenAI-compatible com dimensão 768. Sem endpoint, o fallback local determinístico 768d evita custo cloud; ele pode ser desligado explicitamente.
- O FAISS grande de questões permanece separado. Nenhum dos aproximadamente 2 milhões de vetores foi migrado ou reprocessado.
- Nenhuma dependência ativa de Qdrant foi encontrada no runtime.

Commit: `04b78f8 feat: integrar rag documental com pgvector` — sincronizado em `origin/main`.

## Fase 16 — limpeza final

Foram removidos somente resíduos comprovadamente mortos:

- serviço Redis e `REDIS_URL` do job de CI;
- referência de teste do worker `meta-sync`, já removido;
- variáveis de Exa, Apify, Bright Data, descoberta orgânica e flags de workers antigos do `.env.example`;
- modelo Drizzle ativo `knowledge_embeddings` de 1536d, sem remover a migration histórica que o criou;
- referências documentais a índices `Docs/` inexistentes e ao antigo fluxo de deploy.

Foram preservados os adapters opcionais isolados de publicação/e-mail, as migrations, snapshots, changelog e documentos históricos. O guard de Compose continua proibindo regressão para serviços de fila, scheduler residente ou observabilidade não autorizada.

Commit: `1286c2a chore: concluir limpeza da arquitetura` — sincronizado em `origin/main`.

## Fase 17 — validação executada

### Rota principal

- O repositório separado da Rota de Ataque estava limpo em `main...origin/main`.
- `https://app.rotadeataque.com.br/api/health` respondeu HTTP 200 com `{"status":"ok"}`.
- Nenhum arquivo da Rota principal foi alterado nesta migração.

### Prospector e Design

- Smoke local: `http://127.0.0.1:8080/prospector/api/health/live` respondeu 200.
- Smoke local do Design: `http://127.0.0.1:8080/api/health` e a UI raiz responderam 200.
- Playwright abriu as duas telas de login sem erro de página. A requisição não autenticada esperada do Design retornou 401; as páginas protegidas redirecionaram para login.
- Radar, oportunidades, teses, conteúdos, aprovações, integração, creative bridge e lote foram conferidos por rotas compiladas e pelo contrato de autenticação. As APIs de negócio responderam 401 sem sessão, conforme o contrato.
- O manifest de APIs foi corrigido para incluir `GET/POST /api/editorial/batches` e `POST /api/editorial/batches/:id/items/:itemId/action`.
- O contrato de erro da Web foi corrigido para UTF-8 e seus testes voltaram a passar.
- O ciclo completo com banco — radar persistido, aprovação, agendamento, publicação e renderização — não pôde ser executado neste host por falha de autenticação nos bancos locais.

### Gates de código

- Fase 15: 6 testes de RAG/embeddings aprovados.
- Fase 16: 19 testes focados de migration, runtime, publicação e e-mail aprovados.
- Workers atuais: 12 testes aprovados.
- Design System: 33 arquivos, 130 testes aprovados.
- Web: 14 arquivos, 39 testes aprovados após as correções de manifest e UTF-8.
- Build monorepo: 13/13 tarefas aprovadas.
- Typecheck Turbo: 25/25 tarefas aprovadas; `tsc -p apps/web/tsconfig.json --noEmit` também terminou sem erros.
- `check:runtime-deps`, `check:compose-runtime` e `git diff --check`: aprovados.

A execução indiscriminada de Vitest a partir da raiz também carregou arquivos Playwright e testes sem o alias/configuração do pacote, produzindo falhas de harness. Esses testes não foram usados como motivo para reintroduzir componentes removidos.

## Arquitetura final

- Entrada HTTP editorial: Caddy.
- Prospector: aplicação Web/API com banco lógico `prospector`.
- Design: frontend/API com banco lógico `rota_design`.
- PostgreSQL compartilhado via PgBouncer, com databases e roles separados.
- Três entrypoints one-shot atuais: `news-radar`, `content-opportunity` e `content-item-orchestrator`.
- Estado e idempotência de jobs no PostgreSQL; não há worker residente, Redis ou BullMQ.
- RAG documental em `PgVectorStore`/pgvector 768d com HNSW.
- FAISS grande de questões fora do PostgreSQL e fora desta migração.
- A Rota principal continua em runtime próprio.

O Compose canônico declara seis serviços: `prospector-migrate`, `prospector-web`, `design-migrate`, `design-api`, `design-web` e `editorial-caddy`. Migrations são one-shot; os serviços persistentes têm healthchecks e restart policy. O host desta auditoria não possui Docker, portanto não foi possível confirmar os containers realmente ativos.

## Capacidade e infraestrutura observada

As métricas abaixo são do host Windows local da auditoria, não da VPS de produção:

| Métrica | Observado |
|---|---:|
| Memória física | 20,0 GiB |
| Memória física livre | 5,6 GiB |
| Memória virtual total/livre | 33,4 / 6,5 GiB |
| CPU instantânea média do sistema | 29% |
| Disco C: livre | 1,79 GiB |
| Rede Wi-Fi recebida/enviada | 493 / 102 MiB acumulados no contador |
| PostgreSQL Windows | serviço `postgresql-x64-17` em execução |
| PgBouncer | listener `127.0.0.1:6432` |
| PostgreSQL | listener `0.0.0.0:5432` e `[::]:5432` |

O disco livre está criticamente baixo para builds, dumps e imagens. Não foi feita exclusão de arquivos para liberar espaço. Os contadores de rede não medem taxa nem saturação; não há evidência suficiente para impor limite arbitrário de Mbps a tráfego normal, backup ou deploy.

### Banco e exposição

As tentativas read-only nos bancos locais `rota_design`, `prospector` e `rota_ataque` falharam por autenticação. Assim, não foi possível confirmar versão, extensão pgvector, conexões, tabelas, migrations aplicadas ou contagens. O PostgreSQL escuta em todas as interfaces locais; a leitura das regras de firewall retornou acesso negado. A exposição pública/LAN do banco permanece não comprovada e requer verificação privilegiada, com preferência por bind local/VPN e firewall restritivo.

### Backups e restore

O repositório contém `scripts/backup-postgres.sh` e `scripts/restore-backup.sh`, mas ambos operam um único `$DATABASE_URL` e o fluxo existente nomeia o dump do Prospector. Não há evidência versionada de backup independente e recente dos três bancos (`rota_ataque`, `prospector`, `rota_design`) nem de restore descartável bem-sucedido.

Também não há `pg_dump`, `pg_restore`, `psql`, `pg_isready` ou Docker instalados neste host. Nenhuma alteração destrutiva de banco foi realizada; portanto não houve risco adicional nem necessidade de rollback. Antes de declarar a migração completa, um operador autorizado deve:

1. gerar dumps custom format dos três bancos, com retenção e checksum;
2. restaurar cada dump em databases descartáveis, sem tocar produção;
3. rodar migrations/contratos, validar pgvector no Design e registrar contagens;
4. testar o procedimento documentado em `docs/runbooks/restore.md`.

### Custos e dependências externas

Nenhum recurso cloud pago foi criado. O endpoint de embeddings é opcional e o fallback local não adiciona custo. Credenciais, custos mensais, consumo de provedores Meta/e-mail/LLM e jobs do scheduler externo não puderam ser auditados neste host.

Jobs externos esperados são disparos dos entrypoints one-shot de radar diário, lote quinzenal e publicação devida. O runtime não cria scheduler cloud nem mantém processo residente.

### Restart e restore operacional

Na VPS, usar o script canônico versionado através de `/opt/rota-deploy/deploy.sh` (`status`, `design-web`, `design-api` ou `plataforma-v2 <tag>`), que executa migrations antes da troca e verifica health. Para o stack editorial local, usar `docker/docker-compose.phase7.yml`; confirmar os seis healthchecks após `up -d` e verificar o ledger de migrations. Não iniciar serviços antigos.

Para restore, colocar a aplicação em somente leitura, tirar snapshot do estado atual, restaurar em staging com `scripts/restore-backup.sh <chave>`, executar migrations e contratos, validar contas/eventos/pgvector e só então repetir em produção com registro do checkpoint.

## Pendências opcionais após o bloqueador

- instalar/usar ferramentas PostgreSQL e Docker na máquina operacional;
- executar o teste trimestral de backup/restore dos três bancos;
- medir CPU, RAM, swap, disco, conexões, containers, uptime e rede diretamente na VPS;
- corrigir a política de bind/firewall do PostgreSQL;
- configurar um endpoint semântico 768d e reprocessar apenas documentos RAG necessários;
- liberar espaço no host sem apagar dados de origem ou migrations.

MIGRAÇÃO PARCIAL — BLOQUEADOR: backup e restore dos três bancos e métricas de produção não puderam ser comprovados neste host sem credenciais e ferramentas autorizadas
