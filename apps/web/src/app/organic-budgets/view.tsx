import { createDatabase } from '@plataforma/db'
import { OrganicBudgetsClient } from './OrganicBudgetsClient'

const PROVIDERS = [
  { id: 'exa', name: 'Exa', envEnabled: 'EXA_ENABLED', envKey: 'EXA_API_KEY' },
  { id: 'apify', name: 'Apify', envEnabled: 'APIFY_ENABLED', envKey: 'APIFY_API_KEY' },
  { id: 'bright-data', name: 'Bright Data', envEnabled: 'BRIGHT_DATA_ENABLED', envKey: 'BRIGHT_DATA_API_KEY' },
]

export default async function OrganicBudgetsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const budgets = (await pool.query(
      `SELECT scope, scope_id, period, limit_usd, spent_usd, reserved_usd, hard_limit, period_started_at
       FROM organic_budgets
       WHERE scope = 'provider' AND period_started_at IN (current_date, date_trunc('month', now()))
       ORDER BY scope_id, period`,
    )).rows

    const recentSpend = (await pool.query(
      `SELECT provider, SUM(COALESCE(actual_usd, estimated_usd)) total_usd, COUNT(*) call_count
       FROM organic_budget_reservations
       WHERE created_at >= now() - interval '30 days'
       GROUP BY provider
       ORDER BY total_usd DESC`,
    )).rows

    const providers = PROVIDERS.map(p => ({
      ...p,
      enabled: process.env[p.envEnabled] === 'true',
      hasKey: Boolean(process.env[p.envKey]),
      dailyBudget: budgets.find(b => b.scope_id === p.id && b.period === 'daily'),
      monthlyBudget: budgets.find(b => b.scope_id === p.id && b.period === 'monthly'),
      recentSpend: recentSpend.find(r => r.provider === p.id),
    }))

    return (
      <OrganicBudgetsClient
        providers={JSON.parse(JSON.stringify(providers))}
      />
    )
  } finally {}
}
