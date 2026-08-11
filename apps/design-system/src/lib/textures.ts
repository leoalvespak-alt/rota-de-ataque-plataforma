import type { TextureType } from '@/stores/useDecorStore'

/**
 * Espelha getTextureSVG() do Gerador/index.html original (linha 3162) — 1:1, mesmos 3
 * padrões SVG inline em data-URI (sem arquivos externos), incluindo a inversão de cor
 * no modo escuro via feColorMatrix para o tipo "noise".
 */
export function getTextureSVG(type: TextureType, isDark: boolean): string {
  const stroke = isDark ? '%23ffffff' : '%23000000'
  const noiseInvert = isDark
    ? `%3CfeColorMatrix type='matrix' values='-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0'/%3E`
    : ''

  const defs: Record<Exclude<TextureType, 'none'>, string> = {
    organic: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='60'%3E%3Cpath d='M0,10 C30,2 55,18 80,10 C110,2 135,18 160,10 C180,4 196,14 200,10' stroke='${stroke}' stroke-width='1.4' fill='none'/%3E%3Cpath d='M0,30 C25,22 55,38 80,30 C110,22 135,38 160,30 C180,24 196,34 200,30' stroke='${stroke}' stroke-width='1.4' fill='none'/%3E%3Cpath d='M0,50 C30,43 55,57 80,50 C110,43 135,57 160,50 C180,44 196,54 200,50' stroke='${stroke}' stroke-width='1.4' fill='none'/%3E%3C/svg%3E")`,
    noise: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25' color-interpolation-filters='linearRGB'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch' result='noise'/%3E%3CfeColorMatrix in='noise' type='saturate' values='0' result='gray'/%3E${noiseInvert}%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
    hatching: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cline x1='0' y1='12' x2='12' y2='0' stroke='${stroke}' stroke-width='0.75'/%3E%3C/svg%3E")`,
  }

  return type === 'none' ? 'none' : defs[type]
}
