import { result, type ChannelRule } from './types.js'

export const emailRule: ChannelRule = (text, context) => {
  const subject = context.subject ?? ''
  const preheader = context.preheader ?? ''
  const ctas = text.match(/(?:https?:\/\/[^\s)]+|\[[^\]]+\]\(https?:\/\/[^)]+\))/g) ?? []
  return result(
    ...(subject.length > 60 ? ['email.subject_max_60_chars'] : []),
    ...(subject && preheader && subject.trim().toLowerCase() === preheader.trim().toLowerCase() ? ['email.preheader_repeats_subject'] : []),
    ...(ctas.length !== 1 ? ['email.requires_exactly_one_cta_link'] : []),
  )
}
