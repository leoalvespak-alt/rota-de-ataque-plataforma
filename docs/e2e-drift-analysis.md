# Análise do drift dos testes E2E do design system

Data da inspeção: 2026-08-09.

## Evidência observada

A rota `/` foi executada localmente e inspecionada visualmente e pela árvore de acessibilidade.

- O `header` vigente mostra a marca gráfica com nome acessível `Ataque`, o seletor da edição atual e as abas `Criar Arte`, `Marca`, `AI`, `Renders` e `Historico`. Ele não mostra um nó textual exato `Rota de Ataque`.
- O primeiro `aside` vigente é a biblioteca compacta de modelos. Ele mostra `Biblioteca de modelos`, a busca, o `combobox` `Filtrar por formato`, o botão `Segmentos` e as coleções de templates. Os títulos exatos `Formato` e `Segmento` pertencem à biblioteca expandida, aberta pelo botão `Abrir biblioteca de modelos em tela cheia`.
- Na biblioteca expandida, os grupos acessíveis `Formato` e `Segmento` permanecem parte do design. O filtro `Story` reduz a biblioteca de 26 para 6 modelos.

## Decisão

O design mudou e as expectativas antigas ficaram obsoletas. A aplicação não foi alterada: os dois testes foram atualizados para usar os nomes acessíveis e o fluxo atual.

O primeiro teste agora valida a marca gráfica, abre a biblioteca expandida, confirma os grupos `Formato`/`Segmento` e executa a filtragem real por `Story`. O segundo continua validando a navegação `Marca` → `Criar Arte` e confirma os controles compactos atuais (`Filtrar por formato` e `Segmentos`).

Essa correção preserva a intenção de não regressão dos testes sem reintroduzir textos removidos pelo design vigente.
