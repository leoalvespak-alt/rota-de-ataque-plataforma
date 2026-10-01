CREATE SCHEMA IF NOT EXISTS editorial;
CREATE SCHEMA IF NOT EXISTS design;
CREATE SCHEMA IF NOT EXISTS gazeta;

CREATE TABLE IF NOT EXISTS editorial.legacy_editorial_ids (
  source_relation text NOT NULL,
  legacy_id uuid NOT NULL,
  canonical_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_relation, legacy_id)
);

CREATE TABLE IF NOT EXISTS editorial.legacy_editorial_foreign_keys (
  source_relation text NOT NULL,
  child_relation text NOT NULL,
  child_relation_oid oid NOT NULL,
  constraint_name text NOT NULL,
  child_columns smallint[] NOT NULL,
  parent_columns smallint[] NOT NULL,
  delete_action "char" NOT NULL,
  update_action "char" NOT NULL,
  match_type "char" NOT NULL,
  is_deferrable boolean NOT NULL,
  is_initially_deferred boolean NOT NULL,
  was_validated boolean NOT NULL,
  PRIMARY KEY (source_relation, child_relation, constraint_name)
);

CREATE TABLE IF NOT EXISTS editorial.shared_cutover_state (
  migration_version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  source_database text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS editorial.shared_cutover_snapshots (
  source_relation text NOT NULL,
  record_id uuid NOT NULL,
  row_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_relation, record_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_app') THEN
    RAISE EXCEPTION 'Required role prospector_app is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_reader') THEN
    RAISE EXCEPTION 'Required role prospector_reader is missing';
  END IF;
END
$$;

GRANT USAGE, CREATE ON SCHEMA editorial, design, gazeta TO prospector_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA editorial, design, gazeta TO prospector_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA editorial, design, gazeta TO prospector_app;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA editorial GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prospector_app;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA editorial GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO prospector_app;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA design GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prospector_app;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA design GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO prospector_app;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA gazeta GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prospector_app;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA gazeta GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO prospector_app;
GRANT USAGE ON SCHEMA editorial, design, gazeta TO prospector_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA editorial, design, gazeta TO prospector_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA editorial GRANT SELECT ON TABLES TO prospector_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA design GRANT SELECT ON TABLES TO prospector_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE prospector_app IN SCHEMA gazeta GRANT SELECT ON TABLES TO prospector_reader;
