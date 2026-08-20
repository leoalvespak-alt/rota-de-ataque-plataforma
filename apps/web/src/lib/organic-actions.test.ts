import { describe, expect, it } from 'vitest'
import { CancelPublicationSchema, ConfirmManualPublicationSchema, KillSwitchSchema } from './admin-publishing-schemas'
import { isManualConfirmationAllowed, isPublicationCancellable } from './organic-actions'

describe('organic action contracts', () => {
  it('accepts only cancellable publication states', () => {
    expect(isPublicationCancellable('scheduled')).toBe(true)
    expect(isPublicationCancellable('published')).toBe(false)
    expect(isPublicationCancellable('cancelled')).toBe(false)
  })

  it('accepts manual confirmation only from its pending state', () => {
    expect(isManualConfirmationAllowed('awaiting_manual_publish')).toBe(true)
    expect(isManualConfirmationAllowed('published')).toBe(false)
  })

  it('validates administrative ids, external ids, reasons and actions', () => {
    const publicationId = '11111111-1111-4111-8111-111111111111'
    expect(CancelPublicationSchema.safeParse({ publicationId, reason: 'operator correction' }).success).toBe(true)
    expect(ConfirmManualPublicationSchema.safeParse({ publicationId, externalId: 'ig-media-1' }).success).toBe(true)
    expect(KillSwitchSchema.safeParse({ action: 'kill', reason: 'provider incident' }).success).toBe(true)
    expect(CancelPublicationSchema.safeParse({ publicationId, reason: '' }).success).toBe(false)
    expect(ConfirmManualPublicationSchema.safeParse({ publicationId, externalId: 'contains spaces' }).success).toBe(false)
    expect(KillSwitchSchema.safeParse({ action: 'pause', reason: 'invalid action' }).success).toBe(false)
  })
})
