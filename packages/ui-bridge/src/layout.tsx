'use client'
import React, { type ReactNode, useState } from 'react'
import { AlertCircle, CheckCircle2, Lock, Unlock, HelpCircle, Info } from 'lucide-react'
import { Drawer } from './dialogs'
import { Button } from './primitives'
import { ResourceHelpDrawer, type HelpContentData } from './help'

export const PageHeader = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  helpContent
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
  helpContent?: HelpContentData
}) => {
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpTab, setHelpTab] = useState<'how-to' | 'about'>('how-to')

  const openHelp = (tab: 'how-to' | 'about') => {
    setHelpTab(tab)
    setHelpOpen(true)
  }

  return (
    <>
      <header className="bridge-page-header">
        <div className="bridge-page-header-title-area">
          {breadcrumbs && <nav aria-label="Breadcrumbs">{breadcrumbs}</nav>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
          {helpContent && (
            <div className="bridge-page-header-help">
              <Button variant="quiet" size="sm" onClick={() => openHelp('how-to')}>
                <HelpCircle size={14} style={{ marginRight: '4px' }} />
                Como usar
              </Button>
              <Button variant="quiet" size="sm" onClick={() => openHelp('about')}>
                <Info size={14} style={{ marginRight: '4px' }} />
                Sobre
              </Button>
            </div>
          )}
        </div>
        {actions && <div className="bridge-page-header-actions">{actions}</div>}
      </header>
      
      {helpContent && (
        <ResourceHelpDrawer 
          open={helpOpen} 
          onClose={() => setHelpOpen(false)} 
          content={helpContent} 
          defaultTab={helpTab} 
        />
      )}
    </>
  )
}

export const IntegrationGate = ({ 
  connected, 
  integrationName, 
  fallback, 
  children 
}: { 
  connected: boolean
  integrationName: string
  fallback?: ReactNode
  children: ReactNode 
}) => {
  if (connected) return <>{children}</>
  return (
    <div className="bridge-integration-gate">
      <AlertCircle size={24} />
      <h3>{integrationName} não conectada</h3>
      {fallback}
    </div>
  )
}

export const PermissionGate = ({ 
  hasPermission, 
  fallback, 
  children 
}: { 
  hasPermission: boolean
  fallback?: ReactNode
  children: ReactNode 
}) => {
  if (hasPermission) return <>{children}</>
  return (
    <div className="bridge-permission-gate">
      <Lock size={24} />
      <p>Você não tem permissão para ver este conteúdo.</p>
      {fallback}
    </div>
  )
}



export const DetailDrawer = ({ 
  open, 
  onClose, 
  title, 
  children,
  footer
}: { 
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) => (
  <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
    <div className="bridge-detail-drawer">
      <header>
        <h2>{title}</h2>
      </header>
      <div className="bridge-detail-drawer-content">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </Drawer>
)

export const KpiRow = ({ children }: { children: ReactNode }) => (
  <section className="bridge-kpi-row">
    {children}
  </section>
)

export const ThreePaneLayout = ({ list, detail, context }: { list: ReactNode; detail: ReactNode; context: ReactNode }) => {
  const [activePane, setActivePane] = useState<'list' | 'detail' | 'context'>('list')
  return (
    <div className={`bridge-three-pane responsive-pane-active-${activePane}`}>
      <aside className={`pane-list ${activePane === 'list' ? 'active' : ''}`}>{list}</aside>
      <main className={`pane-detail ${activePane === 'detail' ? 'active' : ''}`}>{detail}</main>
      <aside className={`pane-context ${activePane === 'context' ? 'active' : ''}`}>{context}</aside>
      
      <div className="bridge-three-pane-mobile-nav">
        <button type="button" className={activePane === 'list' ? 'active' : ''} onClick={() => setActivePane('list')}>Lista</button>
        <button type="button" className={activePane === 'detail' ? 'active' : ''} onClick={() => setActivePane('detail')}>Detalhe</button>
        <button type="button" className={activePane === 'context' ? 'active' : ''} onClick={() => setActivePane('context')}>Contexto</button>
      </div>
    </div>
  )
}
