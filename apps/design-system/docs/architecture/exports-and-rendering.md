# Exportação e renderização

## Função

Exporta a arte atual no navegador e disponibiliza componentes de renderização para fluxos de servidor.

## Arquivos principais

- `src/lib/export/ExportNodeProvider.tsx`, `ExportNode.tsx`, `ExportEngine.ts` e `useExportCard.ts`
- `src/lib/export/exporters/`
- `src/domain/exportJobs.ts`
- `src/server/render/playwrightRenderer.ts`

## Fluxo básico

1. `ExportNodeProvider` mantém um nó offscreen com a arte atual.
2. `useExportCard` valida, força commit React, espera fontes/imagens e captura PNG.
3. Exportadores em `exporters/` atendem formatos adicionais.
4. O renderer Playwright gera PNG, JPEG ou PDF em contexto de servidor.

## Dependências internas

Editor, templates, validação, filas e storage.

## Regras importantes

- A exportação no navegador e a renderização de servidor são caminhos distintos; não assuma que um substitui o outro.
- Preserve `waitForRenderReady` e a sincronização antes da captura para evitar frames desatualizados.
- `ExportQueue` em `domain` modela estados; verifique a integração de worker antes de mudar transições.

## Quando atualizar este documento

Ao mudar formatos, qualidade/escala, captura, validação, renderer Playwright ou estados de job.
