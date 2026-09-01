export type EmailAddress = string

export interface EmailMessage {
  to: EmailAddress | EmailAddress[]
  subject: string
  html?: string
  text?: string
  replyTo?: EmailAddress
  tags?: Record<string, string>
}

export interface DeliveryReceipt {
  provider: 'resend' | 'brevo'
  providerMessageId: string | null
  accepted: boolean
  disabled: boolean
}

export interface TransactionalEmailProvider {
  readonly enabled: boolean
  send(message: EmailMessage): Promise<DeliveryReceipt>
}

export interface MarketingEmailProvider {
  readonly enabled: boolean
  createCampaign(input: { name: string; subject: string; html: string; senderName: string; senderEmail: string; listIds: number[] }): Promise<{ campaignId: string | null; disabled: boolean }>
}

export type EmailEnvironment = Record<string, string | undefined>

function currentEnvironment(): EmailEnvironment {
  const runtime = (globalThis as typeof globalThis & { process?: { env?: EmailEnvironment } }).process
  return runtime?.env ?? {}
}

function required(env: EmailEnvironment, key: string): string | undefined {
  const value = env[key]?.trim()
  return value || undefined
}

function addresses(value: EmailAddress | EmailAddress[]): string[] {
  return Array.isArray(value) ? value : [value]
}

class DisabledTransactionalProvider implements TransactionalEmailProvider {
  readonly enabled = false
  async send(_message: EmailMessage): Promise<DeliveryReceipt> {
    return { provider: 'resend', providerMessageId: null, accepted: false, disabled: true }
  }
}

export class ResendTransactionalProvider implements TransactionalEmailProvider {
  readonly enabled = true
  constructor(private readonly apiKey: string, private readonly from: string, private readonly fetcher: typeof fetch = fetch) {}

  async send(message: EmailMessage): Promise<DeliveryReceipt> {
    const response = await this.fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: addresses(message.to), subject: message.subject, html: message.html, text: message.text, reply_to: message.replyTo, tags: Object.entries(message.tags ?? {}).map(([name, value]) => ({ name, value })) }),
    })
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string }
    if (!response.ok) throw new Error(`Resend delivery failed (${response.status}): ${data.message ?? 'provider error'}`)
    return { provider: 'resend', providerMessageId: data.id ?? null, accepted: true, disabled: false }
  }
}

class DisabledMarketingProvider implements MarketingEmailProvider {
  readonly enabled = false
  async createCampaign(_input: Parameters<MarketingEmailProvider['createCampaign']>[0]): Promise<{ campaignId: string | null; disabled: boolean }> {
    return { campaignId: null, disabled: true }
  }
}

export class BrevoMarketingProvider implements MarketingEmailProvider {
  readonly enabled = true
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async createCampaign(input: Parameters<MarketingEmailProvider['createCampaign']>[0]) {
    const response = await this.fetcher('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ name: input.name, subject: input.subject, htmlContent: input.html, sender: { name: input.senderName, email: input.senderEmail }, recipients: { listIds: input.listIds } }),
    })
    const data = await response.json().catch(() => ({})) as { id?: number; message?: string }
    if (!response.ok) throw new Error(`Brevo campaign creation failed (${response.status}): ${data.message ?? 'provider error'}`)
    return { campaignId: data.id ? String(data.id) : null, disabled: false }
  }
}

export function createEmailDelivery(env: EmailEnvironment = currentEnvironment(), fetcher: typeof fetch = fetch): { transactional: TransactionalEmailProvider; marketing: MarketingEmailProvider } {
  const resendKey = required(env, 'RESEND_API_KEY')
  const resendFrom = required(env, 'RESEND_FROM_EMAIL')
  const brevoKey = required(env, 'BREVO_API_KEY')
  return {
    transactional: resendKey && resendFrom ? new ResendTransactionalProvider(resendKey, resendFrom, fetcher) : new DisabledTransactionalProvider(),
    marketing: brevoKey ? new BrevoMarketingProvider(brevoKey, fetcher) : new DisabledMarketingProvider(),
  }
}
