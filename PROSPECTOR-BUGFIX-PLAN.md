# Plano de Correção — Erros do Prospector

Investigação realizada em 2025-08-13 a partir dos erros observados no console do navegador em `design.rotadeataque.com.br/prospector/`.

---

## Resumo dos Erros Identificados

| # | Erro | Origem | Severidade |
|---|------|--------|------------|
| 1 | `GET /prospector/api/admin/notifications/count 404` (loop infinito) | `AppShell.tsx:115` — rota API não existe | **Crítica** |
| 2 | `TypeError: Cannot read properties of undefined (reading 'baseOption')` | Chunk ECharts — prop incorreta `options` vs `option` | **Alta** |
| 3 | 9 arquivos com `@ts-nocheck` suprimindo erros de tipo em produção | Diversos componentes client | **Média** |
| 4 | Polling agressivo de `/api/admin/notifications/count` a cada navegação | `AppShell.tsx:113-125` | **Média** |

---

## Etapa 1 — Rota de Notificações Faltante (Erro 404)

### Causa Raiz
O `AppShell.tsx` (linha 113-125) faz `fetch(appPath('/api/admin/notifications/count'))` a cada mudança de `pathname`. Porém **não existe** a rota `app/api/admin/notifications/count/route.ts`. Existem apenas:
- `app/api/admin/notifications/test/route.ts` (POST — teste de canais)
- `app/api/admin/notifications/triggers/route.ts` (PUT — toggle de triggers)

### Passos

#### 1.1 — Criar a rota API `api/admin/notifications/count`
- **Arquivo**: `apps/web/src/app/api/admin/notifications/count/route.ts`
- **Contrato**: `GET` → `{ count: number, recent: Array<{id, message, created_at}> }`
- **Lógica**: Consultar a tabela `alerts` (ou equivalente) para retornar contagem de alertas não resolvidos e os 5 mais recentes.
- **Autenticação**: Verificar sessão via `getServerSession(authOptions)`.

#### 1.2 — Adicionar tratamento de erro no fetch do AppShell
- **Arquivo**: `apps/web/src/components/AppShell.tsx`, linhas 113-125
- **Mudança**: Verificar `response.ok` antes de parsear JSON. Se a resposta não for ok, definir `notifCount=0` e `recentNotifs=[]` silenciosamente.
- **Adicional**: Trocar o trigger de `[pathname]` para um intervalo fixo (ex.: 60s) para evitar polling excessivo.

#### 1.3 — Teste de verificação
- Acessar qualquer página do Prospector e confirmar que o console não mostra mais o 404.
- Verificar que o badge de notificações mostra o count correto.

---

## Etapa 2 — TypeError `baseOption` no ECharts (Crash de Gráficos)

### Causa Raiz
O componente `ChartContainer` (em `packages/ui-bridge/src/charts.tsx`) aceita a prop **`option`** (singular):

```tsx
export const ChartContainer = ({ option, height }: { option: EChartsOption; height?: string | number }) => {
```

Mas **todos os consumidores** passam **`options`** (plural):
- `OperationalDashboard.tsx` linhas 78, 135 → `<ChartContainer options={{...}}`
- `OperationalInteractive.tsx` linha 232 → `<ChartContainer options={{...}}`

O `echarts-for-react` recebe `undefined` como option e tenta acessar `undefined.baseOption`, causando o TypeError.

### Passos

#### 2.1 — Corrigir a prop no ChartContainer
- **Arquivo**: `packages/ui-bridge/src/charts.tsx`
- **Mudança**: Aceitar **ambas** as props (`option` e `options`) para backwards-compat, priorizando `option`:

```tsx
export const ChartContainer = ({ 
  option, 
  options,
  height = '300px' 
}: { 
  option?: EChartsOption
  options?: EChartsOption
  height?: string | number
}) => {
  const resolvedOption = option ?? options ?? {}
```

#### 2.2 — Corrigir os consumidores para usar `option` (singular)
- **Arquivos**:
  - `apps/web/src/components/OperationalDashboard.tsx` — 3 ocorrências de `options=` → `option=`
  - `apps/web/src/components/OperationalInteractive.tsx` — 1 ocorrência de `options=` → `option=`

#### 2.3 — Remover a compat temporária do ChartContainer
Após corrigir todos os consumidores, remover a prop `options` do ChartContainer.

#### 2.4 — Teste de verificação
- Acessar a página Overview (`/`) e confirmar que o gráfico de funil renderiza.
- Acessar `/source-roi` com dados e confirmar o gráfico de barras.
- Acessar o detalhe de um lead no Radar e confirmar a sparkline de aceleração.
- Confirmar que o console não mostra mais o TypeError `baseOption`.

---

## Etapa 3 — Remoção de `@ts-nocheck` e Correção de Tipos

### Causa Raiz
9 arquivos usam `// @ts-nocheck`, suprimindo completamente o type-checking. Bugs como o da Etapa 2 passam silenciosamente.

