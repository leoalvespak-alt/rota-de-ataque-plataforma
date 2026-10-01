import type { Pool } from 'pg'
import type { TaskHandler } from '@plataforma/task-runtime'
import {
  createMetaSocialPublisher,
  type MetaSocialPublisher,
  type SocialChannel,
} from '@plataforma/social-publishing'

interface PublicationRow {
  id: string
  channel: string
  caption: string | null
  title: string | null
  status: string
  approved_by: string | null
  scheduled_for: string | Date | null
  image_url: string | null
}

async function resolveFindingFingerprint(pool: Pool, publicationId: string): Promise<string | null> {
  const rows = await pool.query<{ fingerprint: string | null }>(
    `SELECT opp.evidence->>'radar_finding_id' AS fingerprint
     FROM editorial.unified_creatives uc
     JOIN editorial.content_items item ON item.id = uc.content_item_id
     JOIN content_opportunities opp ON opp.id = item.opportunity_id
     WHERE uc.id = $1::uuid`,
    [publicationId],
  )
  return rows.rows[0]?.fingerprint ?? null
}

export interface PublicationHandlerDeps {
  publisher?: MetaSocialPublisher | null
}

export function createPublicationDueTaskHandler(pool: Pool, deps: PublicationHandlerDeps = {}): TaskHandler {
  return async (request, context) => {
    const payload = request.payload as { publicationId?: string; imageUrl?: string }
    const publicationId = payload.publicationId ?? request.itemId
    if (!publicationId) throw new Error('publication.due requires publicationId')
    const rows = await pool.query<PublicationRow>(
      `SELECT id, channel, caption, title, status, approved_by, scheduled_for,
              copy_data->>'image_url' AS image_url
       FROM editorial.unified_creatives WHERE id = $1::uuid`,
      [publicationId],
    )
    const row = rows.rows[0]
    if (!row) throw new Error(`Publication ${publicationId} was not found`)
    if (row.status === 'published') {
      return { result: { ok: true, publicationId, alreadyPublished: true }, events: [] }
    }
    if (!['scheduled', 'approved'].includes(row.status)) {
      throw new Error(`Publication ${publicationId} is not releasable (status=${row.status})`)
    }
    if (!row.approved_by || !row.approved_by.trim()) {
      throw new Error(`Publication ${publicationId} needs approval before release`)
    }
    const fingerprint = await resolveFindingFingerprint(pool, publicationId)
    if (fingerprint) {
      const covered = await pool.query<{ id: string }>(
        `SELECT id FROM editorial.pauta_registry
         WHERE status = 'posted' AND sources @> jsonb_build_array(jsonb_build_object('fingerprint', $1))`,
        [fingerprint],
      )
      if ((covered.rowCount ?? 0) > 0) {
        await pool.query(
          `UPDATE editorial.unified_creatives SET status='rejected', curation_status='duplicate_of_posted' WHERE id=$1::uuid`,
          [publicationId],
        )
        return { result: { ok: true, publicationId, duplicateOfPosted: true }, events: [] }
      }
    }
    const channel = (row.channel === 'threads' ? 'threads' : 'instagram') as SocialChannel
    const publisher = deps.publisher ?? createMetaSocialPublisher()
    if (!publisher) throw new Error('Meta social publishing is not configured')
    const outcome = await publisher.publish({
      channel,
      caption: row.caption ?? row.title ?? '',
      imageUrl: payload.imageUrl ?? row.image_url ?? undefined,
      approvedBy: row.approved_by,
      externalAccountId: request.accountId,
    })
    if (outcome.status !== 'published' || !outcome.externalId) {
      throw new Error(`Meta publish ${outcome.status}: ${outcome.error ?? 'unknown'} (reconciliation=${outcome.reconciliationId ?? 'none'})`)
    }
    await pool.query(
      `UPDATE editorial.unified_creatives SET status='published', published_at=now(),
        ig_media_id=$2, external_ref=COALESCE(external_ref,'{}'::jsonb)||$3::jsonb
       WHERE id=$1::uuid`,
      [publicationId, outcome.externalId, JSON.stringify({ channel, attempts: outcome.attempts })],
    )
    await pool.query(
      `INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'publication.published',$2,$3::jsonb)`,
      ['publication.due', publicationId, JSON.stringify({ mediaId: outcome.externalId, runId: context.runId })],
    )
    if (fingerprint) {
      await pool.query(
        `UPDATE editorial.pauta_registry SET status='posted', last_seen_at=now(), updated_at=now()
         WHERE sources @> jsonb_build_array(jsonb_build_object('fingerprint', $1))`,
        [fingerprint],
      )
    }
    return {
      result: { ok: true, publicationId, mediaId: outcome.externalId, attempts: outcome.attempts },
      events: [{
        eventKey: `${request.idempotencyKey}:publication.published`,
        eventType: 'publication.published',
        payload: { runId: context.runId, publicationId, mediaId: outcome.externalId },
      }],
    }
  }
}
