'use client'
import React, { type ReactNode } from 'react'
import { Toaster, toast } from 'sonner'

export const ToastProvider = () => {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: 'bridge-toast',
      }}
    />
  )
}

export { toast }

export const KpiSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="bridge-kpi-skeleton-group" style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bridge-skeleton" style={{ flex: 1, minWidth: '200px', height: '100px', borderRadius: 'var(--radius-lg)' }} />
    ))}
  </div>
)

export const TableSkeleton = ({ rows = 10, columns = 5 }: { rows?: number; columns?: number }) => (
  <div className="bridge-table-skeleton" style={{ width: '100%' }}>
    <div className="bridge-skeleton" style={{ width: '100%', height: '40px', marginBottom: 'var(--space-4)' }} />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
        {Array.from({ length: columns }).map((_, j) => (
          <div key={j} className="bridge-skeleton" style={{ flex: 1, height: '24px' }} />
        ))}
      </div>
    ))}
  </div>
)

export const SidebarSkeleton = () => (
  <div className="bridge-sidebar-skeleton" style={{ width: '320px', height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
    <div className="bridge-skeleton" style={{ width: '60%', height: '24px' }} />
    <div className="bridge-skeleton" style={{ width: '100%', height: '100px' }} />
    <div className="bridge-skeleton" style={{ width: '100%', flex: 1 }} />
  </div>
)

export const ChartSkeleton = ({ height = '300px' }: { height?: string }) => (
  <div className="bridge-chart-skeleton bridge-skeleton" style={{ width: '100%', height, borderRadius: 'var(--radius-lg)' }} />
)

export const LoadingSkeleton = ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) => (
  <React.Suspense fallback={fallback}>
    {children}
  </React.Suspense>
)

import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export const TooltipProvider = TooltipPrimitive.Provider

export const Tooltip = ({ 
  children, 
  content,
  side = 'top'
}: { 
  children: ReactNode; 
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left'
}) => (
  <TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>
      {children}
    </TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content 
        className="bridge-tooltip-content" 
        side={side}
        sideOffset={5}
      >
        {content}
        <TooltipPrimitive.Arrow className="bridge-tooltip-arrow" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
)

export const StatePanel = ({ 
  title, 
  children, 
  actions 
}: { 
  title: string
  children: ReactNode
  actions?: ReactNode 
}) => (
  <section className="bridge-state-panel">
    <header>
      <h2>{title}</h2>
      {actions && <div>{actions}</div>}
    </header>
    <div className="bridge-state-panel-content">{children}</div>
  </section>
)
