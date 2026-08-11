# IA

## Função

Guarda configurações locais de provedores e conecta controles do editor à geração de copy e imagens.

## Arquivos principais

- `src/features/ai/AIConfigView.tsx`, `ModelsList.tsx` e `ModelFormDialog.tsx`
- `src/stores/useAIStore.ts`
- `src/lib/ai/generateCopy.ts`, `generateImage.ts` e `providers/`
- `src/domain/aiOrchestrator.ts`
- `src/features/editor/ControlPanel/AICopyControls.tsx` e `AIImageControls.tsx`

## Fluxo básico

1. A aba de IA grava chaves e modelos no store local.
2. Controles do editor solicitam copy ou imagem pelos adaptadores de `lib/ai`.
3. O resultado é aplicado aos campos do template pelo editor.

## Dependências internas

UI, editor, templates, providers de IA e persistência do navegador.

## Regras importantes

- As chaves são dados sensíveis e ficam no navegador; nunca as registre em logs ou documentação.
- Mantenha compatibilidade entre definição de modelo e adaptador do provedor.
- Verifique no código o comportamento de fallback e erros antes de trocar o orquestrador.

## Quando atualizar este documento

Ao incluir/remover provedor, mudar armazenamento de chaves, contratos de modelo ou fluxo de aplicação do resultado.
