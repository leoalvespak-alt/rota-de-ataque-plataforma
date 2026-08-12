'use client'
import React, { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Copy, MoreVertical, Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'icon-only'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-variant={variant}
        data-size={size}
        disabled={loading || disabled}
        className="bridge-button"
        {...props}
      >
        {loading && <Loader2 className="animate-spin" size={16} />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export interface IconButtonProps extends Omit<ButtonProps, 'variant'> {
  icon: React.ElementType
  label: string
  tooltip?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, tooltip = true, ...props }, ref) => {
    return (
      <Button ref={ref} variant="icon-only" aria-label={label} title={tooltip ? label : undefined} {...props}>
        <Icon size={16} />
      </Button>
    )
  }
)
IconButton.displayName = 'IconButton'

export interface AsyncButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>
}

export const AsyncButton = ({ onClick, ...props }: AsyncButtonProps) => {
  const [isPending, setIsPending] = useState(false)
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPending) return
    setIsPending(true)
    try {
      await onClick(e)
    } finally {
      setIsPending(false)
    }
  }
  return <Button loading={isPending} onClick={handleClick} {...props} />
}

export const ActionMenu = ({ trigger, children }: { trigger?: ReactNode; children: ReactNode }) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      {trigger || <IconButton icon={MoreVertical} label="Mais ações" />}
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="bridge-dropdown-content" sideOffset={4}>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
)

export const SplitButton = ({ primaryAction, primaryLabel, children }: { primaryAction: () => void; primaryLabel: ReactNode; children: ReactNode }) => (
  <div className="bridge-split-button">
    <Button onClick={primaryAction}>{primaryLabel}</Button>
    <ActionMenu trigger={<Button variant="primary" style={{ padding: '0 8px' }}>▾</Button>}>
      {children}
    </ActionMenu>
  </div>
)

export const CopyButton = ({ text, label = 'Copiar' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copiado!' : label}
      onClick={handleCopy}
    />
  )
}
