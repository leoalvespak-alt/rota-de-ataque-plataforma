# Arquitetura editorial vigente

## Runtime local

- Caddy é a única entrada HTTP local para o stack editorial.
- Prospector expõe a operação editorial e mantém o banco `prospector`.
- Design expõe frontend/API e mantém o banco `rota_design`.
- PgBouncer usa a mesma instância PostgreSQL com databases e roles separados; o Compose canônico não inicializa PostgreSQL, Redis ou qualquer banco vetorial separado.
- A Rota de Ataque principal permanece em seu próprio runtime e não depende do stack editorial.

## Execução

`task_runs` e `task_schedules` guardam estado e idempotência. Na última consulta de produção registrada em 26/09/2026 havia zero execuções e três agendas desativadas; não foi verificado um executor editorial residente. O código inclui tarefas one-shot, mas isso não significa que a coleta, o lote ou a publicação estejam operando.

O health do Prospector lê o ledger, a fila vencida e as agendas do PostgreSQL. A tela de saúde apresenta contagens de execução e o estado configurado das agendas, em vez de preencher esses números com zeros fixos. Essas alterações foram feitas no checkout local e ainda não estão publicadas.

As interfaces para disparos futuros em Scheduler, Run e Tasks estão preparadas, mas nenhum recurso cloud pago é criado automaticamente. O fallback local é controlado e desabilitado por padrão. Não habilitar as agendas até que o executor local da Etapa 3 esteja implantado e passe os gates de recuperação.

## Dados editoriais

O código do Radar coleta fontes configuradas, normaliza, deduplica, aplica gates determinísticos e envia itens seguros para a fila humana/editorial. A classificação da notícia e a inclusão do achado agora compartilham uma transação, com inferência compatível com o índice parcial de fingerprint. Conteúdo ambíguo exige revisão; publicação exige aprovação explícita. A execução produtiva do coletor continua pendente.

O RAG documental usa `PgVectorStore` em PostgreSQL com embeddings 768d, metadata, ingestão idempotente e índice HNSW. `RAG_EMBEDDING_ENDPOINT` permite um provedor OpenAI-compatible; sem endpoint, o fallback local determinístico 768d mantém o fluxo sem custo cloud. O índice FAISS grande de questões continua separado e não é copiado nem reprocessado.

## Integrações externas

Resend é reservado para transacional; Brevo é marketing com opt-in explícito. A publicação social oficial é isolada e só opera quando habilitada por ambiente seguro e com aprovação registrada. Sem credenciais, esses adapters permanecem desabilitados.

## Operação

O database singleton do Prospector fica aberto durante a vida do processo Node; handlers e Server Components não encerram o pool ao fim de uma requisição. A API do Design também libera seus pools no `SIGTERM` do processo.

Métricas editoriais aceitam somente `quality_score.overall` numérico em JSONB entre 0 e 1; ausência e tipo inválido produzem média nula. A interface diferencia carregamento, falha com nova tentativa e ausência de valores válidos.

Valide os healthchecks dos seis serviços do Compose, o ledger de migrations e a persistência após restart. Migrations históricas permanecem versionadas, inclusive as anteriores ao expurgo, e não devem ser reescritas. Antes de qualquer alteração destrutiva, faça dump do database correspondente e registre o checkpoint no relatório da fase.
