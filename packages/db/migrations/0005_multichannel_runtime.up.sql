BEGIN;

ALTER TABLE email_events ADD COLUMN provider text, ADD COLUMN external_event_id text;
CREATE UNIQUE INDEX email_events_provider_external_idx ON email_events(provider, external_event_id, kind) WHERE external_event_id IS NOT NULL;

CREATE TABLE email_confirmation_tokens (
  token_hash bytea PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES email_subscribers ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reddit_evidence ADD COLUMN classified_at timestamptz;
CREATE INDEX reddit_watches_due_idx ON reddit_watches(next_run_at) WHERE active = true;

CREATE TABLE contact_policy_decisions (
  id bigserial PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns ON DELETE CASCADE,
  channel text NOT NULL,
  allowed boolean NOT NULL,
  reason text NOT NULL,
  policy_id uuid REFERENCES contact_policies,
  decided_at timestamptz NOT NULL DEFAULT now(),
  trace_id text
);
CREATE INDEX contact_policy_decisions_lead_at_idx ON contact_policy_decisions(lead_id, decided_at DESC);
INSERT INTO contact_policies(campaign_id,channel,cadence_seconds,enabled,rules)
SELECT NULL,NULL,86400,true,'{"inbound_resets_window":true,"whatsapp_group_exempt":true}'::jsonb
WHERE NOT EXISTS(SELECT 1 FROM contact_policies WHERE campaign_id IS NULL AND channel IS NULL);

ALTER TABLE timeline_events ADD CONSTRAINT timeline_events_type_check CHECK(event_type IN (
  'instagram.comment','instagram.follow','instagram.follow_back','instagram.like_received','instagram.mention','instagram.dm_inbound','instagram.dm_outbound','instagram.story_view','instagram.reply_public','instagram.reply_private',
  'threads.publication','threads.reply_inbound','threads.reply_outbound','threads.engagement','threads.repost','threads.quote',
  'email.subscribed','email.double_optin_confirmed','email.sent','email.delivered','email.opened','email.clicked','email.replied','email.bounced','email.complained','email.unsubscribed',
  'whatsapp.opt_in','whatsapp.opt_out','whatsapp.message_inbound','whatsapp.message_outbound','whatsapp.template_sent','whatsapp.status_delivered','whatsapp.status_read','whatsapp.group_join','whatsapp.group_leave','whatsapp.group_message_inbound','whatsapp.group_message_outbound',
  'reddit.evidence_collected','system.identity_verified','system.identity_merge','system.contact_blocked','system.nba_recommended','system.nbc_decided','system.score_recomputed','system.flow_entered','system.flow_exited',
  'conversion.purchase','conversion.lead_form','conversion.dm_reply','conversion.follow_back'
));

CREATE INDEX identities_lead_channel_idx ON identities(lead_id, channel);
ALTER TABLE identity_candidates ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX identity_candidates_pending_idx ON identity_candidates(status, confidence DESC) WHERE status = 'pending';

COMMIT;
