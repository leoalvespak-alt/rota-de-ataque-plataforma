import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const apiDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/api')
const routes = [
  'admin/radar-findings/[id]/action/route.ts',
  'admin/competitor-insights/[id]/action/route.ts',
  'admin/content-suggestions/[id]/action/route.ts',
  'admin/publishing/cancel/route.ts',
  'admin/publishing/confirm-manual/route.ts',
]

describe('organic action route contracts', () => {
  it('keeps the audited mutation sequence on one transaction client', async () => {
    for (const route of routes) {
      const source = await readFile(path.join(apiDirectory, route), 'utf8')
      expect(source).toContain('pool.connect()')
      expect(source).toContain("client.query('BEGIN')")
      expect(source).toContain('FOR UPDATE')
      expect(source).toContain("client.query('COMMIT')")
      expect(source).toContain('ROLLBACK')
      expect(source).toContain('audit_log')
      expect(source).toContain('safeParse')
    }
  })

  it('does not parse administrative JSON through direct casts', async () => {
    for (const route of routes) {
      const source = await readFile(path.join(apiDirectory, route), 'utf8')
      expect(source).not.toMatch(/request\.json\(\)\) as /u)
    }
  })
})
