# Evidência visual do catálogo de templates

Revisão realizada em 27/09/2026 no WSL2, com Chromium headless e Playwright.

## Escopo

- 50 templates do registry: 26 existentes e 24 novas composições.
- 50 renders PNG em tamanho real e 13 folhas de contato, com quatro peças por folha.
- O preview usou `ProfileCanvasWrapper`, `CanvasFrame`, `exportMode`, `TextureLayer` e `WatermarkLayer`, conforme a composição do nó de exportação. Perfil, textura e marca d'água ficaram nos valores iniciais do editor.

## Resultado

- Feed e carrossel: 1080 × 1350 px. Stories: 1080 × 1920 px.
- Texto visível: mínimo observado de 20 px.
- Título principal: mínimo observado de 68 px, acima do piso de 67 px.
- Overflow: zero. Erros JavaScript: zero. Travessões longos visíveis: zero.
- Todos os 50 renders passaram pelas verificações automáticas e foram inspecionados nas folhas de contato.

O manifesto `manifest.json` registra dimensões, medidas de fonte, overflow e erros de cada ID. Os arquivos individuais levam o ID do template no nome.

## Limites da evidência

As peças usam o texto demonstrativo do catálogo. Os slots de imagem e prova que não têm um asset inicial aparecem vazios. Esta revisão confirma a composição dos templates com os valores padrão; não valida conteúdo editorial com fontes reais, assets de Pexels/Fal, exportação após alterações de perfil nem aprovação para publicação.
