import { Switch } from '@/components/ui/switch'

interface ControlToggleProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * Espelha ctrlToggle() do Gerador/index.html original (linha 2849) — mas usando o
 * Switch acessível do shadcn/Radix em vez do `.toggle-switch` custom.
 * Corrige a auditoria item 3: os toggles de Marca d'Água/Textura/Modelos de IA no HTML
 * original usavam um markup diferente (.toggle-track/.toggle-thumb) sem CSS nenhum —
 * aqui só existe UM componente de toggle no app inteiro.
 */
export function ControlToggle({ label, checked, onCheckedChange }: ControlToggleProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[13px] text-ui-text">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  )
}
