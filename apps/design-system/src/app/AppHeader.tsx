import { useEditorStore, ZOOM_LEVELS } from '@/stores/useEditorStore'
import { useUiStore, type AppTab } from '@/stores/useUiStore'
import { useSeriesStore } from '@/stores/useSeriesStore'
import { useWizardStore } from '@/stores/useWizardStore'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HeaderPrimaryButton, HeaderSecondaryButton } from './HeaderButtons'
import { useSeriesExport } from '@/features/series/useSeriesExport'
import { ProjectSessionControls } from '@/features/projects/ProjectSessionControls'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ArrowLeft,
  Download,
  LayoutDashboard,
  Layers3,
  Package,
  PanelLeft,
  PanelRight,
  Redo2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Moon,
  Sun,
  Undo2,
} from 'lucide-react'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'dashboard', label: 'Início' },
  { id: 'brand', label: 'Marca' },
  { id: 'ai-config', label: 'IA' },
  { id: 'renders', label: 'Renders' },
  { id: 'history', label: 'Histórico' },
  { id: 'editorial', label: 'Teses' },
]

export function AppHeader({ onDownload, onSave }: { onDownload: () => void; onSave: () => void }) {
  const activeTab = useUiStore((s) => s.activeTab)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const setTab = useUiStore((s) => s.setTab)
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel)
  const format = useEditorStore((s) => s.format)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const resetCard = useEditorStore((s) => s.resetCard)
  const undo = useEditorStore.temporal.getState().undo
  const redo = useEditorStore.temporal.getState().redo
  const seriesMode = useSeriesStore((s) => s.seriesMode)
  const toggleSeriesMode = useSeriesStore((s) => s.toggleSeriesMode)
  const seriesSlidesCount = useSeriesStore((s) => s.slides.length)
  const { exportSeriesZIP } = useSeriesExport()
  const wizardActive = useWizardStore((s) => s.active)
  const wizardStep = useWizardStore((s) => s.step)

  const isInCreateFlow = activeTab === 'create' || activeTab === 'wizard'

  return (
    <header className="relative z-50 flex min-h-13 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-ui-border bg-ui-panel px-3 py-2 lg:px-5">
      <div className="flex min-w-0 items-center">
        <img
          src={theme === 'dark'
            ? '/logos/01 LOGO ATAQUE - SEM FUNDO.png'
            : '/logos/03 LOGO ATAQUE - SEM FUNDO.png'}
          alt="Ataque"
          className="h-8 w-auto max-w-36 object-contain sm:h-9 sm:max-w-40"
        />
      </div>

      <div className="hidden h-6.5 w-px bg-ui-border md:block" />

      {!isInCreateFlow && <ProjectSessionControls />}

      {isInCreateFlow && (
        <button
          onClick={() => setTab('dashboard')}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-ui-text"
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao Início
        </button>
      )}

      {activeTab === 'wizard' && wizardActive && (
        <div className="flex items-center gap-1.5 text-xs text-ui-muted">
          <LayoutDashboard className="size-3.5" />
          <span>Passo {wizardStep} de 5</span>
        </div>
      )}

      <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto" aria-label="Abas principais">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 font-sans text-[13px] font-medium whitespace-nowrap text-ui-muted transition-all hover:bg-ui-panel2 hover:text-ui-text lg:px-4',
              activeTab === tab.id && 'bg-ui-panel2 text-ui-text',
            )}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <HeaderSecondaryButton
        title={theme === 'dark' ? 'Usar modo claro' : 'Usar modo escuro'}
        aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        className="ml-auto size-9 px-0"
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </HeaderSecondaryButton>

      {activeTab === 'create' && (
        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Popover>
              <PopoverTrigger
                aria-label="Abrir opções de visualização"
                title="Visualização e painéis"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-ui-border bg-ui-panel2 text-ui-text transition-colors hover:border-brand-red hover:text-brand-red"
              >
                <SlidersHorizontal className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="border border-ui-border bg-ui-panel text-ui-text">
                <div>
                  <div className="text-xs font-semibold">Visualização</div>
                  <div className="mt-0.5 text-[10px] text-ui-muted">
                    {format === 'portrait' ? 'Retrato 1080×1920' : 'Quadrado 1080×1080'}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-3 text-xs text-ui-muted">
                  Zoom
                  <Select value={String(zoom)} onValueChange={(v) => setZoom(Number(v) as never)}>
                    <SelectTrigger className="w-24 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ZOOM_LEVELS.map((z) => (
                        <SelectItem key={z} value={String(z)}>{Math.round(z * 100)}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={toggleLeftPanel} className="flex items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-2 py-2 text-xs hover:border-brand-red hover:text-brand-red">
                    <PanelLeft className="size-4" /> Biblioteca
                  </button>
                  <button type="button" onClick={toggleRightPanel} className="flex items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-2 py-2 text-xs hover:border-brand-red hover:text-brand-red">
                    <PanelRight className="size-4" /> Ajustes
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger
                aria-label="Abrir opções do carrossel"
                title="Opções do carrossel"
                className={cn(
                  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border bg-ui-panel2 text-ui-text transition-colors hover:border-brand-red hover:text-brand-red',
                  seriesMode ? 'border-brand-red text-brand-red' : 'border-ui-border',
                )}
              >
                <Layers3 className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="border border-ui-border bg-ui-panel text-ui-text">
                <div>
                  <div className="text-xs font-semibold">Carrossel</div>
                  <div className="mt-0.5 text-[10px] text-ui-muted">Criação e exportação da série de cards.</div>
                </div>
                <HeaderSecondaryButton active={seriesMode} onClick={toggleSeriesMode} className="w-full justify-start">
                  <Layers3 className="size-4" /> {seriesMode ? 'Sair do modo série' : 'Ativar modo série'}
                </HeaderSecondaryButton>
                {seriesSlidesCount > 0 && (
                  <HeaderPrimaryButton title="Exportar série" onClick={exportSeriesZIP} className="w-full justify-start">
                    <Package className="size-4" /> Exportar série em ZIP
                  </HeaderPrimaryButton>
                )}
              </PopoverContent>
            </Popover>

            <HeaderSecondaryButton
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer"
              className="hidden px-0 lg:inline-flex lg:size-9"
              onClick={() => undo()}
            >
              <Undo2 className="size-4" />
            </HeaderSecondaryButton>
            <HeaderSecondaryButton
              title="Refazer (Ctrl+Y)"
              aria-label="Refazer"
              className="hidden px-0 lg:inline-flex lg:size-9"
              onClick={() => redo()}
            >
              <Redo2 className="size-4" />
            </HeaderSecondaryButton>
            <HeaderSecondaryButton
              title="Resetar arte"
              aria-label="Resetar arte"
              className="hidden px-0 lg:inline-flex lg:size-9"
              onClick={resetCard}
            >
              <RotateCcw className="size-4" />
            </HeaderSecondaryButton>
            <HeaderSecondaryButton title="Salvar arte" aria-label="Salvar arte" className="hidden px-0 sm:inline-flex sm:size-9" onClick={onSave}>
              <Save className="size-4" />
            </HeaderSecondaryButton>
            <HeaderPrimaryButton title="Baixar PNG" aria-label="Baixar PNG" className="size-9 px-0" onClick={onDownload}>
              <Download className="size-4" />
            </HeaderPrimaryButton>
          </div>
        </div>
      )}

      {activeTab === 'brand' && (
        <span className="ml-auto rounded-full border border-brand-red/30 bg-ui-panel2 px-3 py-1 text-xs text-brand-red">
          Guia de Identidade Visual
        </span>
      )}
    </header>
  )
}
