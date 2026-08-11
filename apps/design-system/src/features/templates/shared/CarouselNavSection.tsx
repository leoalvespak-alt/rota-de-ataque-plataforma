import { useSeriesStore } from '@/stores/useSeriesStore'

/**
 * Espelha carouselNavSection() do Gerador/index.html (linha 2858) — já com o texto
 * corrigido pela auditoria (item 5): orienta o Modo Série como fluxo principal em vez
 * de "baixe cada slide separadamente" (texto antigo, contraditório com o recurso já
 * existente de exportação em .zip).
 */
export function CarouselNavSection() {
  const seriesMode = useSeriesStore((s) => s.seriesMode)
  const toggleSeriesMode = useSeriesStore((s) => s.toggleSeriesMode)

  return (
    <div className="border-b border-ui-border px-4 py-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase">
        Slides do Carrossel
      </div>
      {!seriesMode ? (
        <>
          <button
            className="w-full justify-center rounded-lg bg-brand-red px-5 py-2 font-heading text-sm font-bold tracking-wide text-white uppercase transition hover:bg-brand-red-hover"
            onClick={toggleSeriesMode}
          >
            ☰ Ativar Modo Série
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-ui-muted">
            Ative o Modo Série para montar cada slide (Capa, Slide, CTA) em sequência e
            exportar tudo de uma vez em um único .zip.
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-ui-muted">
          Modo Série ativo — use a barra acima do card para adicionar e navegar entre os
          slides. Para baixar tudo em .zip, abra o menu de carrossel no topo.
        </p>
      )}
    </div>
  )
}
