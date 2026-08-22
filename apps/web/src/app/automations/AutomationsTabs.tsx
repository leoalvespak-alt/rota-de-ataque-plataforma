'use client'

import { PageHeader } from '@plataforma/ui-bridge'
import { MotoresTab } from './components/MotoresTab'
import { WorkersTab, type WorkerInfo } from './components/WorkersTab'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

type TabValue = 'motores' | 'workers' | 'filas' | 'agendamentos'

export function AutomationsTabs({ workers }: { workers: WorkerInfo[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const activeTab = (searchParams.get('tab') as TabValue) || 'motores'

  const setActiveTab = (tab: TabValue) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'motores') params.delete('tab')
    else params.set('tab', tab)
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  const tabs: Array<{ id: TabValue; label: string }> = [
    { id: 'motores', label: 'Motores' },
    { id: 'workers', label: 'Workers (Avançado)' },
    { id: 'filas', label: 'Filas (Redis)' },
    { id: 'agendamentos', label: 'Agendamentos' },
  ]

  return (
    <main className="bridge-page-content">
      <PageHeader 
        title="Automações" 
        subtitle="Gerencie os motores do Prospector, workers individuais e saúde das filas." 
      />

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              marginBottom: '-1px', // Para sobrepor a borda do container
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      {activeTab === 'motores' && <MotoresTab />}
      {activeTab === 'workers' && <WorkersTab workers={workers} />}
      {activeTab === 'filas' && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          Interface de Filas do BullMQ (Mantida da v1)
        </div>
      )}
      {activeTab === 'agendamentos' && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          Interface de Agendamentos do Postgres (Mantida da v1)
        </div>
      )}
    </main>
  )
}
