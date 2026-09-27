import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_EXPECTED_MIGRATION, expectedMigrationApplied, taskRuntimeHealth } from './health'

describe('health migrations', () => {
  it('expects the current runtime migration by default', () => {
    expect(DEFAULT_EXPECTED_MIGRATION).toBe('0045_task_runtime')
  })
})

describe('expectedMigrationApplied', () => {
  it('exige a migration esperada no ledger, não apenas a existência da tabela', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ applied: false }] })

    await expect(expectedMigrationApplied({ query }, '0035_reconcile_automation_runtime')).resolves.toBe(false)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE version = $1'),
      ['0035_reconcile_automation_runtime'],
    )
  })
})

describe('taskRuntimeHealth', () => {
  it('reports persisted queue states and configured schedules', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ accepted: 2, running: 1, retry_scheduled: 3, failed_last_24h: 1, overdue: 2, stale_running: 1 }] })
      .mockResolvedValueOnce({ rows: [
        { task_name: 'news-radar.daily', destination: 'cloud-run', cadence: 'daily', enabled: false },
        { task_name: 'publication.due', destination: 'local', cadence: 'schedule-time', enabled: true },
      ] })

    await expect(taskRuntimeHealth({ query })).resolves.toEqual({
      runs: { accepted: 2, running: 1, retryScheduled: 3, failedLast24h: 1, overdue: 2, staleRunning: 1 },
      schedules: {
        total: 2,
        enabled: 1,
        disabled: 1,
        entries: [
          { taskName: 'news-radar.daily', destination: 'cloud-run', cadence: 'daily', enabled: false },
          { taskName: 'publication.due', destination: 'local', cadence: 'schedule-time', enabled: true },
        ],
      },
    })
    expect(query.mock.calls[0]?.[0]).toContain('FROM task_runs')
    expect(query.mock.calls[1]?.[0]).toContain('FROM task_schedules')
  })
})
