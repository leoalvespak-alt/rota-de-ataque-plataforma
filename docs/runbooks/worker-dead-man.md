# Runbook — alerta worker dead-man

## O que é

O worker `alerts` verifica periodicamente se cada worker habilitado enviou heartbeat nos últimos N minutos. Se não, abre um alerta `worker_dead_man` na tabela `alerts`.

## Quando um alerta é falso positivo

- **Redeploy recente**: o `HOSTNAME` do container muda a cada deploy. O novo container começa a bater heartbeat com um novo `instance_id`; o `beat()` deleta automaticamente registros antigos (>10min, instance_id diferente). Se o alerta foi aberto durante a janela de restart, resolva manualmente.
- **Worker desabilitado no banco**: desde 19/08/2026, o worker `alerts` lê `worker_settings.enabled` do banco. Workers explicitamente desabilitados são ignorados. Se o alerta foi aberto antes dessa correção, resolva manualmente.

## Verificar estado atual

```sql
-- Heartbeats ativos por worker
SELECT worker, instance_id, last_beat_at, state
FROM worker_heartbeats
ORDER BY last_beat_at DESC;

-- Alertas dead-man abertos
SELECT id, kind, payload, created_at
FROM alerts
WHERE kind = 'worker_dead_man' AND resolved_at IS NULL
ORDER BY created_at DESC;

-- Configuração do worker no banco
SELECT worker_name, enabled, cadence
FROM worker_settings
ORDER BY domain, worker_name;
```

## Resolver alerta manualmente

```sql
UPDATE alerts
SET resolved_at = now(), decided_by = 'operator'
WHERE kind = 'worker_dead_man'
  AND resolved_at IS NULL
  AND payload->>'worker' = '<nome-do-worker>';
```

## Limpeza de heartbeats orphans

```sql
-- Remove heartbeats de instâncias extintas (>10min, instance_id diferente do atual)
DELETE FROM worker_heartbeats
WHERE worker = '<nome>'
  AND instance_id <> '<instance-id-atual>'
  AND last_beat_at < now() - interval '10 minutes';
```

## Ativar alertas após canário

Ative o worker `alerts` somente **depois** de `data-quality`, para que as materialized views estejam íntegras antes da primeira checagem. Ver `automations.md` para a sequência completa.
