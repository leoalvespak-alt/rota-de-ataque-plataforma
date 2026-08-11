import { createHmac, timingSafeEqual } from 'node:crypto'

export class MetaApiError extends Error { constructor(message: string, public readonly status: number, public readonly retryAfter?: number) { super(message) } }
export interface MetaMedia { id?: string; caption?: string; comments_count?: number; like_count?: number; media_type?: string; permalink?: string; timestamp?: string }
export interface MetaPage<T> { data: T[]; paging?: { next?: string } }
export interface BusinessDiscoveryResult { business_discovery?: { id?: string; username?: string; media_count?: number; followers_count?: number; follows_count?: number; biography?: string; profile_picture_url?: string; media?: MetaPage<MetaMedia> } }
export class MetaApiClient {
  private nextAt = new Map<string, number>()
  constructor(private readonly token: string, private readonly version = 'v21.0', private readonly baseUrl = 'https://graph.facebook.com') {}
  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> { const key = endpoint.split('?')[0] ?? endpoint; const wait = Math.max(0, (this.nextAt.get(key) ?? 0) - Date.now()); if (wait) await new Promise((resolve) => setTimeout(resolve, wait)); const url = new URL(`${this.baseUrl}/${this.version}/${endpoint.replace(/^\//,'')}`); const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${this.token}`); headers.set('Content-Type','application/json'); const response = await fetch(url, { ...init, headers }); this.nextAt.set(key, Date.now() + 100); if (!response.ok) throw new MetaApiError(await response.text(), response.status, Number(response.headers.get('retry-after') ?? 0)); return response.json() as Promise<T> }
  self = {
    profile: (id='me') => this.request<Record<string, unknown>>(`${id}?fields=id,username,media_count,followers_count,follows_count,biography,profile_picture_url`),
    media: (id='me', limit=25) => this.request<MetaPage<MetaMedia>>(`${id}/media?fields=id,caption,media_type,permalink,timestamp,comments_count,like_count&limit=${limit}`),
    comments: (mediaId:string) => this.request<MetaPage<Record<string, unknown>>>(`${mediaId}/comments?fields=id,text,username,timestamp,parent_id,replies{id,text,username,timestamp}`),
    insights: (id:string) => this.request<MetaPage<Record<string, unknown>>>(`${id}/insights?metric=reach,impressions,profile_views`),
    mentions: (id='me') => this.request<MetaPage<Record<string, unknown>>>(`${id}/tags?fields=id,caption,media_type,permalink,timestamp,username`),
    dms: (id='me') => this.request<MetaPage<Record<string, unknown>>>(`${id}/conversations?fields=id,participants,updated_time,messages.limit(50){id,from,to,message,created_time}`)
  }
  businessDiscovery = (id:string, username:string, limit=25) => this.request<BusinessDiscoveryResult>(`${id}?fields=business_discovery.username(${encodeURIComponent(username)}){id,username,media_count,followers_count,follows_count,biography,profile_picture_url,media.limit(${limit}){id,caption,comments_count,like_count,media_type,permalink,timestamp}}`)
  messaging = { send: (id:string, recipientId:string, text:string) => this.request(`${id}/messages`, { method:'POST', body: JSON.stringify({ recipient:{id:recipientId}, message:{text} }) }) }
  privateReplies = { send: (commentId:string, message:string) => this.request(`${commentId}/private_replies`, { method:'POST', body: JSON.stringify({message}) }) }
  publishing = { create: (igUserId:string, imageUrl:string, caption:string) => this.request(`${igUserId}/media`, {method:'POST',body:JSON.stringify({image_url:imageUrl,caption})}), publish: (igUserId:string, creationId:string) => this.request(`${igUserId}/media_publish`,{method:'POST',body:JSON.stringify({creation_id:creationId})}) }
}
export function verifyWebhookSignature(rawBody: Buffer, signature: string | null, appSecret: string) { if (!signature?.startsWith('sha256=')) return false; const expected = createHmac('sha256',appSecret).update(rawBody).digest(); const actual = Buffer.from(signature.slice(7),'hex'); return actual.length === expected.length && timingSafeEqual(actual,expected) }
export function verifyWebhookChallenge(mode:string|null, token:string|null, challenge:string|null, expected:string) { return mode === 'subscribe' && token === expected ? challenge : null }
