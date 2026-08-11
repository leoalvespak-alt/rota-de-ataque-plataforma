import { toast } from 'sonner'
import { useAIStore } from '@/stores/useAIStore'
import { Switch } from '@/components/ui/switch'
import { HeaderSecondaryButton } from '@/app/HeaderButtons'

/** Espelha buildModelsList()/toggleModel()/deleteModel() do Gerador/index.html original (linhas 4011-4101). */
export function ModelsList({ onEdit }: { onEdit: (id: string) => void }) {
  const models = useAIStore((s) => s.models)
  const toggleModel = useAIStore((s) => s.toggleModel)
  const deleteModel = useAIStore((s) => s.deleteModel)

  if (models.length === 0) {
    return <div className="text-xs text-ui-muted">Nenhum modelo configurado.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {models.map((m) => (
        <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2.5">
          <Switch
            className="shrink-0"
            checked={m.enabled}
            onCheckedChange={() => {
              const ok = toggleModel(m.id)
              if (!ok) toast.error('Mantenha ao menos 1 modelo habilitado.')
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-ui-text">{m.label}</div>
            <div className="mt-0.5 text-[11px] text-ui-muted">
              {m.model} · {m.provider}
            </div>
          </div>
          <HeaderSecondaryButton className="shrink-0 px-2.5 py-1 text-[11px]" onClick={() => onEdit(m.id)}>
            Editar
          </HeaderSecondaryButton>
          <button
            className="shrink-0 rounded-md border border-brand-red/25 bg-brand-red/10 px-2.5 py-1 text-[11px] text-brand-red"
            onClick={() => {
              const ok = deleteModel(m.id)
              if (!ok) toast.error('Mantenha ao menos 1 modelo habilitado.')
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
