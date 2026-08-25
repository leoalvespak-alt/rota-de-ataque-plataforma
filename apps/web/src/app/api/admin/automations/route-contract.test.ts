import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), poolQuery: vi.fn(), quit: vi.fn() }))
vi.mock('@/lib/permissions', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/campaign-context', () => ({ getCampaignContext: vi.fn() }))
vi.mock('@plataforma/db', () => ({ createDatabase: () => ({ pool: { query: mocks.poolQuery } }) }))
vi.mock('@plataforma/queue', () => ({
  createQueueRegistry: () => ({ connection: { quit: mocks.quit }, queues: {} }),
  MANAGED_SCHEDULER_CONFIG: {},
  nextCadenceExecution: vi.fn(),
  parseCadence: vi.fn(),
}))

import { POST } from './route'

describe('POST /api/admin/automations schedule contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({ email: 'operator@example.test', role: 'operator' })
    mocks.quit.mockResolvedValue(undefined)
  })

  it('recusa set_schedule para worker acionado por evento', async () => {
    mocks.poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ schedulable: false }] })
    const response = await POST(new Request('http://localhost/api/admin/automations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'set_schedule', workerName: 'content-opportunity', cadence: '0 * * * *' }),
    }))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Este worker é acionado por evento e não possui cadência configurável.' })
    expect(mocks.poolQuery).toHaveBeenCalledTimes(1)
    expect(mocks.quit).toHaveBeenCalledOnce()
  })
})
