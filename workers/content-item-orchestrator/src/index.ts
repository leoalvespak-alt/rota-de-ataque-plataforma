import {
  createWorker,
  type WorkerJob,
  type WorkerResult,
  type WorkerSpec,
} from "@plataforma/shared/worker";

export const spec = {
  queue: "content-item-orchestrator",
  requiresMetaToken: false,
} satisfies WorkerSpec;
export interface ContentItemPayload {
  contentItemId: string;
  channels?: Array<
    "instagram" | "threads" | "email" | "whatsapp_dm" | "whatsapp_group"
  >;
}
export interface ContentItem {
  id: string;
  frozenAt: Date | null;
  parentId: string | null;
  brandVoiceVersion: string;
  campaignActive: boolean;
}
export interface ContentItemRepository {
  get(id: string): Promise<ContentItem | null>;
}
export function createContentItemOrchestrator(
  repository: ContentItemRepository,
) {
  const gate = createWorker<ContentItemPayload>(spec);
  return async (job: WorkerJob<ContentItemPayload>): Promise<WorkerResult> => {
    const base = await gate(job);
    const item = await repository.get(job.payload.contentItemId);
    if (
      !item ||
      item.frozenAt ||
      !item.brandVoiceVersion ||
      !item.campaignActive
    )
      throw Object.assign(
        new Error("Content item orchestration preflight failed"),
        { reasonCode: "PREFLIGHT_FAILED" },
      );
    const channels = job.payload.channels ?? ["instagram", "threads"];
    return {
      ...base,
      event: {
        kind: "content-item.orchestrated",
        payload: {
          contentItemId: item.id,
          plannedChannels: channels,
          dispatch: "deferred_to_post_queue_runtime",
        },
      },
    };
  };
}
