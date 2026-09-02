# Instruções para agentes

## Uso de RTK e Codegraph

Este projeto usa RTK para reduzir a saída do terminal e CodeGraph para navegar pelas dependências de código com contexto dirigido.

Antes de executar uma tarefa grande, primeiro consulte CodeGraph ou rode `npm run context:check` quando aplicável. Se o grafo ou os artefatos de contexto estiverem desatualizados, rode `npm run context:update` antes de continuar. Para tarefas pequenas e claramente localizadas, não gaste tokens nem tempo com atualização desnecessária.

- Antes de tarefas grandes, verifique se RTK e CodeGraph estão atualizados com `npm run context:check`.
- Após mudanças estruturais em vários módulos, schema, tipos globais, pastas, muitas criações/remoções de arquivos ou dependências principais, execute `npm run context:update`.
- Use CodeGraph para entender dependências entre módulos e impacto antes de refatorar. Não varra o projeto inteiro quando `codegraph explore` puder indicar os arquivos relevantes; prefira leituras dirigidas.
- Depois de uma refatoração grande, execute `npm run codegraph:update`. Se CodeGraph parecer inconsistente com o código atual, execute o mesmo comando novamente.
- Depois de mudanças em comandos, testes, builds ou logs, execute `npm run rtk:update` para reaplicar e verificar as instruções locais do RTK.
- Em tarefas pequenas e isoladas, use apenas os arquivos e comandos diretamente relevantes; não rode ferramentas extras sem necessidade.

Quando comandos de teste, lint, build ou typecheck gerarem saída grande, use RTK ou filtros equivalentes para mostrar apenas os trechos relevantes. Se o erro não ficar claro, repita o comando com saída mais ampla, mas ainda limitada.

- Prefixe comandos verbosos compatíveis com `rtk`, por exemplo `rtk npm run lint`, `rtk vitest run` e `rtk git status`.
- No Windows, cmdlets nativos do PowerShell não são executáveis do `PATH`; use `rtk proxy <comando>` quando precisar encaminhá-los sem filtragem.
- Não cole logs inteiros quando RTK puder resumir ou filtrar a saída. Se o filtro ocultar informação importante, repita o comando com `rtk proxy <comando>` ou com um filtro menos restritivo.

### Comandos

```bash
npm run context:check      # verifica RTK e a integridade/frescor do índice
npm run context:update     # reaplica RTK e atualiza o grafo incrementalmente
npm run context:refresh    # atalho seguro e idempotente para context:update
npm run codegraph:update   # sincroniza o grafo; reindexa se a versão exigir
npm run rtk:update         # restaura/verifica a integração local do RTK
```

CodeGraph acompanha alterações enquanto a sessão do agente está ativa. Os comandos acima continuam necessários depois de alterações grandes, mudanças feitas fora da sessão, troca/atualização da ferramenta ou quando `context:check` indicar pendências.

## Contexto, RTK, Codegraph e documentação curta

- Antes de tarefas grandes, consulte `../../../docs/ARQUITETURA_FINAL.md` e o documento canônico do produto afetado.
- Use CodeGraph para confirmar dependências antes de refatorações ou alterações em múltiplos módulos.
- Use RTK ou filtros equivalentes para reduzir a saída de logs, testes, lint, build e typecheck.
- Execute `npm run context:check` antes de tarefas grandes e `npm run context:update` depois de mudanças estruturais, refatorações grandes ou alterações em vários módulos.
- Atualize o documento de arquitetura correspondente quando mudar fluxo, arquivos principais ou dependências internas.
- Não varra o projeto inteiro se a documentação curta e CodeGraph já apontarem o módulo correto. Em tarefas pequenas, não use ferramentas extras sem necessidade.
- Se RTK ocultar um erro importante, repita o comando com saída mais ampla e ainda limitada. Se CodeGraph parecer inconsistente, execute `npm run codegraph:update`.

```bash
npm run docs:architecture:check
npm run docs:architecture:update
```

## Localização no monorepo

Este app agora vive dentro do monorepo `plataforma/`; siga instruções globais em `../../CLAUDE.md`.

## Deploy

O deploy do Design System é feito pelo script unificado da plataforma:

```powershell
cd plataforma
.\deploy\deploy-all.ps1 -Only design
```

Ver `plataforma/deploy/DEPLOY.md` para detalhes. **Não use** scripts na pasta `deploy/` local — os scripts de deploy antigos foram removidos.
