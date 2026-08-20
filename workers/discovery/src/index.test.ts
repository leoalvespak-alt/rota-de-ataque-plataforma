import { describe, expect, it, vi } from 'vitest'
import { createDiscoveryProcessor, processJob, spec } from './index.js'

const preflight = { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' as const, accountRole: 'collector' as const }
describe('discovery', () => {
  it('declares its worker contract', () => { expect(spec.queue).toBe('discovery'); expect(typeof processJob).toBe('function') })
  it('reserves budget before invoking the provider', async () => {
    const order: string[] = []
    const repository = { start: vi.fn(async () => { order.push('reserve'); return { runId: 'run', reservationId: 'reservation' } }), complete: vi.fn(async () => ({ inserted: 1, candidates: 1 })), fail: vi.fn(async () => undefined) }
    const provider = { plan: () => ({ provider: 'exa' as const, operation: 'search', estimatedUsd: .01 }), discover: vi.fn(async () => { order.push('network'); return { observations: [], estimatedUsd: .01, actualUsd: null } }) }
    const process = createDiscoveryProcessor(repository, provider)
    await process({ id: 'job', payload: { mode: 'web_search', campaignId: '00000000-0000-4000-8000-000000000001', query: 'rota' }, preflight })
    expect(order).toEqual(['reserve', 'network'])
  })
  it('rejects malformed payload before reservation or network', async () => {
    const repository = { start: vi.fn(), complete: vi.fn(), fail: vi.fn() }
    const provider = { plan: vi.fn(), discover: vi.fn() }
    const process = createDiscoveryProcessor(repository as never, provider as never)
    await expect(process({ id: 'job', payload: { mode: 'fallback_collect', campaignId: 'bad', urls: [] } as never, preflight })).rejects.toThrow('invalid')
    expect(repository.start).not.toHaveBeenCalled(); expect(provider.discover).not.toHaveBeenCalled()
  })
})
