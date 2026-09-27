import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('web database lifecycle', () => {
  it('does not close a process-wide database pool from request handlers', async () => {
    const sourceRoot = path.resolve(import.meta.dirname, '..')
    const requestFiles = [
      'components/OverviewReadiness.tsx',
      'app/sistema/page.tsx',
      'app/sistema/integracoes/page.tsx',
      'app/decisoes/page.tsx',
      'app/planejamento/page.tsx',
      'app/api/dashboard/today/route.ts',
    ]
    const files = await Promise.all(requestFiles.map((file) => readFile(path.resolve(sourceRoot, file), 'utf8')))

    expect(files.join('\n')).not.toMatch(/pool\.end\s*\(/)
  })
})
