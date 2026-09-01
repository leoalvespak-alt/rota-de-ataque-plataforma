export type SocialChannel = 'instagram' | 'threads'

export interface ApprovedPublication {
  channel: SocialChannel
  caption: string
  imageUrl?: string
  approvedBy: string
  externalAccountId?: string
}

export interface PublicationResult {
  channel: SocialChannel
  status: 'published' | 'failed' | 'disabled'
  externalId: string | null
  error: string | null
  attempts: number
}

export type SocialEnvironment = Record<string, string | undefined>
type Requester = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function currentEnvironment(): SocialEnvironment {
  const runtime = (globalThis as typeof globalThis & { process?: { env?: SocialEnvironment } }).process
  return runtime?.env ?? {}
}

function value(env: SocialEnvironment, key: string): string | undefined {
  const item = env[key]?.trim()
  return item || undefined
}

function assertApproved(publication: ApprovedPublication): void {
  if (!publication.approvedBy.trim()) throw new Error('A publicação precisa de aprovação humana')
  if (!publication.caption.trim()) throw new Error('A publicação precisa de legenda')
}

async function requestWithRetry(requester: Requester, input: RequestInfo | URL, init: RequestInit, maxAttempts: number): Promise<{ response: Response; attempts: number }> {
  let attempts = 0
  let response: Response
  do {
    attempts++
    response = await requester(input, init)
    if (response.ok || (response.status < 500 && response.status !== 429) || attempts >= maxAttempts) return { response, attempts }
  } while (attempts < maxAttempts)
  return { response, attempts }
}

export class MetaSocialPublisher {
  constructor(
    private readonly config: { accessToken: string; apiVersion: string; baseUrl: string; instagramAccountId?: string; threadsUserId?: string; threadsEnabled: boolean },
    private readonly requester: Requester = fetch,
  ) {}

  async publish(publication: ApprovedPublication): Promise<PublicationResult> {
    assertApproved(publication)
    if (publication.channel === 'instagram') return this.publishInstagram(publication)
    return this.publishThreads(publication)
  }

  async status(channel: SocialChannel, externalId: string): Promise<{ channel: SocialChannel; externalId: string; status: string; raw: unknown }> {
    const result = await requestWithRetry(this.requester, `${this.config.baseUrl}/${this.config.apiVersion}/${encodeURIComponent(externalId)}?fields=id,status_code,status&access_token=${encodeURIComponent(this.config.accessToken)}`, { method: 'GET' }, 3)
    const raw = await result.response.json().catch(() => ({}))
    if (!result.response.ok) throw new Error(`Meta status failed (${result.response.status})`)
    const data = raw as { status_code?: string; status?: string }
    return { channel, externalId, status: data.status_code ?? data.status ?? 'unknown', raw }
  }

  private async publishInstagram(publication: ApprovedPublication): Promise<PublicationResult> {
    if (!this.config.instagramAccountId) return { channel: 'instagram', status: 'disabled', externalId: null, error: 'Instagram account is not configured', attempts: 0 }
    if (!publication.imageUrl) return { channel: 'instagram', status: 'failed', externalId: null, error: 'Instagram publication requires imageUrl', attempts: 0 }
    const root = `${this.config.baseUrl}/${this.config.apiVersion}/${encodeURIComponent(this.config.instagramAccountId)}`
    const container = await requestWithRetry(this.requester, `${root}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: publication.imageUrl, caption: publication.caption, access_token: this.config.accessToken }) }, 3)
    const containerData = await container.response.json().catch(() => ({})) as { id?: string; error?: { message?: string } }
    if (!container.response.ok || !containerData.id) return { channel: 'instagram', status: 'failed', externalId: null, error: containerData.error?.message ?? `Meta container failed (${container.response.status})`, attempts: container.attempts }
    const published = await requestWithRetry(this.requester, `${root}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: containerData.id, access_token: this.config.accessToken }) }, 3)
    const publishedData = await published.response.json().catch(() => ({})) as { id?: string; error?: { message?: string } }
    return published.response.ok && publishedData.id
      ? { channel: 'instagram', status: 'published', externalId: publishedData.id, error: null, attempts: container.attempts + published.attempts }
      : { channel: 'instagram', status: 'failed', externalId: containerData.id, error: publishedData.error?.message ?? `Meta publish failed (${published.response.status})`, attempts: container.attempts + published.attempts }
  }

  private async publishThreads(publication: ApprovedPublication): Promise<PublicationResult> {
    if (!this.config.threadsEnabled || !this.config.threadsUserId) return { channel: 'threads', status: 'disabled', externalId: null, error: 'Threads is not enabled/configured', attempts: 0 }
    const root = `${this.config.baseUrl}/${this.config.apiVersion}/${encodeURIComponent(this.config.threadsUserId)}`
    const container = await requestWithRetry(this.requester, `${root}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_type: 'TEXT', text: publication.caption, access_token: this.config.accessToken }) }, 3)
    const containerData = await container.response.json().catch(() => ({})) as { id?: string; error?: { message?: string } }
    if (!container.response.ok || !containerData.id) return { channel: 'threads', status: 'failed', externalId: null, error: containerData.error?.message ?? `Threads container failed (${container.response.status})`, attempts: container.attempts }
    const published = await requestWithRetry(this.requester, `${root}/threads_publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: containerData.id, access_token: this.config.accessToken }) }, 3)
    const publishedData = await published.response.json().catch(() => ({})) as { id?: string; error?: { message?: string } }
    return published.response.ok && publishedData.id
      ? { channel: 'threads', status: 'published', externalId: publishedData.id, error: null, attempts: container.attempts + published.attempts }
      : { channel: 'threads', status: 'failed', externalId: containerData.id, error: publishedData.error?.message ?? `Threads publish failed (${published.response.status})`, attempts: container.attempts + published.attempts }
  }
}

export function createMetaSocialPublisher(env: SocialEnvironment = currentEnvironment(), requester: Requester = fetch): MetaSocialPublisher | null {
  if (value(env, 'META_SOCIAL_PUBLISHING_ENABLED') !== 'true') return null
  const accessToken = value(env, 'META_SOCIAL_ACCESS_TOKEN') ?? value(env, 'META_ACCESS_TOKEN')
  if (!accessToken) return null
  return new MetaSocialPublisher({
    accessToken,
    apiVersion: value(env, 'META_API_VERSION') ?? 'v26.0',
    baseUrl: value(env, 'META_GRAPH_BASE_URL') ?? 'https://graph.facebook.com',
    instagramAccountId: value(env, 'META_INSTAGRAM_ACCOUNT_ID'),
    threadsUserId: value(env, 'THREADS_USER_ID'),
    threadsEnabled: value(env, 'THREADS_API_ENABLED') === 'true',
  }, requester)
}
