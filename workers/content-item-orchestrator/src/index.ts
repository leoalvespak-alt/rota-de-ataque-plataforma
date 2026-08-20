import {
  createWorker,
  type WorkerJob,
  type WorkerResult,
  type WorkerSpec,
} from "@plataforma/shared/worker";
import { variantJobId } from "@plataforma/queue";

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
export interface VariantEnqueuer {
  enqueue(
    queue:
      | "threads-adapter"
      | "email-flow-engine"
      | "whatsapp-outbound",
    jobId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}

const queueFor = {
  threads: "threads-adapter",
  email: "email-flow-engine",
  whatsapp_dm: "whatsapp-outbound",
} as const;
export function createContentItemOrchestrator(
  repository: ContentItemRepository,
  enqueuer: VariantEnqueuer,
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
    const dispatchable = channels.filter(
      (channel): channel is keyof typeof queueFor =>
        channel in queueFor,
    );
    await Promise.all(
      dispatchable.map(async (channel) =>
        enqueuer.enqueue(queueFor[channel], variantJobId(item.id, channel), {
          contentItemId: item.id,
          channel,
        }),
      ),
    );
    return {
      ...base,
      event: {
        kind: "content-item.orchestrated",
        payload: {
          contentItemId: item.id,
          channels: dispatchable,
          disabledChannels: channels.filter((channel) => !(channel in queueFor)),
        },
      },
    };
  };
}
