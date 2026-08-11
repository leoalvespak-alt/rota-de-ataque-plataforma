import { createHmac, timingSafeEqual } from 'node:crypto'

export class WhatsAppCloudClient {
  constructor(private phoneNumberId: string, private token: string, private version = 'v21.0') {}
  private async send(body: unknown) {
    const response = await fetch(`https://graph.facebook.com/${this.version}/${this.phoneNumberId}/messages`, {
      method: 'POST', headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body as object }),
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<{ messages?: Array<{ id: string }> }>
  }
  sendText(to: string, text: string) { return this.send({ to, type: 'text', text: { body: text } }) }
  sendTemplate(to: string, name: string, language = 'pt_BR') { return this.send({ to, type: 'template', template: { name, language: { code: language } } }) }
  sendMedia(to: string, type: 'image' | 'audio' | 'video' | 'document', link: string, caption?: string) { return this.send({ to, type, [type]: { link, ...(caption ? { caption } : {}) } }) }
  sendInteractive(to: string, interactive: Record<string, unknown>) { return this.send({ to, type: 'interactive', interactive }) }
  markAsRead(messageId: string) { return this.send({ status: 'read', message_id: messageId }) }
  async readTemplateApprovals(businessAccountId: string) {
    const response = await fetch(`https://graph.facebook.com/${this.version}/${businessAccountId}/message_templates?fields=name,status,language,category,components`, { headers: { authorization: `Bearer ${this.token}` } })
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<{ data?: Array<{ name: string; status: string; language: string; category?: string; components?: unknown[] }> }>
  }
}

export const verifyWhatsAppSignature = (raw: Buffer, signature: string | null, secret: string) => {
  if (!signature?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(raw).digest()
  const actual = Buffer.from(signature.slice(7), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export interface WhatsAppWebhookEvent { kind: 'message' | 'status'; messageId: string; from?: string; text?: string; status?: string; timestamp?: Date; raw: Record<string, unknown> }
export function parseWhatsAppWebhook(payload: unknown): WhatsAppWebhookEvent[] {
  const root = payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>>; statuses?: Array<Record<string, unknown>> } }> }> }
  const events: WhatsAppWebhookEvent[] = []
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const message of change.value?.messages ?? []) events.push({ kind: 'message', messageId: String(message.id), from: typeof message.from === 'string' ? message.from : undefined, text: (message.text as { body?: string } | undefined)?.body, timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000) : undefined, raw: message })
  for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) for (const status of change.value?.statuses ?? []) events.push({ kind: 'status', messageId: String(status.id), status: typeof status.status === 'string' ? status.status : undefined, timestamp: status.timestamp ? new Date(Number(status.timestamp) * 1000) : undefined, raw: status })
  return events
}
