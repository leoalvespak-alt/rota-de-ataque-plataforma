# Editor

## Função

Permite selecionar um template, editar seus dados, visualizar o canvas e controlar recursos auxiliares.

## Arquivos principais

- `src/app/AppShell.tsx`
- `src/features/editor/Gallery/`, `Canvas/` e `ControlPanel/`
- `src/stores/useEditorStore.ts` e `src/stores/useDecorStore.ts`
- `src/stores/useTemplateLibraryStore.ts`
- `src/features/series/` e `src/lib/export/useExportCard.ts`

## Fluxo básico

1. A galeria compacta ou a biblioteca em tela cheia filtram o registro por busca, formato, segmentos, recursos, favoritos e recentes.
2. Ao usar um modelo, a biblioteca registra o uso recente e seleciona o item no editor; favoritos e recentes são persistidos separadamente do documento.
3. `useEditorStore` cria ou atualiza `elements` a partir dos defaults.
4. `Canvas` resolve o template ativo e renderiza `Render` dentro de `CanvasFrame`.
5. O painel chama `Controls` do template e controles compartilhados; a exportação lê o mesmo estado.

## Dependências internas

Templates, séries, decoração, validação, projetos/autosave e exportação.

## Regras importantes

- Mantenha `elements` compatível com o template ativo; não grave caminhos arbitrários.
- O histórico do editor rastreia somente `elements`; template, zoom e tema não devem criar undo.
- Busca e filtros são transitórios; apenas favoritos e os 12 usos mais recentes são persistidos em `rda_template_library`.
- A galeria lateral e a biblioteca em tela cheia compartilham os mesmos filtros e cards; ambas usam `TEMPLATES` como fonte única.
- Verifique no código antes de alterar o bridge de projetos, pois ele sincroniza stores legadas.

## Quando atualizar este documento

Ao alterar o fluxo de seleção, o shape do estado, o canvas, controles ou a integração de séries/exportação.
