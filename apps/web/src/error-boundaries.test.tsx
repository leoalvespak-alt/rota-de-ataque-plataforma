// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import AutomationsError from './app/automations/error'
import SystemHealthError from './app/system-health/error'

describe('operational error boundaries', () => {
  it('exposes a real retry action and the matching runbook', () => {
    const error = new Error('provider unavailable')
    const retry = () => undefined
    const automations = renderToStaticMarkup(createElement(AutomationsError, { error, reset: retry }))
    const systemHealth = renderToStaticMarkup(createElement(SystemHealthError, { error, reset: retry }))
    expect(automations).toContain('/docs/runbooks/automations')
    expect(automations).toContain('Tentar novamente')
    expect(systemHealth).toContain('/docs/runbooks/system-health')
    expect(systemHealth).toContain('Tentar novamente')
  })
})
