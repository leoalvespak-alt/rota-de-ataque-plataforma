'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { NAVIGATION, navigationHref, type NavigationDestination } from '@/lib/navigation'

export function RouteTabs({ destinationId, activeTab, children }: { destinationId: NavigationDestination['id']; activeTab: string; children: ReactNode }) {
  const destination = NAVIGATION.find((item) => item.id === destinationId)
  const refs = useRef<Array<HTMLAnchorElement | null>>([])
  if (!destination) throw new Error(`Destino de navegação desconhecido: ${destinationId}`)

  const visibleTabs = destination.tabs
  return <div className="bridge-page-content">
    <header className="bridge-page-header">
      <div><p className="eyebrow">Rota de Ataque</p><h1>{destination.title}</h1></div>
    </header>
    {visibleTabs.length > 1 && <nav role="tablist" aria-label={`Abas de ${destination.title}`} className="bridge-tabs">
      {visibleTabs.map((tab, index) => <Link
        key={tab.id}
        ref={(element) => { refs.current[index] = element }}
        role="tab"
        id={`${destination.id}-tab-${tab.id}`}
        aria-selected={tab.id === activeTab}
        aria-controls={`${destination.id}-panel-${tab.id}`}
        tabIndex={tab.id === activeTab ? 0 : -1}
        href={navigationHref(destination, tab)}
        onKeyDown={(event) => {
          const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (!delta) return
          event.preventDefault()
          refs.current[(index + delta + visibleTabs.length) % visibleTabs.length]?.focus()
        }}
      >{tab.label_pt}</Link>)}
    </nav>}
    <section id={`${destination.id}-panel-${activeTab}`} role="tabpanel" aria-labelledby={`${destination.id}-tab-${activeTab}`}>
      {children}
    </section>
  </div>
}
