# Plano de evolução UI/UX do Prospector — v2

Status: **planejado, ainda não executado**
Data do diagnóstico: **2026-08-11**
Decisões técnicas consolidadas: **2026-08-12**
Escopo: todas as páginas, abas, estados, componentes e integrações do Prospector em `/prospector`
Objetivo: tornar o Prospector uma central operacional profissional, clara e completa, sem mocks, sem controles decorativos e sem regressão funcional.

---

## 1. Resultado esperado

Ao final da execução, o Prospector deverá:

- apresentar uma linguagem visual consistente com o Design System do monorepo;
- permitir entender propósito, dados, requisitos e uso de cada página por meio de ajuda contextual;
- trocar telas genéricas por experiências específicas para CRM, inteligência, conteúdo, automações e operação multicanal;
- usar gráficos, tabelas, timelines, kanbans e editores apenas quando forem alimentados por dados e ações reais;
- manter contexto, filtros e dados visíveis durante atualização, sem piscar ou desmontar a página;
- tornar cada ação importante fácil de localizar, segura, auditável e recuperável;
- integrar o fluxo Prospector → Design System → render → publicação com estado e retorno visíveis;
- funcionar em desktop, tablet e celular, com teclado e leitores de tela;
- deixar integrações sem credencial claramente identificadas como **Não configuradas**, sem simular sucesso;
- impedir por CI o retorno de mocks, botões inertes, links quebrados, 404/500 e regressões visuais críticas.

## 2. Diagnóstico atual confirmado

### 2.1 Pontos fortes a preservar

- Todas as rotas principais já leem dados reais e respeitam a campanha ativa.
- A troca de campanha é persistida e aplicada às consultas.
- Há estados vazios honestos e checagem de integrações não configuradas.
- Os fluxos centrais já possuem endpoints e mutações reais em vários domínios.
- O primeiro carregamento usa dados do servidor e as atualizações preservam o conteúdo anterior.
- O monorepo já possui tokens, ECharts, React Flow, Radix, Lucide, Sonner, DnD Kit, Storybook, Playwright e axe-core no Design System.
- O pacote `@plataforma/ui-bridge` já é o ponto de integração visual entre as aplicações.

### 2.2 Lacunas visuais e de experiência

- Overview, Radar, Inteligência competitiva, Comunidades, Timeline e ROI ainda compartilham uma apresentação operacional genérica.
- Várias páginas repetem o padrão "KPIs + cartões + texto", sem hierarquia específica do trabalho realizado.
- Os KPIs mostram valores, mas raramente tendência, comparação, explicação, meta ou drill-down.
- As tabelas virtuais não possuem cabeçalho de colunas, ordenação, redimensionamento, seleção e paginação consistentes.
- O shell usa glifos simples em vez de iconografia profissional e tem navegação móvel horizontal extensa.
- A paleta de comandos busca apenas páginas; não encontra leads, conteúdos, conversas ou ações.
- O papel exibido no shell está fixo visualmente como `actor`, sem refletir sessão e permissões reais.
- Há dois vocabulários de tokens CSS (`--bg-*` e `--background/--surface`) e estilos globais muito concentrados.
- Formulários, modais, mensagens, botões e estados ocupados variam entre páginas.
- Modais próprios não oferecem o mesmo nível de foco, teclado e semântica dos componentes Radix já usados no Design System.
- Há pouca visualização de tendências, funis, distribuição, capacidade, dependências e saúde ao longo do tempo.
- Ajuda está concentrada em runbooks técnicos; falta orientação de produto dentro de cada recurso.
- Parte dos caminhos ainda aparece hardcoded com `/prospector`, em vez de usar a função central de base path.
- Storybook cobre somente parte das páginas e os testes de acessibilidade não representam todos os estados.

### 2.3 Princípio da v2

Esta versão não repetirá a primeira melhoria. Ela evoluirá o produto em quatro camadas:

1. **fundação compartilhada** — tokens, componentes, acessibilidade e comportamento;
2. **clareza operacional** — contexto, prioridades, explicações e próximos passos;
3. **experiências por domínio** — CRM, inteligência, conteúdo, canais, governança e sistema;
4. **automação integrada** — ações do Prospector acionando o Design System e retornando progresso e artefatos reais.

## 3. Decisões técnicas consolidadas

As decisões abaixo foram tomadas em sessão de design em 2026-08-12 e são vinculantes para toda a execução. A IA executora **não deve** reabrir essas escolhas nem propor alternativas.

### 3.1 Data grid → `@tanstack/react-table`

Adotar `@tanstack/react-table` diretamente (sem fase de protótipo). O projeto já usa `@tanstack/react-virtual` no `DataTable` do ui-bridge. A react-table se integra nativamente com a react-virtual existente e fornece headers, ordenação, seleção, paginação e column resize headless. O `DataTable` atual em `packages/ui-bridge/src/patterns.tsx` será substituído pelo novo componente `DataGrid` baseado em react-table.

### 3.2 Sidebar → colapsável com ícones

Modelo Linear/Vercel: modo expandido mostra ícone Lucide + texto; modo colapsado mostra ícone + tooltip. O estado (expandido/colapsado) é persistido em `localStorage` com chave `prospector_sidebar_collapsed`. No mobile (largura < 768px), a sidebar vira um Drawer com overlay, aberto por botão hamburger no header. A barra horizontal de navegação móvel atual será removida.

### 3.3 Tokens CSS → convenção semântica por uso

