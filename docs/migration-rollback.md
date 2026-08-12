# Migration Rollback Playbook

> **Status**: Rascunho inicial — Atualizar após cada release de breaking change.

## Visão Geral

Este documento descreve o procedimento de rollback para migrações de schema do banco de dados e alterações de API do sistema de design (`ui-bridge`).

---

## Procedimento Geral de Rollback

### 1. Identificar a migração afetada

```bash
# Listar as últimas 10 migrações aplicadas
psql $DATABASE_URL -c "SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"
```

### 2. Fazer rollback do banco de dados

> [!WARNING]
> Rollbacks destrutivos podem apagar dados. Sempre faça backup antes.

```bash
# Backup antes do rollback
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Rollback da última migração (o nome do arquivo deve ser a migration alvo)
psql $DATABASE_URL < migrations/<nome_da_migration_reversa>.sql
```

### 3. Reverter o código

```bash
# Usar git para voltar ao commit anterior
git log --oneline -20
git revert <commit-sha> --no-commit
git commit -m "revert: rollback to <version>"

# Ou para reverter múltiplos commits
git revert <sha-mais-antigo>..<sha-mais-recente> --no-commit
git commit -m "revert: rollback range"
```

---

## Migrações Críticas Rastreadas

| Migração | Data | Reversível | Notas |
|---|---|---|---|
| `001_initial_schema` | 2025-01 | ❌ | Schema base, não reverter |
| `020_add_content_items` | 2025-03 | ✅ | DROP TABLE content_items |
| `035_add_creative_jobs` | 2025-06 | ✅ | DROP TABLE creative_jobs |
| `048_identity_resolution` | 2025-08 | ⚠️ Parcial | Remover tabelas novas, manter dados de identidade antiga |

---

## Rollback de Componentes do UI Bridge

### Aliases CSS Deprecated

Os seguintes aliases CSS antigos foram substituídos e **NÃO DEVEM SER USADOS** em código novo:

| Alias Antigo | Substituto | Status |
|---|---|---|
| `--bg-canvas` | `--surface-canvas` | ✅ Migrado |
| `--bg-card` | `--surface-card` | ✅ Migrado |
| `--fg-primary` | `--text-primary` | ✅ Migrado |
| `--fg-secondary` | `--text-secondary` | ✅ Migrado |
| `--border-default` | `--border` | ✅ Migrado |
| `--accent` | `--accent-primary` | ✅ Migrado |

> [!CAUTION]
> Se precisar reverter para uma versão anterior do `ui-bridge`, os aliases antigos ainda estão presentes em `packages/ui-bridge/src/tokens.ts` como compatibilidade retroativa. NÃO os remova sem atualizar todos os consumidores.

### Componentes Deprecated

| Componente | Status | Substituto |
|---|---|---|
| `DataTable` | Deprecated — Manter para compatibilidade | `DataGrid` |
| `OperationalRow` | Deprecated | `DataGrid` row |
| `StatePanel` movido de `layout.tsx` | Movido para `feedback.tsx` | Atualizar imports |

---

## Bundle Size Budget

Metas de bundle size para CI:

| Entry Point | Budget Atual | Limite Máximo |
|---|---|---|
| `apps/web` (First Load JS) | ~180KB | **250KB** |
| `packages/ui-bridge` | ~45KB | **80KB** |
| `packages/shared` | ~25KB | **50KB** |

### Como verificar

```bash
cd apps/web
pnpm build
# Verificar saída do Next.js para bundle sizes
```

---

## Contato e Responsáveis

- **Banco de Dados**: DBA ou tech lead responsável pela migração
- **UI Bridge**: Maintainer do pacote
- **Deploy**: CI/CD pipeline em `.github/workflows/deploy.yml`

---

*Última atualização: 2026-08-12*
