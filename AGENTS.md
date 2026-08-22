# Plataforma Rota de Ataque — Regras para agentes de IA

## ⚠️ REGRA CRÍTICA — Branch e commit

**Sempre commitar diretamente em `main`. NUNCA criar branches nem PRs.**

A proteção de branch foi removida no GitHub. O workflow correto é:

```bash
git add <arquivos-modificados>
git commit -m "tipo: descrição clara"
git push origin main
```

Criar uma branch ou abrir um PR é **errado** neste repositório — causa atraso de deploy e fricção operacional. Se você criou uma branch por engano, faça merge imediato para main e delete a branch.

## Deploy automático

Push em `main` → GitHub Actions builda imagem Docker → sobe para GHCR → SSH deploya na VPS.
Não é necessário nenhuma ação manual após o push.

| Projeto | Como deployar |
|---|---|
| Design System (web + API) | `git push origin main` neste repo |
| Prospector | `git push origin main` neste repo |
| Plataforma 2.0 | `git push origin main` no repo `rota-de-ataque-v2` |

Monitorar CI: `gh run list --limit 5`

## Estrutura do monorepo

```
plataforma/
  apps/
    design-system/   # React + Hono API — design.rotadeataque.com.br
    web/             # Next.js — design.rotadeataque.com.br/prospector
  packages/          # Shared packages (só workers podem importar)
  workers/           # Background workers (só importam de packages/)
```

Regra de importação: `apps/design-system` não pode importar de `apps/web` nem de `workers`.

## Documentação canônica

Antes de qualquer tarefa grande, consulte:
- `Docs/README.md` — índice de todos os documentos
- `Docs/DESIGN-SYSTEM.md` — arquitetura do Design System
- `Docs/DEPLOY-DOKPLOY.md` — detalhes de infraestrutura e deploy
- `apps/design-system/CLAUDE.md` — instruções específicas do app

Após mudanças que afetem arquitetura, HTTP, banco, auth, deploy ou flows de usuário, atualize o documento canônico correspondente no mesmo commit.

## CodeGraph

Se existir um diretório `.codegraph/` no projeto, use CodeGraph antes de varrer arquivos com grep/find:
- Ferramenta MCP: `codegraph_explore`
- Terminal: `codegraph explore "<símbolos ou pergunta>"`

## RTK

Prefixe comandos verbosos com `rtk` para reduzir saída de terminal:
`rtk git status`, `rtk npm run lint`, `rtk vitest run`
