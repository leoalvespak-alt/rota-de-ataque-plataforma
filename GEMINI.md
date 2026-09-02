# Plataforma Rota de Ataque — Instruções para Gemini

As instruções globais estão em `AGENTS.md` neste mesmo diretório. Leia-o antes de qualquer tarefa.

## ⚠️ REGRA CRÍTICA — Branch e commit

**Sempre commitar diretamente em `main`. NUNCA criar branches nem PRs.**

```bash
git add <arquivos>
git commit -m "tipo: descrição"
git push origin main
```

Push em `main` dispara CI/CD automático — não é necessária nenhuma ação manual adicional.

## Estrutura

```
plataforma/
  apps/design-system/   # React + Hono API
  apps/web/             # Next.js (Prospector)
  packages/             # Shared
  workers/              # Background workers
```

## Documentação

Consulte antes de tarefas grandes:
- `docs/ARQUITETURA_FINAL.md` — arquitetura consolidada
- `deploy/DEPLOY.md` — infraestrutura e deploy
- `AGENTS.md` — regras completas para agentes

Após alterações estruturais, atualize o documento canônico correspondente.
