import { result, type ChannelRule } from './types.js'

export const threadsRule: ChannelRule = (text) => result(
  ...(text.length > 500 ? ['threads.max_500_chars'] : []),
  ...((text.match(/#[\p{L}\d_]+/gu) ?? []).length > 2 ? ['threads.max_2_hashtags'] : []),
  ...(!text.includes('\n') ? ['threads.requires_strategic_linebreak'] : []),
  ...(/clique no link/i.test(text) ? ['threads.forbid_click_link_cta'] : []),
)
