# Projetos e persistência local

## Função

Converte o estado do editor em documento versionado, mantém projetos locais e agenda autosave opcional.

## Arquivos principais

- `src/features/projects/ProjectSessionProvider.tsx`
- `src/features/projects/ProjectSessionControls.tsx`
- `src/domain/documents.ts`, `repositories.ts`, `autosave.ts` e `adapters.ts`
- `src/stores/useProjectSessionStore.ts` e `src/lib/storage/idbStorage.ts`

## Fluxo básico

1. O provider carrega o projeto mais recente ou cria um documento inicial.
2. Adaptadores convertem editor, decoração e séries em cards do documento.
3. Mudanças nos stores agendam persistência; troca de projeto restaura os stores.
4. A recuperação é apresentada por `ProjectRecoveryNotice`.

## Dependências internas

Editor, decoração, séries, feature flags e IndexedDB.

## Regras importantes

- O fluxo é opt-in por feature flags de projetos/autosave.
- O provider mantém a UI atual como fonte de edição; preserve o bridge ao evoluir o modelo.
- Verifique migrações e compatibilidade de documento antes de mudar o schema persistido.

## Quando atualizar este documento

Ao alterar `ProjectDocument`, repositórios, autosave, adapters, flags ou recuperação de sessão.
