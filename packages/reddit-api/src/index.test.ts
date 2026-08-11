import { describe, expect, it } from 'vitest'
import { RedditClient } from './index.js'
describe('reddit api', () => it('exposes passive collection endpoints without lead operations', () => { const client = new RedditClient('token', 'platform:test:1 (by /u/test)'); expect(typeof client.search).toBe('function'); expect(typeof client.subreddit('concursos').new).toBe('function') }))
