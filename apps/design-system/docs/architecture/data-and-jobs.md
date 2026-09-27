# Data and jobs

Drizzle table declarations live in `src/db/schema.ts` and `src/db/editorial-schema.ts`; SQL migrations are applied by `scripts/migrate.ts`. The current production Design database is `rota_design`; the Prospector database is separate and can be connected through `PROSPECTOR_DATABASE_URL`.

The design API keeps its PostgreSQL pools for the process lifetime and closes them on `SIGTERM`. The editorial queue ledger is in the Prospector database. Its `task_runs` and `task_schedules` are the source for persisted task state, but the current production schedules are disabled and there is no verified resident editorial executor.

The Prospector health code now reads the migration ledger, task-run states and schedule rows. The system-health view reads task counts and schedules from PostgreSQL rather than rendering hardcoded zeroes. These changes are local code and have not been deployed.

Editorial quality scores are JSONB. The metrics query averages only JSON numeric `overall` values in the inclusive 0–1 range and leaves the result null when no valid value exists. The dashboard shows loading, error/retry, and empty-quality states.

The unification plan calls for explicit `editorial`, `design` and `gazeta` schemas in one database. That migration has not been executed; do not route both applications to one database before schema qualification, data mapping, grants and rollback have been validated.
