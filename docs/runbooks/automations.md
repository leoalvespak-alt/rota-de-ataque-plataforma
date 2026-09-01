# Execução editorial agendada

O runtime atual não usa consumidores residentes. As três tarefas editoriais são disparadas como execuções one-shot:

- `news-radar.daily` — coleta diária;
- `editorial-batch.15day` — lote editorial quinzenal;
- `publication.due` — publicação aprovada no horário devido.

O estado de execução fica no PostgreSQL em `task_runs` e `task_schedules`. O fallback local é intencionalmente leve e desabilitado por padrão; Cloud Scheduler, Cloud Run e Cloud Tasks permanecem interfaces preparadas para uma fase posterior, sem provisionamento cloud nesta fase.

Antes de uma nova execução, valide migrations, idempotência, aprovação humana e o healthcheck de Prospector/Design. A Rota de Ataque deve ser validada separadamente.

## Recuperação segura

1. Preserve o `traceId` e a chave de idempotência.
2. Consulte o último estado persistido em `task_runs`.
3. Corrija somente a dependência indicada e repita uma execução controlada.
4. Não reexecute publicação sem aprovação e sem `scheduleTime` válido.

## Histórico

Os documentos e migrations anteriores permanecem como histórico de auditoria. Eles não descrevem o runtime vigente.
