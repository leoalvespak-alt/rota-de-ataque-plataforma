import html2canvas from 'html2canvas-pro'

export interface ExportOptions {
  scale?: number
  backgroundColor?: string | null
}

/**
 * FASE 7 — ponto de risco #2 do plano de migração (timing do html2canvas com re-renders
 * do React). A causa raiz do problema no mundo React é capturar um nó que ainda está no
 * meio de um commit/paint, ou cujas fontes/imagens não terminaram de carregar.
 *
 * Esta função assume que o CALLER já garantiu que `node` está fora da tela, em escala 1:1
 * real (nunca afetado pelo zoom do editor) — ver `useExportCard` para a orquestração
 * completa (flushSync -> fonts.ready -> img.decode() -> duplo rAF -> captura).
 */
export async function captureNodeAsPNG(node: HTMLElement, opts: ExportOptions = {}): Promise<Blob> {
  const canvas = await html2canvas(node, {
    scale: opts.scale ?? 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: opts.backgroundColor ?? null,
    logging: false,
    width: node.offsetWidth,
    height: node.offsetHeight,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Falha ao gerar blob do canvas.'))
    }, 'image/png')
  })
}

/**
 * Sequência determinística de captura — chamada depois que o node de export já está
 * montado com o conteúdo final:
 * 1. `document.fonts.ready` — fontes self-hosted (@fontsource) tornam isso confiável;
 *    com Google Fonts via CDN isso é flaky (ver PLANO_MIGRACAO_REACT.md §6.2).
 * 2. `img.decode()` em todas as imagens do node — garante que uploads/imagens de IA
 *    já estão decodificadas antes da captura (evita PNG com imagem em branco).
 * 3. Duplo `requestAnimationFrame` — garante que o navegador já pintou o frame atual
 *    antes de fotografá-lo.
 */
export async function waitForRenderReady(node: HTMLElement): Promise<void> {
  await document.fonts.ready

  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    images.map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())),
  )

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}
