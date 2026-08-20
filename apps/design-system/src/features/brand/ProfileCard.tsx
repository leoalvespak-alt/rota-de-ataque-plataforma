import type { BrandProfile } from '@/db/schema'
import { Pencil, Trash2, Copy } from 'lucide-react'

interface ProfileCardProps {
  profile: BrandProfile
  onEdit: (profile: BrandProfile) => void
  onDelete: (profile: BrandProfile) => void
  onDuplicate: (profile: BrandProfile) => void
}

export function ProfileCard({ profile, onEdit, onDelete, onDuplicate }: ProfileCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-ui-border bg-ui-panel p-4">
      <div className="flex shrink-0 gap-1.5">
        {[profile.colorBackground, profile.colorPrimary, profile.colorText, profile.colorButton].map((color, i) => (
          <div
            key={i}
            className="size-6 rounded-full border border-ui-border/50"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-ui-text">{profile.name}</span>
          {profile.isDefault && (
            <span className="shrink-0 rounded border border-brand-red/30 bg-brand-red/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-red uppercase">
              Padrão
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-ui-muted">{profile.handle}</div>
        <div className="mt-1 text-[11px] text-ui-muted/70">
          {profile.fontHeading} · {profile.fontBody}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onDuplicate(profile)}
          title="Duplicar perfil"
          className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-ui-text"
        >
          <Copy className="size-4" />
        </button>
        <button
          onClick={() => onEdit(profile)}
          title="Editar perfil"
          className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-ui-text"
        >
          <Pencil className="size-4" />
        </button>
        {!profile.isDefault && (
          <button
            onClick={() => onDelete(profile)}
            title="Deletar perfil"
            className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-brand-red"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
