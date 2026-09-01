export const EDITORIAL_QUEUES = [
  'news-radar',
  'content-opportunity',
  'content-item-orchestrator',
] as const

export type EditorialQueue = typeof EDITORIAL_QUEUES[number]
