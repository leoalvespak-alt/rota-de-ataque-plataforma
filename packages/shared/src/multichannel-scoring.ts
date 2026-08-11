export function emailEngagementScore(input: { opens30d: number; clicks30d: number; replies30d: number; unsubscribed: boolean }) {
  if (input.unsubscribed) return 0
  return Math.min(100, input.opens30d * 4 + input.clicks30d * 15 + input.replies30d * 30)
}

export function whatsappEngagementScore(input: { inboundMessages30d: number; responseRate: number; averageResponseMinutes: number | null }) {
  const responseSpeed = input.averageResponseMinutes === null ? 0 : Math.max(0, 20 - Math.min(20, input.averageResponseMinutes / 15))
  return Math.min(100, input.inboundMessages30d * 8 + Math.max(0, Math.min(1, input.responseRate)) * 50 + responseSpeed)
}

export function freshnessScore(daysSinceLastTouch: number, lambda = 0.08) {
  return 100 * Math.exp(-lambda * Math.max(0, daysSinceLastTouch))
}

export function updateAffinity(previous: number, eventWeight: number, alpha = 0.2) {
  return Math.max(0, Math.min(100, previous * (1 - alpha) + eventWeight * alpha))
}
