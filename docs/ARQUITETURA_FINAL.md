# Arquitetura editorial vigente

## Runtime local

- Caddy é a única entrada HTTP local para o stack editorial.
- Prospector expõe a operação editorial e mantém o banco `prospector`.
- Design expõe frontend/API e mantém o banco `rota_design`.
- PgBouncer usa a mesma instância PostgreSQL com databases e roles separados.
- A Rota de Ataque principal permanece em seu próprio runtime e não depende do stack editorial.

## Execução

Radar diário, lote editorial de 15 dias e publicação de itens aprovados são tarefas one-shot. O estado e a idempotência ficam no PostgreSQL em `task_runs` e `task_schedules`. O servidor local mantém web, APIs, PostgreSQL e Design; não há processo de tarefa residente.

As interfaces para disparos futuros em Scheduler, Run e Tasks estão preparadas, mas nenhum recurso cloud pago é criado automaticamente. O fallback local é controlado e desabilitado por padrão.

## Dados editoriais

O Radar coleta três portais especializados, normaliza, deduplica, aplica gates determinísticos e envia itens seguros para a fila humana/editorial. Conteúdo ambíguo exige revisão; publicação exige aprovação explícita.

O RAG documental usa `PgVectorStore` em PostgreSQL com embeddings 768d, metadata e HNSW. O índice FAISS grande de questões continua separado e não é copiado nem reprocessado.

## Integrações externas

Resend é reservado para transacional; Brevo é marketing com opt-in explícito. A publicação social oficial é isolada e só opera quando habilitada por ambiente seguro e com aprovação registrada. Sem credenciais, esses adapters permanecem desabilitados.

## Operação

Valide os healthchecks dos seis serviços do Compose, o ledger de migrations e a persistência após restart. Antes de qualquer alteração destrutiva, faça dump do database correspondente e registre o checkpoint no relatório da fase.
