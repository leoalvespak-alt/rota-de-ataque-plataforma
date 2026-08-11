# Visão geral

## Função

Aplicação Vite/React para criar artes, configurar marca e IA, manter histórico e exportar resultados.

## Arquivos principais

- `src/main.tsx` e `src/App.tsx`: bootstrap e providers globais.
- `src/app/AppShell.tsx`: abas e composição principal.
- `src/features/`, `src/stores/`, `src/domain/` e `src/lib/`: UI, estado, regras e serviços.

## Fluxo básico

1. `main.tsx` inicializa React.
2. `App.tsx` monta providers, diagnósticos e `ProjectSessionProvider`.
3. `AppShell` seleciona a aba ativa e compõe as features.

## Dependências internas

Editor, templates, projetos, IA, exportação, UI e stores Zustand.

## Regras importantes

- `AppShell` é o ponto de integração de abas; evite colocar regras de domínio nele.
- Serviços de domínio não devem depender de componentes React.

## Quando atualizar este documento

Ao mudar o bootstrap, providers globais, abas ou a divisão entre `features`, `domain`, `lib` e `stores`.
