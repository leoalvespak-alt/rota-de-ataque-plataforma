import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('editorial quality metrics SQL', () => {
  it('accepts only numeric JSON scores inside the documented 0–1 range', async () => {
    const source = await readFile(path.resolve(import.meta.dirname, 'metrics.ts'), 'utf8')

    expect(source).toContain("jsonb_typeof(")
    expect(source).toContain("'number'")
    expect(source).toContain('::numeric')
    expect(source).toContain('BETWEEN 0 AND 1')
    expect(source).toContain('averageQuality')
  })
})
