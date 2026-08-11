import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { creativeWorkflowMachine } from './creativeWorkflow'

describe('Creative Workflow Machine', () => {
  it('starts in idle state', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  it('transitions to editing on SELECT_TEMPLATE', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    expect(actor.getSnapshot().value).toBe('editing')
    expect(actor.getSnapshot().context.templateId).toBe('sq-cover')
    actor.stop()
  })

  it('transitions to generatingCopy from editing', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    actor.send({ type: 'REQUEST_COPY' })
    expect(actor.getSnapshot().value).toBe('generatingCopy')
    actor.stop()
  })

  it('returns to editing after COPY_GENERATED', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    actor.send({ type: 'REQUEST_COPY' })
    actor.send({ type: 'COPY_GENERATED', fields: { title: 'Hello' } })
    expect(actor.getSnapshot().value).toBe('editing')
    expect(actor.getSnapshot().context.generatedText).toEqual({ title: 'Hello' })
    actor.stop()
  })

  it('goes to failed on COPY_FAILED', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    actor.send({ type: 'REQUEST_COPY' })
    actor.send({ type: 'COPY_FAILED', error: 'API error' })
    expect(actor.getSnapshot().value).toBe('failed')
    expect(actor.getSnapshot().context.error).toBe('API error')
    actor.stop()
  })

  it('retries from failed state', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    actor.send({ type: 'REQUEST_COPY' })
    actor.send({ type: 'COPY_FAILED', error: 'err' })
    actor.send({ type: 'RETRY' })
    expect(actor.getSnapshot().value).toBe('editing')
    expect(actor.getSnapshot().context.retryCount).toBe(1)
    actor.stop()
  })

  it('completes full export flow', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    actor.send({ type: 'EXPORT', format: 'png' })
    expect(actor.getSnapshot().value).toBe('rendering')
    actor.send({ type: 'RENDER_COMPLETE' })
    expect(actor.getSnapshot().value).toBe('exporting')
    actor.send({ type: 'EXPORT_COMPLETE' })
    expect(actor.getSnapshot().value).toBe('completed')
    actor.stop()
  })

  it('resets from completed to idle', () => {
    const actor = createActor(creativeWorkflowMachine)
    actor.start()
    actor.send({ type: 'SELECT_TEMPLATE', templateId: 'sq-cover' })
    actor.send({ type: 'EXPORT', format: 'png' })
    actor.send({ type: 'RENDER_COMPLETE' })
    actor.send({ type: 'EXPORT_COMPLETE' })
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.templateId).toBeNull()
    actor.stop()
  })
})
