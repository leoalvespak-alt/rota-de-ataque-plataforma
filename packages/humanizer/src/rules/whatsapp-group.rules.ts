import { result, type ChannelRule } from './types.js'

export const whatsappGroupRule: ChannelRule = (text) => result(
  ...(text.length > 300 ? ['whatsapp_group.max_300_chars'] : []),
  ...(/compre|assine|oferta|desconto|garanta sua vaga/i.test(text) ? ['whatsapp_group.forbid_direct_sales_cta'] : []),
)
