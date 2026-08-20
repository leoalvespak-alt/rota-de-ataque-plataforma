-- Remove heartbeat rows older than 2 hours (orphans from previous deploys)
DELETE FROM worker_heartbeats
WHERE last_beat_at < now() - interval '2 hours';

-- Resolve stale dead-man alerts whose worker instance no longer exists in heartbeats
UPDATE alerts
SET resolved_at = now(),
    decided_by  = 'cleanup-2026-08-19'
WHERE kind = 'worker_dead_man'
  AND resolved_at IS NULL
  AND payload->>'worker_instance' NOT IN (
    SELECT worker || ':' || instance_id FROM worker_heartbeats
  );
