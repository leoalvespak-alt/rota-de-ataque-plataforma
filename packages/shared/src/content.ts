import { z } from 'zod'

export const ContentChannelSchema = z.enum(['instagram', 'threads', 'email', 'whatsapp_dm', 'whatsapp_group'])
export const InstagramCarouselPayloadSchema = z.object({ slides: z.array(z.object({ templateId: z.string().min(1), tokens: z.record(z.string(), z.unknown()) })).min(1), caption: z.string(), hashtags: z.array(z.string()), first_comment: z.string().optional() })
export const InstagramReelPayloadSchema = z.object({ script: z.string().min(1), caption: z.string(), hashtags: z.array(z.string()), cover_image_ref: z.string().min(1) })
export const ThreadsTextPayloadSchema = z.object({ text: z.string().min(1).max(500), media_refs: z.array(z.string()).optional(), reply_to: z.string().optional() })
export const EmailPayloadSchema = z.object({ subject: z.string().min(1), preheader: z.string(), html: z.string().min(1), plain: z.string().min(1), list_id: z.string().min(1), segment_query: z.string().min(1), from_name: z.string().min(1), from_email: z.string().email() })
export const WhatsAppDmPayloadSchema = z.object({ text: z.string().min(1).optional(), template_ref: z.string().min(1).optional(), media_refs: z.array(z.string()).optional() }).refine((value) => Boolean(value.text || value.template_ref), 'text or template_ref is required')
export const WhatsAppGroupPayloadSchema = z.object({ text: z.string().min(1), media_refs: z.array(z.string()).optional(), group_id: z.string().uuid(), mentions: z.array(z.string()).optional() })
export const parseContentVariantPayload = (channel: z.infer<typeof ContentChannelSchema>, format: string, payload: unknown) => {
  if (channel === 'threads') return ThreadsTextPayloadSchema.parse(payload)
  if (channel === 'email') return EmailPayloadSchema.parse(payload)
  if (channel === 'whatsapp_dm') return WhatsAppDmPayloadSchema.parse(payload)
  if (channel === 'whatsapp_group') return WhatsAppGroupPayloadSchema.parse(payload)
  if (format === 'reel') return InstagramReelPayloadSchema.parse(payload)
  return InstagramCarouselPayloadSchema.parse(payload)
}
