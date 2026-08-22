import { describe, expect, it } from 'vitest'
import { migrationChecksums } from './migration-checksum'

describe('migrationChecksums', () => {
  it('uses the same canonical checksum for LF and CRLF files', () => {
    const lf = migrationChecksums('create table example (id int);\nselect 1;\n')
    const crlf = migrationChecksums('create table example (id int);\r\nselect 1;\r\n')

    expect(crlf.canonical).toBe(lf.canonical)
  })

  it('accepts the legacy raw CRLF checksum for one-time reconciliation', () => {
    const crlfSql = 'select 1;\r\nselect 2;\r\n'
    const legacy = migrationChecksums(crlfSql)

    expect(legacy.acceptedLegacy.has(legacy.canonical)).toBe(false)
    expect(legacy.acceptedLegacy.size).toBeGreaterThan(0)
  })

  it('does not accept a checksum from different SQL content', () => {
    const original = migrationChecksums('select 1;\n')
    const changed = migrationChecksums('select 2;\n')

    expect(original.acceptedLegacy.has(changed.canonical)).toBe(false)
  })
})
