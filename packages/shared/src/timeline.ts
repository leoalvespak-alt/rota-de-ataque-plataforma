import { z } from 'zod'

export const TimelineEventTypeSchema = z.enum([
  'instagram.comment', 'instagram.follow', 'instagram.follow_back', 'instagram.like_received', 'instagram.mention', 'instagram.dm_inbound', 'instagram.dm_outbound', 'instagram.story_view', 'instagram.reply_public', 'instagram.reply_private',
  'threads.publication', 'threads.reply_inbound', 'threads.reply_outbound', 'threads.engagement', 'threads.repost', 'threads.quote',
  'email.subscribed', 'email.double_optin_confirmed', 'email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.replied', 'email.bounced', 'email.complained', 'email.unsubscribed',
  'whatsapp.opt_in', 'whatsapp.opt_out', 'whatsapp.message_inbound', 'whatsapp.message_outbound', 'whatsapp.template_sent', 'whatsapp.status_delivered', 'whatsapp.status_read', 'whatsapp.group_join', 'whatsapp.group_leave', 'whatsapp.group_message_inbound', 'whatsapp.group_message_outbound',
  'conversion.purchase', 'conversion.lead_form', 'conversion.dm_reply', 'conversion.follow_back',
])
export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>
