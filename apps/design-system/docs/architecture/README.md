# Mapa de arquitetura

Referências curtas para orientar a leitura dirigida do código. Elas descrevem os módulos atuais; confirme dependências com CodeGraph antes de uma alteração que atravesse módulos.

## Documentos

- [Motor editorial](../editorial-engine/00-current-state-audit.md): teses, RAG, planejamento, filas e revisão.

- [Visão geral](overview.md): entrada da aplicação e divisão de responsabilidades.
- [Editor](editor.md): galeria, canvas, painel de controles e stores.
- [Templates](templates.md): contratos, registro e renderização dos layouts.
- [Projetos](projects.md): documento versionado, persistência local e autosave.
- [IA](ai.md): configuração local de provedores e geração de conteúdo.
- [Exportação e renderização](exports-and-rendering.md): captura no navegador e serviços de servidor.
- [Dados e jobs](data-and-jobs.md): schema, filas, storage e processamento de imagens.
- [UI](ui.md): shell, componentes reutilizáveis e superfícies de interface.

## Como usar esta documentação

Antes de tarefas grandes, consulte este índice e leia apenas o documento do módulo relacionado. Depois, use CodeGraph para confirmar dependências antes de alterar múltiplos módulos. Não leia o projeto inteiro quando estas referências já apontarem os arquivos relevantes.

```bash
npm run context:check
npm run context:update
npm run docs:architecture:check
```

Atualize manualmente o documento do módulo ao mudar seu fluxo, arquivos principais ou dependências internas. `docs:architecture:update` apenas sinaliza essa revisão; ele não inventa documentação.
