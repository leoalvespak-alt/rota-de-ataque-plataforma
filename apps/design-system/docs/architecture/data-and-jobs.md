# Data and jobs

Drizzle table declarations live in `src/db/schema.ts` and `src/db/editorial-schema.ts`; SQL migrations are applied by `scripts/migrate.ts`. Production Design and Prospector now share the `prospector` database, with Design data in schemas `design` and `editorial`. The old `rota_design` database is retained as the preserved migration source.

The design API keeps its PostgreSQL pools for the process lifetime and closes them on `SIGTERM`. The editorial queue ledger is in the shared Prospector database. Migrations `0049_durable_task_executor`, `0050_meta_inbox_events` and `0051_task_runtime_permissions` are applied. The PostgreSQL store and supervised executor with leases, checkpoints, retries, lanes and transactional outbox run under systemd in Ubuntu/WSL2. The unit is active; all four production schedules remain disabled and `task_runs` is empty pending handler acceptance.

The Prospector health code reads the migration ledger, task-run states and schedule rows. The system-health view includes recent task metadata and an admin-only retry action. These changes are deployed in local release `0a90325fc16c14f7e61a9c48`. See the [task runtime runbook](../../../../docs/runbooks/task-runtime.md) for operating commands and remaining gates.

Editorial quality scores are JSONB. The metrics query averages only JSON numeric `overall` values in the inclusive 0–1 range and leaves the result null when no valid value exists. The dashboard shows loading, error/retry, and empty-quality states.

The shared `editorial` and `design` schemas are active in `prospector`; the `gazeta` schema and its data are not yet cut over. The Design source database remains intact for rollback and historical comparison.
