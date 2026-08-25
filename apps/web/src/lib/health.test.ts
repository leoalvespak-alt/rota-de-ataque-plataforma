import { describe, expect, it, vi } from 'vitest'
import { expectedMigrationApplied } from './health'

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
