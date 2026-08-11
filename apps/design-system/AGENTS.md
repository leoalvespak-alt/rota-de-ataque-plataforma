@RTK.md

<!-- CODEGRAPH_START -->
## CodeGraph

Quando o repositório tiver o diretório `.codegraph/`, use CodeGraph antes de varrer arquivos com `grep`, `find` ou leituras amplas para entender dependências e localizar código. Prefira a ferramenta MCP `codegraph_explore` quando disponível; no terminal, use `codegraph explore "<símbolos ou pergunta>"`.

Para tarefas pequenas e claramente localizadas, não invoque ferramentas extras sem necessidade. Se o índice parecer inconsistente, execute `npm run codegraph:update`.
<!-- CODEGRAPH_END -->

Consulte `docs/architecture/README.md` antes de tarefas grandes e leia somente o documento do módulo afetado. Após alterações estruturais, execute `npm run context:update` e revise o respectivo documento de arquitetura; use `npm run docs:architecture:check` como verificação leve.
