import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname)
const source = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

describe('creative copy contract', () => {
  it('exposes format-specific copy fields in the Review Inbox editor', () => {
    const client = source('app/review-inbox/ReviewInboxClient.tsx')
    const fields = source('app/publishing/ContentCopyFields.tsx')

    expect(client).toContain('contentStructure: cleanContentStructure(suggestionCopy)')
    expect(client).toContain('ContentCopyFields')
    expect(fields).toContain('Copy principal')
    expect(fields).toContain('Texto de fala / roteiro')
    expect(fields).toContain('Copy dos cards')
    expect(fields).toContain('Copy dos Stories')
    expect(fields).toContain('Texto da arte / post')
  })

  it('validates and persists the structured copy in the unified creative', () => {
    const actionRoute = source('app/api/admin/content-suggestions/[id]/action/route.ts')
    const publicationRoute = source('app/api/admin/publications/route.ts')

    expect(actionRoute).toContain('contentStructure')
    expect(actionRoute).toContain('copy_principal')
    expect(actionRoute).toContain('stories')
    expect(actionRoute).toContain('JSON.stringify(copyData)')
    expect(publicationRoute).toContain('copy_principal')
    expect(publicationRoute).toContain('stories: z.array')
  })
})
