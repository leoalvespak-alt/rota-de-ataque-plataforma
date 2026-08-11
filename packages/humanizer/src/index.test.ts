import { describe, expect, it } from 'vitest'
import { humanize, validateChannelText } from './index.js'

describe('humanizer', () => {
  it('varies the prompt by channel', async () => {
    const prompts:string[] = []
    await humanize({ channel:'threads', purpose:'post', basePrompt:'base', brandVoiceVersion:'v1', context:{}, recent:[], generate:async (prompt) => { prompts.push(prompt); return { text:'Linha um\nLinha dois?', embedding:[0,1] } } })
    await humanize({ channel:'whatsapp_dm', purpose:'post', basePrompt:'base', brandVoiceVersion:'v1', context:{}, recent:[], generate:async (prompt) => { prompts.push(prompt); return { text:'Olá, como posso ajudar?', embedding:[0,1] } } })
    expect(prompts[0]).not.toEqual(prompts[1])
  })
  it('regenerates a threads text above 500 characters', async () => {
    let calls = 0
    const result = await humanize({ channel:'threads', purpose:'post', basePrompt:'x', brandVoiceVersion:'v1', context:{}, recent:[], generate:async () => { calls++; return { text:calls === 1 ? `${'a'.repeat(501)}\n` : 'Uma ideia\nem duas linhas', embedding:[0,calls] } } })
    expect(calls).toBe(2); expect(result.ok).toBe(true)
  })
  it('flags a cross-channel variant with cosine 0.90 from the same item', async () => {
    const result = await humanize({ channel:'threads', purpose:'post', contentItemId:'item', basePrompt:'x', brandVoiceVersion:'v1', context:{}, recent:[{ id:'email', text:'email', embedding:[1,0], purpose:'post', createdAt:new Date(), channel:'email', contentItemId:'item' }], generate:async () => ({ text:'Linha\nThreads', embedding:[.9,Math.sqrt(.19)] }) })
    expect(result.ok).toBe(false); expect(result.violations).toContain('similarity.cross_channel_0_85')
  })
  it('exposes declarative WhatsApp constraints', () => expect(validateChannelText('whatsapp_dm', 'Sem pergunta', {}).violations).toContain('whatsapp.requires_exactly_one_question'))
})
