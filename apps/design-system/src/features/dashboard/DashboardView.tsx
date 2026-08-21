import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/useUiStore'
import { useWizardStore } from '@/stores/useWizardStore'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api/client'
import {
  Plus,
  FolderOpen,
  Clock,
  CheckCircle2,
  Layers3,
  Image,
  RectangleVertical,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { CreativeProjectStatus } from '@/db/schema'

interface ProjectItem {
  id: string
  title: string
  status: CreativeProjectStatus
  format: string | null
  templateId: string | null
  cardCount: number | null
  createdAt: string
  updatedAt: string
  wizardData?: Record<string, unknown>
  wizardStep?: number
}

const STATUS_CONFIG: Record<CreativeProjectStatus, { label: string; color: string; Icon: typeof FolderOpen }> = {
  nao_iniciado: { label: 'Não Iniciado', color: 'text-ui-muted', Icon: FolderOpen },
  em_andamento: { label: 'Em Andamento', color: 'text-amber-500', Icon: Clock },
  finalizado: { label: 'Finalizado', color: 'text-emerald-500', Icon: CheckCircle2 },
}

function ProjectCard({ project, onDelete }: { project: ProjectItem; onDelete: (id: string) => void }) {
  const setTab = useUiStore((s) => s.setTab)
  const loadWizardData = useWizardStore((s) => s.loadWizardData)
  const { label, color, Icon } = STATUS_CONFIG[project.status]

  const handleContinue = async () => {
    try {
      // Usar os dados da lista ou buscar detalhes completos se precisar
      const data = await apiFetch<ProjectItem>(`/projects/${project.id}`)
      if (data.wizardData) {
        loadWizardData({
          ...data.wizardData,
          step: (data.wizardStep ?? (data.wizardData.step as number | undefined) ?? 1) as import('@/stores/useWizardStore').WizardStep,
          projectId: project.id
        })
      } else {
        // Se não tiver wizardData (projetos antigos?), tentamos inicializar o básico
        loadWizardData({
          projectId: project.id,
          step: 1 as const
        })
      }
      setTab('wizard')
    } catch (err) {
      console.error('Failed to load project details', err)
    }
  }

  return (
    <div className="group flex items-center justify-between rounded-xl border border-ui-border bg-ui-panel p-4 transition-all hover:border-brand-red/30 hover:shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg bg-ui-panel2', color)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ui-text">{project.title}</h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ui-muted">
            <span className={cn('font-medium', color)}>{label}</span>
            {project.format && (
              <>
                <span className="text-ui-border">·</span>
                <span className="capitalize">{project.format}</span>
              </>
            )}
            {project.cardCount && project.cardCount > 1 && (
              <>
                <span className="text-ui-border">·</span>
                <span>{project.cardCount} cards</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {project.status !== 'finalizado' && (
          <button
            onClick={handleContinue}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-red-hover"
          >
            <Pencil className="size-3.5" />
            Continuar
          </button>
        )}
        <button
          onClick={() => onDelete(project.id)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-ui-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

function StatusSection({
  status,
  projects,
  onDelete,
}: {
  status: CreativeProjectStatus
  projects: ProjectItem[]
  onDelete: (id: string) => void
}) {
  const { label, color, Icon } = STATUS_CONFIG[status]
  const filtered = projects.filter((p) => p.status === status)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('size-4', color)} />
        <h2 className="text-sm font-semibold text-ui-text">{label}</h2>
        <span className="rounded-full bg-ui-panel2 px-2 py-0.5 text-xs text-ui-muted">
          {filtered.length}
        </span>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ui-border p-6 text-center text-sm text-ui-muted">
          Nenhum projeto {label.toLowerCase()}.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

const CREATIVE_TYPES = [
  { id: 'post' as const, label: 'Post Estático', desc: 'Imagem única para feed', Icon: Image },
  { id: 'carousel' as const, label: 'Carrossel', desc: 'Série de slides deslizáveis', Icon: Layers3 },
  { id: 'story' as const, label: 'Story', desc: 'Formato vertical 9:16', Icon: RectangleVertical },
]

export function DashboardView() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const setTab = useUiStore((s) => s.setTab)
  const startWizard = useWizardStore((s) => s.startWizard)
  const setCreativeType = useWizardStore((s) => s.setCreativeType)

  useEffect(() => {
    apiFetch<ProjectItem[]>('/projects')
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' }).catch(() => null)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  const handleNewCreative = (type: typeof CREATIVE_TYPES[number]['id']) => {
    startWizard()
    setCreativeType(type)
    setTab('wizard')
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ui-text font-heading">Gerador de Criativos</h1>
          <p className="mt-1 text-sm text-ui-muted">
            Crie posts, carrosséis e stories para as redes sociais da Rota de Ataque.
          </p>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {CREATIVE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleNewCreative(type.id)}
              className="group flex items-center gap-4 rounded-xl border border-ui-border bg-ui-panel p-5 text-left transition-all hover:border-brand-red hover:shadow-md"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red transition-colors group-hover:bg-brand-red group-hover:text-white">
                <type.Icon className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ui-text">{type.label}</span>
                  <ArrowRight className="size-3.5 text-ui-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-red" />
                </div>
                <p className="mt-0.5 text-xs text-ui-muted">{type.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ui-text font-heading">Meus Projetos</h2>
          <button
            onClick={() => handleNewCreative('post')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red-hover"
          >
            <Plus className="size-4" />
            Nova Criação
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-ui-muted">Carregando projetos…</div>
        ) : (
          <div className="space-y-8">
            <StatusSection status="em_andamento" projects={projects} onDelete={handleDelete} />
            <StatusSection status="nao_iniciado" projects={projects} onDelete={handleDelete} />
            <StatusSection status="finalizado" projects={projects} onDelete={handleDelete} />
          </div>
        )}
      </div>
    </div>
  )
}
