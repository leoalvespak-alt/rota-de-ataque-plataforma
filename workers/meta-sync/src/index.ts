import type { BusinessDiscoveryResult, MetaMedia, MetaPage } from '@plataforma/meta-api'
import { MetaApiError } from '@plataforma/meta-api'
import { metaSyncApiErrors, metaSyncDuration, metaSyncPostsNew } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'meta-sync', requiredRole: 'actor', requiresMetaToken: true } satisfies WorkerSpec
export const processJob = createWorker(spec)

export interface CompetitorTarget { campaignId: string; competitorId: string; username: string }
export interface MetaSyncRepository {
  activeCompetitors(filter?: { campaignId?: string; competitorId?: string }): Promise<CompetitorTarget[]>
  updateCompetitor(target: CompetitorTarget, profile: Record<string, unknown>): Promise<void>
  upsertPost(target: CompetitorTarget, media: MetaMedia): Promise<{ id: string; inserted: boolean }>
  saveOwnSnapshot(accountId: string, profile: Record<string, unknown>, media: MetaMedia[], insights: Record<string, unknown>[], mentions: Record<string, unknown>[], conversations: Record<string, unknown>[]): Promise<void>
  incrementRateLimit(accountId: string): Promise<void>
}
export interface MetaSyncQueue { extraction(postId: string, runId: string, payload: Record<string, unknown>): Promise<void> }
export interface MetaSyncPayload { kind: 'competitor' | 'own'; accountId: string; collectorAccountId?: string; igUserId: string; campaignId?: string; competitorId?: string; limit?: number; runId?: string }
export interface MetaSyncApi {
  businessDiscovery(id: string, username: string, limit?: number): Promise<BusinessDiscoveryResult>
  self: { profile(id?: string): Promise<Record<string, unknown>>; media(id?: string, limit?: number): Promise<MetaPage<MetaMedia>>; insights(id: string): Promise<MetaPage<Record<string, unknown>>>; mentions(id?: string): Promise<MetaPage<Record<string, unknown>>>; dms(id?: string): Promise<MetaPage<Record<string, unknown>>> }
}

const shortcodeFrom = (media: MetaMedia) => {
  const match = media.permalink?.match(/\/(?:p|reel|tv)\/([^/?#]+)/)
  return match?.[1] ?? media.id
}

export function createMetaSyncProcessor(repository: MetaSyncRepository, queue: MetaSyncQueue, api: MetaSyncApi) {
  const gate = createWorker<MetaSyncPayload>(spec)
  return async (job: WorkerJob<MetaSyncPayload>): Promise<WorkerResult> => {
    const started = Date.now()
    const base = await gate(job)
    const runId = job.payload.runId ?? base.traceId
    let postsNew = 0
    try {
      if (job.payload.kind === 'competitor') {
        if (!job.payload.collectorAccountId) throw new Error('collectorAccountId is required for competitor extraction')
        const targets = await repository.activeCompetitors({ campaignId: job.payload.campaignId, competitorId: job.payload.competitorId })
        for (const target of targets) {
          const response = await api.businessDiscovery(job.payload.igUserId, target.username, job.payload.limit ?? 25)
          const profile = response.business_discovery
          if (!profile) throw new Error(`Business Discovery did not return @${target.username}`)
          await repository.updateCompetitor(target, profile as Record<string, unknown>)
          for (const media of profile.media?.data ?? []) {
            const shortcode = shortcodeFrom(media)
            if (!shortcode) continue
            const post = await repository.upsertPost(target, { ...media, id: shortcode })
            if (!post.inserted) continue
            postsNew += 1
            metaSyncPostsNew.inc()
            await queue.extraction(post.id, runId, { postId: post.id, campaignId: target.campaignId, competitorId: target.competitorId, accountId: job.payload.collectorAccountId, postUrl: media.permalink, commentCountShown: media.comments_count ?? 0, runId, accountRole: 'collector' })
          }
        }
      } else {
        const [profile, media, insights, mentions, conversations] = await Promise.all([
          api.self.profile(job.payload.igUserId),
          api.self.media(job.payload.igUserId, job.payload.limit ?? 25),
          api.self.insights(job.payload.igUserId),
          api.self.mentions(job.payload.igUserId),
          api.self.dms(job.payload.igUserId),
        ])
        await repository.saveOwnSnapshot(job.payload.accountId, profile, media.data, insights.data, mentions.data, conversations.data)
      }
      return { ...base, event: { kind: 'meta-sync.completed', payload: { kind: job.payload.kind, postsNew } } }
    } catch (error) {
      const endpoint = job.payload.kind === 'competitor' ? 'business_discovery' : 'own_account'
      metaSyncApiErrors.inc({ endpoint })
      if (error instanceof MetaApiError && error.status === 429) await repository.incrementRateLimit(job.payload.accountId)
      throw error
    } finally {
      metaSyncDuration.observe(Date.now() - started)
    }
  }
}
