import { result, type ChannelRule } from './types.js'

export const instagramRule: ChannelRule = (text, context) => {
  const hook = text.split('\n')[0] ?? ''
  return result(
    ...(hook.length > 120 ? ['instagram.hook_max_120_chars'] : []),
    ...(/#[\p{L}\d_]+/u.test(text) ? ['instagram.hashtags_must_be_first_comment'] : []),
    ...(context.firstComment === undefined ? ['instagram.first_comment_required'] : []),
  )
}
