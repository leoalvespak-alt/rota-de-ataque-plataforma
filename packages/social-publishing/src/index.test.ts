import { describe, expect, it, vi } from 'vitest'
import { MetaSocialPublisher, createMetaSocialPublisher } from './index.js'

describe('official social publishing', () => {
  it('does not create an integration without explicit enablement and a token', () => {
    expect(createMetaSocialPublisher({})).toBeNull()
    expect(createMetaSocialPublisher({ META_SOCIAL_PUBLISHING_ENABLED: 'true' })).toBeNull()
  })

  it('requires approval and publishes Instagram through the official Graph flow', async () => {
    const requester = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-1' }), { status: 200 }))
    const publisher = new MetaSocialPublisher({ accessToken: 'secret', apiVersion: 'v26.0', baseUrl: 'https://graph.example', instagramAccountId: 'ig-1', threadsEnabled: false }, requester)
    await expect(publisher.publish({ channel: 'instagram', caption: 'Aprovado', imageUrl: 'https://cdn.example/post.jpg', approvedBy: 'operator@example.com' })).resolves.toMatchObject({ status: 'published', externalId: 'media-1', attempts: 2 })
    await expect(publisher.publish({ channel: 'instagram', caption: 'Sem aprovação', approvedBy: '' })).rejects.toThrow('aprovação humana')
    expect(requester).toHaveBeenCalledTimes(2)
  })

  it('keeps Threads disabled unless official configuration is explicit', async () => {
    const publisher = new MetaSocialPublisher({ accessToken: 'secret', apiVersion: 'v26.0', baseUrl: 'https://graph.example', threadsEnabled: false }, vi.fn())
    await expect(publisher.publish({ channel: 'threads', caption: 'Aprovado', approvedBy: 'operator@example.com' })).resolves.toMatchObject({ status: 'disabled' })
  })
})
