# UI e design system

## Função

Oferece o shell da aplicação e componentes reutilizáveis para as features, marca e Storybook.

## Arquivos principais

- `src/app/AppHeader.tsx`, `AppShell.tsx` e `HeaderButtons.tsx`
- `src/components/ui/`
- `src/components/brand/`
- `.storybook/main.ts` e `.storybook/preview.ts`

## Fluxo básico

1. `AppShell` monta a superfície da aba ativa.
2. Features consomem os componentes de `components/ui`.
3. Componentes de marca compõem conteúdos e apresentações especializadas.
4. Storybook é o ambiente de inspeção dos componentes documentados por stories.

## Dependências internas

App shell, editor, IA, marca, renders, histórico e Tailwind/Radix.

## Regras importantes

- Reutilize `components/ui` antes de criar primitivas semelhantes dentro de features.
- Preserve acessibilidade e variantes dos componentes; não altere estilos globais para corrigir um único caso.
- Verifique no código os tokens e convenções de tema antes de alterar componentes de marca.

## Quando atualizar este documento

Ao mudar o shell, biblioteca de componentes, convenções visuais, Storybook ou superfícies principais.
