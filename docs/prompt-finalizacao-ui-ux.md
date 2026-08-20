# Prompt de Finalização — Plano UI/UX Prospector v2 (atualizado)

> Restam apenas as pendências abaixo. Fases 1, 2, 6, 7, 8, 9, 10 estão **DONE** — não mexa nelas.
> Execute na ordem listada. Após cada fase, rode `pnpm build` para garantir que nada quebrou.

---

## FASE 3 — AppShell: Session real [DONE]

**Arquivo**: `apps/web/src/components/AppShell.tsx`

O `DEFAULT_SESSION` (linhas ~39-43) está hardcoded com `name: 'Usuário'` e `role: 'actor'`. Linha ~91 atribui diretamente `const session: Session = DEFAULT_SESSION`.

**O que fazer**:
- Crie um `SessionProvider` com React Context em `apps/web/src/components/SessionProvider.tsx`
- A interface já deve existir: `Session { name: string; role: string; avatarUrl?: string }`
- No `layout.tsx`, obtenha a sessão real (cookie/auth) e passe ao provider. Se não houver auth implementado ainda, leia de uma env var ou de um endpoint `/api/me` — mas o provider deve existir para facilitar a troca futura
- No `AppShell.tsx`, substitua `const session = DEFAULT_SESSION` por `const session = useSession()` do contexto
- Remova a constante `DEFAULT_SESSION`

**Critério**: zero ocorrências de `DEFAULT_SESSION` ou `'actor'` hardcoded no AppShell

---

## FASE 4 — DataGrid: Remover @ts-nocheck [DONE]

**Arquivo**: `packages/ui-bridge/src/data.tsx`

O arquivo tem `@ts-nocheck` no topo, suprimindo todos os erros de tipo. Isso esconde bugs reais.

**O que fazer**:
1. Remova a linha `// @ts-nocheck`
2. Rode `pnpm --filter @plataforma/ui-bridge exec tsc --noEmit` e corrija cada erro de tipo
3. Se estiver usando a API v9 do react-table (`useTable`, `createCoreRowModel`), confirme que o package.json tem `@tanstack/react-table` v9+. Se estiver na v8, use a API v8 (`useReactTable`, `getCoreRowModel`)
4. Rode `pnpm build` para confirmar que compila

**Critério**: arquivo compila sem `@ts-nocheck`; `pnpm build` passa

---

## FASE 5 — Route Pages [DONE]

### 5.1 Substituir DashboardPage genérico em 4 rotas [DONE]

As rotas abaixo ainda usam `DashboardPage view="..."` genérico em vez de componentes dedicados:
- `apps/web/src/app/community/page.tsx`
- `apps/web/src/app/competitive-intel/page.tsx`
- `apps/web/src/app/timeline/page.tsx`
- `apps/web/src/app/radar/page.tsx`

**Para cada uma**:
1. No `page.tsx` (server component), faça a query SQL específica para os dados daquela rota
2. Envolva com `<Suspense fallback={<TableSkeleton/>}>` cada seção
3. Crie um `*Client.tsx` dedicado que receba os dados como props e use DataGrid ou visualização apropriada
4. Remova a dependência de `DashboardPage`

**Critério**: `grep -r "DashboardPage" apps/web/src/app/ --include="*.tsx"` retorna APENAS `page.tsx` da raiz (home/overview)

### 5.2 Migrar filtros de useState para URL searchParams [DONE]

Vários Client components ainda usam `useState` para estado de filtros em vez de `useSearchParams`. Isso impede compartilhar URLs filtradas e perde o estado no refresh.

**Como encontrar**: `grep -rn "useState" apps/web/src/app/ --include="*Client.tsx"` — audite cada resultado e identifique quais são filtros/search/sort (esses devem ir para URL) vs. estado de UI local como `busy`, `editing`, `selectedIds` (esses podem ficar em useState).

**Para cada filtro encontrado em useState**:
1. Importe `useSearchParams` e `useRouter` de `next/navigation`
2. Leia o valor inicial de `searchParams.get('nome_do_filtro')`
3. Ao mudar, faça `router.replace(pathname + '?' + params.toString())`
4. Remova o `useState` correspondente

**Rotas conhecidas com filtros em useState**: `ContentItemsClient.tsx` (status, search), `ConversationsClient.tsx` (filtros parciais)

**Critério**: filtros sobrevivem a F5 e são compartilháveis por URL

### 5.3 react-hook-form + Zod nos formulários restantes [DONE]

Apenas 3 rotas usam `useForm` (`ThesesClient`, `ContentOpportunityClient`, `ContactPoliciesClient`). Os demais formulários precisam ser migrados.

**Rotas com formulários que ainda não usam RHF+Zod** (encontre com `grep -rn "onSubmit\|<form" apps/web/src/app/ --include="*Client.tsx"`):
- `/configs` — formulário de configurações
- `/integrations` — formulário de integração
- `/campaigns/create` — formulário de criação de campanha
- `/accounts` — edição de conta
- Qualquer outro formulário encontrado pelo grep

**Para cada um**:
1. Crie um schema Zod para os campos
2. Use `useForm` com `zodResolver`
3. Conecte campos via `register()` ou `Controller`
4. Exiba erros via prop `error` dos campos do ui-bridge

**Critério**: `grep -rn "useForm" apps/web/src/app/ --include="*Client.tsx"` retorna todas as rotas com formulários

---

## FASE 11 — E2E: Journey tests incompletos [DONE]

**Arquivo**: `apps/web/tests/e2e/journeys.spec.ts`

Os journey tests 2 e 3 existem mas estão esqueléticos — assertions comentadas ou ausentes.

**O que fazer**:
1. **Journey 2 — Lead operacional**: completar com assertions reais
   - `page.goto('/leads')` → esperar tabela carregar (`getByRole('grid')`)
   - Clicar no primeiro lead da tabela
   - Verificar que o detalhe abre (drawer ou página)
   - Se houver NBA, clicar no botão de ação → confirmar → verificar toast de sucesso
2. **Journey 3 — Content end-to-end**: completar com assertions reais
   - `page.goto('/content-opportunity')` → esperar carregamento
   - Criar oportunidade (preencher form, submeter)
   - Navegar para `/content-items` → verificar que o item criado aparece
   - Aprovar o item → verificar mudança de status

Use locators resilientes: `getByRole`, `getByText`, `getByLabel` — não seletores CSS.

**Critério**: `pnpm --filter web exec playwright test` roda e os 3 journeys passam com assertions reais (não comentadas)

---

## CHECKLIST FINAL

Após executar tudo, confirme que todos passam:

```bash
# 1. Build completo
pnpm build

# 2. TypeScript sem erros (especialmente data.tsx sem @ts-nocheck)
pnpm --filter @plataforma/ui-bridge exec tsc --noEmit
pnpm --filter web exec tsc --noEmit

# 3. Guardrails
pnpm --filter web test -- production-ui-guardrails

# 4. Nenhuma rota usando DashboardPage genérico (exceto home)
grep -r "DashboardPage" apps/web/src/app/ --include="*.tsx" -l
# Esperado: apenas apps/web/src/app/page.tsx

# 5. Sem DEFAULT_SESSION hardcoded
grep -r "DEFAULT_SESSION" apps/web/src/ -l
# Esperado: nenhum resultado

# 6. Sem @ts-nocheck no bridge
grep -r "@ts-nocheck" packages/ui-bridge/src/ -l
# Esperado: nenhum resultado
```
