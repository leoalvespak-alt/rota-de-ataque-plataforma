export type HumanizerChannel = 'instagram' | 'threads' | 'email' | 'whatsapp_dm' | 'whatsapp_group'

export interface ChannelRuleContext { subject?: string; preheader?: string; firstComment?: string; [key: string]: unknown }
export interface RuleResult { ok: boolean; violations: string[] }
export type ChannelRule = (text: string, context: ChannelRuleContext) => RuleResult

export const result = (...violations: string[]): RuleResult => ({ ok: violations.length === 0, violations })
