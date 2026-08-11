# Gerador de Criativos — Rota de Ataque

Aplicação **React + TypeScript** para criar peças gráficas ("criativos") para as redes
sociais da marca **Rota de Ataque** (plataforma de estudos para concursos públicos).
O app principal (SPA) permanece 100% client-side — sem back-end obrigatório para uso
diário. Uma camada opcional de infraestrutura server-side (banco de dados, storage,
filas, renderização headless) foi adicionada na modernização de 2026 e está documentada
em [`docs/`](docs/) — ver [`docs/architecture.md`](docs/architecture.md).

Este projeto é a versão atual e única em produção. A versão anterior, em HTML/CSS/JS
puro num único arquivo, foi descontinuada após a migração ter atingido paridade visual
completa (ver §7).

## Modernização (2026)

Uma modernização completa em 24 fases adicionou: design tokens (Style Dictionary),
CSS Cascade Layers, schemas Zod para templates, XState para fluxos, editor Tiptap,
17 componentes de marca, Storybook, diagramas (Mermaid/React Flow/D3), gráficos
(ECharts), conteúdo técnico (KaTeX/Shiki), animações (GSAP), pipeline de imagens
(Sharp), renderização server-side (Playwright), exportadores adicionais (HTML/PPTX),
módulos de slides e documentos HTML, providers de IA estruturados, validação visual,
banco de dados (PostgreSQL + Drizzle), storage (MinIO), filas (Redis + BullMQ) e
observabilidade (Sentry). Detalhes completos em
[`docs/modernization/03-final-report.md`](docs/modernization/03-final-report.md).

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript 6 (strict) |
| Estado | Zustand 5 + Immer (updates tipados) + Zundo (undo/redo) |
| Estilo | Tailwind CSS 4 (`@theme` CSS-first), tokens da marca em `src/index.css` |
| Componentes acessíveis | Radix UI (via `radix-ui`) + shadcn |
| Animações | Motion (ex-Framer Motion) |
| Ícones | lucide-react |
| Drag-and-drop | @dnd-kit (core + sortable) |
| Upload | react-dropzone |
| Formulários | react-hook-form + zod |
| Storage local | idb-keyval (IndexedDB, para blobs de imagem) + localStorage (config pequena) |
| Export PNG | html2canvas-pro |
| ZIP (séries) | JSZip |
| Fontes | @fontsource (Rajdhani, IBM Plex Sans, Space Grotesk) self-hosted |
| Testes | Vitest + Testing Library (unit) · Playwright (e2e + diff visual) |
| Lint/format | ESLint 9 (flat config) + Prettier |

## 2. Como rodar

```bash
npm install
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
npm run build        # tsc -b && vite build → dist/
npm run preview      # serve o build de produção localmente
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest (unit)
npm run test:e2e     # playwright test (e2e + diff visual)
```

Deploy: build estático (`dist/`), servido diretamente por qualquer host/VPS — não há
etapa de servidor.

## 3. Estrutura de pastas

```
src/
├── app/                    # AppShell, AppHeader, HeaderButtons — shell da aplicação e 5 abas
├── features/
│   ├── editor/             # Gallery (esquerda) · Canvas (centro) · ControlPanel (direita)
│   ├── templates/           # ★ os 26 templates
│   │   ├── registry.ts      # TemplateDefinition tipado, união discriminada por id
│   │   ├── types.ts
│   │   ├── primitives/      # TTitle, TBody, TEyebrow, TSlot, TBox, TTag, TRedline, CanvasFrame...
│   │   ├── square/           # 12 componentes (sq-*)
│   │   ├── portrait/         # 6 componentes (pt-*)
│   │   ├── carousel/         # 8 componentes (cr-*)
│   │   └── shared/           # controles reutilizados entre templates (steps, tip, etc.)
│   ├── series/               # modo série (carrossel) + export ZIP + drag-and-drop de slides
│   ├── renders/               # biblioteca de imagens (4 categorias), upload/usar/excluir
│   ├── history/               # artes salvas (limite 20), salvar/carregar/excluir
│   ├── ai/                    # config de chaves e modelos (DeepSeek/Claude/custom/fal.ai)
│   └── brand/                 # guia de identidade visual (8 seções, espelha Base/MARCA.md)
├── stores/                    # useEditorStore, useDecorStore, useSeriesStore, useLibraryStore, useAIStore, useUiStore
├── lib/
│   ├── export/                # ExportEngine + useExportCard (nó offscreen 1:1, timing determinístico)
│   ├── ai/                    # generateCopy, generateImage
│   └── textures.ts             # SVG data-URI das 3 texturas táticas
├── components/ui/              # primitivos shadcn/Radix
└── index.css                   # design tokens da marca (@theme Tailwind 4)
tests/
├── e2e/                        # Playwright
└── visual/                     # baseline (52 PNGs) + diff automatizado contra o baseline
```

