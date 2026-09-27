import type { Pool } from 'pg'
import type { RadarClassification, RadarFinding } from './index.js'

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
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO radar_findings (news_item_id, title, summary, source_url, source_name, concurso_alvo, estado, banca, fase_ciclo, categoria, relevance_score, confidence, factuality_score, review_status, auto_content_allowed, fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING
         RETURNING id`,
        [finding.news_item_id, finding.title, finding.summary, finding.source_url, finding.source_name, finding.concurso_alvo, finding.estado, finding.banca, finding.fase_ciclo, finding.categoria, finding.relevance_score, finding.confidence, finding.factuality_score, finding.review_status, finding.auto_content_allowed, finding.fingerprint],
      )
      result = { id: inserted.rows[0]?.id ?? '', isNew: (inserted.rowCount ?? 0) > 0 }
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
