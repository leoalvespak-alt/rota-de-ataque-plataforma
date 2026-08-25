'use client'

import { PageHeader } from '@plataforma/ui-bridge'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AutomationsClient, type WorkerInfo } from './AutomationsClient'
import { MotoresTab } from './components/MotoresTab'
import { QueuesTab } from './components/QueuesTab'
import { SchedulesTab } from './components/SchedulesTab'
import { useUiMode } from '@/components/UiModeProvider'
import { useEffect } from 'react'

const tabs = [
  { id: 'motores', label: 'Motores' },
  { id: 'workers', label: 'Workers (Avançado)' },
  { id: 'filas', label: 'Filas (Avançado)' },
  { id: 'agendamentos', label: 'Agendamentos (Avançado)' },
] as const
type TabValue = typeof tabs[number]['id']

function isTab(value: string | null): value is TabValue {
  return tabs.some((tab) => tab.id === value)
}

export function AutomationsTabs({ workers }: { workers: WorkerInfo[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { mode, revealAdvanced } = useUiMode()
  const requestedTab = searchParams.get('aba')
  const activeTab: TabValue = isTab(requestedTab) ? requestedTab : 'motores'
  const visibleTabs = mode === 'advanced' ? tabs : tabs.filter((tab) => tab.id === 'motores')

  useEffect(() => {
    if (activeTab !== 'motores') revealAdvanced()
  }, [activeTab, revealAdvanced])

  function setActiveTab(tab: TabValue) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('aba', tab)
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  function moveTab(index: number, direction: 1 | -1) {
    const next = visibleTabs[(index + direction + visibleTabs.length) % visibleTabs.length]
    if (!next) return
    setActiveTab(next.id)
    requestAnimationFrame(() => document.getElementById(`automation-tab-${next.id}`)?.focus())
  }

  return <div className="bridge-page-content">
    <PageHeader title="Automações" subtitle="Gerencie os motores, workers individuais, filas e agendamentos." />
    <nav role="tablist" aria-label="Seções de automações" className="tabs">
      {visibleTabs.map((tab, index) => <button
        id={`automation-tab-${tab.id}`}
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls={`automation-panel-${tab.id}`}
        tabIndex={activeTab === tab.id ? 0 : -1}
        onClick={() => setActiveTab(tab.id)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(index, 1) }
          if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(index, -1) }
        }}
      >{tab.label}</button>)}
    </nav>
    <div id={`automation-panel-${activeTab}`} role="tabpanel" aria-labelledby={`automation-tab-${activeTab}`}>
      {activeTab === 'motores' && <MotoresTab />}
      {activeTab === 'workers' && <AutomationsClient workers={workers} />}
      {activeTab === 'filas' && <QueuesTab workers={workers} />}
      {activeTab === 'agendamentos' && <SchedulesTab workers={workers} />}
    </div>
  </div>
}
