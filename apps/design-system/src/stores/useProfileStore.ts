import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { BrandProfile } from '@/db/schema'

const API_BASE = typeof window !== 'undefined'
  ? (import.meta.env?.VITE_API_URL ?? 'http://localhost:3001')
  : 'http://localhost:3001'

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
      set((s) => { s.loading = true; s.error = null })
      try {
        const res = await fetch(`${API_BASE}/api/profiles`)
        if (!res.ok) throw new Error('Falha ao carregar perfis')
        const data: BrandProfile[] = await res.json()
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
      const res = await fetch(`${API_BASE}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro ao criar perfil')
      }
      const created: BrandProfile = await res.json()
      set((s) => { s.profiles.push(created) })
      return created
    },

    updateProfile: async (id, data) => {
      const res = await fetch(`${API_BASE}/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro ao atualizar perfil')
      }
      const updated: BrandProfile = await res.json()
      set((s) => {
        const idx = s.profiles.findIndex((p) => p.id === id)
        if (idx >= 0) s.profiles[idx] = updated
      })
      return updated
    },

    deleteProfile: async (id) => {
      const res = await fetch(`${API_BASE}/api/profiles/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro ao deletar perfil')
      }
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