### Arquivos Afetados
1. `app/notifications/NotificationsClient.tsx`
2. `app/leads/LeadsClient.tsx`
3. `app/leads/LeadsClient.stories.tsx`
4. `app/engagement-queue/EngagementClient.tsx`
5. `app/email-flows/FlowEditor.tsx`
6. `components/OperationalInteractive.tsx`
7. `lib/dashboard-config.ts`
8. `components/OperationalDashboard.tsx`
9. `components/CommandPalette.tsx`

### Passos

#### 3.1 — Remover `@ts-nocheck` e corrigir erros de tipo
Para cada arquivo:
1. Remover `// @ts-nocheck`
2. Executar `pnpm typecheck` e corrigir os erros reportados
3. Priorizar: OperationalDashboard → OperationalInteractive → NotificationsClient (onde os bugs de produção estão)

#### 3.2 — Teste de verificação
- `pnpm typecheck` deve passar sem erros em todos os 9 arquivos.
- `pnpm build` deve completar com sucesso.

---

## Etapa 4 — Polling Agressivo de Notificações

### Causa Raiz
O `useEffect` do `AppShell.tsx` usa `[pathname]` como dependência, fazendo uma requisição a cada navegação. Como o AppShell re-renderiza frequentemente (inclusive via `router.refresh()`), isso gera dezenas de requests.

### Passos

#### 4.1 — Implementar intervalo com cleanup
- **Arquivo**: `apps/web/src/components/AppShell.tsx`
- **Mudança**: Substituir o `useEffect` baseado em `pathname` por um `setInterval` de 60 segundos, com fetch inicial imediato e `AbortController` no cleanup.

```tsx
useEffect(() => {
  const controller = new AbortController()
  const fetchCount = () => {
    fetch(appPath('/api/admin/notifications/count'), { cache: 'no-store', signal: controller.signal })
      .then(r => r.ok ? r.json() as Promise<{ count: number; recent?: ... }> : null)
      .then(data => {
        if (data) {
          setNotifCount(data.count ?? 0)
          setRecentNotifs(data.recent ?? [])
        }
      })
      .catch(() => {})
  }
  fetchCount()
  const interval = setInterval(fetchCount, 60_000)
  return () => { controller.abort(); clearInterval(interval) }
}, [])
```

#### 4.2 — Teste de verificação
- Abrir Network tab do DevTools.
- Navegar entre 5+ páginas.
- Confirmar que `notifications/count` é chamada apenas 1 vez ao carregar + 1 vez por minuto, não a cada navegação.

---

## Etapa 5 — Diagnósticos Adicionais e Testes de Regressão

### 5.1 — Ampliar o teste de guardrails existente
- **Arquivo**: `apps/web/src/production-ui-guardrails.test.ts`
- **Novos testes**:
  - Verificar que nenhum componente usa `@ts-nocheck` (após limpeza)
  - Verificar que `ChartContainer` é chamado com `option=` (singular), nunca `options=`
  - Verificar que todas as rotas API referenciadas em fetches de componentes existem como `route.ts`

#### Teste: rotas API referenciadas devem existir
```ts
it('API routes referenced in client components must exist', async () => {
  const clientFiles = files.filter(f => f.source.includes("'use client'"))
  const apiCalls = clientFiles.flatMap(f => {
    return [...f.source.matchAll(/appPath\(['"](\\/api\\/[^'"]+)['"]\)/g)]
      .map(m => m[1])
  })
  const uniqueRoutes = [...new Set(apiCalls.map(r => r.replace(/\?.*/, '')))]
  for (const route of uniqueRoutes) {
    const routePath = path.join(root, 'app', route, 'route.ts')
    // Check existence (can be dynamic route)
    // This is a simplified check — dynamic routes need special handling
  }
})
```

### 5.2 — Smoke test E2E (recomendação futura)
O guardrails test já tem um comentário sobre isso. Recomendo:
- Criar `tests/e2e/smoke.spec.ts` com Playwright
- Verificar que todas as rotas do sidebar carregam sem 4xx/5xx
- Verificar que o console do navegador não tem erros TypeError/ReferenceError

### 5.3 — Teste de regressão visual dos gráficos
- Após as correções, visitar cada página que usa `ChartContainer` e tirar screenshot
- Comparar com o estado esperado (funil, barras, sparkline)

---

## Ordem de Execução Recomendada

```
Etapa 1 (Rota faltante)     ← Elimina o 404 e o loop no console
   ↓
Etapa 2 (ChartContainer)    ← Elimina o TypeError de baseOption
   ↓
Etapa 4 (Polling)            ← Reduz carga de rede
   ↓
Etapa 3 (@ts-nocheck)       ← Preventivo; pode revelar bugs ocultos
   ↓
Etapa 5 (Testes)             ← Garante que os bugs não voltem
```

---

## Checklist de Verificação Final

- [ ] Console do navegador limpo (sem 404, sem TypeError)
- [ ] Gráficos de Overview, Source-ROI e Radar renderizam
- [ ] Badge de notificações funcional
- [ ] Network mostra no máximo 1 request/minuto para notifications/count
- [ ] `pnpm typecheck` passa
- [ ] `pnpm build` passa
- [ ] `pnpm test` passa (incluindo guardrails ampliados)
- [ ] Nenhum arquivo com `@ts-nocheck` (exceto stories)
