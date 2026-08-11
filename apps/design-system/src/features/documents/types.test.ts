import { describe, it, expect } from 'vitest'
import type { DocumentData, DocumentBlock } from './types'

describe('Document Types', () => {
  it('accepts valid document data', () => {
    const doc: DocumentData = {
      id: 'doc-1',
      title: 'Resumo Tributario',
      type: 'resumo',
      pages: [
        {
          id: 'p1',
          blocks: [
            { id: 'b1', type: 'heading', content: 'Intro', level: 1 },
            { id: 'b2', type: 'paragraph', content: 'Content here.' },
          ],
        },
      ],
      dark: false,
    }
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0]!.blocks).toHaveLength(2)
  })

  it('accepts a block with all types', () => {
    const blocks: DocumentBlock[] = [
      { id: '1', type: 'heading', content: 'Title', level: 1 },
      { id: '2', type: 'paragraph', content: 'Para' },
      { id: '3', type: 'list', content: '', items: ['a', 'b'] },
      { id: '4', type: 'divider', content: '' },
    ]
    expect(blocks).toHaveLength(4)
  })
})
