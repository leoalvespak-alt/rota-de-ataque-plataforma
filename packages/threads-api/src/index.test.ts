import { describe, expect, it } from 'vitest'
import { ThreadsClient } from './index.js'
describe('threads api', () => it('rejects text above the official MVP limit before network access', async () => { await expect(new ThreadsClient('token').createContainer('user', 'x'.repeat(501))).rejects.toThrow('500') }))
