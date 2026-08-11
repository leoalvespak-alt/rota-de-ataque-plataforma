import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { decryptToken, encryptToken } from './index.js'

describe('database contracts', () => {
  it('encrypts Meta tokens with authenticated encryption', () => { const key = Buffer.alloc(32, 7); const encrypted = encryptToken('secret', key); expect(encrypted).not.toContain('secret'); expect(decryptToken(encrypted, key)).toBe('secret') })
  it('ships transactional up/down migrations and forbids liker mining', async () => { const up = await readFile(path.resolve(import.meta.dirname, '../migrations/0001_initial.up.sql'), 'utf8'); const down = await readFile(path.resolve(import.meta.dirname, '../migrations/0001_initial.down.sql'), 'utf8'); expect(up).toMatch(/^BEGIN;/); expect(up).toContain('vector(384)'); expect(up).toContain('trigger_kind IN'); expect(up).not.toContain('post_likers'); expect(down).toMatch(/^BEGIN;/) })
})
