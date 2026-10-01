BEGIN;

CREATE TABLE IF NOT EXISTS editorial.social_inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = 'meta'),
  channel text NOT NULL CHECK (channel IN ('instagram')),
  account_external_id text NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('comment', 'direct_message')),
  external_event_id text NOT NULL,
  revision_hash text NOT NULL CHECK (revision_hash ~ '^[0-9a-f]{64}$'),
  sender_external_id text,
  media_external_id text,
  parent_external_id text,
  content_type text NOT NULL CHECK (content_type IN ('text', 'attachment', 'text+attachment', 'unknown')),
  text_content text,
  content_truncated boolean NOT NULL DEFAULT false,
  provider_event_at timestamptz,
  reply_window_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending_triage'
    CHECK (status IN ('pending_triage', 'needs_human_review', 'triaged', 'resolved', 'expired')),
  triage_reason text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  personal_data_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  dedupe_expires_at timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  redacted_at timestamptz,
  UNIQUE (provider, channel, account_external_id, event_kind, external_event_id, revision_hash),
  CHECK (event_kind <> 'comment' OR reply_window_expires_at IS NULL OR provider_event_at IS NOT NULL),
  CHECK (personal_data_expires_at <= dedupe_expires_at)
);

CREATE INDEX IF NOT EXISTS social_inbox_events_status_received_idx
  ON editorial.social_inbox_events(status, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_inbox_events_retention_idx
  ON editorial.social_inbox_events(personal_data_expires_at)
  WHERE redacted_at IS NULL;
CREATE INDEX IF NOT EXISTS social_inbox_events_dedupe_expiry_idx
  ON editorial.social_inbox_events(dedupe_expires_at)
  WHERE redacted_at IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON editorial.social_inbox_events TO prospector_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospector_reader') THEN
    EXECUTE 'GRANT SELECT ON editorial.social_inbox_events TO prospector_reader';
  END IF;
END
$$;

INSERT INTO editorial.task_schedules(task_name, destination, cadence, enabled, configuration, lane, priority, next_run_at)
VALUES ('inbox.retention.cleanup', 'local', 'daily', false, '{}'::jsonb, 'default', 5, now())
ON CONFLICT(task_name) DO UPDATE SET destination='local', cadence='daily',
  configuration='{}'::jsonb, lane='default', priority=5, next_run_at=COALESCE(editorial.task_schedules.next_run_at, now()), updated_at=now();

COMMIT;
