import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { BrandProfile } from '@/db/schema'
import { isApiAvailable } from '@/lib/api/guards'
import { apiFetch } from '@/lib/api/client'

export type ProfileInput = {
  name: string
  handle: string
  colorBackground: string
  colorText: string
  colorPrimary: string
  colorButton: string
  fontHeading: string
  fontBody: string
  avatarKey?: string
}

interface ProfileState {
  profiles: BrandProfile[]
  activeProfileId: string | null
  loading: boolean
  error: string | null
}

interface ProfileActions {
  fetchProfiles: () => Promise<void>
  createProfile: (data: ProfileInput) => Promise<BrandProfile>
  updateProfile: (id: string, data: Partial<ProfileInput>) => Promise<BrandProfile>
  deleteProfile: (id: string) => Promise<void>
  setActiveProfile: (id: string | null) => void
  getActiveProfile: () => BrandProfile | null
}

export const useProfileStore = create<ProfileState & ProfileActions>()(
  immer((set, get) => ({
    profiles: [],
    activeProfileId: null,
    loading: false,
    error: null,

    fetchProfiles: async () => {
      if (!isApiAvailable()) {
        set((s) => { s.loading = false; s.profiles = [] })
        return
      }
      set((s) => { s.loading = true; s.error = null })
      try {
        const data = await apiFetch<BrandProfile[]>('/profiles')
        set((s) => {
          s.profiles = data
          if (!s.activeProfileId) {
            const def = data.find((p) => p.isDefault)
            if (def) s.activeProfileId = def.id
          }
        })
      } catch (err) {
        set((s) => { s.error = err instanceof Error ? err.message : 'Erro desconhecido' })
      } finally {
        set((s) => { s.loading = false })
      }
    },

    createProfile: async (data) => {
      const created = await apiFetch<BrandProfile>('/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set((s) => { s.profiles.push(created) })
      return created
    },

    updateProfile: async (id, data) => {
      const updated = await apiFetch<BrandProfile>(`/profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      set((s) => {
        const idx = s.profiles.findIndex((p) => p.id === id)
        if (idx >= 0) s.profiles[idx] = updated
      })
      return updated
    },

    deleteProfile: async (id) => {
      await apiFetch<void>(`/profiles/${id}`, { method: 'DELETE' })
      set((s) => {
        s.profiles = s.profiles.filter((p) => p.id !== id)
        if (s.activeProfileId === id) s.activeProfileId = null
      })
    },

    setActiveProfile: (id) => set((s) => { s.activeProfileId = id }),

    getActiveProfile: () => {
      const { profiles, activeProfileId } = get()
      return profiles.find((p) => p.id === activeProfileId) ?? null
    },
  })),
)
