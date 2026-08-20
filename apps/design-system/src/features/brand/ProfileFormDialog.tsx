import { useState } from 'react'
import type { BrandProfile } from '@/db/schema'
import type { ProfileInput } from '@/stores/useProfileStore'
import { X } from 'lucide-react'

const AVAILABLE_FONTS = [
  'Rajdhani',
  'IBM Plex Sans',
  'Space Grotesk',
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
]

interface ProfileFormDialogProps {
  profile?: BrandProfile | null
  onSave: (data: ProfileInput) => Promise<void>
  onClose: () => void
}

const DEFAULT_FORM: ProfileInput = {
  name: '',
  handle: '@',
  colorBackground: '#0A0A0A',
  colorText: '#F0F0F0',
  colorPrimary: '#C1121F',
  colorButton: '#C1121F',
  fontHeading: 'Rajdhani',
  fontBody: 'IBM Plex Sans',
}

export function ProfileFormDialog({ profile, onSave, onClose }: ProfileFormDialogProps) {
  const [form, setForm] = useState<ProfileInput>(() =>
    profile
      ? {
          name: profile.name,
          handle: profile.handle,
          colorBackground: profile.colorBackground,
          colorText: profile.colorText,
          colorPrimary: profile.colorPrimary,
          colorButton: profile.colorButton,
          fontHeading: profile.fontHeading,
          fontBody: profile.fontBody,
          avatarKey: profile.avatarKey ?? undefined,
        }
      : DEFAULT_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    if (!form.handle.trim() || form.handle === '@') { setError('@handle é obrigatório.'); return }
    setError(null)
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-ui-border bg-ui-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ui-border px-6 py-4">
          <h3 className="font-heading text-lg font-bold uppercase text-ui-text">
            {profile ? 'Editar Perfil' : 'Novo Perfil'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ui-muted hover:text-ui-text">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Rota de Ataque"
                  className={inputCls}
                />
              </Field>
              <Field label="@Handle">
                <input
                  type="text"
                  value={form.handle}
                  onChange={(e) => set('handle', e.target.value)}
                  placeholder="@rotadeataque"
                  className={inputCls}
                />
              </Field>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ui-muted">
                Paleta de Cores
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Fundo" value={form.colorBackground} onChange={(v) => set('colorBackground', v)} />
                <ColorField label="Texto" value={form.colorText} onChange={(v) => set('colorText', v)} />
                <ColorField label="Cor Primária" value={form.colorPrimary} onChange={(v) => set('colorPrimary', v)} />
                <ColorField label="Botões" value={form.colorButton} onChange={(v) => set('colorButton', v)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fonte de Títulos">
                <select value={form.fontHeading} onChange={(e) => set('fontHeading', e.target.value)} className={inputCls}>
                  {AVAILABLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Fonte de Corpo">
                <select value={form.fontBody} onChange={(e) => set('fontBody', e.target.value)} className={inputCls}>
                  {AVAILABLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>

            <div className="rounded-xl border border-ui-border bg-ui-panel2 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ui-muted">
                Preview do Canvas
              </div>
              <div
                className="flex h-24 items-center justify-center rounded-lg px-4"
                style={{ backgroundColor: form.colorBackground }}
              >
                <div className="text-center">
                  <div
                    className="text-lg font-bold uppercase tracking-wide"
                    style={{ color: form.colorPrimary, fontFamily: form.fontHeading }}
                  >
                    CONQUISTE SUA APROVAÇÃO
                  </div>
                  <div
                    className="mt-1 text-xs"
                    style={{ color: form.colorText, fontFamily: form.fontBody }}
                  >
                    {form.handle}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-ui-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ui-border px-4 py-2 text-sm text-ui-muted transition-colors hover:border-brand-red hover:text-ui-text"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-hover disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text focus:border-brand-red focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ui-muted">{label}</label>
      {children}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-ui-muted">{label}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xs font-mono text-ui-text focus:outline-none"
        />
      </div>
    </div>
  )
}
