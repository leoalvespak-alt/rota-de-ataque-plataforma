# Backlog de fila

Verifique heartbeat, Redis, DLQ e idade do job mais antigo. Pause produtores, recupere o worker e refile apenas jobs idempotentes com o mesmo `jobId` antes de reativar a origem.
