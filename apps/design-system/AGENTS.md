@RTK.md

<!-- CODEGRAPH_START -->
## CodeGraph

Quando o repositório tiver o diretório `.codegraph/`, use CodeGraph antes de varrer arquivos com `grep`, `find` ou leituras amplas para entender dependências e localizar código. Prefira a ferramenta MCP `codegraph_explore` quando disponível; no terminal, use `codegraph explore "<símbolos ou pergunta>"`.

Para tarefas pequenas e claramente localizadas, não invoque ferramentas extras sem necessidade. Se o índice parecer inconsistente, execute `npm run codegraph:update`.
<!-- CODEGRAPH_END -->

Consulte `../../../Docs/README.md` e `../../../Docs/DESIGN-SYSTEM.md` antes de tarefas grandes. Após alterações estruturais, revise o documento canônico e, se a integração entre produtos mudar, `../../../Docs/ARQUITETURA-UNIFICADA.md`.
