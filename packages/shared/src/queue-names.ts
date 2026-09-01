export const QUEUE_NAMES = [
  "content-opportunity",
  "content-item-orchestrator",
  "news-radar",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
