export const dynamic = 'force-dynamic';
import type { Metadata } from 'next'
import { createDatabase } from '@plataforma/db'
import { AppShell } from '@/components/AppShell'
import { CommandPalette } from '@/components/CommandPalette'
import { FeatureFlagProvider } from '@/components/FeatureFlagProvider'
import { Suspense } from 'react'
import { getCampaignContext } from '@/lib/campaign-context'
import { getFlags } from '@/lib/feature-flags'
import './globals.css'

export const metadata: Metadata = { title: 'Plataforma Rota de Ataque', description: 'Gestão de redes sociais e prospecção ativa' }

import { TooltipProvider, ToastProvider } from '@plataforma/ui-bridge'

import { SessionProvider } from '@/components/SessionProvider'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let context: Awaited<ReturnType<typeof getCampaignContext>> = { campaigns: [], selected: null }
  if (process.env.DATABASE_URL) {
    const { pool } = createDatabase(process.env.DATABASE_URL)
    try { context = await getCampaignContext(pool) } catch { context = { campaigns: [], selected: null } } finally { await pool.end() }
  }
  const flags = getFlags()
  const session = { name: process.env.NEXT_PUBLIC_USER_NAME || 'Usuário', role: 'actor' }
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-nav" href="#main-content">Pular para o conteúdo principal</a>
        <FeatureFlagProvider flags={flags}>
          <TooltipProvider>
            <CommandPalette>
              <SessionProvider session={session}>
                <AppShell campaigns={context.campaigns} selectedCampaignId={context.selected?.id ?? null}>
                  <Suspense fallback={<div style={{padding: 24}}>Carregando interface...</div>}>{children}</Suspense>
                </AppShell>
              </SessionProvider>
              <ToastProvider />
            </CommandPalette>
          </TooltipProvider>
        </FeatureFlagProvider>
      </body>
    </html>
  )
}
