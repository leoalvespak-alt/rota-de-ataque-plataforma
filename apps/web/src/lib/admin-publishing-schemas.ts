import { z } from 'zod'

const externalId = z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._:-]+$/)
const reason = z.string().trim().min(1).max(500)

export const CancelPublicationSchema = z.object({
  publicationId: z.string().uuid(),
  reason,
}).strict()

export const ConfirmManualPublicationSchema = z.object({
  publicationId: z.string().uuid(),
  externalId,
}).strict()

export const KillSwitchSchema = z.object({
  action: z.enum(['kill', 'resume']),
  reason,
}).strict()
