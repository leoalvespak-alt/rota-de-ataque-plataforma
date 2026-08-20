# Runbook de automações

## Diagnóstico

1. Confira Saúde do sistema, heartbeat, backlog e último erro do worker.
2. Confirme estado desejado, comando aceito, heartbeat e se a dependência necessária está disponível. Um toggle só está efetivo após o heartbeat refletir `running` ou `paused`.
3. Preserve o `traceId` exibido pela interface e consulte os logs sem registrar tokens ou dados pessoais.

## Recuperação segura

1. Use o botão de tentar novamente da página para executar o `reset` do boundary; ele não altera filas nem reprocessa itens por conta própria.
2. Corrija a dependência indicada e valide um canário antes de reativar a automação.
3. Reprocesse somente após confirmar idempotência e o estado do kill-switch.

## Gates conhecidos

O runbook da interface informa o estado do front-end. A validação de Redis/PostgreSQL real e o canário operacional continuam sendo gates de rollout quando essas dependências não estão disponíveis no ambiente local.

## Configurar agendamento de um worker

A coluna "Agendamento" na tela de Automações permite editar a cadência de cada worker:

- **Formato `every:<ms>`** — intervalo fixo em milissegundos (ex: `every:900000` = 15 min).
- **Formato cron** — expressão cron padrão (ex: `0 */6 * * *` = a cada 6h).

A ação `set_schedule` é um controle operacional, não um comando de worker. Ela:
1. Atualiza `worker_settings.cadence` no banco.
2. Chama `upsertJobScheduler` no BullMQ com o ID `{worker}-managed-v1`.
3. Registra em `audit_log`.

Não passa pelo `worker_commands`, portanto não viola o CHECK constraint de `command_type`.

## Heartbeats e orphans

Cada instância de worker registra heartbeats com `HOSTNAME` como `instance_id`. Após um redeploy, o `HOSTNAME` muda. O `beat()` limpa automaticamente registros de instâncias antigas (>10 min sem heartbeat). A migration `0027` fez limpeza inicial de heartbeats >2h.

Se alertas dead-man persistirem após um redeploy, verifique:
```sql
SELECT worker, instance_id, last_beat_at FROM worker_heartbeats ORDER BY last_beat_at DESC;
```
E se necessário, delete manualmente:
```sql
DELETE FROM worker_heartbeats WHERE last_beat_at < now() - interval '10 minutes' AND instance_id != '<id-atual>';
```

## Sequência de ativação de canário (E4.1)

Ative na ordem, aguardando heartbeat `running` após cada passo:

1. `data-quality` — repara materialized views
2. `alerts` — monitora workers (agora lê `worker_settings` do banco)
3. `news-radar` — coleta RSS (incremental a cada 15min)
4. `competitive-intel` — inteligência competitiva
5. `content-opportunity` — geração de oportunidades editoriais
