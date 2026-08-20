import { createHmac, timingSafeEqual } from 'node:crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export class MetaApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfter?: number) {
    super(message)
    this.name = 'MetaApiError'
  }
}

export interface MetaPage<T> { data: T[]; paging?: { cursors?: { before?: string; after?: string }; next?: string; previous?: string } }
export interface MetaMedia { id?: string; caption?: string; comments_count?: number; like_count?: number; media_type?: string; media_url?: string; permalink?: string; thumbnail_url?: string; timestamp?: string; username?: string; [key: string]: unknown }
export interface MetaInsight { id?: string; name?: string; period?: string; values?: Array<{ value: number | Record<string, number>; end_time?: string }>; title?: string; description?: string; [key: string]: unknown }
export interface MetaConversation { id?: string; link?: string; snippet?: string; updated_time?: string; message_count?: number; participants?: MetaPage<{ id: string; name?: string; email?: string }>; [key: string]: unknown }
export interface MetaMessage { id?: string; from?: { id: string; name?: string }; to?: MetaPage<{ id: string; name?: string }>; message?: string; created_time?: string; attachments?: MetaPage<{ id?: string; mime_type?: string; name?: string; file_url?: string; image_data?: Record<string, unknown> }> }
export interface BusinessDiscoveryResult { business_discovery?: { id?: string; username?: string; media_count?: number; followers_count?: number; follows_count?: number; biography?: string; profile_picture_url?: string; website?: string; media?: MetaPage<MetaMedia> } }
export interface MetaHashtag { id: string }
export interface MetaLiveVideo { id?: string; status?: string; stream_url?: string; secure_stream_url?: string; title?: string; creation_time?: string; embed_html?: string }
export interface MetaProductTag { product_id: string; merchant_id?: string; name?: string; price_string?: string; image_url?: string }
export interface MetaCarouselChild { image_url?: string; video_url?: string; caption?: string; location_id?: string; product_tags?: MetaProductTag[] }
export interface MetaWebhookValue { messaging?: MetaMessagingEvent[]; changes?: Array<{ field: string; value: unknown }> }
export interface MetaMessagingEvent {
  sender?: { id: string }
  recipient?: { id: string }
  timestamp?: number
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: Array<{ type: string; payload?: Record<string, unknown> }> }
  read?: { watermark?: number }
  delivery?: { watermark?: number; mids?: string[] }
  reaction?: { mid?: string; action?: 'react' | 'unreact'; reaction?: string; emoji?: string }
  postback?: { mid?: string; title?: string; payload?: string }
  referral?: { ref?: string; source?: string; type?: string }
}

// ── Client ────────────────────────────────────────────────────────────────────

export class MetaApiClient {
  private nextAt = new Map<string, number>()

  constructor(
    private readonly token: string,
    private readonly version = 'v26.0',
    private readonly baseUrl = 'https://graph.facebook.com',
  ) {}

