import { z } from 'zod'

const FlagSchema = z.object({
  newSidebar: z.boolean().default(true),
  newDataGrid: z.boolean().default(true),
  newCommandPalette: z.boolean().default(true),
  enableKanban: z.boolean().default(false),
  enableAiScore: z.boolean().default(true),
})

export type FeatureFlags = z.infer<typeof FlagSchema>

// Reads from env vars (NEXT_PUBLIC_FF_*) with Zod validation + defaults
export function getFlags(): FeatureFlags {
  return FlagSchema.parse({
    newSidebar: process.env.NEXT_PUBLIC_FF_NEW_SIDEBAR !== 'false',
    newDataGrid: process.env.NEXT_PUBLIC_FF_NEW_DATAGRID !== 'false',
    newCommandPalette: process.env.NEXT_PUBLIC_FF_NEW_CMD_PALETTE !== 'false',
    enableKanban: process.env.NEXT_PUBLIC_FF_KANBAN === 'true',
    enableAiScore: process.env.NEXT_PUBLIC_FF_AI_SCORE !== 'false',
  })
}

// Legacy compat — keep existing types working
export type FeatureFlag = 'enable_kanban' | 'enable_ai_score'

export function getFeatureFlag(flag: FeatureFlag): boolean {
  const flags = getFlags()
  if (flag === 'enable_kanban') return flags.enableKanban
  if (flag === 'enable_ai_score') return flags.enableAiScore
  return false
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return getFeatureFlag(flag)
}
