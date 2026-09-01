import { describe, expect, it } from 'vitest'
import { EDITORIAL_QUEUES } from './index.js'

describe('editorial queue contract', () => {
  it('exposes only the three queues kept after the Prospector expurgo', () => {
    expect(EDITORIAL_QUEUES).toEqual(['news-radar', 'content-opportunity', 'content-item-orchestrator'])
  })
})
