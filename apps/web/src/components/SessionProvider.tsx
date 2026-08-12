'use client'

import React, { createContext, useContext } from 'react'

export interface Session {
  name: string
  role: string
  avatarUrl?: string
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ session, children }: { session: Session, children: React.ReactNode }) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
