import { describe, expect, it, vi } from 'vitest'
import { BrevoMarketingProvider, ResendTransactionalProvider, createEmailDelivery } from './index.js'

describe('email delivery boundaries', () => {
  it('keeps both providers disabled without credentials', async () => {
    const fetcher = vi.fn()
    const delivery = createEmailDelivery({}, fetcher)
    expect(delivery.transactional.enabled).toBe(false)
    expect(delivery.marketing.enabled).toBe(false)
    expect(await delivery.transactional.send({ to: 'person@example.com', subject: 'x', text: 'x' })).toMatchObject({ disabled: true })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('sends only transactional messages through Resend', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 're_123' }), { status: 200 }))
    const provider = new ResendTransactionalProvider('key', 'Rota <noreply@example.com>', fetcher)
    const receipt = await provider.send({ to: ['person@example.com'], subject: 'Aviso', text: 'Operacional' })
    expect(receipt).toMatchObject({ provider: 'resend', providerMessageId: 're_123', accepted: true })
    expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }))
  })

  it('creates a Brevo marketing campaign only through the explicit marketing adapter', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42 }), { status: 201 }))
    const provider = new BrevoMarketingProvider('key', fetcher)
    await expect(provider.createCampaign({ name: 'ciclo', subject: 'Ciclo', html: '<p>x</p>', senderName: 'Rota', senderEmail: 'marketing@example.com', listIds: [1] })).resolves.toEqual({ campaignId: '42', disabled: false })
    expect(fetcher).toHaveBeenCalledWith('https://api.brevo.com/v3/emailCampaigns', expect.objectContaining({ method: 'POST' }))
  })
})
