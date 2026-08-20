import { describe, expect, it, vi } from 'vitest'
import { apiErrorResponse } from './api-errors'

describe('API error contract', () => {
  it('preserves auth status while hiding internal details behind a trace id', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = apiErrorResponse(Object.assign(new Error('SQL password=secret'), { status: 500, code: 'internal_error' }))
    const body = await response.json() as { error: string; traceId: string }

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'internal_error', traceId: expect.any(String) })
    expect(JSON.stringify(body)).not.toContain('SQL')
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ traceId: body.traceId, error: expect.stringContaining('password=[redacted]') }), 'API request failed')
    log.mockRestore()
  })
})
