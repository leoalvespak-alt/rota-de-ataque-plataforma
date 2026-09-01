import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname)
const source = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

describe('creative copy contract', () => {
  it('exposes format-specific copy fields in the Review Inbox editor', () => {
    const client = source('app/review-inbox/ReviewInboxClient.tsx')
    const fields = source('components/ContentCopyFields.tsx')

    expect(client).toContain('contentStructure: cleanContentStructure(suggestionCopy)')
    expect(client).toContain('ContentCopyFields')
    expect(fields).toContain('Copy principal')
    expect(fields).toContain('Roteiro ou copy longa')
    expect(fields).toContain('Texto da arte')
    expect(fields).toContain('Observações para o editor')
  })

  it('validates and persists the structured copy in the editorial action', () => {
    const actionRoute = source('app/api/admin/content-suggestions/[id]/action/route.ts')

    expect(actionRoute).toContain('contentStructure')
    expect(actionRoute).toContain('copy_principal')
    expect(actionRoute).toContain('stories')
    expect(actionRoute).toContain('JSON.stringify(copyData)')
    expect(actionRoute).toContain('INSERT INTO unified_creatives')
  })
})
