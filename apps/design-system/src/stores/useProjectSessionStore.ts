import { create } from 'zustand'
import type { ProjectDocument } from '@/domain/documents'

export type ProjectSessionStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

interface ProjectSessionState {
  project?: ProjectDocument
  status: ProjectSessionStatus
  recoveryProject?: ProjectDocument
  error?: string
  setProject: (project: ProjectDocument) => void
  setStatus: (status: ProjectSessionStatus, error?: string) => void
  offerRecovery: (project?: ProjectDocument) => void
  clearRecovery: () => void
}

export const useProjectSessionStore = create<ProjectSessionState>()((set) => ({
  status: 'idle',
  setProject: (project) => set({ project, status: 'ready', error: undefined }),
  setStatus: (status, error) => set({ status, error }),
  offerRecovery: (recoveryProject) => set({ recoveryProject }),
  clearRecovery: () => set({ recoveryProject: undefined }),
}))
