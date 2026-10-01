CREATE SCHEMA IF NOT EXISTS editorial;
CREATE SCHEMA IF NOT EXISTS design;
CREATE SCHEMA IF NOT EXISTS gazeta;

DO $$
DECLARE
  app_role text;
BEGIN
  app_role := current_user;
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA editorial, design, gazeta TO %I', app_role);

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_app') THEN
    GRANT USAGE, CREATE ON SCHEMA editorial, design, gazeta TO prospector_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_reader') THEN
    GRANT USAGE ON SCHEMA editorial, design, gazeta TO prospector_reader;
  END IF;
END $$;
