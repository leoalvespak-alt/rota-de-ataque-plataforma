import { describe, it, expect } from 'vitest'
import type { SlideData, DeckData, SlideMode } from './types'

describe('Slide Types', () => {
  it('accepts valid slide data', () => {
    const slide: SlideData = {
      id: '1',
      type: 'cover',
      title: 'Concursos Fiscais',
      subtitle: '2025',
    }
    expect(slide.type).toBe('cover')
    expect(slide.title).toBe('Concursos Fiscais')
  })

  it('accepts valid deck data', () => {
    const deck: DeckData = {
      id: 'deck-1',
      title: 'Presentation',
      slides: [
        { id: '1', type: 'cover', title: 'Title' },
        { id: '2', type: 'section', title: 'Section 1' },
      ],
      dark: false,
    }
    expect(deck.slides).toHaveLength(2)
  })

  it('accepts all slide modes', () => {
    const modes: SlideMode[] = ['edit', 'present', 'overview']
    expect(modes).toHaveLength(3)
  })

  it('accepts slide with notes', () => {
    const slide: SlideData = {
      id: '3',
      type: 'concept',
      title: 'Principios',
      notes: 'Falar sobre principios constitucionais',
    }
    expect(slide.notes).toBeDefined()
  })
})
