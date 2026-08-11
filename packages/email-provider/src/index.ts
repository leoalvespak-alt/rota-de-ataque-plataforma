import { Resend } from 'resend'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export type EmailEventKind = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'replied' | 'unsubscribed'
export interface EmailMessage { to: string; from: string; subject: string; html: string; plain: string; tags?: Record<string, string>; kind: 'transactional' | 'bulk' }
export interface Delivery { provider: 'resend' | 'ses'; messageId: string }
export interface ProviderEvent { kind: EmailEventKind; messageId?: string; email?: string; metadata: Record<string, unknown>; occurredAt: Date }
export interface EmailProvider { send(message: EmailMessage): Promise<Delivery>; parseWebhook(payload: unknown): ProviderEvent[] }

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
function normalizeKind(value: unknown): EmailEventKind | null {
  const normalized = String(value ?? '').toLowerCase().replaceAll('.', '_')
  const map: Record<string, EmailEventKind> = { email_sent: 'sent', sent: 'sent', email_delivered: 'delivered', delivered: 'delivered', delivery: 'delivered', email_opened: 'opened', opened: 'opened', open: 'opened', email_clicked: 'clicked', clicked: 'clicked', click: 'clicked', email_bounced: 'bounced', bounced: 'bounced', bounce: 'bounced', complaint: 'complained', complained: 'complained', email_complained: 'complained', replied: 'replied', unsubscribed: 'unsubscribed', email_unsubscribed: 'unsubscribed' }
  return map[normalized] ?? null
}

export class ResendProvider implements EmailProvider {
  private client: Resend
  constructor(apiKey: string) { this.client = new Resend(apiKey) }
  async send(message: EmailMessage): Promise<Delivery> {
    const response = await this.client.emails.send({ from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.plain, tags: Object.entries(message.tags ?? {}).map(([name, value]) => ({ name, value })) })
    if (response.error || !response.data?.id) throw new Error(response.error?.message ?? 'Resend did not return a message id')
    return { provider: 'resend', messageId: response.data.id }
  }
  parseWebhook(payload: unknown): ProviderEvent[] {
    const row = asRecord(payload); const data = asRecord(row.data); const kind = normalizeKind(row.type)
    const recipient = typeof data.to === 'string' ? data.to : Array.isArray(data.to) && typeof data.to[0] === 'string' ? data.to[0] : undefined
    return kind ? [{ kind, messageId: typeof data.email_id === 'string' ? data.email_id : undefined, email: recipient, metadata: row, occurredAt: new Date(typeof data.created_at === 'string' ? data.created_at : Date.now()) }] : []
  }
}
export function verifyResendWebhook(input: { apiKey: string; webhookSecret: string; payload: string; headers: { id: string; timestamp: string; signature: string } }) {
  return new Resend(input.apiKey).webhooks.verify({ webhookSecret: input.webhookSecret, payload: input.payload, headers: input.headers })
}

export interface SesTransport { send(input: EmailMessage): Promise<{ messageId: string }> }
export class AwsSesTransport implements SesTransport {
  private client: SESv2Client
  constructor(region: string) { this.client = new SESv2Client({ region }) }
  async send(input: EmailMessage) { const result = await this.client.send(new SendEmailCommand({ FromEmailAddress: input.from, Destination: { ToAddresses: [input.to] }, Content: { Simple: { Subject: { Data: input.subject, Charset: 'UTF-8' }, Body: { Html: { Data: input.html, Charset: 'UTF-8' }, Text: { Data: input.plain, Charset: 'UTF-8' } } } } })); if (!result.MessageId) throw new Error('SES did not return a message id'); return { messageId: result.MessageId } }
}
export class SesProvider implements EmailProvider {
  constructor(private transport: SesTransport) {}
  async send(message: EmailMessage): Promise<Delivery> { const response = await this.transport.send(message); return { provider: 'ses', messageId: response.messageId } }
  parseWebhook(payload: unknown): ProviderEvent[] {
    const row = asRecord(payload); const message = asRecord(row.mail); const notification = asRecord(row.notification); const kind = normalizeKind(row.eventType ?? row.notificationType)
    return kind ? [{ kind, messageId: typeof message.messageId === 'string' ? message.messageId : undefined, email: Array.isArray(message.destination) && typeof message.destination[0] === 'string' ? message.destination[0] : undefined, metadata: row, occurredAt: new Date(typeof notification.timestamp === 'string' ? notification.timestamp : Date.now()) }] : []
  }
}

export class RoutingEmailProvider implements EmailProvider {
  constructor(private transactional: EmailProvider, private bulk: EmailProvider) {}
  send(message: EmailMessage) { return (message.kind === 'transactional' ? this.transactional : this.bulk).send(message) }
  parseWebhook(payload: unknown) { return [...this.transactional.parseWebhook(payload), ...this.bulk.parseWebhook(payload)] }
}
