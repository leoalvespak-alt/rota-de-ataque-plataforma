import type { Pool } from 'pg'

export interface BudgetReservation {
  reservationId: string
  provider: string
  estimatedUsd: number
}

export async function reserveBudget(pool: Pool, provider: string, estimatedUsd: number): Promise<BudgetReservation> {
  if (!provider.trim() || !Number.isFinite(estimatedUsd) || estimatedUsd < 0) {
    throw Object.assign(new Error('Invalid budget reservation'), { code: 'INVALID_BUDGET_RESERVATION' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const daily = await client.query<{ limit_usd: number; spent_usd: number; reserved_usd: number }>(
      `SELECT limit_usd, spent_usd, reserved_usd FROM organic_budgets
       WHERE scope = 'provider' AND scope_id = $1 AND period = 'daily' AND period_started_at = current_date
       FOR UPDATE`,
      [provider],
    )
    const dailyRow = daily.rows[0]
    if (dailyRow && dailyRow.spent_usd + dailyRow.reserved_usd + estimatedUsd > dailyRow.limit_usd) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error(`Daily budget exceeded for ${provider}: ${dailyRow.spent_usd + dailyRow.reserved_usd + estimatedUsd} > ${dailyRow.limit_usd}`), { code: 'BUDGET_EXCEEDED', provider, period: 'daily' })
    }

    const monthly = await client.query<{ limit_usd: number; spent_usd: number; reserved_usd: number }>(
      `SELECT limit_usd, spent_usd, reserved_usd FROM organic_budgets
       WHERE scope = 'provider' AND scope_id = $1 AND period = 'monthly' AND period_started_at = date_trunc('month', now())
       FOR UPDATE`,
      [provider],
    )
    const monthlyRow = monthly.rows[0]
    if (monthlyRow && monthlyRow.spent_usd + monthlyRow.reserved_usd + estimatedUsd > monthlyRow.limit_usd) {
      await client.query('ROLLBACK')
      throw Object.assign(new Error(`Monthly budget exceeded for ${provider}: ${monthlyRow.spent_usd + monthlyRow.reserved_usd + estimatedUsd} > ${monthlyRow.limit_usd}`), { code: 'BUDGET_EXCEEDED', provider, period: 'monthly' })
    }

    const reservation = await client.query<{ id: string }>(
      `INSERT INTO organic_budget_reservations(provider, estimated_usd, status) VALUES($1, $2, 'reserved') RETURNING id`,
      [provider, estimatedUsd],
    )
    const reservationRow = reservation.rows[0]
    if (!reservationRow) throw Object.assign(new Error('Failed to persist budget reservation'), { code: 'BUDGET_RESERVATION_FAILED', provider })

    await client.query(
      `UPDATE organic_budgets SET reserved_usd = reserved_usd + $2 WHERE scope = 'provider' AND scope_id = $1 AND period_started_at IN (current_date, date_trunc('month', now()))`,
      [provider, estimatedUsd],
    )

    await client.query('COMMIT')
    return { reservationId: reservationRow.id, provider, estimatedUsd }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function reconcileBudget(pool: Pool, reservationId: string, actualUsd: number): Promise<void> {
  if (!Number.isFinite(actualUsd) || actualUsd < 0) throw Object.assign(new Error('Invalid actual budget cost'), { code: 'INVALID_BUDGET_COST' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const res = await client.query<{ provider: string; estimated_usd: number }>(
      `UPDATE organic_budget_reservations SET actual_usd = $2, status = 'reconciled' WHERE id = $1 AND status = 'reserved' RETURNING provider, estimated_usd`,
      [reservationId, actualUsd],
    )
    const row = res.rows[0]
    if (!row) { await client.query('ROLLBACK'); return }

    await client.query(
      `UPDATE organic_budgets
       SET reserved_usd = GREATEST(0, reserved_usd - $2), spent_usd = spent_usd + $3
       WHERE scope = 'provider' AND scope_id = $1 AND period_started_at IN (current_date, date_trunc('month', now()))`,
      [row.provider, row.estimated_usd, actualUsd],
    )
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error } finally { client.release() }
}

export async function releaseBudget(pool: Pool, reservationId: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const res = await client.query<{ provider: string; estimated_usd: number }>(
      `UPDATE organic_budget_reservations SET status = 'released' WHERE id = $1 AND status = 'reserved' RETURNING provider, estimated_usd`,
      [reservationId],
    )
    const row = res.rows[0]
    if (row) {
      await client.query(
        `UPDATE organic_budgets SET reserved_usd = GREATEST(0, reserved_usd - $2) WHERE scope = 'provider' AND scope_id = $1 AND period_started_at IN (current_date, date_trunc('month', now()))`,
        [row.provider, row.estimated_usd],
      )
    }
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error } finally { client.release() }
}

export function isProviderEnabled(envVarName: string): boolean {
  return process.env[envVarName] === 'true'
}

export async function assertProviderReady(pool: Pool, provider: string, envEnabled: string, envKey: string): Promise<void> {
  if (!isProviderEnabled(envEnabled)) throw Object.assign(new Error(`${provider} is disabled`), { code: 'PROVIDER_DISABLED' })
  if (!process.env[envKey]) throw Object.assign(new Error(`${provider} API key not configured`), { code: 'PROVIDER_NO_KEY' })

  const budget = await pool.query(
    `SELECT 1 FROM organic_budgets WHERE scope = 'provider' AND scope_id = $1 AND limit_usd > 0 LIMIT 1`,
    [provider],
  )
  if (budget.rows.length === 0) throw Object.assign(new Error(`${provider} has no budget ceiling configured`), { code: 'PROVIDER_NO_BUDGET' })
}
