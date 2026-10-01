import type { Pool } from 'pg'
import type { RadarClassification, RadarFinding } from './index.js'
import { attachPautaSource, checkPautaRegistry, registerPauta } from './pauta-registry.js'

interface Queryable {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>
}

/**
 * Replicates the opportunity-approve route for JEV auto-approved findings:
 * draft content item + instagram/threads creatives + review inbox entry + audit.
 * Uses the canonical editorial tables, exactly like the web route.
 */
async function createAutoApprovedDraft(
  client: Queryable,
  opportunityId: string,
  campaignId: string | null,
  finding: RadarFinding,
  reason: string,
): Promise<void> {
  const thesis = `${finding.categoria}: ${finding.title}`
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM editorial.content_items WHERE opportunity_id = $1 ORDER BY created_at LIMIT 1',
    [opportunityId],
  )
  let contentItemId = existing.rows[0]?.id
  if (!contentItemId) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO editorial.content_items(campaign_id,opportunity_id,audience_segment,funnel_stage,objective,angle,hook,arguments,cta,intelligence_sources,brand_voice_version,status,created_by)
       VALUES($1,$2,'prospects','awareness',$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,'current','draft','auto-jev-gate') RETURNING id`,
      [
        campaignId, opportunityId, thesis, reason, finding.title,
        JSON.stringify([{ text: reason ?? thesis, evidence: { radar_finding_id: finding.fingerprint, source_url: finding.source_url } }]),
        JSON.stringify({ text: 'Faça parte da plataforma pelo link da BIO: plano de estudos, questões, teoria em PDF e muito mais.' }),
        JSON.stringify([{ fingerprint: finding.fingerprint, url: finding.source_url }]),
      ],
    )
    contentItemId = inserted.rows[0]?.id
    if (!contentItemId) throw new Error('Auto-approved draft content item was not created')
      const baseCopy = [finding.title, reason, 'Faça parte da plataforma pelo link da BIO: plano de estudos, questões, teoria em PDF e muito mais.'].filter(Boolean).join('\n\n')
    await client.query(
      `INSERT INTO editorial.unified_creatives(content_item_id,channel,format,payload,variant_status,generated_by)
       VALUES($1,'instagram','carousel',$2::jsonb,'draft','organic-draft-v1'),($1,'threads','text',$3::jsonb,'draft','organic-draft-v1')`,
      [
        contentItemId,
        JSON.stringify({
          caption: baseCopy,
          slides: [
            { role: 'cover', title: finding.title, body: reason ?? '' },
            { role: 'content', title: thesis, body: reason ?? '' },
            { role: 'cta', title: 'Próximo passo', body: 'Faça parte da plataforma pelo link da BIO.' },
          ],
        }),
        JSON.stringify({ text: baseCopy }),
      ],
    )
    await client.query(
      `INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('content_item',$1,'Rascunho editorial gerado por aprovacao automatica JEV',$2::jsonb,$3::jsonb)`,
      [contentItemId, JSON.stringify({ action: 'review_content_draft' }), JSON.stringify({ opportunityId, contentVersion: 1, autoApproved: true })],
    )
  }
  await client.query(
    `INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,
    ['auto-jev-gate', 'content_opportunity.auto_approve', opportunityId, JSON.stringify({ status: 'new' }), JSON.stringify({ status: 'approved', contentItemId })],
  )
}

