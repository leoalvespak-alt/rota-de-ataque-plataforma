# Runbook de automações

## Estado reconciliado (25/08/2026)

O contrato auditado contém scheduler, Compose com 41 workers, health separado e a migration `0035_reconcile_automation_runtime`. O checker de deploy exige os 42 runtimes na imagem exata da release; a implantação e o canário são confirmados separadamente no registro pós-deploy.

Estados devem ser lidos separadamente: `desiredState` (intenção persistida), `runtimeState` (heartbeat real), `lastRunState` (`succeeded`, `skipped`, `blocked` ou `failed`) e `queueState`. `NO_INPUT` é trabalho inexistente, não sucesso silencioso; `RUNTIME_UNAVAILABLE` impede `run-now` quando não existe consumer `running`; `SQL_CONTRACT_ERROR` aponta para drift de query/schema. Todos os reason codes do runtime têm mensagem e próxima ação catalogadas. Incidentes podem ser reconhecidos pelo operador com nota e são resolvidos por uma execução posterior bem-sucedida.

Endpoints públicos de operação: `/api/health/live`, `/api/health/ready`, `/api/health/operational` e `/api/health`. O último só deve ser usado como agregado; para decidir se uma ação pode ser enfileirada, use o estado operacional.

> O registro de 22/08/2026 é histórico. O estado vigente inclui `0035_reconcile_automation_runtime`; produção só deve usar os procedimentos de motores depois de confirmar `0034` + `0035` e a comparação dos 41 valores de `enabled` passar sem divergência.

O bloco de estado histórico acima não substitui a reconciliação de 24/08: o rollout vigente deve validar `0034_automation_engines` e `0035_reconcile_automation_runtime` juntos, sem reescrever a migration publicada `0034`.

## Motores e abas

A rota canônica `/automacoes` usa o parâmetro `?aba=`. `/automations` permanece como redirect permanente:

- `motores`: sete cartões operacionais cobrindo os 41 workers;
- `workers`: controles individuais preservados;
- `filas`: contagens waiting/active/failed, execução imediata e limpeza de DLQ;
- `agendamentos`: somente os nove workers presentes em `MANAGED_SCHEDULER_CONFIG`.

Antes de ligar ou desligar um motor, confira no diálogo a lista nominal de workers afetados. Ativar com cascata liga somente dependências que ainda não estejam integralmente ligadas. Desativar com cascata inclui apenas motores dependentes que tenham algum worker ativo. M0 pode ser ligado quando o baseline estiver desligado, mas não pode ser desligado pela API de motores.

Pré-requisito pendente bloqueia apenas uma nova ativação; nunca desliga automaticamente um worker já ativo. Resolva o item pelo link do cartão e repita a ação. Replay no mesmo estado deve responder com `changed: []`.

## Diagnóstico

1. Confira Saúde do sistema, heartbeat, backlog e último erro do worker.
2. Confirme estado desejado, comando aceito, heartbeat e se a dependência necessária está disponível. Um toggle só está efetivo após o heartbeat refletir `running` ou `paused`. Para `run-now`, o worker precisa estar `running`; o heartbeat do scheduler é necessário apenas para recorrências.
3. Preserve o `traceId` exibido pela interface e consulte os logs sem registrar tokens ou dados pessoais.

## Recuperação segura

1. Use o botão de tentar novamente da página para executar o `reset` do boundary; ele não altera filas nem reprocessa itens por conta própria.
2. Corrija a dependência indicada e valide um canário antes de reativar a automação.
3. Reprocesse somente após confirmar idempotência e o estado do kill-switch.
4. Em divergência `configured_but_not_running`, não alterne o toggle repetidamente: verifique pré-requisitos, fila e container, execute um canário e só então repita o comando. Em `running_but_disabled`, preserve evidências e pare o runtime pelo fluxo operacional antes de limpar comandos.

## Gates conhecidos

O runbook da interface informa o estado do front-end. PostgreSQL descartável e Docker Compose real foram validados no VPS isoladamente; a base de produção nunca deve ser usada como banco descartável. Redis, navegador autenticado e canário operacional são confirmados na release implantada.

Para `0034_automation_engines` + `0035_reconcile_automation_runtime`, o gate inclui: aplicar ambos os `up`/`down` em banco descartável e dump sanitizado, comparar os 41 valores de `enabled` com `docs/snapshots/workers-pre-0034.csv`, confirmar zero `engine_key` nulo e verificar a reversibilidade sem reescrever migrações aplicadas. Não use a base de produção como banco descartável.

## Configurar agendamento de um worker

A aba `/automacoes?aba=agendamentos` permite editar somente os nove workers com `schedulable=true`. Os demais mostram `Acionado por …` na visão avançada e recebem HTTP 409 se alguém tentar `set_schedule` diretamente:

- **Formato `every:<ms>`** — intervalo fixo em milissegundos (ex: `every:900000` = 15 min).
- **Formato cron** — expressão cron padrão (ex: `0 */6 * * *` = a cada 6h).

A ação `preview_schedule` valida cron/intervalo no servidor e devolve a próxima execução sem persistir. Depois da confirmação visual, `set_schedule`:
1. valida novamente a cadência;
2. chama `upsertJobScheduler` com o `MANAGED_SCHEDULER_CONFIG[worker].primaryId` canônico, evitando scheduler duplicado;
3. atualiza `worker_settings.cadence`;
4. registra em `audit_log`.

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
