# Templates

## Função

Define layouts, defaults, controles, capacidades e regras de qualidade para as artes quadradas, verticais e carrosséis.

## Arquivos principais

- `src/features/templates/types.ts` e `schemas.ts`
- `src/features/templates/registry.ts`
- `src/features/templates/{square,portrait,carousel}/`
- `src/features/templates/primitives/` e `declarative-renderer.tsx`

## Fluxo básico

1. O registro expõe `TEMPLATES` e busca por ID.
2. O editor seleciona o template e clona seus `defaults`.
3. `Canvas` e `TemplateThumb` renderizam o mesmo componente `Render`.
4. Controles e validação usam os metadados declarativos quando existentes.

## Dependências internas

Editor, galeria, canvas, validação e exportação.

## Regras importantes

- `TemplateDefinition` é o contrato central; preserve `Render`, `Controls`, `format` e `defaults` coerentes.
- Não crie uma segunda representação só para miniaturas: elas usam o `Render` real.
- Atualize equivalentes e regras de qualidade junto com mudanças de formato. Verificar no código antes de alterar schemas compartilhados.

## Quando atualizar este documento

Ao adicionar/remover template, mudar o contrato, formatos, registro, primitivas ou regras de renderização.
