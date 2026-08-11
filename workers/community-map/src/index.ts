import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'community-map', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface CommunityPayload { campaignId: string; minMembers?: number }
export interface CommunityEdge { leadId: string; contextType: string; contextId: string; weight: number; username?: string }
export interface CommunityRepository { edges(payload: CommunityPayload): Promise<CommunityEdge[]>; replace(payload: CommunityPayload, groups: CommunityEdge[][], traceId: string): Promise<void> }

export function clusterByContext(edges: CommunityEdge[], minMembers = 3) {
  const buckets = new Map<string, CommunityEdge[]>()
  for (const edge of edges) {
    const key = `${edge.contextType}:${edge.contextId}`
    buckets.set(key, [...(buckets.get(key) ?? []), edge])
  }
  return [...buckets.values()].filter((group) => new Set(group.map((edge) => edge.leadId)).size >= minMembers)
}

export function createCommunityMapProcessor(repository: CommunityRepository) {
  const gate = createWorker<CommunityPayload>(spec)
  return async (job: WorkerJob<CommunityPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const groups = clusterByContext(await repository.edges(job.payload), job.payload.minMembers ?? 3)
    await repository.replace(job.payload, groups, base.traceId)
    return { ...base, event: { kind: 'community-map.completed', payload: { communities: groups.length } } }
  }
}
