import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  poolQuery: vi.fn(),
  createQueueRegistry: vi.fn(),
}))

vi.mock('@/lib/permissions', () => ({ requireRole: mocks.requireRole }))
vi.mock('@plataforma/db', () => ({ createDatabase: () => ({ pool: { query: mocks.poolQuery } }) }))
vi.mock('@plataforma/queue', async (importOriginal) => ({
  ...await importOriginal<typeof import('@plataforma/queue')>(),
  createQueueRegistry: mocks.createQueueRegistry,
}))
vi.mock('ioredis', () => ({
  Redis: class {
    quit = vi.fn().mockResolvedValue(undefined)
  },
}))

import { POST } from './route'

describe('POST /api/admin/automations/engines/:key/run-now', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({ email: 'operator@example.test', role: 'operator' })
  })

  it('não aceita job quando o consumer existe, mas está pausado', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ worker_name: 'news-radar' }] })
      .mockResolvedValueOnce({ rows: [{ worker_name: 'news-radar', state: 'paused', last_beat_at: new Date().toISOString() }] })

    const response = await POST(
      new Request('http://localhost/api/admin/automations/engines/M1/run-now', { method: 'POST' }),
      { params: Promise.resolve({ key: 'M1' }) },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'runtime_unavailable',
      reasonCode: 'RUNTIME_UNAVAILABLE',
      unavailableWorkers: ['news-radar'],
      nextAction: { label: 'Ligar motor' },
    })
    expect(mocks.createQueueRegistry).not.toHaveBeenCalled()
  })
})
