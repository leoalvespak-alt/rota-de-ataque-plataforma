'use client'
import { SessionProvider } from 'next-auth/react'
import { appPath } from '@/lib/base-path'
export function NextAuthBasePath({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={appPath('/api/auth')} refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  )
}
