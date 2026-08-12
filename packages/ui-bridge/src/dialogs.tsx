'use client'

import React, { type ReactNode, useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

// Tooltip is the canonical wrapper exported from feedback.tsx
// We export the raw Radix primitive under a different name for advanced use
export { TooltipPrimitive as RadixTooltip }

// ─── Drawer ──────────────────────────────────────────────────────────────────
// Implemented with a dialog element (native) for minimal deps

export function Drawer({
  open,
  onOpenChange,
  children,
  trigger,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  trigger?: ReactNode
}) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onOpenChange?.(false)
  }, [onOpenChange])

  return (
    <>
      {trigger && (
        <span onClick={() => onOpenChange?.(!open)} style={{ display: 'contents' }}>
          {trigger}
        </span>
      )}
      {open && (
        <div
          className="bridge-drawer-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }}
          onClick={() => onOpenChange?.(false)}
          aria-hidden
        />
      )}
      <div
        role="dialog"
        aria-modal={open}
        className="bridge-drawer-content"
        onKeyDown={handleKeyDown}
        style={{
          position: 'fixed',
          top: 0, left: 0, height: '100vh',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          zIndex: 201,
          background: 'var(--surface-card)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
          overflowY: 'auto',
        }}
      >
        {children}
        <button
          className="bridge-drawer-close"
          aria-label="Fechar"
          onClick={() => onOpenChange?.(false)}
          style={{ position: 'absolute', top: 12, right: 12 }}
        >
          ×
        </button>
      </div>
    </>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'primary',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  variant?: 'primary' | 'danger'
}) {
  if (!open) return null
  return (
    <>
      <div
        className="bridge-alert-overlay"
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)' }}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="bridge-alert-content"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 301,
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          width: '400px',
          maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <h2 id="confirm-dialog-title" className="bridge-alert-title" style={{ margin: '0 0 8px' }}>{title}</h2>
        <p id="confirm-dialog-desc" className="bridge-alert-description" style={{ margin: '0 0 20px', color: 'var(--text-secondary)' }}>
          {description}
        </p>
        <div className="bridge-alert-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            className="bridge-button"
            data-variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </button>
          <button
            className="bridge-button"
            data-variant={variant}
            onClick={() => { onConfirm(); onOpenChange(false) }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Dialog (simple modal) ────────────────────────────────────────────────────

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)' }}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 301,
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        {title && <h2 style={{ margin: '0 0 16px' }}>{title}</h2>}
        {children}
        <button
          aria-label="Fechar"
          onClick={() => onOpenChange(false)}
          style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}
        >
          ×
        </button>
      </div>
    </>
  )
}

// ─── AlertDialog ──────────────────────────────────────────────────────────────
export const AlertDialog = ConfirmDialog

// ─── Popover ─────────────────────────────────────────────────────────────────

export function Popover({
  trigger,
  children,
  align = 'start',
}: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end' | 'center'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={() => setOpen(v => !v)} style={{ display: 'contents', cursor: 'pointer' }}>
        {trigger}
      </span>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'end' ? { right: 0 } : align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { left: 0 }),
            zIndex: 100,
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            minWidth: '200px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabsCtx { active: string; setActive: (v: string) => void }
const TabsContext = createContext<TabsCtx>({ active: '', setActive: () => {} })

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultValue)
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>
}

export function TabsList({ children }: { children: ReactNode }) {
  return <div role="tablist" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>{children}</div>
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { active, setActive } = useContext(TabsContext)
  const isActive = active === value
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      style={{
        padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
        borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const { active } = useContext(TabsContext)
  if (active !== value) return null
  return <div role="tabpanel">{children}</div>
}

// ─── DropdownMenu ─────────────────────────────────────────────────────────────

export function DropdownMenu({
  trigger,
  children,
}: {
  trigger: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={() => setOpen(v => !v)} style={{ display: 'contents', cursor: 'pointer' }}>
        {trigger}
      </span>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0,
            zIndex: 100,
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: '160px',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownMenuItem({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 16px', border: 'none', cursor: 'pointer',
        background: 'transparent', color: 'var(--text-primary)', fontSize: '14px',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}
