# Plano de Melhorias — Prospector

> Auditoria de 55 rotas API, 31 páginas, 42 workers, 278 testes, componentes UI e TypeScript.
> Executada em 15/08/2026.

---

## Resumo Executivo

| Categoria | Achados | Prioridade |
|---|---|---|
| Rotas sem autenticação | 4 | **Crítico** |
| Erros de TypeScript | 8 | **Crítico** |
| Worker retorno/deps errados | 5 | **Crítico** |
| Testes falhando | 11 | **Crítico** |
| Botões sem funcionalidade | 8 | Alto |
| Componente com CSS errado (Tailwind) | 1 | **Crítico** |
| Páginas stub sem dados reais | 5 | Alto |
| Pool cleanup incorreto | 1 | Alto |
| Tokens CSS inexistentes em uso | 8+ | Alto |
| Rotas API faltantes | 4 | Alto |
| Rotas sem error handling | 3 | Médio |
| Páginas sem loading.tsx | 10 | Médio |
| Componentes ui-bridge subutilizados | 30+ | Médio |
| Problemas de acessibilidade | 5 | Médio |
| Melhorias de UX | 4 | Baixo |

---

## Etapa 1 — Segurança e autenticação

### Achados

1. **[CRÍTICO] 4 rotas admin sem requireRole()**
   - `api/admin/publishing/cancel/route.ts`
   - `api/admin/publishing/confirm-manual/route.ts`
   - `api/admin/publishing/kill-switch/route.ts`
   - `api/admin/organic-metrics/route.ts`
   - Qualquer requisição pode cancelar publicações, ativar kill-switch ou acessar métricas internas.

2. **[ALTO] audit_log com actor_id hardcoded**
   - As 4 rotas gravam `'operator'` no audit_log em vez de identificar o usuário real via sessão.

3. **[MÉDIO] Vazamento de erro interno ao cliente**
   - `api/engagement/actions/route.ts` retorna `String(error)` no corpo, expondo stack traces.

4. **[MÉDIO] OTP sem rate limiting**
   - `api/auth/otp/route.ts` — sem try/catch, sem Zod no email, sem proteção brute-force.

### Passos

- **1.1** Adicionar `requireRole('operator')` nas 4 rotas admin. Extrair email da sessão para audit_log.
- **1.2** Sanitizar mensagens de erro — nunca retornar `String(error)` ao cliente. Mensagem genérica + log server-side.
- **1.3** Adicionar rate limiting ao OTP e validar email com Zod. Envolver em try/catch.

---

## Etapa 2 — Erros de TypeScript e compilação

### Achados

1. **[CRÍTICO] Queue 'news-radar' não existe no tipo QueueName**
   - Adicionado ao array `QUEUE_NAMES` mas o tipo no `packages/queue` não inclui a string.
   - `packages/queue/src/index.ts:24-25`

2. **[ALTO] 7 erros no PublishingClient.tsx**
   - EmptyState recebendo children (não aceita)
   - Tipo string usado onde `MultichannelName` é esperado
   - Valores possivelmente undefined passados sem guard
   - `apps/web/src/app/publishing/PublishingClient.tsx:136, 210, 243, 403, 410, 416, 417`

### Passos

- **2.1** Adicionar `'news-radar'` ao tipo QueueName no packages/queue.
- **2.2** Corrigir EmptyState — remover children, usar prop `action`.
- **2.3** Tipar channel como `MultichannelName` e adicionar null guards nos pilares.

---

## Etapa 3 — Botões decorativos (sem funcionalidade)

### Achados

1. **[ALTO] 8 botões no ReviewInboxClient sem onClick**
   - Radar: "Criar slot", "Descartar"
   - Insights: "Gerar sugestão", "Marcar visto"
   - Sugestões: "Aprovar → calendário", "Editar e aprovar", "Rejeitar"
   - `apps/web/src/app/review-inbox/ReviewInboxClient.tsx`

### Passos

- **3.1** Radar — "Criar slot": POST para criar scheduled_publication, abrir SlotEditor pré-preenchido.
- **3.2** Radar — "Descartar": PATCH `radar_findings` SET `processed=true` com motivo.
- **3.3** Insights — "Gerar sugestão": POST para `content_suggestions` a partir do insight.
- **3.4** Insights — "Marcar visto": PATCH `competitor_insights` SET `processed=true`.
- **3.5** Sugestões — "Aprovar → calendário": POST criar slot + PATCH `curation_status='accepted'`.
- **3.6** Sugestões — "Editar e aprovar": Abrir modal de edição, depois executar 3.5.
- **3.7** Sugestões — "Rejeitar": PATCH `curation_status='rejected'` com motivo.
- **3.8** Criar rotas API para radar-findings, competitor-insights e content-suggestions (PATCH actions).

