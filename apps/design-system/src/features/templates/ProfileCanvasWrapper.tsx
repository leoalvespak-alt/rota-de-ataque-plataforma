import { type ReactNode, useEffect } from 'react'
import { useProfileTokens } from '@/hooks/useProfileTokens'
import { useProfileStore } from '@/stores/useProfileStore'
import { loadProfileFonts } from '@/lib/fonts/loadProfileFonts'

interface ProfileCanvasWrapperProps {
  profileId: string | null
  children: ReactNode
  className?: string
}

export function ProfileCanvasWrapper({ profileId, children, className }: ProfileCanvasWrapperProps) {
  const tokens = useProfileTokens(profileId)
  const profiles = useProfileStore((s) => s.profiles)
  const hasTokens = Object.keys(tokens).length > 0

  useEffect(() => {
    if (!profileId) return
    const profile = profiles.find((p) => p.id === profileId)
    if (profile) void loadProfileFonts(profile.fontHeading, profile.fontBody)
  }, [profileId, profiles])

  return (
    <div
      style={tokens}
      className={['profile-canvas-scope', className].filter(Boolean).join(' ')}
      data-profile-id={hasTokens ? profileId : undefined}
    >
      {children}
    </div>
  )
}
