import { emailRule } from './email.rules.js'
import { instagramRule } from './instagram.rules.js'
import { threadsRule } from './threads.rules.js'
import { whatsappGroupRule } from './whatsapp-group.rules.js'
import { whatsappRule } from './whatsapp.rules.js'
import type { ChannelRule, HumanizerChannel } from './types.js'

export * from './types.js'
export const channelRules: Record<HumanizerChannel, ChannelRule> = { instagram: instagramRule, threads: threadsRule, email: emailRule, whatsapp_dm: whatsappRule, whatsapp_group: whatsappGroupRule }