---

## Etapa 4 — AutomationsClient — reescrever sem Tailwind

### Achados

1. **[CRÍTICO] Componente inteiro usa Tailwind CSS num projeto sem Tailwind**
   - `AutomationsClient.tsx` usa exclusivamente classes Tailwind (`bg-white`, `dark:bg-gray-800`, `text-2xl`, `rounded-lg`) que não existem. O componente renderiza completamente sem estilo.
   - `apps/web/src/app/automations/AutomationsClient.tsx`

### Passos

- **4.1** Reescrever AutomationsClient usando tokens CSS do `semantic.css` e componentes do ui-bridge (PageHeader, KpiCard, KpiRow, StatusBadge, DataGrid).
- **4.2** Reescrever `loading.tsx` da mesma página (também usa Tailwind).

---

## Etapa 5 — Páginas stub com dados falsos

### Achados

1. **[ALTO] 5 páginas com `setTimeout` + array vazio em vez de dados reais**
   - `/competitive-intel`, `/community`, `/radar`, `/source-roi`, `/timeline`
   - Usam `setTimeout(resolve, 500)` com arrays vazios. Renderizam apenas EmptyState.

### Passos

- **5.1** `/competitive-intel`: Conectar a `competitor_insights` e `content_suggestions` do banco.
- **5.2** `/radar`: Conectar a `radar_findings` e `news_items`. Listar por fonte, relevância, fase.
- **5.3** `/community`: Conectar a `community_map` e `audience_overlap`.
- **5.4** `/source-roi`: Conectar a `source_roi` e `conversion_tracking`.
- **5.5** `/timeline`: Conectar a `timeline_events` com feed cronológico.

---

## Etapa 6 — Error handling e pool cleanup

### Achados

1. **[ALTO] pool.end() fora do finally**
   - `review-inbox/[id]/[action]/route.ts` — pool pode vazar se a seção de queue falhar.

2. **[MÉDIO] 3 rotas sem try/catch**
   - `notifications/test`, `auth/otp`, `dashboard/[view]`

3. **[BAIXO] Pool duplo por request**
   - `content-opportunities/[id]/creative/route.ts` cria dois pools separados no POST.

### Passos

- **6.1** Mover `pool.end()` para `finally` no review-inbox action route.
- **6.2** Adicionar try/catch nas 3 rotas sem tratamento de erro.
- **6.3** Refatorar creative route para compartilhar um único pool.

---

## Etapa 7 — Loading states e error boundaries

### Achados

1. **[MÉDIO] 10 rotas sem loading.tsx**
   - ai-settings, communities, content-items, content-items/[id], docs/runbooks, docs/runbooks/[slug], login, theses, creative-bridge, organic-budgets

2. **[BAIXO] Apenas 1 error.tsx no projeto inteiro**
   - Apenas a boundary raiz existe.

3. **[MÉDIO] /configs retorna null quando sem campanha**
   - Deveria mostrar EmptyState.

### Passos

- **7.1** Criar `loading.tsx` para as 10 rotas usando KpiSkeleton/TableSkeleton do ui-bridge.
- **7.2** Adicionar `error.tsx` em /system-health e /automations com guidance específica.
- **7.3** Corrigir /configs — renderizar EmptyState ao invés de null.

---

## Etapa 8 — Design system e consistência visual

### Achados

1. **[ALTO] Tokens CSS não definidos em uso**
   - `--bg-default`, `--status-success-subtle`, `--status-success-strong`, `--status-warning-subtle`, `--surface-raised`, `--text-disabled`

2. **[ALTO] Biblioteca ui-bridge massivamente subutilizada**
   - Button, InputField, TextareaField, SelectField, Dialog, Tabs, ConfirmDialog, Drawer, KanbanBoard existem mas são recriados manualmente.

3. **[MÉDIO] Inline styles extensivos com hardcoded pixels**
   - Quase todo componente usa `style={{...}}` com valores hardcoded em vez de tokens.

### Passos

- **8.1** Definir tokens faltantes no `semantic.css`.
- **8.2** Migrar tabs hand-rolled para Tabs do ui-bridge (ReviewInboxClient, AccountsClient, NotificationsClient).
- **8.3** Migrar modals para Dialog/ConfirmDialog (PublishingClient, AISettingsClient, AccountsClient).
- **8.4** Migrar forms para InputField/TextareaField/SelectField.
- **8.5** Substituir pixels hardcoded por tokens `var(--space-*)`.

---

## Etapa 9 — Acessibilidade

### Achados

