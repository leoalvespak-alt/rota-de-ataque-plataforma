import type { CSSProperties } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'

export function useProfileTokens(profileId: string | null): CSSProperties {
  const profiles = useProfileStore((s) => s.profiles)

  const profile = profileId ? profiles.find((p) => p.id === profileId) : null

  if (!profile) return {}

  return {
    '--profile-bg': profile.colorBackground,
    '--profile-text': profile.colorText,
    '--profile-primary': profile.colorPrimary,
    '--profile-button': profile.colorButton,
    '--profile-font-heading': `'${profile.fontHeading}', sans-serif`,
    '--profile-font-body': `'${profile.fontBody}', sans-serif`,
  } as CSSProperties
}
