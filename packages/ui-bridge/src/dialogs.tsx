'use client'

import React, { type ReactNode, useState, useRef, useEffect, useCallback, createContext, useContext, useId } from 'react'
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
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement as HTMLElement | null
    const focusable = 'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>(focusable)?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onOpenChange(false); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusable))
      if (!elements.length) { event.preventDefault(); dialogRef.current.focus(); return }
      const first = elements[0]!
      const last = elements[elements.length - 1]!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus() }
  }, [onOpenChange, open])
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
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
        tabIndex={-1}
        className="bridge-alert-content"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 301,
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg, 0.75rem)',
          padding: 'var(--space-6, 1.5rem)',
          width: 'min(25rem, 90vw)',
          maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <h2 id={titleId} className="bridge-alert-title" style={{ margin: '0 0 var(--space-2, 0.5rem)' }}>{title}</h2>
        <p id={descriptionId} className="bridge-alert-description" style={{ margin: '0 0 var(--space-5, 1.25rem)', color: 'var(--text-secondary)' }}>
          {description}
        </p>
        <div className="bridge-alert-actions" style={{ display: 'flex', gap: 'var(--space-2, 0.5rem)', justifyContent: 'flex-end' }}>
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
  busy = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** Prevents accidental close while a mutation is in flight. */
  busy?: boolean
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = 'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const focusFirst = () => dialogRef.current?.querySelector<HTMLElement>(focusable)?.focus()
    const timer = window.setTimeout(focusFirst, 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) onOpenChange(false); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusable))
      if (!elements.length) { event.preventDefault(); dialogRef.current.focus(); return }
      const first = elements[0]!
      const last = elements[elements.length - 1]!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [busy, onOpenChange, open])
  if (!open) return null
  return (
    <>
      <div
        className="bridge-dialog-overlay"
        onClick={() => { if (!busy) onOpenChange(false) }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        ref={dialogRef}
        tabIndex={-1}
        className="bridge-dialog-content"
      >
        <header className="bridge-dialog-header">
          {title && <h2 id={titleId}>{title}</h2>}
          <button aria-label="Fechar" disabled={busy} onClick={() => onOpenChange(false)} className="bridge-dialog-close">×</button>
        </header>
        <div className="bridge-dialog-body">{children}</div>
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

interface TabsCtx { active: string; setActive: (v: string) => void; listId: string }
const TabsContext = createContext<TabsCtx>({ active: '', setActive: () => {}, listId: 'tabs' })

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultValue)
  const listId = useId()
  return <TabsContext.Provider value={{ active, setActive, listId }}>{React.Children.toArray(children)}</TabsContext.Provider>
}

export function TabsList({ children }: { children: ReactNode }) {
  const { listId } = useContext(TabsContext)
  return <div id={listId} role="tablist" aria-label="Seções" style={{ display: 'flex', gap: 'var(--space-1, 0.25rem)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-4, 1rem)' }}>{children}</div>
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { active, setActive, listId } = useContext(TabsContext)
  const isActive = active === value
  const tabId = `${listId}-tab-${value}`
  const panelId = `${listId}-panel-${value}`
  return (
    <button
      id={tabId}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActive(value)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
        event.preventDefault()
        const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
        const index = tabs.indexOf(event.currentTarget)
        const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
        next?.focus()
        if (next) setActive(next.dataset.value ?? value)
      }}
      data-value={value}
      style={{
        padding: 'var(--space-2, 0.5rem) var(--space-4, 1rem)', border: 'none', cursor: 'pointer', background: 'transparent',
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
  const { active, listId } = useContext(TabsContext)
  if (active !== value) return null
  return <div id={`${listId}-panel-${value}`} role="tabpanel" aria-labelledby={`${listId}-tab-${value}`}>{children}</div>
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
