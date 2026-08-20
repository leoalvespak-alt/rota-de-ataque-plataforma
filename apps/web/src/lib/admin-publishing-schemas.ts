import { z } from 'zod'

export const KillSwitchSchema = z.object({
  action: z.enum(['resume', 'kill']),
  reason: z.string().min(1).optional(),
})
export type KillSwitch = z.infer<typeof KillSwitchSchema>

export const CancelPublicationSchema = z.object({
  publicationId: z.string().uuid(),
  reason: z.string().min(1).optional(),
})
export type CancelPublication = z.infer<typeof CancelPublicationSchema>

export const ConfirmManualPublicationSchema = z.object({
  publicationId: z.string().uuid(),
  externalId: z.string().min(1),
})
export type ConfirmManualPublication = z.infer<typeof ConfirmManualPublicationSchema>
