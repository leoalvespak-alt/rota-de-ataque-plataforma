# Estado de tarefas editoriais

O runtime editorial atual executa tarefas one-shot e persiste estado no PostgreSQL. Consulte `task_runs` e `task_schedules` para identificar tarefas pendentes, falhas e a chave de idempotência.

Antes de repetir uma execução, confirme a chave idempotente, a migration esperada e o estado de aprovação do item. Reprocesse somente entradas editoriais seguras e nunca publique conteúdo sem aprovação humana.
