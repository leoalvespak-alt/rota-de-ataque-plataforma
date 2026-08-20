export const radarFindingStates = ['pending', 'approved', 'dismissed'] as const
export const competitorInsightStates = ['pending', 'seen', 'suggestion_created'] as const
export const suggestionStates = ['proposed', 'approved', 'rejected', 'expired'] as const
export const publicationStates = ['idea', 'draft', 'ready', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'awaiting_manual_publish', 'cancelled'] as const

export type RadarFindingState = (typeof radarFindingStates)[number]
export type CompetitorInsightState = (typeof competitorInsightStates)[number]
export type SuggestionState = (typeof suggestionStates)[number]
export type PublicationState = (typeof publicationStates)[number]

export function isPublicationCancellable(status: string) {
  return status === 'idea' || status === 'draft' || status === 'ready' || status === 'approved' || status === 'scheduled' || status === 'awaiting_manual_publish'
}

export function isManualConfirmationAllowed(status: string) {
  return status === 'awaiting_manual_publish'
}