## 4. Modelo de dados dos templates

Cada template tem seu próprio schema de conteúdo tipado (`Hideable<T> = T | false` para
campos que podem ser ocultados), registrado em `features/templates/registry.ts` como uma
união discriminada por `id`. Isso torna impossível, em tempo de compilação, um controle
gravar num campo que aquele template não possui.

- **26 templates**: 12 quadrados (`sq-*`) + 6 stories/retrato (`pt-*`) + 8 carrossel (`cr-*`)
- **2 formatos de canvas**: 1080×1080 (square) e 1080×1920 (portrait)
- **5 abas**: Criar Arte · Marca · AI · Renders · Histórico
- **Undo/redo**: 30 estados (Zundo), atalhos `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`
- **Export**: PNG em escala 2x via `html2canvas-pro`, nome `rota-de-ataque-{id}-{timestamp}.png`

## 5. Pontos de risco já resolvidos

- **`contentEditable` + React**: `EditableText` é não-controlado; o store só escreve no
  DOM quando o elemento não está focado, evitando que o cursor pule durante a digitação.
- **Timing do export PNG**: nó de export dedicado, offscreen, sempre em escala 1:1 —
  `flushSync` → `document.fonts.ready` → `img.decode()` de todas as imagens → duplo
  `requestAnimationFrame` → captura. Fontes self-hosted tornam `fonts.ready` confiável.
- **Prop `dark` e modo escuro**: todo componente de template deve repassar a prop `dark`
  recebida para `TTitle`/`TBody`/`TSlot` — exceto elementos intencionalmente sempre-light
  por design (ex.: o card de `sq-tweet` simula um tweet e é sempre branco). Ao criar um
  novo template, siga esse padrão e rode o diff visual antes de dar merge.

## 6. Identidade visual

A fonte única da identidade da marca é [`../Base/MARCA.md`](../Base/MARCA.md) (tom de voz,
cores, tipografia, iconografia). Os tokens em `src/index.css` implementam esses valores
em CSS/Tailwind; a aba **Marca** do app (`features/brand/`) exibe o guia navegável dentro
do próprio produto, incluindo swatches com copiar-hex.

## 7. Histórico da migração

O app foi originalmente um único `index.html` autossuficiente (~4550 linhas, HTML+CSS+JS
embutidos, sem build step). Foi totalmente reescrito em React + TypeScript, template por
template, com validação por diff visual pixel a pixel (Puppeteer + pixelmatch, threshold
3%) contra capturas do app original: **48/52 capturas dentro do threshold** — as 4
restantes correspondem a uma única correção de conteúdo intencional (um "\n\n" que
aparecia como texto literal "nn" no HTML original foi corrigido, por decisão do usuário).

Dois bugs introduzidos pela própria migração foram encontrados e corrigidos durante essa
auditoria (id duplicado no nó de export; prop `dark` não propagada em 17 templates — ver
§5). Nenhum dos bugs do app HTML original (documentados antes da migração) voltou.

A versão HTML original foi descontinuada e removida do repositório após a conclusão da
migração; este projeto é a única versão mantida.
