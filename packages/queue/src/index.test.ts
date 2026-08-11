import { describe, expect, it } from 'vitest'
import { retryPolicy } from './index.js'
import { QUEUE_NAMES } from '@plataforma/shared'

describe('queues', () => {
  it('defines a retry policy for every supported queue and no liker queue', () => {
    expect(QUEUE_NAMES).toContain('content-item-orchestrator')
    expect(QUEUE_NAMES).toContain('contact-policy-engine')
    expect(QUEUE_NAMES).not.toContain('liker-mining')
    expect(Object.keys(retryPolicy).sort()).toEqual([...QUEUE_NAMES].sort())
  })
})