Adotar naming semântico: `--surface-canvas`, `--surface-card`, `--surface-overlay`, `--surface-subtle`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-default`, `--border-strong`, `--accent-primary`, `--accent-secondary`. Fazer find-replace de `--bg-canvas` → `--surface-canvas`, `--bg-surface` → `--surface-card`, `--bg-subtle` → `--surface-subtle` em todos os arquivos. Atualizar o objeto `semanticTokens` em `packages/ui-bridge/src/index.ts` para refletir os novos nomes.

### 3.4 Command palette → `kbar`

Usar a biblioteca `kbar` para command palette. Suporta nested actions, shortcut registration e ações hierárquicas. Instalar `kbar` no app web. Criar providers por tipo: `PagesProvider` (navegação), `LeadsProvider` (busca por lead com fetch sob demanda), `ContentProvider` (teses, oportunidades, conteúdos), `ActionsProvider` (criar tese, abrir fila, testar integração, etc.). Ativação por `Ctrl+K` / `Cmd+K`.

### 3.5 Help content → objeto TS tipado

Criar `src/lib/help-registry.ts` com `Record<string, HelpContent>` onde a chave é o path da rota. Definir tipo `HelpContent` com schema Zod:

```ts
const HelpContentSchema = z.object({
  title: z.string(),
  what: z.string(),
  whenToUse: z.string(),
  metrics: z.array(z.object({ name: z.string(), explanation: z.string() })).optional(),
  steps: z.array(z.object({ title: z.string(), description: z.string() })),
  dataSources: z.array(z.object({ name: z.string(), frequency: z.string() })),
  integrations: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  shortcuts: z.array(z.object({ key: z.string(), action: z.string() })).optional(),
  relatedLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
})
```

O conteúdo é type-safe, tree-shakeable por rota (import dinâmico), sem dependência de MDX runtime.

### 3.6 Chart theme → derivado dos tokens semânticos

O tema ECharts será gerado automaticamente a partir dos tokens CSS semânticos. Criar `src/lib/echarts-theme.ts` que lê os valores computados de `--accent-primary`, `--accent-secondary`, `--status-success`, `--status-warn`, `--status-error`, `--status-info`, `--score-high`, `--score-med`, `--score-low` e monta o objeto de tema ECharts. O tema se adapta automaticamente ao modo claro/escuro. Não definir cores hardcoded nos gráficos.

### 3.7 Estratégia de refresh → polling inteligente

Usar `setInterval` com backoff + revalidação ao focar a aba (`document.visibilitychange`). Sem SSE, sem infra nova. Intervalos por tipo de rota:

| Tipo de rota | Intervalo ativo | Intervalo em background | Exemplo |
| --- | --- | --- | --- |
| Fila/inbox | 15s | 60s | engagement-queue, conversations |
| Dashboard | 60s | 300s | overview, system-health |
| Listagem | manual (pull-to-refresh ou botão) | — | leads, theses, content-items |
| Configuração | sem polling | — | configs, accounts, ai-settings |

Criar hook `usePolling(fetcher, { interval, backgroundInterval })` no ui-bridge. Todas as rotas preservam o último dado válido durante refresh (`stale-while-revalidate` manual).

### 3.8 Loading → RSC + streaming parcial (Suspense boundaries)

Cada página é um Server Component que faz fetch direto (como `leads/page.tsx` já faz). Usar `<Suspense>` boundaries por seção da página: KPIs carregam primeiro, tabela/conteúdo principal depois, sidebar/detalhes por último. Cada boundary tem seu skeleton com a geometria final. O `loading.tsx` de cada rota mostra o layout completo com skeletons nas posições corretas. **Não** usar double-skeleton (loading.tsx genérico + skeleton no client). O `DashboardPage` e `OperationalDashboard` em `apps/web/src/components/` serão refatorados para este pattern.

### 3.9 E2E → smoke por rota + 3 jornadas críticas

Escopo realista de E2E para cada PR:

1. **Smoke test**: todas as 28 rotas carregam sem erro de console, sem 404/500, sem crash de hidratação.
2. **Jornada 1 — Login e navegação**: OTP → troca de campanha → navegar por 5 rotas → verificar dados mudam.
3. **Jornada 2 — Lead operacional**: abrir leads → filtrar P0 → abrir painel 360° → preparar contato → verificar auditoria.
4. **Jornada 3 — Conteúdo end-to-end**: abrir tese → aprovar oportunidade → criar conteúdo → verificar na bridge.

As 5 jornadas adicionais do plano original ficam como metas pós-deploy, implementadas incrementalmente.

### 3.10 Feature flags → LaunchDarkly/Unleash

Usar LaunchDarkly ou Unleash (avaliar qual tem plano gratuito adequado no momento da implementação) para feature flags em substituições de alto impacto. Wraping: `if (flags.newSidebar) { <NewSidebar /> } else { <LegacySidebar /> }`. Flags obrigatórias para: nova sidebar, novo data grid, novo command palette. Flags opcionais para: novo layout de página individual. Remover flags após rollout completo (máximo 30 dias após ativação).

### 3.11 Estratégia de PRs → 1 PR por fase

Cada fase gera uma PR autossuficiente e testável. Total de ~11 PRs na sequência:

| PR | Fase | Conteúdo | Pré-requisito |
| --- | --- | --- | --- |
| PR-01 | 0 | Baseline, inventário, guardrails | nenhum |
| PR-02 | 1 | Tokens, primitivos, grid, bridge | PR-01 merged |
| PR-03 | 2 | Shell, sidebar, header, kbar, help, microcopy | PR-02 merged |
| PR-04 | 3 | Loading/streaming, lazy imports, responsivo | PR-03 merged |
| PR-05 | 4 | Overview, Leads, Review Inbox, Timeline, Identities | PR-04 merged |
| PR-06 | 5 | Radar, Market Radar, Competitive Intel, Community, ROI | PR-05 merged |
| PR-07 | 6 | Teses, Oportunidades, Conteúdos, Bridge, Publicação | PR-06 merged |
| PR-08 | 7 | Conversas, Email Flows, WhatsApp, Policies, Queue | PR-07 merged |
| PR-09 | 8 | Accounts, AI, Configs, Notifications, Health, Login | PR-08 merged |
| PR-10 | 9 | Contrato de automação, ações integradas, consistência | PR-09 merged |
| PR-11 | 10-11 | Acessibilidade, E2E, guardrails finais, rollout | PR-10 merged |

A execução é **sequencial**. Não pular fases. A IA executora deve completar uma PR inteira antes de iniciar a próxima.

## 4. Regras obrigatórias da execução

1. Nenhum dado demonstrativo, aleatório, estático ou sintético poderá entrar em produção.
2. Fixtures serão permitidas somente em Storybook e testes, fora do bundle de produção.
3. Nenhum botão, menu, ícone, aba, filtro ou card clicável poderá existir sem efeito real.
4. Ações futuras não implementadas não serão exibidas como habilitadas; deverão ser omitidas ou explicadas como indisponíveis.
5. Toda mutação terá permissão, validação, estado ocupado, idempotência, feedback, auditoria e tratamento de erro.
6. Toda informação será escopada por campanha, conta, papel e permissão quando aplicável.
7. Nenhuma chave ou segredo voltará ao navegador após ser salvo.
8. Integrações sem variáveis permanecerão inativas e mostrarão exatamente o que falta.
9. A interface manterá o último dado válido durante refresh e reconexão.
10. Filtros compartilháveis ficarão na URL; preferências pessoais ficarão em armazenamento estável, sem mudança pós-hidratação.
11. Bibliotecas pesadas serão importadas dinamicamente e somente nas rotas que as usam.
12. A execução será feita em PRs por fase, com CI e validação visual antes de cada merge.
13. Builds, auditorias e E2E pesados continuarão no GitHub/VPS, não no computador local.
14. Não haverá deploy antes de todas as verificações da fase correspondente estarem verdes.

## 5. Arquitetura visual e técnica

### 5.1 Núcleo compartilhado

Expandir `@plataforma/ui-bridge` (`packages/ui-bridge/src/`) para ser a camada pública e estável de UI operacional. Componentes internos de `apps/design-system/src/` não serão importados por caminhos privados.

O bridge deverá expor (organizados em arquivos separados dentro de `packages/ui-bridge/src/`):

| Arquivo | Exports |
| --- | --- |
| `tokens.ts` | `semanticTokens` (atualizado para convenção semântica), `typography`, `spacing`, `radius`, `elevation` |
| `primitives.tsx` | `Button`, `IconButton`, `AsyncButton`, `ActionMenu`, `SplitButton`, `CopyButton`, `Input`, `Select`, `Checkbox`, `Switch`, `Textarea` |
| `dialogs.tsx` | `Dialog`, `AlertDialog`, `Drawer`, `ConfirmDialog`, `ConfirmDestructiveDialog` (evoluído do existente) |
| `feedback.tsx` | `ToastProvider`, `AsyncBanner`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `StatePanel` |
| `layout.tsx` | `PageHeader`, `Breadcrumbs`, `ActionBar`, `ThreePaneLayout`, `DetailDrawer`, `RightDetailPane` |
| `data.tsx` | `DataGrid` (react-table), `KpiCard`, `KpiRow`, `MetricGroup`, `InsightCard`, `NextBestActionCard`, `DataQualityBadge` |
| `charts.tsx` | `ChartContainer` (lazy ECharts com tema), `SparklineInline` |
| `operational.tsx` | `SourceFreshness`, `IntegrationGate`, `PermissionGate`, `LiveBadge`, `RunbookLink`, `HealthDial`, `QuotaMeter` |
| `multichannel.tsx` | `ChannelBadge`, `ChannelTimeline`, `IdentityStrip`, `ContactPolicyIndicator`, `OptinEvidenceCard`, `NbaWithChannel` |
| `content.tsx` | `ContentItemCard`, `VariantPreview`, `MarketSignalCard`, `StatusBadge`, `ScoreBadge`, `PriorityChip`, `ConfidencePill` |
| `patterns.tsx` | `FilterBar`, `SavedViewTabs`, `KanbanBoard`, `TimelineFeed`, `SuggestedActionCard`, `FlowCanvas`, `GroupPolicyForm`, `RowActionsMenu`, `RoleBadge` |
| `help.tsx` | `ResourceHelpDrawer` |
| `index.ts` | re-exporta tudo |

### 5.2 Bibliotecas autorizadas (decisão final)

| Biblioteca | Uso | Estratégia |
| --- | --- | --- |
| `lucide-react` | ícones consistentes, com rótulo acessível | reutilizar a versão já instalada no Design System |
| `radix-ui` | dialogs, menus, tabs, tooltip, popover, select e foco | expor wrappers pelo bridge; não duplicar estilos por página |
| `sonner` | confirmação não bloqueante de sucesso/erro | um único toaster no shell; mensagem inline continua obrigatória em formulários |
| `echarts` + `echarts-for-react` | séries temporais, funis, distribuição e capacidade | importação dinâmica por rota; tema derivado dos tokens semânticos (seção 3.6) |
| `@xyflow/react` | editor visual de fluxos de e-mail | carregar apenas em `/email-flows`; persistir grafo real |
| `@dnd-kit/*` | reordenar etapas, kanban e agenda | usar somente onde a alteração for persistida e houver alternativa por teclado |
| `react-hook-form` + `zod` | formulários complexos e validação compartilhada | schemas usados no cliente e no endpoint |
| `@tanstack/react-table` | data grid profissional headless | **adoção direta** — criar `DataGrid` no bridge usando react-table + react-virtual existente |
| `kbar` | command palette com nested actions e shortcuts | instalar no app web; criar providers por tipo (pages, leads, content, actions) |
| `launchdarkly-react-client-sdk` ou `@unleash/proxy-client-react` | feature flags para rollout gradual | avaliar qual tem plano free adequado; usar para sidebar, grid e kbar no mínimo |

**Não instalar** uma segunda biblioteca de gráficos, ícones, toast, modal ou drag-and-drop.

### 5.3 Contrato de página

Toda página operacional deverá usar a mesma anatomia:

1. breadcrumbs quando houver hierarquia real;
2. título, descrição curta e estado da fonte;
3. ações primária e secundárias;
4. botões **Como usar** e **Sobre este recurso** (alimentados por `help-registry.ts`);
5. filtros globais relevantes, incluindo período quando aplicável;
6. KPIs ou resumo somente se ajudarem uma decisão;
7. conteúdo principal específico do domínio, dentro de `<Suspense>` boundaries;
8. painel de detalhe ou drawer preservando o contexto da lista;
9. rodapé discreto com atualização, fonte e cobertura;
10. feedback acessível para atualização, sucesso, erro e bloqueio.

### 5.4 Ajuda contextual

Criar `ResourceHelpDrawer` em `packages/ui-bridge/src/help.tsx`, alimentado por `src/lib/help-registry.ts`.

O drawer terá duas entradas visíveis no `PageHeader`: **Como usar** e **Sobre**. O conteúdo será type-safe (schema Zod, seção 3.5), pesquisável pelo kbar (seção 3.4) e testado contra links quebrados na CI.

Para cada rota, o registro deve conter no mínimo: `title`, `what`, `whenToUse`, `steps` (3+) e `dataSources`. Os campos opcionais (`metrics`, `integrations`, `permissions`, `limitations`, `shortcuts`, `relatedLinks`) devem ser preenchidos quando aplicáveis.

### 5.5 Estados assíncronos

Padronizar os estados no componente `StatePanel`:

| Estado | Comportamento | Componente |
| --- | --- | --- |
| `initial_loading` | skeleton com a geometria final (Suspense fallback) | `LoadingSkeleton` adaptado por seção |
| `refreshing` | conteúdo preservado + spinner discreto no header | `LiveBadge` com `refreshing` |
| `success` | dado, fonte e horário de atualização | conteúdo normal + `SourceFreshness` |
| `empty` | ainda não existem registros | `EmptyState` com orientação de criação |
| `filtered_empty` | filtros não encontraram registros | `EmptyState` com botão "Limpar filtros" |
| `not_configured` | faltam integração ou credenciais | `IntegrationGate` com checklist do que falta |
| `partial` | uma fonte indisponível, mas há dados úteis | `AsyncBanner` kind=partial + conteúdo parcial |
| `blocked` | política, permissão ou janela impede a ação | `AsyncBanner` kind=blocked + explicação |
| `error` | falha recuperável | `ErrorState` com traceId, retry e runbook |
| `offline/reconnecting` | dados preservados, sem alegar atualização | `LiveBadge` com `reconnecting` |

## 6. Fases de execução

### Fase 0 — Baseline e inventário executável

**PR-01** — Nenhum código de UI é alterado. Apenas documentação, testes e guardrails.

#### Etapa 0.1 — Matriz de rotas e estados

- [ ] Atualizar `docs/inventario-ui-ux-prospector.md` para incluir todas as 28 rotas da seção 8 (Matriz).
- [ ] Para cada rota, documentar em tabela: queries SQL usadas, endpoints de API, mutações, integrações externas, papéis e tabelas do banco.
- [ ] Para cada controle visível (botão, link, filtro, aba, select), documentar: handler associado, efeito (endpoint/mutação chamada), se há auditoria, e qual estado de erro é tratado.
- [ ] Para cada rota, registrar quais dos 10 estados assíncronos (seção 5.5) estão implementados e quais faltam.
- [ ] Marcar explicitamente dependências indisponíveis (WhatsApp Groups API, integrações sem credencial) como `status: unavailable`.

**Arquivo de saída**: `docs/inventario-ui-ux-prospector.md` atualizado.

#### Etapa 0.2 — Evidência de produção

- [ ] Capturar screenshots em 3 viewports (1280×800 desktop, 768×1024 tablet, 375×812 mobile) de todas as 28 rotas, nas duas campanhas (Rota de Ataque e Gazeta Concursos).
- [ ] Registrar erros de console (errors, warnings), erros de rede (4xx, 5xx), erros de hidratação e violações axe-core.
- [ ] Medir e registrar LCP, CLS, INP, tamanho total do bundle JS por rota e as 5 queries mais lentas.
- [ ] Gravar vídeos curtos (< 10s) das navegações que apresentam flash, salto de layout ou perda de contexto.
- [ ] Salvar evidências em `docs/baseline/` como artefato da CI, sem incluir credenciais ou dados sensíveis.

**Arquivo de saída**: `docs/baseline/` com screenshots, métricas em JSON e vídeos.

#### Etapa 0.3 — Contratos de não regressão

- [ ] Ampliar `production-ui-guardrails.test.ts` para detectar: imports de fixtures em código de produção, textos estáticos de demonstração, respostas mockadas e imports de `faker`/`@faker-js`.
- [ ] Adicionar detecção de: botões sem `onClick`/`onSubmit`/`href`, links com `href="#"` ou vazio, caminhos hardcoded `/prospector` fora de `appPath()`, abas que não alteram conteúdo observável.
- [ ] Adicionar smoke test que navega cada rota autenticada e falha em qualquer requisição 4xx/5xx inesperada.
- [ ] Definir orçamento de bundle por tipo de página e registrar em `docs/bundle-budget.json`:
  - Listagem: ≤ 200KB JS comprimido
  - Dashboard: ≤ 250KB JS comprimido
  - Editor (flows): ≤ 400KB JS comprimido
  - Configuração: ≤ 150KB JS comprimido

**Critério de aceite**: 100% das rotas e ações têm baseline documentado. Guardrails passam na CI.

---

### Fase 1 — Fundação do Design System operacional

**PR-02** — Tokens, primitivos, data grid e bridge expandido. Nenhuma página de rota é alterada nesta fase.

#### Etapa 1.1 — Tokens

- [ ] Criar `packages/ui-bridge/src/tokens.ts` com o contrato único de tokens semânticos.
- [ ] Fazer find-replace global:
  - `--bg-canvas` → `--surface-canvas`
  - `--bg-surface` → `--surface-card`
  - `--bg-subtle` → `--surface-subtle`
  - `var(--bg-canvas)` → `var(--surface-canvas)` (e equivalentes)
- [ ] Atualizar o objeto `semanticTokens` em `packages/ui-bridge/src/index.ts` para os novos nomes.
- [ ] Manter os nomes antigos como aliases CSS temporários (`:root { --bg-canvas: var(--surface-canvas) }`) para evitar quebra durante a migração. Remover na PR-11.
- [ ] Definir escalas em `tokens.ts`:
  - Tipografia: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px)
  - Espaçamento: `space-1` (4px) até `space-12` (48px) em incrementos de 4px
  - Raio: `radius-sm` (4px), `radius-md` (6px), `radius-lg` (8px), `radius-xl` (12px), `radius-full`
  - Elevação: `shadow-sm`, `shadow-md`, `shadow-lg`
  - Densidade: `density-comfortable` (padding 12px), `density-compact` (padding 8px)
- [ ] Definir cores semânticas para: prioridade (P0=vermelho, P1=laranja, P2=amarelo, P3=cinza), intenção, confiança, saúde, canal e estado.
- [ ] Verificar contraste AA (4.5:1 texto, 3:1 UI) nos temas claro e escuro.
- [ ] Aplicar `font-variant-numeric: tabular-nums` ao `KpiCard`, `DataGrid`, `QuotaMeter` e `MetricGroup`.

**Verificação**: `pnpm build` sem erros. Nenhum estilo quebrado visualmente (comparar screenshots com baseline).

#### Etapa 1.2 — Primitivos compartilhados

- [ ] Criar `packages/ui-bridge/src/primitives.tsx`:
  - `Button` com variantes: `primary`, `secondary`, `quiet`, `danger`, `icon-only`. Props: `variant`, `size` (sm/md/lg), `loading`, `disabled`, `asChild`. Usar `<button>` nativo com estilos por data-attribute.
  - `IconButton` com props: `icon` (componente Lucide), `label` (string, obrigatório para acessibilidade), `tooltip` (boolean, default true). Renderiza `<button>` com `aria-label`.
  - `AsyncButton` — Button que aceita `onClick` async, mostra spinner durante execução, desabilita durante loading, previne clique duplo.
  - `ActionMenu` — wrapper Radix `DropdownMenu` com trigger customizável.
  - `SplitButton` — botão primário + dropdown de ações secundárias.
  - `CopyButton` — copia texto para clipboard com feedback "Copiado" via tooltip temporário.
- [ ] Criar `packages/ui-bridge/src/fields.tsx`:
  - `InputField` com label, description, error message, character counter e estado loading.
  - `SelectField` wrapper de Radix Select com label e error.
  - `CheckboxField` e `SwitchField` com label acessível.
  - `TextareaField` com auto-resize, label, error e counter.
- [ ] Exportar wrappers Radix que o Design System já usa: Dialog, AlertDialog, Popover, Tooltip, Tabs, DropdownMenu. Criar em `packages/ui-bridge/src/dialogs.tsx`.
- [ ] Criar `Drawer` (Radix Dialog com posição lateral, responsivo).
- [ ] Criar `ConfirmDialog` (AlertDialog com botão de confirmação que fica habilitado após 3s, como `ConfirmDestructiveDialog` existente mas reutilizável).
- [ ] Criar `ToastProvider` global em `packages/ui-bridge/src/feedback.tsx` usando Sonner. Contrato: `toast.success(message)`, `toast.error(message, { traceId?, runbook? })`, `toast.info(message)`.

**Verificação**: cada componente tem story em Storybook com todas as variantes. axe-core sem violações critical/serious em cada story.

#### Etapa 1.3 — Componentes operacionais

- [ ] Evoluir `PageHeader` em `packages/ui-bridge/src/layout.tsx`:
  - Adicionar prop `breadcrumbs: Array<{ label: string, href?: string }>`.
  - Adicionar prop `metadata: ReactNode` (para mostrar fonte, atualização, campanha).
  - Adicionar prop `helpKey: string` que renderiza botões "Como usar" e "Sobre" conectados ao `ResourceHelpDrawer`.
  - Manter backward-compatible com interface atual (title, subtitle, actions).
- [ ] Evoluir `KpiCard` em `packages/ui-bridge/src/data.tsx`:
  - Adicionar props: `period`, `sparklineData`, `explanation`, `drillDownHref`.
  - Sparkline inline (SVG simples, sem ECharts) de ~60×20px.
  - Delta mostra seta + porcentagem + cor semântica (verde positivo, vermelho negativo, cinza neutro).
- [ ] Criar `MetricGroup` — container para 3-6 `KpiCard` em grid responsivo (1 col mobile, 2 tablet, 3-4 desktop).
- [ ] Criar `InsightCard` — card com título, corpo, `ConfidencePill`, fonte e ação.
- [ ] Criar `NextBestActionCard` — evolução do `SuggestedActionCard` com `ChannelBadge`, rationale expandível, confidence e botões Aprovar/Revisar.
- [ ] Criar `DataQualityBadge` — indicador de cobertura/qualidade com tooltip explicativo.
- [ ] Criar `SourceFreshness` — mostra "Atualizado há X min · via Y".
- [ ] Criar `IntegrationGate` — bloqueia conteúdo e mostra checklist do que falta quando integração não está configurada.
- [ ] Criar `PermissionGate` — bloqueia ação e mostra qual permissão é necessária.
- [ ] Criar `StatePanel` tipado — componente que aceita `state: AsyncState` e renderiza o componente correto (EmptyState, ErrorState, IntegrationGate, etc.) conforme tabela da seção 5.5.
- [ ] Criar `DetailDrawer` — Drawer responsivo (drawer no mobile, painel lateral no desktop) que preserva o contexto da lista ao abrir detalhes.

**Verificação**: Storybook com todas as variantes e estados. axe-core sem violações. Tema claro/escuro funcional.

#### Etapa 1.4 — Data grid

- [ ] Instalar `@tanstack/react-table` em `packages/ui-bridge`.
- [ ] Criar `DataGrid` em `packages/ui-bridge/src/data.tsx`:
  - Props tipadas: `columns: ColumnDef<T>[]`, `data: T[]`, `rowKey`, `density` ('comfortable' | 'compact'), `enableSorting`, `enableSelection`, `enablePagination`, `pageSize`, `onRowClick`, `actions: (row: T) => ReactNode`.
  - Header com cabeçalho de colunas clicável para ordenação (asc/desc/none).
  - Seleção por checkbox na primeira coluna, com select-all no header.
  - Paginação por cursor ou offset (prop `paginationMode`).
  - Column resize por drag (armazenado em state local).
  - Ações de linha via `RowActionsMenu` (já existente, adaptar).
  - Ações em massa: barra flutuante quando há seleção, com contagem e botões contextuais.
  - Virtualização via `@tanstack/react-virtual` para listas > 50 itens.
  - Para listas ≤ 50 itens, renderizar sem virtualização (prop `virtualize: false`).
  - Navegação por teclado: Arrow keys entre células, Enter para ação, Space para seleção.
  - `aria-label` no container, `role="grid"`, `role="row"`, `role="gridcell"`.
  - Anúncio de seleção via `aria-live="polite"`.
  - Foco visível com anel consistente.
- [ ] Manter o `DataTable` antigo exportado como deprecated (remover na PR-11 após migração de todas as rotas).

**Verificação**: Story com dados de exemplo (fixtures de teste apenas). Teste de interação: ordenar, selecionar, paginar, navegar por teclado. axe sem violações.

**Critério de aceite da Fase 1**: Todos os componentes compartilhados possuem Storybook, testes de interação, axe e tema claro/escuro. `pnpm build` verde. Nenhuma rota existente quebrada.

---

### Fase 2 — Shell, navegação e conteúdo

**PR-03** — Shell, sidebar, header, command palette, help drawer e microcopy. As rotas individuais não mudam de conteúdo, mas ganham o novo shell.

#### Etapa 2.1 — Sidebar profissional

- [ ] Refatorar `apps/web/src/components/AppShell.tsx`:
  - Substituir glifos textuais por ícones `lucide-react`. Mapeamento:

    | Grupo | Rota | Ícone Lucide |
    | --- | --- | --- |
    | Visão | Overview | `LayoutDashboard` |
    | Prospecção | Leads | `Users` |
    | Prospecção | Review Inbox | `Inbox` |
    | Prospecção | Timeline | `Clock` |
    | Prospecção | Identidades | `Fingerprint` |
    | Inteligência | Radar | `Radar` |
    | Inteligência | Market Radar | `Radio` |
    | Inteligência | Competitiva | `Swords` |
    | Inteligência | Comunidades | `Network` |
    | Conteúdo | Teses | `Lightbulb` |
    | Conteúdo | Oportunidades | `Sparkles` |
    | Conteúdo | Conteúdos | `FileText` |
    | Conteúdo | Bridge | `Palette` |
    | Conteúdo | Publicação | `Calendar` |
    | Canais | Conversas | `MessageSquare` |
    | Canais | Email Flows | `Mail` |
    | Canais | WhatsApp Groups | `Phone` |
    | Governança | Políticas | `Shield` |
    | Governança | Fila | `ListTodo` |
    | Sistema | Contas | `Link` |
    | Sistema | IA | `Bot` |
    | Sistema | Configs | `Settings` |
    | Sistema | ROI | `TrendingUp` |
    | Sistema | Notificações | `Bell` |
    | Sistema | Saúde | `Activity` |

  - Implementar toggle expandido/colapsado:
    - Expandido: ícone (20px) + texto do item, largura 240px.
    - Colapsado: ícone (20px) centrado + tooltip com nome, largura 56px.
    - Botão toggle no rodapé da sidebar (ícone `PanelLeftClose` / `PanelLeftOpen`).
    - Estado persistido em `localStorage` chave `prospector_sidebar_collapsed`.
  - Manter os grupos atuais (Visão, Prospecção, Inteligência, Conteúdo, Canais, Governança, Sistema).
  - Mostrar contadores somente para: Review Inbox (pendentes), Engagement Queue (pendentes), Conversations (não lidas). Buscar contagem via endpoint existente. Não mostrar contador zero.
  - Mostrar dot vermelho discreto em destinos com integração com erro (dados do endpoint de saúde).
  - **Mobile** (viewport < 768px): sidebar vira `Drawer` do bridge, aberto por botão hamburger (`Menu` icon) no header. **Remover** a barra horizontal de navegação móvel existente.
  - Preservar `aria-current="page"` no item ativo. Foco visível em todos os itens.
  - **Feature flag**: wrapping com `if (flags.newSidebar)` via LaunchDarkly/Unleash. Fallback para sidebar atual.

#### Etapa 2.2 — Header global

- [ ] Refatorar header em `AppShell.tsx`:
  - Mostrar nome do usuário e papel reais da sessão (não fixo como `actor`).
  - Campanha: mostrar nome + avatar/cor. Seletor dropdown com busca por nome. Troca rápida sem reload de página (revalidar dados das seções via `router.refresh()` ou refetch).
  - Período global: mostrar seletor de período (7d, 30d, 90d, custom) somente nas rotas que suportam filtro temporal (overview, leads, radar, timeline, roi). Persistir na URL como `?period=30d`.
  - Saúde: badge discreto "Normal" (verde), "Atenção" (amarelo), "Parcial" (vermelho). Popover ao clicar com lista dos problemas ativos. Dados do endpoint `/api/health`.
  - Notificações: ícone `Bell` com badge de contagem. Popover com as 5 notificações mais recentes. Link "Ver todas" → `/notifications`.
  - Layout estável: nenhum shift durante troca de campanha (usar largura fixa ou min-width no seletor).

#### Etapa 2.3 — Command palette (kbar)

- [ ] Instalar `kbar` no app web (`pnpm add kbar` em `apps/web`).
- [ ] Criar `apps/web/src/components/CommandPalette.tsx`:
  - Montar `KBarProvider` no `AppShell` com ações registradas por provider:

    **PagesProvider** (estático):
    - Uma ação por rota (28 rotas). `name`: título da rota. `shortcut`: nenhum. `perform`: `router.push(path)`.

    **LeadsProvider** (dinâmico):
    - Buscar leads por nome conforme o usuário digita (debounce 300ms, mínimo 2 caracteres).
    - `perform`: `router.push(/leads?selected=${id})`.
    - Respeitar campanha ativa.

    **ContentProvider** (dinâmico):
    - Buscar teses, oportunidades e conteúdos por título.
    - Agrupar resultados por tipo.

    **ActionsProvider** (estático, filtrado por permissão):
    - "Criar tese" → `router.push('/theses?action=create')`
    - "Abrir fila de engagement" → `router.push('/engagement-queue')`
    - "Criar oportunidade" → `router.push('/content-opportunity?action=create')`
    - "Testar integração" → `router.push('/accounts?action=test')`
    - "Pausar sistema" → `router.push('/system-health?action=killswitch')`

    **HelpProvider** (estático):
    - Uma ação por entrada do `help-registry.ts`. `perform`: abre o `ResourceHelpDrawer` na rota correspondente.

  - Agrupar resultados por tipo com headers: Páginas, Leads, Conteúdo, Ações, Ajuda.
  - Suportar navegação por teclado (↑↓ para selecionar, Enter para executar, Esc para fechar).
  - Mostrar atalhos de teclado quando disponíveis.
  - Respeitar campanha, papel e permissão (ocultar ações não permitidas).
  - Registrar na auditoria: navegações para rotas administrativas e mutações de alto risco.
  - **Feature flag**: `if (flags.newCommandPalette)`.

#### Etapa 2.4 — Help drawer

- [ ] Criar `apps/web/src/lib/help-registry.ts`:
  - Definir `HelpContentSchema` (Zod) conforme seção 3.5.
  - Criar registro com conteúdo para todas as 28 rotas. Para esta PR, preencher conteúdo completo para as 5 rotas mais usadas (overview, leads, theses, conversations, system-health) e conteúdo mínimo (`title`, `what`, `whenToUse`, `steps`, `dataSources`) para as demais.
  - Validar o registro inteiro com Zod no build time (test ou script).
- [ ] Criar `ResourceHelpDrawer` em `packages/ui-bridge/src/help.tsx`:
  - Aceita `content: HelpContent` e `tab: 'how-to' | 'about'`.
  - Tab "Como usar": renderiza `steps` como lista numerada e `shortcuts` como tabela.
  - Tab "Sobre": renderiza `what`, `whenToUse`, `metrics`, `dataSources`, `integrations`, `permissions`, `limitations` em seções com headings.
  - Links em `relatedLinks` abrem em nova aba.
- [ ] Integrar no `PageHeader`: botões "Como usar" e "Sobre" abrem o drawer com a tab correspondente.

#### Etapa 2.5 — Microcopy

- [ ] Padronizar títulos de todas as rotas em português. Manter nomes de produto em inglês quando necessário (Design System, Review Inbox, WhatsApp).
- [ ] Substituir textos técnicos por orientação operacional:
  - ~~"Nenhum registro encontrado"~~ → "Ainda não há [leads/teses/etc.] nesta campanha. [Orientação de como criar]."
  - ~~"Erro 500"~~ → "Não conseguimos carregar os dados. Tente novamente ou consulte o runbook."
  - ~~"Não configurado"~~ → "Esta integração precisa de [X, Y] para funcionar. Configure em Contas."
- [ ] Usar verbos específicos em botões: "Aprovar conteúdo" (não "Confirmar"), "Criar tese" (não "Novo"), "Pausar coleta" (não "Parar").
- [ ] Antes de ações destrutivas: explicar consequência ("Isso vai arquivar a tese e todos os conteúdos derivados. Essa ação pode ser revertida.").
- [ ] Padronizar padrões de mensagem:
  - Sucesso: "[Objeto] [verbo] com sucesso." (ex: "Tese criada com sucesso.")
  - Erro: "Não foi possível [verbo] [objeto]. [Causa breve]. [Ação sugerida]."
  - Bloqueio: "[Ação] bloqueada: [motivo]. [Como resolver]."
  - Vazio: "Nenhum [objeto] [contexto]. [Como criar/ação sugerida]."
  - Não configurado: "[Recurso] precisa de [requisito]. [Link para configurar]."

**Critério de aceite**: qualquer página pode ser encontrada pelo kbar e entendida via help drawer sem conhecimento da estrutura interna. Sidebar funciona em desktop e mobile. Feature flags ativas para sidebar e kbar.

---

### Fase 3 — Carregamento, desempenho e responsividade

**PR-04** — Streaming, lazy loading, responsividade. As rotas ganham loading melhorado mas não mudam conteúdo funcional.

#### Etapa 3.1 — Navegação sem flash (RSC + Suspense streaming)

- [ ] Refatorar `apps/web/src/components/DashboardPage.tsx` e `OperationalDashboard.tsx`:
  - Eliminar o pattern de double-skeleton. A página server component faz o fetch principal. O `loading.tsx` mostra skeleton com geometria final.
  - Para cada rota, usar `<Suspense>` boundaries por seção:
    ```
    <Suspense fallback={<KpiSkeleton count={4} />}>
      <KpiSection />  <!-- server component que faz fetch dos KPIs -->
    </Suspense>
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <MainContent />  <!-- server component que faz fetch da lista -->
    </Suspense>
    <Suspense fallback={<SidebarSkeleton />}>
      <ContextPanel />  <!-- server component que faz fetch de contexto -->
    </Suspense>
    ```
  - KPIs carregam primeiro (~200ms), tabela depois (~500ms), sidebar por último.
  - Criar skeletons tipados: `KpiSkeleton`, `TableSkeleton`, `SidebarSkeleton`, `ChartSkeleton` em `packages/ui-bridge/src/feedback.tsx`. Cada um replica a geometria final (número de cards, número de linhas, largura das colunas).
- [ ] Remover skeleton do client component quando há dado anterior (stale-while-revalidate). Mostrar apenas `LiveBadge` com estado `refreshing`.
- [ ] Preservar filtros, seleção, scroll e painel aberto em refresh: filtros na URL (searchParams), seleção em state do client component.
- [ ] Usar `React.startTransition` para navegação: mostrar indicador de loading somente após 150ms, sem bloquear interação existente.
- [ ] Evitar requisições duplicadas: usar `AbortController` ou key de request para cancelar fetch anterior quando filtro muda.

#### Etapa 3.2 — Carregamento sob demanda

- [ ] ECharts: `const Chart = dynamic(() => import('./ChartContainer'), { ssr: false })`. Importar somente nas rotas: overview, radar, competitive-intel, community, source-roi, system-health.
- [ ] React Flow: `const FlowEditor = dynamic(() => import('./FlowEditor'), { ssr: false })`. Importar somente em `/email-flows`.
- [ ] Editores ricos, calendários e preview criativo: `dynamic()` com `ssr: false`.
- [ ] Pré-carregar rotas prováveis: `router.prefetch(href)` no `onMouseEnter` / `onFocus` dos links da sidebar. Respeitar `navigator.connection?.saveData` e `effectiveType === '2g'` — não pré-carregar em conexão lenta.
- [ ] Medir bundle de cada rota antes e depois. Registrar em `docs/bundle-report.json`. Comparar com orçamento da etapa 0.3.

#### Etapa 3.3 — Layout responsivo

- [ ] Definir breakpoints por comportamento (tokens em `tokens.ts`):
  - `--bp-mobile`: 0–767px (1 coluna, drawer navigation, stacked content)
  - `--bp-tablet`: 768–1023px (2 colunas, sidebar colapsada ou expandida)
  - `--bp-desktop`: 1024px+ (layout completo, sidebar + content + detail pane)
- [ ] Transformar `RightDetailPane` e `DetailDrawer` em drawer no mobile (< 768px), painel lateral no desktop.
- [ ] Transformar `ThreePaneLayout` em: mobile = stack (lista → detalhe → contexto como navegação em pilha), tablet = 2 painéis (lista + detalhe, contexto em drawer), desktop = 3 painéis.
- [ ] Manter ações primárias visíveis em todos os viewports. Mover ações secundárias para `ActionMenu` no mobile.
- [ ] `DataGrid` responsivo: mostrar colunas essenciais no mobile + botão "Ver detalhes" que abre `DetailDrawer`. Não duplicar com card view.
- [ ] Garantir alvos de toque ≥ 44×44px com 8px de espaçamento mínimo entre alvos.
- [ ] Nenhum scroll horizontal global. Tabelas com muitas colunas scroll horizontalmente dentro do seu container (`overflow-x: auto` no grid).

**Metas**: CLS ≤ 0,05; LCP ≤ 2,5s; INP ≤ 200ms no p75. Nenhuma rota com regressão de bundle acima do orçamento.

**Critério de aceite**: Nenhum double-skeleton. Navegação sem flash perceptível. Bundle por rota dentro do orçamento. Layout funcional em 375px, 768px e 1280px.

---

### Fase 4 — Visão e prospecção

**PR-05** — Overview, Leads, Review Inbox, Timeline, Identidades. Todas passam a usar os componentes da Fase 1-3.

#### Etapa 4.1 — Overview (`/`)

- [ ] Substituir `DashboardPage view="overview"` por page server component dedicado:
  - `<Suspense>` boundary 1: `MetricGroup` com 6 KPIs: leads novos (7d), qualificados (7d), P0+P1 (total), conversões (30d), ações pendentes, conversas ativas. Cada KPI com delta vs período anterior e `drillDownHref` para a rota correspondente.
  - `<Suspense>` boundary 2: Funil clicável SVG/CSS (descoberta → qualificação → contato → conversão). Cada etapa mostra count e % de conversão. Click navega para leads filtrados por estágio.
  - `<Suspense>` boundary 3: `ChartContainer` com série temporal de aquisição e conversão (30d, comparação vs 30d anteriores). Lazy-loaded.
  - `<Suspense>` boundary 4: Painel "Prioridades de hoje" — 3 seções: Review Inbox pendentes, Engagement Queue com problema, NBAs de alta confiança. Cada item é clicável.
  - `<Suspense>` boundary 5: "Cobertura de dados" — grid de canais × integração com status (verde/amarelo/vermelho).
- [ ] Mostrar `explanation` em cada KPI (tooltip com "Como é calculado: ...").
- [ ] Se não houver dados, mostrar `EmptyState` com orientação de configuração inicial.

#### Etapa 4.2 — Leads (`/leads`)

- [ ] Substituir `LeadsClient` + `DataTable` por `DataGrid` (react-table):
  - Colunas default: Prioridade, Nome, Score, Intent, Canais, Fontes, Última interação, NBA, Ações.
  - Colunas configuráveis pelo usuário (persistir seleção em localStorage `prospector_leads_columns`).
  - Ordenação por qualquer coluna.
  - Seleção para ações em massa.
  - Views salvas: `SavedViewTabs` conectadas a `searchParams`. Cada view = combinação de filtros + colunas + ordenação. Persistir views no banco (endpoint existente ou novo).
- [ ] Filtros (na URL via searchParams): prioridade, intenção, canal, origem, score range, verificação, opt-in, período. Usar `FilterBar` do bridge.
- [ ] Ações em massa: selecionar leads → barra flutuante com "Preparar contato" (somente para elegíveis pela Contact Policy), "Enviar para revisão", "Adicionar à lista". Leads não elegíveis mostram tooltip com motivo.
- [ ] Painel 360° (`DetailDrawer` lateral no desktop, full-screen no mobile):
  - Identidade: `IdentityStrip` com canais e verificação.
  - Score: breakdown visual (intent, relationship, freshness) com explicação por fator.
  - Evidências: lista das interações mais relevantes com fonte e data.
  - Timeline: `TimelineFeed` com as últimas 20 interações.
  - NBA: `NextBestActionCard` com canal, motivo, confiança e política. Botões "Aprovar ação" e "Revisar antes".
  - Conversas: resumo das conversas ativas por canal.
  - Conteúdo: conteúdos onde o lead foi mencionado/interagiu.
- [ ] Motivo de bloqueio: quando contato não é permitido, mostrar `ContactPolicyIndicator` com explicação.
- [ ] Botões funcionais no detalhe: "Preparar contato" (→ engagement queue), "Enviar para revisão" (→ review inbox), "Copiar referência" (→ clipboard com link).

#### Etapa 4.3 — Review Inbox (`/review-inbox`)

- [ ] Usar `ThreePaneLayout`: lista (esquerda, escaneável) | detalhe (centro) | contexto/evidências (direita).
- [ ] Lista: ordenável por tipo, risco, idade e prioridade. Cada item mostra: tipo de review, prioridade chip, idade ("há 2h"), trecho do conteúdo.
- [ ] Detalhe: comparação antes/depois com diff visual (texto adicionado em verde, removido em vermelho). Mostrar evidências e política aplicável em blocos distintos. Explicar impacto da decisão ("Se aprovar: lead X será contactado via Y").
- [ ] Filtros na URL: tipo, risco, idade, status (pendente/resolvido).
- [ ] Ação "Pular por agora": move para o próximo sem alterar estado, preserva posição na lista.
- [ ] Atalhos de teclado: `A` aprovar, `R` rejeitar, `E` editar, `S` pular, `?` abrir cheat sheet. Mostrar atalhos no botão "Como usar" (help drawer).
- [ ] Após cada decisão: toast de confirmação com link para o objeto alterado.

#### Etapa 4.4 — Timeline (`/timeline`)

- [ ] Substituir tabela genérica por `TimelineFeed` evoluído:
  - Agrupar eventos por dia com header de data.
  - Cada evento: ícone Lucide por tipo + `ChannelBadge` + cor semântica (descoberta=azul, mensagem=verde, follow=laranja, conteúdo=roxo, conversão=dourado).
  - Expandir metadados em formato legível (não JSON cru) — chave-valor com labels.
  - Cada evento linkado ao lead, conversa, ação ou conteúdo de origem.
- [ ] Filtros na URL: lead (busca por nome), canal, direção (inbound/outbound), tipo de evento, origem, período.
- [ ] Toggle: visão agregada (todos os leads) ↔ visão de um lead (timeline isolada).
- [ ] Paginação por cursor (carregar mais ao scrollar, sem recarregar os anteriores).

#### Etapa 4.5 — Identidades (`/identities`)

- [ ] Visão principal: lista agrupada por pessoa, mostrando `IdentityStrip` com canais e grau de verificação por identidade.
- [ ] Candidatos de merge: mostrar dois leads lado a lado com evidências destacadas (matches de nome, email, phone, etc.). Indicador de confiança do match.
- [ ] Impacto do merge: antes de aprovar, mostrar "Isso vai unificar X interações, Y conversas e Z scores. O score final será W."
- [ ] Rejeição: modal com campo obrigatório de motivo. Motivo registrado na auditoria.
- [ ] Rollback: botão "Desfazer merge" visível durante janela de rollback (ex: 7 dias). Após janela, desabilitado com tooltip "Janela de rollback expirada em DD/MM".
- [ ] Histórico: lista de merges recentes com estado (ativo, revertido), data, operador e motivo.

**Critério de aceite**: o operador percorre "sinal → lead → evidência → contato → auditoria" sem procurar UUID, banco ou logs. DataGrid funcional com react-table em Leads.

---

### Fase 5 — Inteligência de mercado

**PR-06** — Radar, Market Radar, Competitive Intel, Community, ROI.

#### Etapa 5.1 — Radar (`/radar`)

- [ ] Ranking em `DataGrid`: colunas Score, Velocidade 7d, Volume, Confiança, Frescor. Ordenação por qualquer coluna.
- [ ] Série de aceleração: `ChartContainer` com gráfico de linha (velocidade 7d × tempo) comparando com baseline do concorrente. Lazy-loaded.
- [ ] Preview: ao clicar na oportunidade, `DetailDrawer` com trecho da publicação de origem. Link "Abrir original" com `target="_blank" rel="noreferrer"`.
- [ ] Explicação: card "Por que detectamos" com evidências (keywords, volume, aceleração, fonte).
- [ ] Ações reais: "Criar oportunidade editorial" (→ form com tese pré-selecionada), "Criar watch" (→ market-radar com form aberto), "Ignorar sinal" (→ modal com motivo obrigatório, registra auditoria).

#### Etapa 5.2 — Radar de mercado (`/market-radar`)

- [ ] Tabs controladas pela URL (`?tab=signals|watches|health`):
  - **Sinais**: lista de sinais recentes com fonte, timestamp, velocidade e evidências.
  - **Watches**: `DataGrid` com nome, status, próxima execução, última coleta, volume total, falhas recentes.
  - **Saúde da coleta**: status de cada watch com indicador verde/amarelo/vermelho.
- [ ] Formulário de criação de watch: wizard com preview da consulta Reddit. Validação com Zod. Preview mostra resultado estimado antes de salvar.
- [ ] Próxima execução e última coleta por watch com timestamp.
- [ ] Evidências em `DetailDrawer` com fonte, subreddit, score, timestamp e link.
- [ ] Quando Reddit não estiver configurado: `IntegrationGate` com checklist (API key, subreddit configurado, variáveis de ambiente). Botão "Configurar" → `/accounts`.

#### Etapa 5.3 — Inteligência competitiva (`/competitive-intel`)

- [ ] Tabs por URL (`?tab=themes|pains|questions|hooks|competitors`).
- [ ] Mapa de momentum: `ChartContainer` com heatmap ou bar chart de temas × velocidade (7d e 30d). Clicável → filtra lista abaixo.
- [ ] Cada insight: cobertura (quantos sinais), quantidade de evidências, confiança. Link para evidências em drawer.
- [ ] Ação "Criar tese": preenche formulário de tese com tema/dor/pergunta pré-populados. Preserva atribuição (link para o insight de origem).
- [ ] Comparação entre concorrentes: tabela comparativa somente quando há dados de 2+ concorrentes. Caso contrário, ocultar a tab com tooltip "Dados insuficientes para comparação".

#### Etapa 5.4 — Comunidades (`/community`)

- [ ] Lista de clusters: `DataGrid` com nome, tamanho, coesão, origem, última atualização.
- [ ] Detalhes em `DetailDrawer`: tópicos principais, membros representativos (sem expor dados pessoais indevidos), evidências de clustering.
- [ ] Drill-down para leads: link para `/leads?community=X`.
- [ ] `DataQualityBadge` com cobertura e qualidade do clustering.
- [ ] Distinção visual: "Comunidade detectada" (badge azul) vs "Grupo de WhatsApp" (badge verde com ícone WhatsApp). Tooltip explicando a diferença.

#### Etapa 5.5 — ROI por origem (`/source-roi`)

- [ ] Ranking em `DataGrid`: Origem, Volume (mínimo para significância), Score ROI, Followback rate, Retenção, Conversão. Ordenação.
- [ ] `ChartContainer` com tendência por origem selecionada (linha × tempo) e comparação de janela (7d vs 30d).
- [ ] Explicação do score: tooltip ou card com fórmula, cobertura dos dados e nível de confiança.
- [ ] Drill-down: clicar na origem → `/leads?source=X`.
- [ ] Exportar CSV: botão "Exportar" que gera CSV server-side com filtros e permissão aplicados. Não exportar dados fora do escopo da campanha/permissão.

**Critério de aceite**: todo insight mostra evidência, frescor, confiança e uma próxima ação real. Gráficos com tema derivado dos tokens semânticos.

---

### Fase 6 — Conteúdo e Design System

**PR-07** — Teses, Oportunidades, Conteúdos, Detalhe, Bridge criativa, Publicação.

#### Etapa 6.1 — Teses (`/theses`)

- [ ] Lista: cards compactos em grid (1-2-3 colunas conforme viewport). Cada card: título, status badge, score de desempenho, contagem de conteúdos derivados.
- [ ] Detalhe em `DetailDrawer`: texto completo da tese, conteúdos derivados (lista), oportunidades associadas, métricas de desempenho.
- [ ] Busca e filtros (URL): busca por texto, status (ativa/pausada/arquivada), ordenação por desempenho/data.
- [ ] Criação/edição: formulário por seções com `react-hook-form` + Zod. Seções: Título e ângulo, Público-alvo, Evidências, Canais. Preview ao lado do form. Validação por campo com mensagem em português.
- [ ] Ações reais: "Editar" (→ form), "Duplicar" (cria cópia com sufixo), "Pausar" (muda status, confirma impacto em conteúdos ativos), "Arquivar" (confirma com `ConfirmDialog`), "Gerar oportunidade" (→ form de oportunidade com tese pré-selecionada).
- [ ] Limite: mostrar "5/7 teses ativas" com `QuotaMeter`. Ao tentar criar a 8ª, bloquear com `StatePanel state="blocked"` explicando o limite.

#### Etapa 6.2 — Oportunidades de conteúdo (`/content-opportunity`)

- [ ] Pipeline: `KanbanBoard` por status (Nova → Em análise → Aprovada → Em produção → Publicada). Drag com `@dnd-kit` (persiste via endpoint). Alternativa: `DataGrid` em modo tabela para volume alto. Toggle via URL `?view=kanban|table`.
- [ ] Cada card/linha: tese de origem, ângulo, hook, `ScoreBadge`, evidências count, frescor.
- [ ] Preview antes de aprovar: `DetailDrawer` com conteúdo completo, evidências e impacto.
- [ ] Ações: "Editar", "Aprovar" (→ muda status), "Rejeitar" (→ motivo obrigatório), "Gerar variações" (→ chama modelo IA configurado). Todas com auditoria.
- [ ] "Criar no Design System": formulário com seletor de formato (post, story, carrossel, vídeo) e template (catálogo real do Design System). Ao confirmar, cria `creative_job` e mostra progresso inline: `queued → opened → editing → rendering → ready`.
- [ ] Progresso, falha e retry: `AsyncBanner` no card com status do job. Botão "Retry" em caso de `failed`. Sem navegar para outra página.

#### Etapa 6.3 — Conteúdos (`/content-items`)

- [ ] Tabs por status (URL `?status=all|draft|approved|published|archived`) com contadores reais.
- [ ] Filtros (URL): busca, tese, funil stage, canal, período, desempenho (sort).
- [ ] Dois modos de visualização (URL `?view=gallery|table`):
  - Galeria: cards compactos em grid com thumbnail/preview, status badge, canais, tese.
  - Tabela: `DataGrid` com colunas densa.
- [ ] Cada item mostra: estado do briefing, quantidade de variantes, status de aprovação, status de render, status de publicação.
- [ ] Ações reais: "Abrir" (→ `/content-items/[id]`), "Aprovar", "Arquivar", "Fork" (cria cópia), "Criar variante" (→ form), "Renderizar" (→ cria job no Design System).

#### Etapa 6.4 — Detalhe do conteúdo (`/content-items/[id]`)

- [ ] Cabeçalho: título, `StatusBadge`, tese de origem (link), campanha, responsável, ações primárias.
- [ ] Tabs (URL `?tab=briefing|variants|creatives|publishing|performance|audit`):
  - **Briefing**: texto do brief, ângulo, público, tom de voz, referências.
  - **Variantes**: lista de variantes por canal com `VariantPreview`. Ações: aprovar, editar, gerar nova.
  - **Criativos**: preview dos artefatos renderizados pelo Design System. Download autorizado. Status do render.
  - **Publicações**: calendário de publicação por canal com status. Link externo para o post publicado.
  - **Desempenho**: métricas por canal (alcance, engajamento, conversão) quando disponíveis.
  - **Auditoria**: timeline de todas as ações no ciclo de vida.
- [ ] Timeline do ciclo de vida: strip horizontal com etapas (criado → briefado → variantes → aprovado → renderizado → publicado) e timestamps.
- [ ] Erros: se render ou publicação falhou, `ErrorState` com retry e link para runbook.

#### Etapa 6.5 — Ponte criativa (`/creative-bridge`)

- [ ] Substituir tela intermediária por `DataGrid` de jobs criativos reais:
  - Colunas: Origem (tese/oportunidade/conteúdo), Formato, Template, Status, Progresso, Preview, Data.
  - Status: `queued`, `opened`, `editing`, `rendering`, `ready`, `failed`, `attached`, `cancelled`.
- [ ] Detalhes em `DetailDrawer`: preview do artefato, payload (sem secrets), progresso por etapa.
- [ ] "Abrir no Design System": botão que navega para `apps/design-system` com payload validado (schema Zod, idempotency key). Usar `appPath` para URL.
- [ ] Callback: receber evento de salvamento/render/exportação e atualizar status do job.
- [ ] Ações: "Reabrir" (job ready → editing), "Duplicar" (cria novo job com mesmo payload), "Reprocessar" (job failed → queued), "Anexar resultado" (liga artefato final ao content item e variante).

#### Etapa 6.6 — Publicação (`/publishing`)

- [ ] Calendário: navegação mensal/semanal com `ChartContainer` customizado ou componente próprio. Timezone do usuário. Filtros por canal, status, tipo.
- [ ] Conflitos: destacar visualmente dias com mais de 1 publicação no mesmo canal. Lacunas editoriais: dias sem publicação marcados sutilmente.
- [ ] Kanban alternativo: `KanbanBoard` por status (Agendado → Publicando → Publicado → Falhou). Toggle `?view=calendar|kanban`. Drag com `@dnd-kit` para reagendar.
- [ ] Detalhe em `DetailDrawer`: copy, criativo (preview), canal, horário agendado, comprovante de publicação (link externo), métricas quando disponíveis.
- [ ] Ações conforme estado: "Agendar" (draft → agendado), "Reagendar" (muda data/hora), "Cancelar" (confirma), "Publicar agora" (confirma), "Retry" (falhou → publicando), "Abrir externamente" (link para post).
- [ ] Saúde da integração: se canal com problema, `IntegrationGate` inline bloqueando apenas aquele canal, não a página inteira.

**Critério de aceite**: o fluxo "insight → tese → oportunidade → conteúdo → criativo → publicação → desempenho" é navegável de ponta a ponta e retorna ao contexto original.

---

### Fase 7 — Canais, conversas e automações

**PR-08** — Conversations, Email Flows, WhatsApp Groups, Contact Policies, Engagement Queue.

#### Etapa 7.1 — Conversas (`/conversations`)

- [ ] Desktop: `ThreePaneLayout` — lista de conversas (esquerda) | thread (centro) | contexto do lead (direita).
- [ ] Mobile: navegação em pilha — lista → thread → contexto (back button para voltar).
- [ ] Filtros (URL): canal, status (ativa/resolvida/arquivada), intenção, não lidas, em revisão, janela de 24h (WhatsApp).
- [ ] Busca por texto na conversa e por nome do lead (debounce 300ms).
- [ ] Contexto do lead (painel direito): `IdentityStrip`, opt-in status, `ContactPolicyIndicator`, janela de 24h restante (WhatsApp), link para perfil 360° em `/leads`.
- [ ] Composer: selector de template aprovado, contador de caracteres por canal, preview de anexo suportado, preview da mensagem antes de enviar.
- [ ] Status por mensagem: ícones de envio (✓), entrega (✓✓), leitura (✓✓ azul), erro (✗ vermelho com tooltip de causa).
- [ ] Ações: "Atribuir" (→ seletor de responsável), "Marcar resolvida", "Enviar para revisão" (→ review inbox), "Abrir lead" (→ /leads?selected=X).
- [ ] Polling: intervalo 15s ativo, 60s em background (seção 3.7). Preservar scroll e seleção durante atualização.

#### Etapa 7.2 — Fluxos de e-mail (`/email-flows`)

- [ ] Lista: `DataGrid` com nome, status (draft/ativo/pausado), versão, inscritos, taxa de conversão, última execução, saúde do Resend.
- [ ] Editor visual: `@xyflow/react` lazy-loaded. Tipos de nó: Entry, Send (email template), Wait (tempo), Branch (condição), Exit. Cada nó tem painel de propriedades no sidebar.
- [ ] Validação antes de ativar: detectar ciclos, nós órfãos (sem conexão), nós Send sem conteúdo, branches sem ambos os caminhos. Mostrar erros inline nos nós problemáticos.
- [ ] Preview do email: renderizar template com dados de exemplo (fixtures de teste) no painel de propriedades do nó Send.
- [ ] Teste: botão "Enviar teste" com campo de email obrigatório (não usar email do lead). Confirmar com `ConfirmDialog`.
- [ ] Ações: "Versionar" (salva snapshot), "Ativar" (com validação), "Pausar", "Duplicar", "Auditoria" (timeline de alterações).
- [ ] `IntegrationGate`: se Resend ou domínio não estiver configurado, bloquear ativação e mostrar checklist (API key, domínio verificado, DNS configurado).

#### Etapa 7.3 — Grupos de WhatsApp (`/communities`)

- [ ] **Página honesta**: não exibir funcionalidade antes de suporte real.
- [ ] Estado vazio transformado em checklist de disponibilidade:
  - [ ] WhatsApp Business API conectada? (link para `/accounts`)
  - [ ] Groups API disponível para esta conta? (verificação automática)
  - [ ] Requisitos de uso atendidos? (documentação oficial)
  - Última verificação: timestamp da última checagem.
- [ ] Link para documentação oficial da Meta sobre Groups API.
- [ ] **Não exibir**: formulário de política, envio, automação, ou qualquer controle que sugira funcionalidade. Usar `StatePanel state="not_configured"` com mensagem clara.

#### Etapa 7.4 — Políticas de contato (`/contact-policies`)

- [ ] Editor visual: formulário estruturado por escopo (Global → Campanha → Canal). Cada nível pode sobrescrever o anterior.
- [ ] Campos tipados (react-hook-form + Zod): frequência máxima por período, janela de contato, opt-in obrigatório, cooldown após rejeição, canais permitidos.
- [ ] Explicação de precedência: diagrama visual mostrando qual regra prevalece (canal > campanha > global).
- [ ] Resumo em linguagem natural antes de salvar: "Máximo 3 contatos por semana via WhatsApp. Cooldown de 48h após rejeição. Opt-in obrigatório."
- [ ] Simulador: selecionar um lead ou conversa → mostrar resultado da política ("Contato permitido: sim/não. Motivo: ..."). Sem efeito colateral.
- [ ] Versionamento: histórico de versões com comparação (diff visual). Botões "Restaurar versão" e "Pausar política" (com `ConfirmDialog`).
- [ ] Aviso de impacto: antes de salvar alteração em política usada por workers ativos, mostrar "Esta política afeta X workers e Y leads elegíveis. Confirmar?"

#### Etapa 7.5 — Fila de engagement (`/engagement-queue`)

- [ ] Dois modos (URL `?view=list|kanban`):
  - Lista: `DataGrid` com filtros por estado, prioridade, conta, ação, campanha, idade.
  - Kanban: `KanbanBoard` por estado (pendente → aprovado → executando → concluído/falhou).
- [ ] Detalhe em `DetailDrawer`: evidência da ação, política aplicável, quota restante, trace ID, última tentativa, causa de falha.
- [ ] Capacidade: `QuotaMeter` por conta e ação (ex: "WhatsApp DMs: 45/50 hoje").
- [ ] Ações conforme estado e papel: "Aprovar" (pendente → aprovado), "Rejeitar" (com motivo), "Cancelar", "Retry" (falhou → pendente).
- [ ] Atualização: **polling inteligente** com intervalo 15s ativo, 60s em background (seção 3.7). **Não usar SSE.** Preservar lista, seleção e filtros durante refresh.
- [ ] Resumo de problemas: card no topo com contagem de bloqueios por motivo e itens envelhecendo (> 24h sem ação).

**Critério de aceite**: cada canal informa capacidade real, política aplicável, estado de entrega e razão de qualquer bloqueio.

---

### Fase 8 — Administração, IA e observabilidade

**PR-09** — Accounts, AI Settings, Configs, Notifications, System Health, Login, Runbooks.

#### Etapa 8.1 — Contas e integrações (`/accounts`)

- [ ] Catálogo: `DataGrid` ou cards com: nome da integração, `StatusBadge` (ready/partial/not_configured/error), ambiente (prod/staging), última validação, variáveis faltantes.
- [ ] Tabs (URL `?tab=integrations|meta|competitors|policies`): separar contas Meta, concorrentes e políticas.
- [ ] OAuth: wizard por etapas com progresso visual (1. Permissões → 2. Autorizar → 3. Validar → 4. Concluído). Retorno ao contexto original após completar.
- [ ] Ações por integração: "Testar" (validar credenciais), "Renovar" (token OAuth), "Desativar" (com confirmação), "Revisar escopos" (mostrar permissões ativas).
- [ ] Sem reload: atualizar estado da integração localmente após ação (optimistic update com rollback em erro).
- [ ] Usar `appPath()` em todos os caminhos. Nenhum `/prospector` hardcoded.

#### Etapa 8.2 — Modelos de IA (`/ai-settings`)

- [ ] Central de provedores: cards com logo/ícone Lucide, `StatusBadge`, latência média, último teste, data do último sucesso.
- [ ] Detalhe por provedor: modelo padrão, fallback, capacidades (lista), tamanho de contexto, tokens/min, custo estimado (quando informado pela API).
- [ ] Teste: botão "Testar modelo" com prompt seguro predefinido. Resultado: latência, status, trecho da resposta. **Não persistir conteúdo sensível.**
- [ ] Ordem de fallback: drag (`@dnd-kit`) para reordenar modelos habilitados. Persistir ordem.
- [ ] Workers: mostrar lista de workers que usam cada modelo.
- [ ] Alerta de recurso: se endpoint local (Ollama), mostrar aviso sobre consumo de CPU/RAM.
- [ ] Ações: "Desativar" (confirma impacto nos workers), "Duplicar configuração", "Rotacionar chave" (formulário sem exibir chave atual — campo password).

#### Etapa 8.3 — Configurações (`/configs`)

- [ ] Tabs (URL `?tab=scoring|freshness|nba|voice|collection|security`).
- [ ] Cada configuração: valor efetivo, badge "default" ou "customizado", última alteração (quem e quando).
- [ ] Validação: relações entre thresholds (ex: score P0 > P1 > P2) e soma de pesos = 100%. Erros inline por campo.
- [ ] Preview de impacto: ao alterar scoring, mostrar "Antes: 15 leads P0 | Depois: ~22 leads P0" com amostra real.
- [ ] Histórico: timeline de versões com comparação visual (diff). "Restaurar versão" com confirmação.

#### Etapa 8.4 — Notificações e erros (`/notifications`)

- [ ] Tabs (URL `?tab=triggers|channels|incidents|deliveries`).
- [ ] Incidentes: `DataGrid` com severidade, status, responsável, idade, causa. Agrupamento por causa raiz.
- [ ] Detalhe do incidente: timeline de eventos + payload sanitizado (sem secrets, sem PII).
- [ ] Ações: "Reconhecer" (muda status), "Resolver" (com motivo), "Reabrir", "Testar canal" (envia notificação de teste), "Abrir runbook" (link).
- [ ] Entregas: lista com tentativas, status, causa legível, timestamps.
- [ ] Filtros salvos: predefinir "Falhas críticas", "Integrações com problema" como views rápidas.

#### Etapa 8.5 — Saúde do sistema (`/system-health`)

- [ ] Score decomposto: `MetricGroup` com banco, Redis, filas, workers, webhooks, provedores. Cada item com `HealthDial`.
- [ ] Séries temporais: `ChartContainer` lazy com gráficos de backlog, latência p50/p95, falhas/hora e throughput (últimas 24h).
- [ ] Workers: `DataGrid` com nome, estado (running/stopped/failed), última execução, backlog, latência p95, versão.
- [ ] Dependências: diagrama simplificado de dependências (sem React Flow — SVG estático ou lista).
- [ ] Kill-switch: botão que abre `ConfirmDestructiveDialog` com motivo obrigatório, seleção de alcance (worker específico ou todos), confirmação por digitação do nome do worker. Registra na auditoria com trilha completa.
- [ ] Links de runbook: usar `appPath()` para URL. Validar existência dos runbooks na CI.

#### Etapa 8.6 — Login e runbooks

- [ ] Login (`/login`): formulário de OTP com estados claros:
  - Input de email → botão "Enviar código".
  - Após envio: input de código + timer de expiração + botão "Reenviar" (habilitado após 60s).
  - Erro: "Código inválido. X tentativas restantes." Sem revelar se email existe.
  - Suporte: link para contato em caso de problemas.
- [ ] Runbooks (`/docs/runbooks/[slug]`): aplicar mesmo header, tipografia e navegação do Prospector. Criar índice pesquisável em `/docs/runbooks` com busca por título e tag. Cada runbook tem links para páginas relacionadas. Incluir runbooks no `kbar` (HelpProvider).

**Critério de aceite**: um administrador identifica configuração ausente, testa integração, entende impacto e encontra recuperação sem abrir o servidor.

---

### Fase 9 — Integração profunda com o Design System

**PR-10** — Contrato de automação, ações integradas, consistência visual.

#### Etapa 9.1 — Contrato de automação

- [ ] Criar `packages/shared/src/creative-job-schema.ts`:
  ```ts
  const CreativeJobSchema = z.object({
    id: z.string().uuid(),
    idempotencyKey: z.string(),
    version: z.literal(1),
    campaignId: z.string().uuid(),
    thesisId: z.string().uuid().optional(),
    opportunityId: z.string().uuid().optional(),
    contentItemId: z.string().uuid().optional(),
    format: z.enum(['post', 'story', 'carousel', 'video', 'email']),
    templateId: z.string(),
    content: z.record(z.unknown()),
    status: z.enum(['queued', 'opened', 'editing', 'rendering', 'ready', 'failed', 'attached', 'cancelled']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  ```
- [ ] Validar com este schema nos dois apps (web e design-system) usando import de `@plataforma/shared`.
- [ ] Criar correlação: Prospector (creative_job.id) ↔ fila (job_id) ↔ Design System (session.jobId) ↔ render (output.jobId) ↔ publicação (publishing.jobId).
- [ ] Persistir todos os estados e transições no banco. **Não depender de localStorage.**

#### Etapa 9.2 — Ações integradas

- [ ] Botão "Criar arte" visível em: oportunidade (quando aprovada), conteúdo (quando briefado), publicação (quando sem criativo). Somente quando há template compatível.
- [ ] Seletor de formato/template: buscar catálogo real do Design System via endpoint. Mostrar preview do template selecionado.
- [ ] Geração de copy/variante: usar modelo IA configurado em `/ai-settings`. Mostrar loading e resultado. Permitir editar antes de enviar ao Design System.
- [ ] Progresso inline: no card/linha onde o job foi criado, mostrar `StatusBadge` e `progress` bar. "Retry" em caso de falha.
- [ ] Auto-attach: quando job status = `ready`, anexar artefatos ao content item e variante correspondentes.
- [ ] Navegação bidirecional: "Abrir no editor" (→ Design System com contexto) e "Voltar ao Prospector" (→ content item com tab criativos).

#### Etapa 9.3 — Consistência compartilhada

- [ ] Todas as rotas do Prospector usam componentes do bridge. Nenhum import direto de `apps/design-system/src/`.
- [ ] Storybook: publicar composição de ambos os apps. Cada componente do bridge tem story com todas as variantes.
- [ ] Exemplos de automação: adicionar stories que simulam o fluxo Prospector → Design System (com fixtures de teste).
- [ ] CI: lint rule que falha para imports de `../../../apps/design-system/` ou `@plataforma/design-system/src/`.
- [ ] CI: verificar que tokens do bridge e do Design System são idênticos (comparar arquivos de tokens).

**Critério de aceite**: um job criativo iniciado no Prospector pode ser editado, renderizado, retornado, anexado e publicado com IDs rastreáveis.

---

### Fase 10-11 — Acessibilidade, qualidade, segurança e rollout

**PR-11** — Acessibilidade, E2E, guardrails finais, remoção de aliases, deploy.

#### Etapa 10.1 — WCAG 2.2 AA

- [ ] Foco visível: anel de foco com `outline: 2px solid var(--accent-primary); outline-offset: 2px`. Nunca oculto por `overflow: hidden` em headers, drawers ou barras fixas.
- [ ] Ordem de foco: Tab percorre a página em ordem lógica. Em modais/drawers: trap de foco com Radix. Escape fecha e retorna foco ao trigger.
- [ ] Nomes acessíveis: todo `IconButton` tem `aria-label`. Todo ícone decorativo tem `aria-hidden="true"`. Todo controle sem texto visível tem `aria-label`.
- [ ] Alvos mínimos: 44×44px com 8px de espaçamento (já definido na Fase 3). Verificar com teste automatizado.
- [ ] Drag-and-drop: todo `@dnd-kit` tem alternativa por menu/teclado (botões "Mover para cima/baixo" ou select de posição).
- [ ] Anúncios: `aria-live="polite"` para status de refresh, seleção em grid, toast de sucesso/erro. `aria-live="assertive"` somente para erros críticos.
- [ ] Testes: zoom 200% sem perda de conteúdo, reflow horizontal sem scroll, contraste AA verificado, `prefers-reduced-motion` respeitado (desligar animações).

#### Etapa 10.2 — Testes de componentes

- [ ] Stories para todas as variantes e estados de: `Button`, `DataGrid`, `Dialog`, `Drawer`, `StatePanel`, `KpiCard`, `PageHeader`, `ResourceHelpDrawer`.
- [ ] Testes de interação (Storybook play functions): abrir/fechar dialog, ordenar grid, selecionar linha, submeter form, navegar tabs.
- [ ] axe-core em cada story relevante (`@storybook/addon-a11y`). Zero violações critical ou serious.
- [ ] Testes para tema claro e escuro (verificar que tokens mudam corretamente).

#### Etapa 10.3 — E2E (smoke + 3 jornadas)

- [ ] **Smoke test**: Playwright navega cada uma das 28 rotas autenticadas. Verifica: sem erro de console (error level), sem 404/500, página renderiza conteúdo (não fica em skeleton indefinidamente), sem crash de hidratação.
- [ ] **Jornada 1 — Login e navegação**: enviar OTP (provedor simulado em test env) → autenticar → trocar campanha (Rota de Ataque → Gazeta Concursos) → navegar por overview, leads, theses, conversations, system-health → verificar que dados mudam com a campanha.
- [ ] **Jornada 2 — Lead operacional**: abrir `/leads` → filtrar por P0 → clicar no primeiro lead → verificar painel 360° abre → verificar score, identidades e timeline carregam → clicar "Preparar contato" → verificar redirect para engagement queue ou toast de bloqueio.
- [ ] **Jornada 3 — Conteúdo end-to-end**: abrir `/theses` → selecionar tese ativa → clicar "Gerar oportunidade" → verificar oportunidade aparece em `/content-opportunity` → aprovar oportunidade → verificar status muda → verificar disponível na creative bridge.

#### Etapa 10.4 — Guardrails de produção

- [ ] CI falha para: imports de fixtures/faker em código de produção.
- [ ] CI falha para: imports privados de `apps/design-system/src/` em apps/web.
- [ ] CI falha para: caminhos `/prospector` hardcoded fora de `appPath()`.
- [ ] CI falha para: violações critical ou serious do axe-core.
- [ ] CI falha para: 404/500 inesperados no smoke test.
- [ ] CI falha para: regressão de bundle acima do orçamento sem justificativa em `docs/bundle-budget.json`.

#### Etapa 11.1 — Limpeza e finalização

- [ ] Remover aliases CSS temporários (`--bg-canvas`, `--bg-surface`, `--bg-subtle`) — migração completada nas fases anteriores.
- [ ] Remover `DataTable` deprecated do bridge (substituído por `DataGrid` em todas as rotas).
- [ ] Remover feature flags após verificar que tudo funciona sem fallback (sidebar, kbar, grid). Prazo: 30 dias após ativação.
- [ ] Remover `DashboardPage.tsx` e `OperationalDashboard.tsx` se todas as rotas foram migradas para server components.

#### Etapa 11.2 — Estratégia de segurança

- [ ] Feature flags via LaunchDarkly/Unleash para substituições de alto impacto (sidebar, grid, kbar). Ativar gradualmente: dev → staging → prod.
- [ ] Preservar endpoints antigos até todos os consumidores (workers, Design System) migrarem.
- [ ] Migrations de banco compatíveis para frente e para trás quando possível. Documentar rollback em `docs/migration-rollback.md`.
- [ ] Não ativar workers dependentes de credenciais vazias.

#### Etapa 11.3 — Validação no VPS

- [ ] Executar `pnpm build` e migrations no VPS.
- [ ] Validar com as duas campanhas: Rota de Ataque e Gazeta Concursos.
- [ ] Validar papéis: actor e collector (quando aplicável).
- [ ] Verificar estados vazios em campanha sem dados.
- [ ] Verificar integrações ausentes (Reddit, Resend, Meta sem configurar).
- [ ] Smoke test automatizado nas 28 rotas (reutilizar E2E).
- [ ] Verificar logs (sem erros inesperados), saúde (endpoint `/api/health`), filas (sem backlog anormal), CPU/RAM (sem pico).
- [ ] Confirmar que Gazeta Concursos continua funcional.
- [ ] Observar erros e Core Web Vitals nas primeiras 24h após deploy.

**Critério de aceite**: deploy saudável, sem regressão, zero violação critical/serious, zero controle inerte, zero 404/500, rollback testado, e observação de 24h registrada.

---

## 7. Matriz obrigatória de páginas

| Grupo | Página/rota | PR | Experiência principal |
| --- | --- | --- | --- |
| Visão | `/` | PR-05 | resumo executivo, funil, tendências e prioridades |
| Prospecção | `/leads` | PR-05 | DataGrid react-table + painel 360° + NBA |
| Prospecção | `/review-inbox` | PR-05 | triagem em ThreePaneLayout e comparação |
| Prospecção | `/timeline` | PR-05 | feed cronológico filtrável com ChannelBadge |
| Prospecção | `/identities` | PR-05 | identidades agrupadas, merge e rollback |
| Inteligência | `/radar` | PR-06 | ranking e aceleração de oportunidades |
| Inteligência | `/market-radar` | PR-06 | sinais, watches e saúde Reddit |
| Inteligência | `/competitive-intel` | PR-06 | temas, concorrentes e momentum |
| Inteligência | `/community` | PR-06 | clusters, cobertura e evidências |
| Conteúdo | `/theses` | PR-07 | biblioteca, desempenho e edição guiada |
| Conteúdo | `/content-opportunity` | PR-07 | pipeline kanban/tabela e criação no DS |
| Conteúdo | `/content-items` | PR-07 | lista/galeria com ciclo de vida |
| Conteúdo | `/content-items/[id]` | PR-07 | briefing, variantes, criativos, publicação |
| Conteúdo | `/creative-bridge` | PR-07 | fila de jobs e artefatos criativos |
| Conteúdo | `/publishing` | PR-07 | calendário, kanban e comprovantes |
| Canais | `/email-flows` | PR-08 | lista e editor React Flow |
| Canais | `/communities` | PR-08 | disponibilidade honesta de WhatsApp Groups |
| Canais | `/conversations` | PR-08 | inbox multicanal e composer contextual |
| Governança | `/contact-policies` | PR-08 | editor, precedência, simulação e versões |
| Governança | `/engagement-queue` | PR-08 | fila com polling, quotas e decisões |
| Sistema | `/accounts` | PR-09 | catálogo de integrações e OAuth |
| Sistema | `/ai-settings` | PR-09 | provedores, modelos, fallback e testes |
| Sistema | `/configs` | PR-09 | configurações tipadas, preview e histórico |
| Sistema | `/source-roi` | PR-06 | ranking, tendência e drill-down |
| Sistema | `/notifications` | PR-09 | triggers, canais, incidentes e entregas |
| Sistema | `/system-health` | PR-09 | saúde, séries, workers e kill-switch |
| Acesso | `/login` | PR-09 | OTP claro, seguro e recuperável |
| Ajuda | `/docs/runbooks/[slug]` | PR-09 | runbook navegável e contextual |

Nenhuma rota desta matriz poderá ser considerada concluída sem os estados assíncronos (seção 5.5) e os testes definidos na Fase 10.

## 8. Critérios globais de conclusão

- [ ] Todas as páginas usam dados e integrações reais.
- [ ] Todas as páginas oferecem **Como usar** e **Sobre** com conteúdo específico via `help-registry.ts`.
- [ ] Todos os botões visíveis são funcionais, permitidos e testados.
- [ ] Nenhum operador precisa digitar UUID ou JSON para uma tarefa comum.
- [ ] Nenhuma página perde conteúdo durante refresh ou reconexão.
- [ ] Nenhuma integração ausente aparece como saudável.
- [ ] Todos os KPIs informam período, fonte e significado.
- [ ] Todos os gráficos possuem tabela/resumo acessível e drill-down quando aplicável.
- [ ] Todas as listas grandes usam `DataGrid` (react-table) com paginação/cursor e filtros na URL.
- [ ] Todos os formulários complexos usam `react-hook-form` + Zod e mensagens por campo em português.
- [ ] Todos os modais e menus controlam foco corretamente via Radix.
- [ ] Tema claro/escuro funcional com tokens semânticos.
- [ ] Sidebar colapsável com ícones Lucide e drawer mobile.
- [ ] Command palette (kbar) busca páginas, leads, conteúdos e ações.
- [ ] O fluxo Prospector ↔ Design System é rastreável de ponta a ponta via `creative_job`.
- [ ] CI, smoke E2E, Storybook, axe e build estão verdes.
- [ ] Produção não apresenta 404, 500, erro de console ou falha de hidratação.
- [ ] Rota de Ataque e Gazeta Concursos funcionam após o deploy.

## 9. Referências de decisão

- [Salesforce — Empty State](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-empty-state.html): diferenciar ausência de dados, filtro sem resultado, manutenção e erro, sempre com orientação de próximo passo.
- [Salesforce — Data Table](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-datatable.html): base para grid com colunas tipadas, seleção, ordenação e ações.
- [HubSpot — filtros de dashboard](https://knowledge.hubspot.com/dashboards/use-dashboard-filters): filtros globais, rápidos e transparentes sobre quais fontes são afetadas.
- [HubSpot — interação com relatórios](https://knowledge.hubspot.com/reports/interact-with-reports-in-the-report-viewer): drill-down, configurações visuais, aba Sobre e qualidade dos dados.
- [React Flow — Workflow Editor](https://reactflow.dev/ui/templates/workflow-editor): referência para editor de automações baseado em nós.
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/): foco, reflow, contraste, tamanho de alvo, autenticação acessível e mensagens de estado.
- [TanStack Table docs](https://tanstack.com/table/latest): API headless para grid com sorting, filtering, pagination e column sizing.
- [kbar docs](https://kbar.vercel.app/): API para command palette com nested actions, keyboard navigation e dynamic providers.
- [LaunchDarkly React SDK](https://docs.launchdarkly.com/sdk/client-side/react): integração de feature flags com React.

## 10. Fora de escopo

- inventar dados para preencher telas vazias;
- ativar integrações sem credenciais válidas;
- prometer WhatsApp Groups antes de disponibilidade oficial para a conta;
- trocar a identidade da marca por um template genérico de CRM;
- reescrever o backend sem necessidade de UX ou de contrato;
- instalar bibliotecas duplicadas para o mesmo problema;
- usar animação decorativa que prejudique velocidade ou legibilidade;
- executar ação externa ou destrutiva sem confirmação, permissão e auditoria;
- usar SSE para atualização em tempo real (decisão: polling inteligente);
- adotar MDX runtime para help content (decisão: objeto TS tipado);
- prototipar data grid antes de adotar (decisão: @tanstack/react-table direto);
- usar env vars simples para feature flags (decisão: LaunchDarkly/Unleash).

## 11. Definição de pronto por item

Um passo só poderá ser marcado como concluído quando houver:

1. código e contrato de dados reais;
2. estados loading, refreshing, vazio, parcial, erro e sucesso aplicáveis (usando `StatePanel`);
3. permissão e auditoria das mutações;
4. Storybook ou fixture exclusivamente de teste (não importada pelo bundle de produção);
5. teste unitário/de interação relevante;
6. axe sem violação crítica ou séria;
7. smoke test da rota afetada passando;
8. screenshot desktop (1280px), tablet (768px) e mobile (375px);
9. verificação de console (zero errors) e rede (zero 4xx/5xx inesperados);
10. CI verde na PR correspondente.
