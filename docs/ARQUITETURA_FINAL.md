# Arquitetura editorial vigente

## Runtime local

- Caddy é a única entrada HTTP local para o stack editorial.
- Prospector expõe a operação editorial no database `prospector`.
- Design expõe frontend/API nos schemas `design` e `editorial` desse mesmo database; `rota_design` foi preservado como origem histórica.
- PgBouncer usa a mesma instância PostgreSQL com databases e roles separados; o Compose canônico não inicializa PostgreSQL, Redis ou qualquer banco vetorial separado.
- A Rota de Ataque principal permanece em seu próprio runtime e não depende do stack editorial.

## Execução

`task_runs` e `task_schedules` guardam estado e idempotência. As migrations `0049_durable_task_executor`, `0050_meta_inbox_events`, `0051_task_runtime_permissions`, `0052_news_item_versions` e `0053_news_source_pagination` estão aplicadas no database prospector. `PostgresTaskRunStore` e `EditorialTaskSupervisor` rodam no processo `editorial-executor`, iniciado e reiniciado pelo unit systemd `rota-editorial-executor.service`. O wrapper ativa EDITORIAL_EXECUTOR_ENABLED=true somente nesse processo. O executor registra os handlers do Radar e da Inbox; as quatro agendas e a fila permanecem vazias até o aceite funcional de cada handler.

O health do Prospector lê o ledger, a fila vencida e as agendas do PostgreSQL. A tela de saúde apresenta jobs recentes com campos limitados e repetição admin de falhas. A release `0a90325fc16cc3ee15670c4d` foi publicada localmente pelo WSL2; os quatro endpoints públicos de saúde responderam 200 após o deploy.

O overlay Compose exige a migration `0053_news_source_pagination` e mantém o executor no perfil editorial-runtime, desligado por padrão no Compose. O unit systemd está habilitado no Ubuntu/WSL2. O kill-switch pausa materialização de agendas e novas claims da fila/outbox; não cancela handlers em curso nem encerra consumidores legados. As quatro schedules seguem desabilitadas. Antes de ativar qualquer uma, complete o aceite funcional do handler correspondente e compare o consumidor legado, receipts, retry e exclusividade.

## Dados editoriais

O Radar consulta fontes configuradas, normaliza e deduplica entradas e aplica gates determinísticos. Respostas HTTP de erro não viram coleta vazia bem-sucedida; respostas `304` atualizam o horário da consulta sem perder validators, e o sinal de encerramento chega à requisição. O worker reconhece detalhes HTML nos três portais do registry, restringe a busca a HTTPS e à origem cadastrada, limita redirects e corpo, registra versões com hash e mantém anexos PDF como referências, sem baixar arquivos. O ensaio de integração simulou lista e detalhe localmente, sem chamada externa. Paginação completa, Querido Diário com resposta real, DOU/INLABS, Business Discovery e PDFs/OCR seguem pendentes; nenhuma coleta produtiva foi disparada. O cadastro local e os gaps estão em [matriz de fontes editoriais](architecture/editorial-source-matrix.md).

O RAG documental usa `PgVectorStore` em PostgreSQL com embeddings 768d, metadata, ingestão idempotente e índice HNSW. `RAG_EMBEDDING_ENDPOINT` permite um provedor OpenAI-compatible; sem endpoint, o fallback local determinístico 768d mantém o fluxo sem custo cloud. O índice FAISS grande de questões continua separado e não é copiado nem reprocessado.

## Inbox social da Meta

O código local da Etapa 10 recebe comentários e mensagens do Instagram em `/prospector/api/webhooks/meta`. O `GET` confere o desafio da Meta; o `POST` valida `X-Hub-Signature-256` sobre os bytes originais, limita o corpo a 1 MiB e grava o evento deduplicado e a tarefa `inbox.message` na mesma transação do schema `editorial`. URLs temporárias de anexos não são persistidas.

`/prospector/inbox` exige operador. Sem JEV, o executor mantém cada item em revisão humana; esse caminho não envia Direct nem resposta pública. `0050_meta_inbox_events` define retenção de texto e IDs pessoais por 30 dias e da linha de deduplicação por 180 dias. A agenda de expurgo nasce desativada.

O schema e a API da Inbox estão no database e na release ativos; não há evento persistido. A inscrição do webhook, os segredos de Meta, a agenda de retenção e qualquer envio seguem desligados até a credencial JEV, os receipts dos canais e os ensaios funcionais estarem validados.

## Integrações externas

Resend é reservado para transacional; Brevo é marketing com opt-in explícito. A publicação social oficial é isolada e só opera quando habilitada por ambiente seguro e com aprovação registrada. Sem credenciais, esses adapters permanecem desabilitados.

## Operação

O database singleton do Prospector fica aberto durante a vida do processo Node; handlers e Server Components não encerram o pool ao fim de uma requisição. A API do Design também libera seus pools no `SIGTERM` do processo.

Métricas editoriais aceitam somente `quality_score.overall` numérico em JSONB entre 0 e 1; ausência e tipo inválido produzem média nula. A interface diferencia carregamento, falha com nova tentativa e ausência de valores válidos.

Valide os healthchecks dos quatro containers web/Caddy do Compose, o estado do unit systemd, o heartbeat, o ledger de migrations e a persistência após restart. Migrations históricas permanecem versionadas, inclusive as anteriores ao expurgo, e não devem ser reescritas. Antes de qualquer alteração destrutiva, faça dump do database correspondente e registre o checkpoint no relatório da fase.

## Estado operativo posterior à release 0a90325fc16c3618187a568d (28/09/2026)

Este registro substitui os estados operacionais anteriores deste documento que indicavam a release 0a90325fc16cc3ee15670c4d, quatro agendas desativadas e ausência de arquivamento.

- Migrations 0054 e 0055 estão aplicadas no PostgreSQL do WSL2. As 50 oportunidades antigas foram arquivadas pelos IDs selecionados, com backup recuperável em /home/deploy/rota-editorial-backups/content-opportunities-legacy-20260928.json, modo 0600. Os 30 criativos e 30 publicações ligadas continuam prontos.
- A agenda incremental news-radar.daily está habilitada para 12:00 e 20:00 em America/Sao_Paulo. As demais agendas permanecem desligadas.
- O executor durável registra news-radar.daily, inbox.message e inbox.retention.cleanup. content-opportunity e content-item-orchestrator continuam desligados até receberem handlers e produtores compatíveis com o runtime durável. O orquestrador antigo apenas indicava despacho adiado para uma fila que não está conectada.
- O dashboard de saúde consulta editorial.task_runs, conta o executor persistente e desconsidera heartbeats históricos stopped. Na validação posterior ao deploy, os quatro endpoints de saúde retornaram HTTP 200 e a tela mostrou estado OK, zero atrasos e zero tarefas pendentes ou falhas.
- DeepSeek V4 Flash é o modelo editorial principal. GLM-5.3-Flash usa o fallback via OpenRouter com a chave indicada pelo usuário; o smoke real deste fallback ainda precisa ser feito. A geração de copy no Design System segue a orientação atualizada da skill de criativos.
- A publicação automática de notícias segue incompleta: falta verificação factual JEV por afirmação, criação/render de carrossel, upload R2 e confirmação Meta por receipt. Nenhuma coleta produtiva nem publicação foi iniciada durante o reteste desta release.
- O build Next concluiu, mas ignorou typecheck e lint. Os testes direcionados e o typecheck dos arquivos de saúde tocados passaram; o typecheck integral do Prospector web ficou sem confirmação porque excedeu o limite de recurso/tempo.
