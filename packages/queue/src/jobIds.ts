import { deterministicJobId } from '@plataforma/shared'

export const variantJobId = (contentItemId: string, channel: string) => deterministicJobId('content-variant', [contentItemId, channel])
export const publishVariantJobId = (variantId: string) => deterministicJobId('content-publish', [variantId])
export const redditWatchJobId = (watchId: string, cursor = 'latest') => deterministicJobId('reddit-intelligence', [watchId, cursor])