1. **[MÉDIO] Tabs sem roles ARIA** — `role="tab"`, `role="tablist"`, `role="tabpanel"` ausentes.
2. **[MÉDIO] Modals sem focus trapping** — sem `aria-modal="true"`, sem retorno de foco ao fechar.
3. **[MÉDIO] Drag-and-drop sem alternativa de teclado** — calendário usa apenas onDragStart/onDrop.

### Passos

- **9.1** Migrar para Tabs do ui-bridge (resolve roles ARIA automaticamente).
- **9.2** Migrar para Dialog do ui-bridge (resolve focus trapping e aria-modal).
- **9.3** Adicionar keyboard navigation ao calendário — Arrow keys, Enter, Escape.

---

## Etapa 10 — Rotas API faltantes

### Achados

1. **[ALTO] Sem API para ações do radar/insights/sugestões**
   - Botões da Etapa 3 precisam de endpoints PATCH para radar_findings, competitor_insights e content_suggestions.

2. **[MÉDIO] Sem API GET para organic-budgets**
   - Falta GET para refresh client-side.

### Passos

- **10.1** `POST /api/admin/radar-findings/[id]/action` — approve, dismiss.
- **10.2** `POST /api/admin/competitor-insights/[id]/action` — generate-suggestion, mark-seen.
- **10.3** `POST /api/admin/content-suggestions/[id]/action` — approve, edit-approve, reject.
- **10.4** `GET /api/admin/organic-budgets` para refresh client-side.

---

## Etapa 11 — Melhorias de UX e funcionalidade

### Achados

1. **[MÉDIO] Runbook 'web' inacessível** — slug aceito mas não listado no índice.
2. **[BAIXO] Confirmação manual sem feedback visual** — endpoint existe mas sem UI.

### Passos

- **11.1** Adicionar 'web' ao índice de runbooks.
- **11.2** UI de confirmação manual: botão "Confirmar postagem" com campo para external ID.
- **11.3** Kill-switch visual: indicador no /publishing e /automations.
- **11.4** Janela de cancelamento visual: slots nos próximos 10min com badge "Cancelável".

---

## Etapa 12 — Workers — dependências e tipos

### Achados

1. **[CRÍTICO] news-radar retorna shape errado do processador**
   - Retorna `{ traceId, reasonCode, event }` mas `runWorker` exige `{ ok: true, traceId, event }`.
   - `workers/news-radar/src/main.ts:146-159`

2. **[ALTO] competitive-intel não declara @plataforma/meta-api**
   - Importa `createMetaClient` mas package.json não lista a dependência.

3. **[MÉDIO] 3 dependências fantasmas + 2 em devDependencies errado**
   - Não usadas: channel-router (2 workers), humanizer (1 worker).
   - devDeps: scoring tem worker-classification e worker-extraction em deps mas só usa em testes.

4. **[BAIXO] enrichment worker é stub vazio** — placeholder sem lógica de negócio.

### Passos

- **12.1** Corrigir retorno do news-radar — adicionar `ok: true`, remover `reasonCode`.
- **12.2** Adicionar `@plataforma/meta-api` ao package.json do competitive-intel.
- **12.3** Remover deps fantasmas; mover deps de teste para devDependencies no scoring.

---

## Etapa 13 — Suite de testes — 11 falhas

### Achados

1. **[CRÍTICO] 6 testes publisher/threads-publisher falhando**
   - `Cannot read properties of undefined (reading 'migrationsCurrent')`
   - Mock do preflight não provê WorkerPreflight completo.

2. **[ALTO] 4 testes do design-system store falhando**
   - `useTemplateLibraryStore.persist.clearStorage()` — `clearStorage` é undefined.

3. **[MÉDIO] 24 test files falhando no total**
   - 160 arquivos, 24 falharam, 136 passaram. 278 testes, 11 falharam, 267 passaram.

### Passos

- **13.1** Corrigir mocks de preflight nos testes de publisher e threads-publisher.
- **13.2** Corrigir persist middleware no useTemplateLibraryStore ou atualizar teste.
- **13.3** Investigar os 18 test files restantes — rodar vitest com `--reporter=verbose`.

---

## Ordem de execução sugerida

1. **Etapa 1** (Segurança) — blocker de deploy
2. **Etapa 2** (TypeScript) — blocker de build
3. **Etapa 12** (Workers) — blocker de runtime
4. **Etapa 13** (Testes) — blocker de CI
5. **Etapa 6** (Error handling) — risk de leak
6. **Etapa 4** (Tailwind rewrite) — página quebrada
7. **Etapa 3 + 10** (Botões + APIs) — funcionalidade core
8. **Etapa 5** (Stubs) — funcionalidade secundária
9. **Etapa 7** (Loading states) — UX polish
10. **Etapa 8** (Design system) — consistência
11. **Etapa 9** (Acessibilidade) — compliance
12. **Etapa 11** (UX) — melhorias finais
