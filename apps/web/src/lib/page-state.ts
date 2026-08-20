export type PageState = 'loading' | 'empty' | 'no_campaign' | 'forbidden' | 'provider_error' | 'error' | 'ready'

export interface PageStateInput {
  loading?: boolean
  hasCampaign: boolean
  itemCount: number
  permitted?: boolean
  providerAvailable?: boolean
  failed?: boolean
}

/** Keeps operational page states distinct so recovery and empty-state copy do not collapse into one message. */
export function resolvePageState(input: PageStateInput): PageState {
  if (input.loading) return 'loading'
  if (input.permitted === false) return 'forbidden'
  if (!input.hasCampaign) return 'no_campaign'
  if (input.providerAvailable === false) return 'provider_error'
  if (input.failed) return 'error'
  if (input.itemCount === 0) return 'empty'
  return 'ready'
}
