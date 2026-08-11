import { result, type ChannelRule } from './types.js'

export const whatsappRule: ChannelRule = (text) => result(
  ...(text.length > 400 ? ['whatsapp.max_400_chars'] : []),
  ...((text.match(/[\p{Extended_Pictographic}]/gu) ?? []).length > 2 ? ['whatsapp.max_2_emojis'] : []),
  ...((text.match(/\?/g) ?? []).length !== 1 ? ['whatsapp.requires_exactly_one_question'] : []),
)
