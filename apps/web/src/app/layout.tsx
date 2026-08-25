export const dynamic = 'force-dynamic';
import type { Metadata } from 'next'
import { createDatabase } from '@plataforma/db'
import { AppShell } from '@/components/AppShell'
import { CommandPalette } from '@/components/CommandPalette'
import { FeatureFlagProvider } from '@/components/FeatureFlagProvider'
import { Suspense } from 'react'
import { getCampaignContext } from '@/lib/campaign-context'
import { getFlags } from '@/lib/feature-flags'
import '@plataforma/ui-bridge/styles.css'
import './globals.css'

export const metadata: Metadata = { title: 'Plataforma Rota de Ataque', description: 'Gestão de redes sociais e prospecção ativa' }

import { TooltipProvider, ToastProvider } from '@plataforma/ui-bridge'

import { SessionProvider } from '@/components/SessionProvider'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UiModeProvider } from '@/components/UiModeProvider'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let context: Awaited<ReturnType<typeof getCampaignContext>> = { campaigns: [], selected: null }
  if (process.env.DATABASE_URL) {
    const { pool } = createDatabase(process.env.DATABASE_URL)
    try { context = await getCampaignContext(pool) } catch { context = { campaigns: [], selected: null } } finally {}
  }
const flags = getFlags()
  const authenticated = await getServerSession(authOptions)
  const localBootstrap = process.env.AUTH_BOOTSTRAP_VIEWER === 'true'
    && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
  const session = authenticated?.user
    ? { name: authenticated.user.name ?? authenticated.user.email ?? 'Usuário', role: authenticated.user.role }
    : localBootstrap
      ? { name: 'Visualização local', role: 'viewer' as const }
      : null
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-nav" href="#main-content">Pular para o conteúdo principal</a>
        <FeatureFlagProvider flags={flags}>
          <TooltipProvider>
            <UiModeProvider>
              <CommandPalette>
                <SessionProvider session={session ?? { name: 'Sessão indisponível', role: 'viewer' as const }}>
                  <AppShell campaigns={context.campaigns} selectedCampaignId={context.selected?.id ?? null}>
                    <Suspense fallback={<div style={{padding: 24}}>Carregando interface...</div>}>{children}</Suspense>
                  </AppShell>
                </SessionProvider>
                <ToastProvider />
              </CommandPalette>
            </UiModeProvider>
          </TooltipProvider>
        </FeatureFlagProvider>
      </body>
    </html>
  )
}
