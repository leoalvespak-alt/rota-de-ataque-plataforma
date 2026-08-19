import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { ResendEmailChannel, TelegramChannel, type NotificationChannel } from '@plataforma/notifications'
import { authOptions } from '@/lib/auth'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const notification = { kind: 'notification.synthetic', severity: 'info' as const, campaign: 'Teste', message: 'Canal operacional', dashboardUrl: `${process.env.APP_URL}/notifications`, traceId: crypto.randomUUID() }
    const channels: NotificationChannel[] = []
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) channels.push(new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID))
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.ALERTS_EMAIL_TO) channels.push(new ResendEmailChannel(process.env.RESEND_API_KEY, process.env.RESEND_FROM, process.env.ALERTS_EMAIL_TO.split(',')))
    return NextResponse.json({ deliveries: await Promise.all(channels.map((channel) => channel.send(notification))) })
  } catch (error) {
    console.error('Failed to send test notification', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
