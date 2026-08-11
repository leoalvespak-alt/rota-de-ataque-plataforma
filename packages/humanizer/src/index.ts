import { cosine } from '@plataforma/nlp'
import { channelRules, type ChannelRuleContext, type HumanizerChannel, type RuleResult } from './rules/index.js'

export type { ChannelRuleContext, HumanizerChannel, RuleResult }
export interface GeneratedText { id:string; text:string; embedding:number[]; purpose:string; createdAt:Date; channel?:HumanizerChannel; contentItemId?:string; variantId?:string }
export interface HumanizeInput {
  channel?: HumanizerChannel
  purpose: string
  basePrompt: string
  brandVoiceVersion: string
  thesisId?: string
  contentItemId?: string
  leadId?: string
  stage?: string
  objective?: string
  context: ChannelRuleContext
  recent: GeneratedText[]
  generate: (prompt:string) => Promise<{text:string;embedding:number[]}>
}

const channelGuidance: Record<HumanizerChannel, string> = {
  instagram: 'Instagram: hook curto na primeira linha, sem hashtags no corpo; devolva hashtags apenas para first_comment.',
  threads: 'Threads: até 500 caracteres, quebras de linha estratégicas, até duas hashtags e nunca use “clique no link”.',
  email: 'E-mail: subject até 60 caracteres, preheader diferente do subject e exatamente um link de CTA claro.',
  whatsapp_dm: 'WhatsApp: até 400 caracteres, no máximo dois emojis e exatamente uma pergunta.',
  whatsapp_group: 'Grupo WhatsApp: até 300 caracteres, tom de comunidade e nenhuma CTA direta de venda.',
}

export function composePrompt(base:string, voice:string, context:ChannelRuleContext, variation=false, channel:HumanizerChannel='instagram', correction:string[]=[]){
  return `${base}\nCanal: ${channelGuidance[channel]}\nVoz da marca (${voice}): natural, específica e sem clichês.\nContexto: ${JSON.stringify(context)}${variation?'\nVarie radicalmente a estrutura sintática em relação às opções anteriores.':''}${correction.length?`\nCorrija obrigatoriamente: ${correction.join(', ')}.`:''}`
}

export function validateChannelText(channel:HumanizerChannel, text:string, context:ChannelRuleContext={}): RuleResult { return channelRules[channel](text, context) }

export async function humanize(input:HumanizeInput) {
  const channel = input.channel ?? 'instagram'
  let output = await input.generate(composePrompt(input.basePrompt, input.brandVoiceVersion, input.context, false, channel))
  let repeated: string | null = null
  let violations: string[] = []
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sameChannel = input.recent.find((item) => item.purpose === input.purpose && (item.channel ?? channel) === channel && cosine(item.embedding, output.embedding) >= .92)
    const crossChannel = input.contentItemId ? input.recent.find((item) => item.contentItemId === input.contentItemId && item.channel && item.channel !== channel && cosine(item.embedding, output.embedding) >= .85) : undefined
    const rule = validateChannelText(channel, output.text, input.context)
    repeated = sameChannel?.id ?? crossChannel?.id ?? null
    violations = [...rule.violations, ...(sameChannel ? ['similarity.same_channel_0_92'] : []), ...(crossChannel ? ['similarity.cross_channel_0_85'] : [])]
    if (!violations.length) return { ...output, repeated, ok:true, violations, attempts:attempt + 1 }
    if (attempt === 2) break
    output = await input.generate(composePrompt(input.basePrompt, input.brandVoiceVersion, input.context, true, channel, violations))
  }
  return { ...output, repeated, ok:false, violations, attempts:3 }
}
