import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { adaptiveInterval } from '@plataforma/shared'
import { createAdaptiveProcessor, spec, type AdaptiveRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: AdaptiveRepository = {
  async recompute(accountId, traceId) {
    const client = await pool.connect()
    let updated = 0
    let budgetBlocked = 0
    try {
      await client.query('BEGIN')
      const budget = Number(process.env.PLAYWRIGHT_DAILY_BUDGET ?? 1000)
      const used = Number((await client.query<{ count: string }>(
        `SELECT COUNT(*)::text count
         FROM crawl_runs
         WHERE started_at >= date_trunc('day', now())
           AND ($1::uuid IS NULL OR account_id = $1)`,
        [accountId ?? null],
      )).rows[0]?.count ?? 0)
      const schedules = await client.query(
        `SELECT cs.*,
                COALESCE((SELECT source_score
                          FROM source_metrics sm
                          WHERE sm.source_type = cs.source_type
                            AND sm.source_id = cs.source_id
                            AND sm.campaign_id = cs.campaign_id
                          ORDER BY computed_at DESC LIMIT 1), 0) score
         FROM crawl_schedule cs
         WHERE NOT cs.locked_by_user OR cs.locked_until < now()
         FOR UPDATE`,
      )
      for (const row of schedules.rows) {
        if (used >= budget) {
          budgetBlocked++
          continue
        }
        const quality = Math.max(0, Math.min(1, Number(row.score) / 100))
        const next = adaptiveInterval({
          current: Number(row.current_interval_seconds),
          min: Number(row.min_interval_seconds),
          max: Number(row.max_interval_seconds),
          sourceScore: quality,
          generated: quality > 0 ? 1 : 0,
          emptyRuns: Number(row.consecutive_empty_runs),
          budgetPressure: budget > 0 ? used / budget : 1,
          locked: Boolean(row.locked_by_user),
        })
        if (next.interval === Number(row.current_interval_seconds)) continue
        await client.query(
          `UPDATE crawl_schedule
           SET current_interval_seconds = $2,
               next_run_at = GREATEST(COALESCE(last_run_at, now()) + ($2 || ' seconds')::interval, now()),
               quality_score = $3,
               last_updated_at = now()
           WHERE id = $1`,
          [row.id, next.interval, quality],
        )
        await client.query(
          `INSERT INTO crawl_schedule_history(
             source_type, source_id, old_interval_seconds, new_interval_seconds, reason
           ) VALUES($1, $2, $3, $4, $5)`,
          [
            row.source_type,
            row.source_id,
            row.current_interval_seconds,
            next.interval,
            `${next.reason}; quality=${quality.toFixed(3)}; empty=${row.consecutive_empty_runs}; trace=${traceId}`,
          ],
        )
        updated++
      }
      await client.query('COMMIT')
      return { updated, budgetBlocked }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

runWorker(spec.queue, createAdaptiveProcessor(repository))