export async function persistNewsClassification(
  pool: Pool,
  itemId: string,
  classification: RadarClassification,
  finding: RadarFinding | null,
): Promise<{ id: string; isNew: boolean }> {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    const classified = await client.query(
      'UPDATE news_items SET classified = true, classification = $2 WHERE id = $1',
      [itemId, JSON.stringify(classification)],
    )
    if ((classified.rowCount ?? 0) !== 1) throw new Error(`News item ${itemId} was not found for classification`)

    let result = { id: '', isNew: false }
    if (finding) {
      const pauta = await checkPautaRegistry(client, {
        categoria: finding.categoria, estado: finding.estado,
        fase_ciclo: finding.fase_ciclo, title: finding.title,
      })
      const pautaSource = { fingerprint: finding.fingerprint, url: finding.source_url, source_name: finding.source_name }
      if (pauta.blocked && pauta.existing) {
        // Same pauta already covered (posted, scheduled or manual): attach this
        // source and stop. No new finding, no new opportunity, no repost.
        await attachPautaSource(client, pauta.existing.id, pautaSource)
        await client.query('COMMIT')
        transactionStarted = false
        return result
      }
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO radar_findings (news_item_id, title, summary, source_url, source_name, concurso_alvo, estado, banca, fase_ciclo, categoria, relevance_score, confidence, factuality_score, review_status, auto_content_allowed, fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING
         RETURNING id`,
        [finding.news_item_id, finding.title, finding.summary, finding.source_url, finding.source_name, finding.concurso_alvo, finding.estado, finding.banca, finding.fase_ciclo, finding.categoria, finding.relevance_score, finding.confidence, finding.factuality_score, finding.review_status, finding.auto_content_allowed, finding.fingerprint],
      )
      result = { id: inserted.rows[0]?.id ?? '', isNew: (inserted.rowCount ?? 0) > 0 }
      if (!result.isNew) {
        // Fingerprint collision: attach the source to the canonical pauta anyway.
        await registerPauta(client, {
          key: pauta.key,
          categoria: finding.categoria, estado: finding.estado,
          fase_ciclo: finding.fase_ciclo, title: finding.title,
          status: 'draft',
          source: pautaSource,
          findingId: null,
          opportunityId: null,
        })
      }
      if (result.isNew) {
        const campaign = await client.query<{ id: string }>("SELECT id FROM campaigns WHERE name = 'Rota de Ataque' LIMIT 1")
        const sourceReferences = [{ fingerprint: finding.fingerprint, url: finding.source_url }]
        const evidence: Record<string, unknown> = {
          radar_finding_id: finding.fingerprint, news_item_id: finding.news_item_id,
          source_url: finding.source_url, source_name: finding.source_name, factuality_score: finding.factuality_score,
        }
        // Calibrated auto path: the JEV gate already approved this finding, so the
        // opportunity skips human triage and enters the funnel as approved.
        const opportunityStatus = finding.auto_content_allowed ? 'approved' : 'new'
        if (finding.auto_content_allowed && finding.auto_evidence) {
          evidence.auto_approved = true
          evidence.jev_preserved = finding.auto_evidence.jevPreserved
          evidence.auto_thresholds = {
            relevance: finding.auto_evidence.minRelevance, confidence: finding.auto_evidence.minConfidence,
            factuality: finding.auto_evidence.minFactuality, preserved: finding.auto_evidence.minPreserved,
          }
          evidence.trusted_source = finding.auto_evidence.trustedSource
        }
        const opportunity = await client.query<{ id: string }>(
          `INSERT INTO content_opportunities (campaign_id, thesis, angle, hook, evidence, opportunity_score, status, confidence, source_references)
           SELECT $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb
           WHERE NOT EXISTS (SELECT 1 FROM content_opportunities WHERE source_references @> $9::jsonb)
           RETURNING id`,
          [
            campaign.rows[0]?.id ?? null,
            `${finding.categoria}: ${finding.title}`,
            classification.reason,
            finding.title,
            JSON.stringify(evidence),
            classification.relevance_score,
            opportunityStatus,
            classification.confidence,
            JSON.stringify(sourceReferences),
          ],
        )
        const opportunityId = opportunity.rows[0]?.id
        if (finding.auto_content_allowed && opportunityId) {
          await createAutoApprovedDraft(client, opportunityId, campaign.rows[0]?.id ?? null, finding, classification.reason)
        }
        await registerPauta(client, {
          key: pauta.key,
          categoria: finding.categoria, estado: finding.estado,
          fase_ciclo: finding.fase_ciclo, title: finding.title,
          status: finding.auto_content_allowed ? 'scheduled' : 'draft',
          source: pautaSource,
          findingId: result.id || null,
          opportunityId: opportunityId ?? null,
        })
      }
    }

    await client.query('COMMIT')
    transactionStarted = false
    return result
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
