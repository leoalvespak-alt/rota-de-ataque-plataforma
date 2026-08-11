export type Channel = 'instagram' | 'threads' | 'email' | 'whatsapp' | 'none'
type ContactableChannel = Exclude<Channel, 'none'>
export interface ChannelScores { email: number; whatsapp: number; instagram: number; threads: number; intent: number; relationship: number }
export interface ContactPolicy { cadenceSeconds: number; lastOutboundAt?: Date; inboundAt?: Date; emailCadenceSeconds?: number }
export const canContact = (channel: Channel, policy: ContactPolicy, now = new Date()) => {
  if (channel === 'none') return false
  if (policy.inboundAt && now.getTime() - policy.inboundAt.getTime() < 86_400_000) return true
  const cadence = channel === 'email' ? policy.emailCadenceSeconds ?? policy.cadenceSeconds : policy.cadenceSeconds
  return !policy.lastOutboundAt || now.getTime() - policy.lastOutboundAt.getTime() >= cadence * 1000
}
export function chooseChannel(scores: ChannelScores, eligible: Channel[], policy: ContactPolicy, now = new Date()): Channel {
  const ordered = [...eligible].filter((channel): channel is ContactableChannel => channel !== 'none' && canContact(channel, policy, now)).sort((a, b) => scores[b] - scores[a])
  return ordered[0] ?? 'none'
}