  private async request<T>(endpoint: string, init: RequestInit = {}, base = this.baseUrl): Promise<T> {
    const key = endpoint.split('?')[0] ?? endpoint
    const wait = Math.max(0, (this.nextAt.get(key) ?? 0) - Date.now())
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    const url = new URL(`${base}/${this.version}/${endpoint.replace(/^\//, '')}`)
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.token}`)
    headers.set('Content-Type', 'application/json')
    const response = await fetch(url, { ...init, headers })
    this.nextAt.set(key, Date.now() + 100)
    if (!response.ok) {
      const body = await response.text()
      throw new MetaApiError(body, response.status, Number(response.headers.get('retry-after') ?? 0))
    }
    return response.json() as Promise<T>
  }

  // ── Instagram account ──────────────────────────────────────────────────────

  profile = {
    get: (id = 'me') =>
      this.request<Record<string, unknown>>(
        `${id}?fields=id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,account_type`,
      ),
    insights: (id: string, period: 'day' | 'week' | 'month' | 'lifetime' = 'month') =>
      this.request<MetaPage<MetaInsight>>(
        `${id}/insights?metric=reach,impressions,profile_views,accounts_engaged,accounts_reached&period=${period}`,
      ),
    followerDemographics: (id: string, breakdown: 'city' | 'country' | 'age' | 'gender' = 'country') =>
      this.request<MetaPage<MetaInsight>>(
        `${id}/insights?metric=follower_demographics&period=lifetime&breakdown=${breakdown}&metric_type=total_value`,
      ),
  }

  // ── Feed media ─────────────────────────────────────────────────────────────

  media = {
    list: (id = 'me', limit = 25) =>
      this.request<MetaPage<MetaMedia>>(
        `${id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count,username&limit=${limit}`,
      ),
    get: (mediaId: string) =>
      this.request<MetaMedia>(
        `${mediaId}?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count,children{id,media_url,media_type}`,
      ),
    comments: (mediaId: string, limit = 50) =>
      this.request<MetaPage<Record<string, unknown>>>(
        `${mediaId}/comments?fields=id,text,username,timestamp,parent_id,like_count,replies.limit(50){id,text,username,timestamp,like_count}&limit=${limit}`,
      ),
    likes: (mediaId: string) => this.request<MetaPage<Record<string, unknown>>>(`${mediaId}/likes`),
    insights: async (mediaId: string) => {
      const metrics = ['views', 'impressions', 'reach', 'total_interactions', 'saved', 'shares', 'comments', 'likes']
      try {
        return await this.request<MetaPage<MetaInsight>>(`${mediaId}/insights?metric=${metrics.join(',')}`)
      } catch (error) {
        if (!(error instanceof MetaApiError) || error.status !== 400) throw error
        const results = await Promise.allSettled(
          metrics.map((metric) => this.request<MetaPage<MetaInsight>>(`${mediaId}/insights?metric=${metric}`)),
        )
        return { data: results.flatMap((r) => (r.status === 'fulfilled' ? r.value.data : [])) }
      }
    },
  }

  // ── Stories ────────────────────────────────────────────────────────────────

  stories = {
    list: (igUserId: string) =>
      this.request<MetaPage<MetaMedia>>(
        `${igUserId}/stories?fields=id,media_type,media_url,permalink,timestamp,username`,
      ),
    insights: (storyId: string) =>
      this.request<MetaPage<MetaInsight>>(
        `${storyId}/insights?metric=exits,impressions,reach,replies,taps_forward,taps_back`,
      ),
    replies: (storyId: string) =>
      this.request<MetaPage<Record<string, unknown>>>(
        `${storyId}/replies?fields=id,text,timestamp,username,from`,
      ),
  }

  // ── Reels ──────────────────────────────────────────────────────────────────

  reels = {
    insights: (reelId: string) =>
      this.request<MetaPage<MetaInsight>>(
        `${reelId}/insights?metric=ig_reels_aggregated_all_plays_count,ig_reels_avg_watch_time,ig_reels_video_view_total_time,clips_replays_count,comments,likes,reach,saved,shares,total_interactions`,
      ),
  }

  // ── Hashtags ───────────────────────────────────────────────────────────────

  hashtags = {
    search: (igUserId: string, hashtag: string) =>
      this.request<MetaPage<MetaHashtag>>(`ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(hashtag)}`),
    recentMedia: (hashtagId: string, igUserId: string, limit = 25) =>
      this.request<MetaPage<MetaMedia>>(
        `${hashtagId}/recent_media?user_id=${igUserId}&fields=id,caption,media_type,permalink,timestamp,comments_count,like_count&limit=${limit}`,
      ),
    topMedia: (hashtagId: string, igUserId: string, limit = 25) =>
      this.request<MetaPage<MetaMedia>>(
        `${hashtagId}/top_media?user_id=${igUserId}&fields=id,caption,media_type,permalink,timestamp,comments_count,like_count&limit=${limit}`,
      ),
  }

  // ── User tags (mentions) ───────────────────────────────────────────────────

  userTags = {
    list: (igUserId: string, limit = 25) =>
      this.request<MetaPage<MetaMedia>>(
        `${igUserId}/tags?fields=id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count&limit=${limit}`,
      ),
  }

  // ── Business discovery ─────────────────────────────────────────────────────

  businessDiscovery = (igUserId: string, username: string, limit = 25) =>
    this.request<BusinessDiscoveryResult>(
      `${igUserId}?fields=business_discovery.username(${encodeURIComponent(username)}){id,username,media_count,followers_count,follows_count,biography,profile_picture_url,website,media.limit(${limit}){id,caption,comments_count,like_count,media_type,permalink,timestamp}}`,
    )

  // ── Publishing ─────────────────────────────────────────────────────────────

  publishing = {
    createImage: (igUserId: string, imageUrl: string, caption?: string, locationId?: string, productTags?: MetaProductTag[]) =>
      this.request(`${igUserId}/media`, {
        method: 'POST',
        body: JSON.stringify({ image_url: imageUrl, ...(caption && { caption }), ...(locationId && { location_id: locationId }), ...(productTags && { product_tags: productTags }) }),
      }),

    createReel: (igUserId: string, videoUrl: string, caption?: string, coverUrl?: string, shareToFeed = true) =>
      this.request(`${igUserId}/media`, {
        method: 'POST',
        body: JSON.stringify({ media_type: 'REELS', video_url: videoUrl, ...(caption && { caption }), ...(coverUrl && { cover_url: coverUrl }), share_to_feed: shareToFeed }),
      }),

    createCarouselChild: (igUserId: string, child: MetaCarouselChild) =>
      this.request(`${igUserId}/media`, {
        method: 'POST',
        body: JSON.stringify({ is_carousel_item: true, ...(child.image_url ? { image_url: child.image_url } : { video_url: child.video_url, media_type: 'VIDEO' }), ...(child.caption && { caption: child.caption }), ...(child.location_id && { location_id: child.location_id }), ...(child.product_tags && { product_tags: child.product_tags }) }),
      }),

    createCarousel: (igUserId: string, children: string[], caption?: string, locationId?: string) =>
      this.request(`${igUserId}/media`, {
        method: 'POST',
        body: JSON.stringify({ media_type: 'CAROUSEL', children: children.join(','), ...(caption && { caption }), ...(locationId && { location_id: locationId }) }),
      }),

    checkStatus: (containerId: string) =>
      this.request<{ id: string; status?: string; status_code?: string; error_message?: string }>(`${containerId}?fields=id,status,status_code,error_message`),

    publish: (igUserId: string, creationId: string) =>
      this.request<{ id: string }>(`${igUserId}/media_publish`, { method: 'POST', body: JSON.stringify({ creation_id: creationId }) }),

    /** @deprecated use createImage() */
    create: (igUserId: string, imageUrl: string, caption?: string) =>
      this.request<{ id: string }>(`${igUserId}/media`, { method: 'POST', body: JSON.stringify({ image_url: imageUrl, ...(caption && { caption }) }) }),
  }

  // ── Comments & moderation ──────────────────────────────────────────────────

  comments = {
    reply: (commentId: string, message: string) =>
      this.request(`${commentId}/replies`, { method: 'POST', body: JSON.stringify({ message }) }),
    hide: (commentId: string, hidden: boolean) =>
      this.request(`${commentId}`, { method: 'POST', body: JSON.stringify({ hide: hidden }) }),
    delete: (commentId: string) => this.request(`${commentId}`, { method: 'DELETE' }),
    privateReply: (commentId: string, message: string) =>
      this.request(`${commentId}/private_replies`, { method: 'POST', body: JSON.stringify({ message }) }),
  }

  // ── Messaging (Messenger / Instagram DMs via Page token) ───────────────────

  messaging = {
    send: (pageId: string, recipientId: string, text: string) =>
      this.request(`${pageId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
      }),
    sendAttachment: (pageId: string, recipientId: string, type: 'image' | 'video' | 'audio' | 'file', url: string) =>
      this.request(`${pageId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, message: { attachment: { type, payload: { url, is_reusable: true } } } }),
      }),
    sendTemplate: (pageId: string, recipientId: string, template: Record<string, unknown>) =>
      this.request(`${pageId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, message: { attachment: { type: 'template', payload: template } } }),
      }),
    markRead: (pageId: string, recipientId: string) =>
      this.request(`${pageId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, sender_action: 'mark_seen' }),
      }),
    typingOn: (pageId: string, recipientId: string) =>
      this.request(`${pageId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, sender_action: 'typing_on' }),
      }),
    typingOff: (pageId: string, recipientId: string) =>
      this.request(`${pageId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, sender_action: 'typing_off' }),
      }),
  }

  // ── Conversations (page-level) ─────────────────────────────────────────────

  conversations = {
    list: (pageId: string, folder: 'inbox' | 'other' = 'inbox', limit = 20) =>
      this.request<MetaPage<MetaConversation>>(
        `${pageId}/conversations?folder=${folder}&fields=id,link,snippet,updated_time,message_count,participants&limit=${limit}`,
      ),
    messages: (conversationId: string, limit = 50) =>
      this.request<MetaPage<MetaMessage>>(
        `${conversationId}/messages?fields=id,from,to,message,created_time,attachments{id,mime_type,name,file_url,image_data}&limit=${limit}`,
      ),
    markRead: (conversationId: string) =>
      this.request(`${conversationId}`, { method: 'POST', body: JSON.stringify({ read: true }) }),
  }

  // ── Live video ─────────────────────────────────────────────────────────────

  liveVideo = {
    create: (pageId: string, title?: string, description?: string) =>
      this.request<MetaLiveVideo>(`${pageId}/live_videos`, {
        method: 'POST',
        body: JSON.stringify({ status: 'LIVE_NOW', ...(title && { title }), ...(description && { description }) }),
      }),
    get: (liveVideoId: string) =>
      this.request<MetaLiveVideo>(`${liveVideoId}?fields=id,status,stream_url,secure_stream_url,title,creation_time,embed_html`),
    end: (liveVideoId: string) =>
      this.request(`${liveVideoId}`, { method: 'POST', body: JSON.stringify({ end_live_video: true }) }),
    comments: (liveVideoId: string, since?: number) =>
      this.request<MetaPage<Record<string, unknown>>>(
        `${liveVideoId}/comments?fields=id,message,from,created_time${since ? `&since=${since}` : ''}`,
      ),
  }

  // ── Page (Facebook) ────────────────────────────────────────────────────────

  page = {
    get: (pageId: string) =>
      this.request<Record<string, unknown>>(
        `${pageId}?fields=id,name,category,fan_count,follower_count,link,website,about,description,cover,picture`,
      ),
    posts: (pageId: string, limit = 25) =>
      this.request<MetaPage<Record<string, unknown>>>(
        `${pageId}/posts?fields=id,message,story,created_time,full_picture,permalink_url,shares,reactions.summary(true)&limit=${limit}`,
      ),
    insights: (pageId: string, metric: string, period: 'day' | 'week' | 'month' = 'month') =>
      this.request<MetaPage<MetaInsight>>(`${pageId}/insights?metric=${metric}&period=${period}`),
    subscribeWebhook: (pageId: string, subscribedFields: string[]) =>
      this.request(`${pageId}/subscribed_apps`, {
        method: 'POST',
        body: JSON.stringify({ subscribed_fields: subscribedFields.join(',') }),
      }),
  }

  // ── Message reactions ──────────────────────────────────────────────────────

  reactions = {
    list: (messageId: string) =>
      this.request<MetaPage<Record<string, unknown>>>(`${messageId}/reactions?fields=id,reaction,emoji,count`),
  }

  // ── Token debug ────────────────────────────────────────────────────────────

  debugToken = (inputToken: string) =>
    this.request<{ data: Record<string, unknown> }>(`debug_token?input_token=${inputToken}`)

  // ── Backward-compat shims ─────────────────────────────────────────────────

  /** @deprecated use comments.privateReply() */
  privateReplies = {
    send: (commentId: string, message: string) => this.comments.privateReply(commentId, message),
  }

  self = {
    profile: (id = 'me') => this.profile.get(id),
    media: (id = 'me', limit = 25) => this.media.list(id, limit),
    comments: (mediaId: string) => this.media.comments(mediaId),
    insights: (id: string) => this.profile.insights(id),
    mediaInsights: (id: string) => this.media.insights(id),
    mentions: (id = 'me') => this.userTags.list(id),
    dms: (id = 'me') => this.conversations.list(id),
  }
}

// ── Webhook utilities ─────────────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: Buffer, signature: string | null, appSecret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  const actual = Buffer.from(signature.slice(7), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function verifyWebhookChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  expected: string,
): string | null {
  return mode === 'subscribe' && token === expected ? challenge : null
}

// ── Factory helpers ───────────────────────────────────────────────────────────

export function createMetaClient(token: string, version = 'v26.0'): MetaApiClient {
  return new MetaApiClient(token, version)
}
