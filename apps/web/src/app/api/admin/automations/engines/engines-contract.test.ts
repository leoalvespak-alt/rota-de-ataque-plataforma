import { AUTOMATION_ENGINES, ENGINE_BY_KEY } from '@plataforma/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
  clientQuery: vi.fn(),
  clientRelease: vi.fn(),
  evaluatePrerequisites: vi.fn(),
  createQueueRegistry: vi.fn(),
}))

vi.mock('@/lib/permissions', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/automation-prerequisites', () => ({
  evaluateAutomationPrerequisites: mocks.evaluatePrerequisites,
}))
vi.mock('@plataforma/db', () => ({
  createDatabase: () => ({
    pool: { query: mocks.poolQuery, connect: mocks.poolConnect },
  }),
}))
vi.mock('@plataforma/queue', () => ({
  createQueueRegistry: mocks.createQueueRegistry,
}))
vi.mock('ioredis', () => ({
  Redis: class {
    quit = vi.fn().mockResolvedValue(undefined)
  },
}))

import { GET, POST } from './route'

const allSatisfied = [
  'news_source_active',
  'connected_account_healthy',
  'budget_ceiling_set',
  'embeddings_healthy',
  'ai_provider_configured',
  'thesis_exists',
  'actor_account_healthy',
  'kill_switch_off',
  'approved_variant_exists',
  'contact_policy_configured',
].map((key) => ({ key, satisfied: true, label_pt: key, href: '/' }))

function request(body: unknown) {
  return new Request('http://localhost/api/admin/automations/engines', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function statesFor(engineKeys: Array<keyof typeof ENGINE_BY_KEY>, enabled: boolean) {
  return engineKeys.flatMap((key) => ENGINE_BY_KEY[key].workers)
    .map((worker_name) => ({ worker_name, enabled }))
}

describe('POST /api/admin/automations/engines', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({ email: 'operator@example.test', role: 'operator' })
    mocks.poolConnect.mockResolvedValue({ query: mocks.clientQuery, release: mocks.clientRelease })
    mocks.evaluatePrerequisites.mockResolvedValue(allSatisfied)
    mocks.createQueueRegistry.mockReturnValue({
      connection: { quit: vi.fn().mockResolvedValue(undefined) },
      queues: Object.fromEntries(AUTOMATION_ENGINES.flatMap((engine) => engine.workers).map((worker) => [worker, {
        getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0 }),
        close: vi.fn().mockResolvedValue(undefined),
      }])),
    })
  })

  it('retorna 401 sem sessão', async () => {
    mocks.requireRole.mockRejectedValue(Object.assign(new Error('session missing'), {
      status: 401,
      code: 'authentication_required',
    }))

    const response = await POST(request({ engineKey: 'M1', action: 'enable', cascade: false }))

    expect(response.status).toBe(401)
    expect(mocks.poolQuery).not.toHaveBeenCalled()
  })

  it('retorna 403 para viewer em mutação', async () => {
    mocks.requireRole.mockRejectedValue(Object.assign(new Error('role denied'), {
      status: 403,
      code: 'forbidden',
    }))

    const response = await POST(request({ engineKey: 'M1', action: 'enable', cascade: false }))

    expect(response.status).toBe(403)
  })

  it('retorna 409 tipado quando falta pré-requisito', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: statesFor(['M1'], false) })
    mocks.evaluatePrerequisites.mockResolvedValue([
      ...allSatisfied.filter((item) => item.key !== 'news_source_active'),
      { key: 'news_source_active', satisfied: false, label_pt: 'Fonte ativa', href: '/radar' },
    ])

    const response = await POST(request({ engineKey: 'M1', action: 'enable', cascade: false }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      error: 'prerequisites_not_met',
      prerequisites: [{ key: 'news_source_active', engineKey: 'M1' }],
    })
    expect(mocks.poolConnect).not.toHaveBeenCalled()
  })

  it('retorna 409 somente quando uma dependência realmente precisa mudar', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: statesFor(['M1', 'M2'], false) })

    const response = await POST(request({ engineKey: 'M2', action: 'enable', cascade: false }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({ error: 'cascade_required', dependencies: ['M1'] })
  })

  it('retorna 200 com changed vazio no replay', async () => {
    const current = statesFor(['M0'], true)
    mocks.poolQuery.mockResolvedValue({ rows: current })
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: current })
      .mockResolvedValueOnce({ rows: [] })

    const response = await POST(request({ engineKey: 'M0', action: 'enable', cascade: false }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.changed).toEqual([])
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(mocks.clientQuery).toHaveBeenLastCalledWith('ROLLBACK')
  })

  it('mantém update, comandos e auditoria no mesmo client transacional', async () => {
    const current = statesFor(['M1'], false)
    mocks.poolQuery.mockResolvedValue({ rows: current })
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT worker_name')) return { rows: current }
      if (sql.includes('INSERT INTO engine_commands')) return { rows: [{ id: 'engine-command-id' }] }
      return { rows: [] }
    })

    const response = await POST(request({ engineKey: 'M1', action: 'enable', cascade: false }))

    expect(response.status).toBe(200)
    expect(mocks.clientQuery.mock.calls[0]?.[0]).toBe('BEGIN')
    expect(mocks.clientQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT')
    expect(mocks.clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO audit_log'))).toBe(true)
    expect(mocks.poolQuery.mock.calls.some(([sql]) => sql === 'BEGIN')).toBe(false)
  })

  it('não permite desligar o motor always-on', async () => {
    const response = await POST(request({ engineKey: 'M0', action: 'disable', cascade: false }))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'always_on_engine' })
  })

  it('mantém os sete motores no contrato', () => {
    expect(AUTOMATION_ENGINES).toHaveLength(7)
  })
})

describe('GET /api/admin/automations/engines', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({ email: 'viewer@example.test', role: 'viewer' })
    mocks.evaluatePrerequisites.mockResolvedValue(allSatisfied)
    mocks.createQueueRegistry.mockReturnValue({
      connection: { quit: vi.fn().mockResolvedValue(undefined) },
      queues: Object.fromEntries(AUTOMATION_ENGINES.flatMap((engine) => engine.workers).map((worker) => [worker, {
        getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0 }),
        close: vi.fn().mockResolvedValue(undefined),
      }])),
    })
  })

  it('mantém motor desligado como off mesmo quando a última execução histórica falhou', async () => {
    const now = new Date().toISOString()
    mocks.poolQuery.mockResolvedValue({ rows: AUTOMATION_ENGINES.flatMap((engine) => engine.workers.map((worker_name) => ({
      worker_name,
      enabled: false,
      engine_key: engine.key,
      schedulable: false,
      label_pt: worker_name,
      cadence: null,
      last_error: 'historical failure',
      heartbeat_state: 'paused',
      last_beat_at: now,
      last_run_state: 'failed',
      last_run_reason_code: 'SQL_CONTRACT_ERROR',
      last_run_finished_at: now,
      last_success_at: null,
      updated_at: now,
    }))) })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.engines.every((engine: { state: string; desiredState: string; lastRunState: string }) =>
      engine.state === 'off' && engine.desiredState === 'off' && engine.lastRunState === 'failed')).toBe(true)
    expect(String(mocks.poolQuery.mock.calls[0]?.[0])).toContain('SELECT state, last_beat_at')
  })
})
