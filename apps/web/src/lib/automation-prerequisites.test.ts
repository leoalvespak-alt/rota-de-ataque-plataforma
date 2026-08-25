import { describe, expect, it, vi } from 'vitest'
import { evaluateAutomationPrerequisites } from './automation-prerequisites'

const allFacts = {
  has_sources: true,
  has_connected_account: true,
  has_actor: true,
  has_policy: true,
  has_ai: true,
  has_thesis: true,
  has_approved_variant: true,
  has_budget: true,
}

describe('evaluateAutomationPrerequisites', () => {
  it('avalia as dez chaves usando o schema executável e o kill-switch do Redis', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [allFacts] }) }
    const redis = { get: vi.fn().mockResolvedValue(null) }
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch

    const result = await evaluateAutomationPrerequisites(database, redis, {
      env: { NODE_ENV: 'test', EMBEDDINGS_ENDPOINT: 'http://embeddings' },
      fetchImpl,
    })

    expect(result).toHaveLength(10)
    expect(result.every((item) => item.satisfied)).toBe(true)
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('limit_usd > 0'))
    expect(database.query).toHaveBeenCalledWith(expect.not.stringContaining('operational_settings'))
    expect(redis.get).toHaveBeenCalledWith('kill-switch:global')
  })

  it('falha fechado quando Redis e embeddings estão indisponíveis', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [{ ...allFacts, has_ai: false }] }) }
    const redis = { get: vi.fn().mockRejectedValue(new Error('offline')) }
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch

    const result = await evaluateAutomationPrerequisites(database, redis, {
      env: { NODE_ENV: 'test', EMBEDDINGS_ENDPOINT: 'http://embeddings' },
      fetchImpl,
    })
    const byKey = Object.fromEntries(result.map((item) => [item.key, item.satisfied]))

    expect(byKey.kill_switch_off).toBe(false)
    expect(byKey.embeddings_healthy).toBe(false)
    expect(byKey.ai_provider_configured).toBe(false)
  })
})
