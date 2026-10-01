import { useEffect } from 'react'
import { useWizardStore, type CreativeType } from '@/stores/useWizardStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { cn } from '@/lib/utils'
import { Image, Layers3, RectangleVertical } from 'lucide-react'

const CREATIVE_TYPES: { id: CreativeType; label: string; desc: string; Icon: typeof Image }[] = [
  { id: 'post', label: 'Post Estático', desc: 'Feed 4:5, 1080×1350 px', Icon: Image },
  { id: 'carousel', label: 'Carrossel', desc: 'Feed 4:5, 1080×1350 px por card', Icon: Layers3 },
  { id: 'story', label: 'Story', desc: 'Formato 9:16, 1080×1920 px', Icon: RectangleVertical },
]

export function WizardStep1Format() {
  const creativeType = useWizardStore((s) => s.creativeType)
  const profileId = useWizardStore((s) => s.profileId)
  const setCreativeType = useWizardStore((s) => s.setCreativeType)
  const setProfileId = useWizardStore((s) => s.setProfileId)

  const { profiles, fetchProfiles, activeProfileId } = useProfileStore()

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  useEffect(() => {
    if (!profileId && activeProfileId) setProfileId(activeProfileId)
  }, [activeProfileId, profileId, setProfileId])

  const selectedProfile = profiles.find((p) => p.id === profileId)

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h2 className="mb-2 text-xl font-bold text-ui-text font-heading">Escolha o Formato</h2>
      <p className="mb-8 text-sm text-ui-muted">
        Selecione o tipo de criativo que deseja produzir.
      </p>

      {profiles.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-2 text-sm font-semibold text-ui-text">Perfil de Marca</h3>
          <div className="flex items-center gap-3">
            <select
              value={profileId ?? ''}
              onChange={(e) => setProfileId(e.target.value || null)}
              className="flex-1 rounded-xl border border-ui-border bg-ui-panel px-4 py-2.5 text-sm text-ui-text focus:border-brand-red focus:outline-none"
            >
              <option value="">Selecione um perfil…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isDefault ? '(Padrão)' : ''}
                </option>
              ))}
            </select>
            {selectedProfile && (
              <div className="flex shrink-0 gap-1.5">
                {[selectedProfile.colorBackground, selectedProfile.colorPrimary, selectedProfile.colorText, selectedProfile.colorButton].map(
                  (color, i) => (
                    <div
                      key={i}
                      className="size-7 rounded-full border border-ui-border/50"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {CREATIVE_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setCreativeType(type.id)}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all',
              creativeType === type.id
                ? 'border-brand-red bg-brand-red/5 shadow-sm'
                : 'border-ui-border bg-ui-panel hover:border-brand-red/40',
            )}
          >
            <div
              className={cn(
                'flex size-14 items-center justify-center rounded-xl',
                creativeType === type.id
                  ? 'bg-brand-red text-white'
                  : 'bg-ui-panel2 text-ui-muted',
              )}
            >
              <type.Icon className="size-7" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ui-text">{type.label}</div>
              <div className="mt-1 text-xs text-ui-muted">{type.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
