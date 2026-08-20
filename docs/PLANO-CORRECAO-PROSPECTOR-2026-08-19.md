# Plano de correção do Prospector — auditoria de 19/08/2026

**Alvo:** `plataforma/apps/web` (`@plataforma/web`), `plataforma/packages/ui-bridge`, `plataforma/packages/db`, `plataforma/packages/queue`, workers.
**Ambiente:** `https://design.rotadeataque.com.br/prospector` (VPS 187.127.249.22, compose `plataforma-rota`).
**Método:** `systematic-debugging` — nenhuma correção foi proposta antes de fechar a causa raiz.
**Migrations aplicadas em produção:** até `0026_recommendations_and_provider_health` (log `deploy/prospector-rebuild.log`, 18/08/2026 20:33).

---

## 0. Como este plano foi produzido

| Fase | O que foi feito |
|---|---|
| 1 — Evidência | Leitura das mensagens de erro do console, mapeamento de cada tela → componente → query → tabela, e conferência coluna a coluna contra as migrations `0001`–`0026`. |
| 2 — Padrão | Comparação entre telas que funcionam e telas que quebram; comparação do uso do TanStack Table contra a documentação da versão instalada (`node_modules/@tanstack/table-core/skills/`). |
| 3 — Hipótese | Uma hipótese por sintoma, validada em código/documentação do fornecedor antes de virar item de plano. |
| 4 — Implementação | Este documento. Nenhum código foi alterado ainda. |

### Nota sobre acesso SSH

O acesso SSH ao VPS foi bloqueado pelo classificador de auto-mode do Claude Code durante a auditoria. Para executar os comandos da Etapa 0, há três caminhos:

1. **Aprovar no prompt do Claude Code** — quando o Claude Code pedir permissão para rodar `ssh`, aceitar. O bloqueio foi do modo automático, não uma limitação técnica.
2. **Rodar manualmente no terminal** — copiar e colar os comandos `ssh`/`docker exec` deste plano no PowerShell ou Git Bash. A chave SSH em `~/.ssh/id_rsa` já está configurada (mesma que o `deploy-all.ps1` usa).
3. **Usar o script de deploy** — `deploy-all.ps1` já se conecta ao VPS com a mesma chave e executa comandos remotos via `Ssh()` e `SshScript()`. Para comandos pontuais, basta rodar diretamente:

```powershell
ssh -i C:\Users\Lenovo\.ssh\id_rsa -o IdentitiesOnly=yes root@187.127.249.22 "docker logs --since 24h prospector-platform-web-1 2>&1 | grep -i 'digest\|error' | tail -50"
```

Todas as causas marcadas como **CONFIRMADA** foram fechadas por evidência estática (código + schema + documentação do fornecedor) e não dependem de produção. A única marcada como **A CONFIRMAR** tem o comando exato na Etapa 0.

---

## 1. Matriz dos relatos

| # | Relato | Causa raiz | Estado | Etapa |
|---|---|---|---|---|
| 5 | Overview mostra apenas "Não deu para carregar 1403321119" | `OverviewReadiness` consulta `news_sources WHERE enabled=true`, mas a coluna se chama `active` → erro PG `42703` fora do tratamento de degradação | **CONFIRMADA** | E1.1 |
| 9a | Aba **Contas e integrações** falha com `trace_indisponivel` | `accounts/page.tsx` consulta `SELECT action,target,created_at FROM audit_log`, mas a coluna se chama `at` → erro PG `42703` | **CONFIRMADA** | E1.2 |
| 9b | Aba **Automações** falha com `trace_indisponivel` | `DataGrid` do `ui-bridge` usa TanStack Table v9 sem registrar `features` → `column.getIsSorted is not a function` no cliente | **CONFIRMADA** | E1.3 |
| — | `TypeError: e.column.getIsSorted is not a function` no console | idem 9b | **CONFIRMADA** | E1.3 |
| — | `Minified React error #419` (×2) | Consequência de 5 e 9b: o boundary de Suspense do servidor aborta durante o streaming | **CONFIRMADA** | E1 |
| 2 | "Estado desejado e consumidores" tudo `disabled` | `system-health/page.tsx` calcula `desired` a partir de `process.env.WORKER_*_ENABLED`; a fonte canônica é `worker_settings.enabled` | **CONFIRMADA** | E2.1 |
| 4 | "Workers ativos: 0", "Backlog real: 19" | O mesmo cálculo de `desired` zera o KPI; os 41 workers estão `enabled=false` no banco desde o seed, enquanto o `scheduler` continua enfileirando jobs repetíveis | **CONFIRMADA** | E2.1 / E4 |
| 1 | Heartbeats com muitos `paused` e `stopped/reconectando`, poucos "ao vivo" (e mesmo esses `paused`) | (a) `worker_settings.enabled=false` → o runtime chama `worker.pause()` e reporta `state='paused'`; (b) `worker_heartbeats` é chaveada por `instance_id = HOSTNAME` (ID do container) e nunca é limpa → linhas órfãs de deploys antigos ficam eternamente "reconectando" | **CONFIRMADA** | E3.1 / E4 |
| 3 | Falha crítica `heartbeat_age_seconds` | O dead-man do worker `alerts` lê as linhas órfãs de `worker_heartbeats` e abre alerta `critical` para instâncias que não existem mais | **CONFIRMADA** | E3.1 |
| 6 | Não há como iniciar radar/workers nem configurar agendamentos | Iniciar/parar/executar **existe** (`/api/admin/automations`) mas está inacessível porque a tela quebra (9b). Agendamento **não existe**: `installPlatformSchedulers` é fixo no código e `worker_settings.cadence` nunca é lido nem editável | **CONFIRMADA** | E1.3 / E4.2 |
| 7 | Oportunidades, Conteúdos e Creative Bridge vazios | O baseline de `CRESCIMENTO-ORGANICO-ROTA-DE-ATAQUE.md` (migration `0020`) semeia `theses`, `content_suggestions` e `scheduled_publications`. As três telas leem `content_opportunities`, `content_items` e `creative_bridge_deliveries` — tabelas alimentadas só pelo worker `content-opportunity` (a partir de `topics`/`organic_intelligence_signals`) e pelas APIs de conteúdo. Não existe ponte entre as duas metades | **CONFIRMADA** | E5 |
| 8 | Kanban/calendário sem ver ou editar copy | `scheduled_publications.content_structure` (jsonb, migration `0025`) existe mas não é lido pela página, não é aceito pela API `/api/admin/publications` e não aparece no diálogo de edição — que só tem título, legenda, CTA e hashtags | **CONFIRMADA** | E6 |
| — | `Error: An error occurred in the Server Components render` com digest | Mensagem genérica de produção; o digest `1403321119` deve corresponder ao erro de E1.1 | **A CONFIRMAR** (E0.1) | E0 |

---

## 2. Causas-raiz confirmadas, com evidência

### C1 — `news_sources.enabled` não existe (Overview cai)

`apps/web/src/components/OverviewReadiness.tsx`, linha 16:

```sql
SELECT count(*)::int count FROM news_sources WHERE enabled=true
```

`packages/db/migrations/0013_editorial_doctrine.up.sql:84` cria `news_sources` com a coluna **`active`**, não `enabled`. Nenhuma migration posterior adiciona `enabled`. Todo o resto do código usa `active` corretamente (worker `news-radar`).

Efeito: PostgreSQL devolve `42703 undefined_column`. `OverviewReadiness` não tem `try/catch`, então a exceção sobe pelo `MainContent`, aborta o boundary de Suspense (React #419) e o boundary de erro imprime o digest — exatamente `Não deu para carregar 1403321119`.

> `loadDashboardView` já tem degradação para `55000`/`42P01`, mas `OverviewReadiness` roda **fora** desse caminho e não tem proteção nenhuma.

### C2 — `audit_log.created_at` não existe (Contas e integrações cai)

`apps/web/src/app/accounts/page.tsx`:

```sql
SELECT action,target,created_at FROM audit_log ORDER BY created_at DESC LIMIT 30
```

`packages/db/migrations/0001_initial.up.sql:74` cria `audit_log(..., at timestamptz DEFAULT now())`. Não há `created_at` e nenhuma migration adiciona.

Efeito: `42703`. Como a query está dentro de um `Promise.all` sem tratamento, a página inteira falha em todo request. É a única leitura de `audit_log` no app — os `INSERT` usam as colunas certas.

### C3 — `DataGrid` incompatível com TanStack Table v9

`packages/ui-bridge/src/data.tsx`, linhas 128–153: `useTable` recebe `createCoreRowModel`, `createSortedRowModel` e `createPaginatedRowModel` **no nível raiz das opções**, e nenhuma feature é registrada.

A documentação da versão instalada é explícita
(`node_modules/@tanstack/table-core/skills/migrate-v8-to-v9/SKILL.md`):

> "V8 bundled all stock features. V9 exposes an API only when its feature is present in `tableFeatures({...})`."

E `dist/core/table/constructTable.js:26` mostra que os row models são lidos de `tableOptions.features.coreRowModel` / `.sortedRowModel` / `.paginatedRowModel`. O que está no nível raiz é descartado.

Efeito: `column.getIsSorted`, `getCanSort`, `getIsVisible`, `getToggleVisibilityHandler`, `row.getIsSelected`, `getToggleSelectedHandler`, `table.getState().pagination` e `getPageCount` **não existem**. O `<th>` chama `header.column.getIsSorted()` incondicionalmente (`data.tsx:211`), então **qualquer** tabela quebra, mesmo com `enableSorting={false}`.

Telas afetadas: `automations`, `radar`, `leads`, `timeline`, `community`, `competitive-intel`, `source-roi`, `notifications`, `creative-bridge` e a aba Timeline do dashboard operacional.

O `// @ts-ignore` em `data.tsx:126` e os `as any` são o motivo de o `typecheck` estar verde apesar do erro.

### C4 — `system-health` lê o estado desejado da fonte errada

`apps/web/src/app/system-health/page.tsx`, linha 41:

```ts
desired: process.env[flagName(worker)] === "true"
```

O runtime de worker (`packages/queue/src/runtime.ts:10-17`) documenta e implementa o oposto:

> "PostgreSQL é a fonte canônica do estado desejado. A flag só é fallback para execução sem banco."

Além disso, `.env.example` define apenas **15** flags `WORKER_*_ENABLED` (todas `false`) para **41** filas. Logo, a coluna "Estado desejado" marca `disabled` para todos e "Workers ativos" sempre resulta 0 — independentemente do que estiver no banco.

### C5 — `worker_heartbeats` acumula instâncias órfãs

`packages/shared/src/worker.ts:32` usa `instanceId = process.env.HOSTNAME ?? crypto.randomUUID()`. Em Docker, `HOSTNAME` é o ID do container, que muda a cada `up`/rebuild. A chave primária é `(worker, instance_id)` e **não existe nenhum `DELETE` nem política de retenção** em todo o repositório.

Consequências encadeadas:

1. `system-health` lista uma linha por instância histórica → o `LiveBadge` mostra "Reconectando…" para todas as antigas (relato 1).
2. O dead-man de `workers/alerts/src/main.ts` (blocos em ~228 e ~265) percorre `worker_heartbeats` e abre alerta `critical` com métrica `heartbeat_age_seconds` para cada órfã (relato 3).
3. `automations/page.tsx:14` faz `LEFT JOIN worker_heartbeats wh ON wh.worker = ws.worker_name` sem desempatar por instância → **duplica linhas de worker** na tabela.

### C6 — A plataforma nasce desligada e não há agendamento configurável

`packages/db/migrations/0014_seed_doctrine.up.sql:136` semeia as 41 linhas de `worker_settings` com `enabled=false`. A conferência entre `QUEUE_NAMES` (`packages/shared/src/index.ts:323`) e o seed não mostra divergência: 41 × 41, mesmos nomes.

O `scheduler` (`packages/queue/src/scheduler.ts`) instala jobs repetíveis mesmo assim — dead-man a cada 30 s, publisher a cada 60 s, news-radar a cada 15 min, etc. Com todos os consumidores pausados, o backlog cresce (os 19 do relato 4).

A cadência é **fixa no código** (`installPlatformSchedulers`, `packages/queue/src/index.ts`). A coluna `worker_settings.cadence` existe e nunca é lida. Não há rota nem UI para editar agendamento.

### C7 — O baseline editorial não chega às telas de conteúdo

`0020_growth_organic_manual_baseline.up.sql` insere em `theses`, `content_suggestions` e `scheduled_publications`.

As telas leem outra coisa:

| Tela | Tabela lida | Quem alimenta |
|---|---|---|
| Oportunidades | `content_opportunities` | só o worker `content-opportunity`, a partir de `topics` e `organic_intelligence_signals` |
| Conteúdos | `content_items` | só `POST /api/content-items` e o fork |
| Creative Bridge | `creative_bridge_deliveries` | só `POST /api/content-opportunities/{id}/creative` |

Como `topics` depende de concorrentes cadastrados + worker `competitive-intel` ligado, e `organic_intelligence_signals` depende de research runs, **as três telas ficam vazias por construção**. As 20 sugestões existem, mas em `content_suggestions`, que só aparece em Review Inbox e Inteligência competitiva.

Bug de vocabulário associado: `OverviewReadiness` conta oportunidades com `status IN ('pending','review')`, mas o worker grava `status='new'` (`workers/content-opportunity/src/main.ts`). O contador nunca sai de zero.

### C8 — A copy completa nunca é carregada nem editada em Publicação

`0025_creative_bridge_and_publication_contracts.up.sql:10` adiciona `scheduled_publications.content_structure jsonb NOT NULL DEFAULT '{}'`.

- `apps/web/src/app/publishing/page.tsx` **não seleciona** `content_structure`.
- `apps/web/src/app/api/admin/publications/route.ts` (`PublicationInput`) **não aceita** `content_structure` — e o schema é `.strict()`, então enviar o campo hoje resulta em `400`.
- `PublishingClient.tsx` (diálogo de edição, ~336–381) só oferece Título, Legenda, CTA e Hashtags.

Kanban e calendário mostram `item.title || item.caption?.slice(0, 40)`. Não há lugar para roteiro, slides de carrossel ou copy longa.

---

## 3. Achados adicionais (fora dos 9 relatos)

| ID | Achado | Arquivo | Severidade |
|---|---|---|---|
| X1 | `0016` criou `hashtags text[]` e `cta text`; `0025` tenta recriá-las como `jsonb` com `ADD COLUMN IF NOT EXISTS` → **é silenciosamente ignorado**. O schema real diverge do contrato pretendido | migrations `0016`, `0025` | Alta |
| X2 | `0025` cria dois índices sem `IF NOT EXISTS` → a migration não é reexecutável | `0025_...up.sql` | Média |
| X3 | `OverviewReadiness` linka para `/content-opportunities`; a rota real é `/content-opportunity` → 404 | `OverviewReadiness.tsx` | Média |
| X4 | `system-health/page.tsx` roda `getJobCounts` das 41 filas em um único `Promise.all` sem tratamento: uma falha de Redis derruba a página inteira | `system-health/page.tsx` | Média |
| X5 | `automations/page.tsx` e `/api/admin/automations` abrem 41 objetos `Queue` + 1 conexão Redis **por request** | ambos | Média (performance) |
| X6 | `run_now` só tem payload para 7 workers; os outros 34 devolvem `422 manual_payload_not_supported` | `/api/admin/automations` | Média |
| X7 | `CREDENCIAIS_VPS.txt` (senha root do VPS, chaves R2, tokens Meta/Threads/DeepSeek) está na árvore do repositório e **não está no `.gitignore`** do repositório externo | raiz `Sistema de Design/` | Alta (segurança) |
| X8 | `feedback.tsx`, `fields.tsx` e `help.tsx` do `ui-bridge` não têm `'use client'`, ao contrário dos irmãos | `packages/ui-bridge/src` | Baixa |

---

## 4. Plano de execução

Cada etapa tem passos numerados, arquivos e um critério de aceite verificável. E1 a E3 são pré-requisito de todo o resto: enquanto as telas caem, nada mais pode ser validado por observação.

---

### Etapa 0 — Coletar a evidência de produção que faltou

**Objetivo:** confirmar a hipótese aberta e fotografar o estado real antes de mexer.
**Pré-requisito:** acesso SSH ao VPS (ver "Nota sobre acesso SSH" acima).

Os comandos abaixo podem ser executados de três formas: aprovando o prompt do Claude Code, colando no terminal local, ou via `ssh -i C:\Users\Lenovo\.ssh\id_rsa -o IdentitiesOnly=yes root@187.127.249.22 "<comando>"`.

**Passo 0.1 — Casar o digest com a mensagem real**

```bash
ssh -i ~/.ssh/id_rsa -o IdentitiesOnly=yes root@187.127.249.22 \
  "docker logs --since 24h prospector-platform-web-1 2>&1 | grep -i 'digest\|error' | tail -50"
```

Aceite: aparece o stack da query de `news_sources` (confirma C1) e o da query de `audit_log` (confirma C2). Se aparecer outra coisa, **volte à Fase 1** antes de aplicar E1.

**Passo 0.2 — Fotografar o estado operacional**

```bash
ssh -i ~/.ssh/id_rsa -o IdentitiesOnly=yes root@187.127.249.22 \
  'docker exec prospector-platform-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT count(*) total, count(*) FILTER (WHERE enabled) ligados FROM worker_settings;" \
    -c "SELECT worker, count(*) instancias, max(last_beat_at) ultimo FROM worker_heartbeats GROUP BY worker HAVING count(*) > 1 ORDER BY 2 DESC;" \
    -c "SELECT kind, severity, count(*) FROM alerts WHERE resolved_at IS NULL GROUP BY 1,2;"'
```

**Passo 0.3 — Confirmar o tipo real das colunas divergentes (X1)**

```bash
ssh -i ~/.ssh/id_rsa -o IdentitiesOnly=yes root@187.127.249.22 \
  'docker exec prospector-platform-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "\d+ scheduled_publications" -c "\d+ audit_log" -c "\d+ news_sources"'
```

**Passo 0.4 — Verificar quantos containers de worker estão de pé**

```bash
docker ps --filter "name=prospector-platform-worker" --format "{{.Names}}\t{{.Status}}" | sort
```

**Entregável:** `plataforma/docs/baseline/estado-2026-08-19.md` com as saídas. É a referência de "antes" para provar que as correções funcionaram.

---

### Etapa 1 — Desbloquear as telas que caem (P0)

Sem isto, nenhuma outra correção é observável.

**Passo 1.1 — Corrigir a consulta de fontes de notícia**

Arquivo: `apps/web/src/components/OverviewReadiness.tsx`

1. Trocar `FROM news_sources WHERE enabled=true` por `FROM news_sources WHERE active=true`.
2. Envolver o bloco de consultas em `try/catch` e devolver um `EmptyState` explicativo em vez de propagar — o Overview não pode cair por causa de um checklist auxiliar.
3. Corrigir o link `/content-opportunities` → `/content-opportunity` (X3).
4. Alinhar o filtro de oportunidades ao vocabulário real: `status IN ('new','pending','review')` (E5.1 unifica isso de vez).

**Passo 1.2 — Corrigir a consulta de auditoria**

Arquivo: `apps/web/src/app/accounts/page.tsx`

1. `SELECT action,target,at AS created_at FROM audit_log ORDER BY at DESC LIMIT 30` — mantém o contrato do cliente intacto.
2. Encapsular cada consulta pesada da página em degradação individual, para que um erro de uma seção não derrube as quatro abas.

**Passo 1.3 — Migrar o `DataGrid` para a API v9 do TanStack Table**

Arquivo: `packages/ui-bridge/src/data.tsx`

1. Definir as features **fora do componente**, uma única vez:

```ts
import {
  tableFeatures, rowSortingFeature, rowSelectionFeature,
  columnVisibilityFeature, rowPaginationFeature,
  createCoreRowModel, createSortedRowModel, createPaginatedRowModel,
} from '@tanstack/react-table'

export const gridFeatures = tableFeatures({
  rowSortingFeature, rowSelectionFeature,
  columnVisibilityFeature, rowPaginationFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})
```

2. Passar `features: gridFeatures` para `useTable` e **remover** `createCoreRowModel`/`createSortedRowModel`/`createPaginatedRowModel` do nível raiz das opções.
3. Parar de usar `enableSorting`/`enablePagination` como interruptor de feature: as features ficam sempre registradas; o que varia é a opção normal do TanStack.
4. **Remover o `// @ts-ignore` da linha 126.** Ele é o que escondeu o erro; sem removê-lo a correção não é verificável pelo `typecheck`.
5. Alinhar `createColumnHelper` nos consumidores: v9 usa `createColumnHelper<typeof gridFeatures, TData>()`. Hoje há `createColumnHelper<any, Item>()` (`OperationalInteractive.tsx:12`, `AutomationsClient.tsx:17`) e `tableFeatures({})` vazio (`creative-bridge/page.tsx:11`). Exportar `gridFeatures` do `ui-bridge` e usar o mesmo objeto em todos.

**Passo 1.4 — Teste de regressão que trava o erro**

Novo arquivo: `packages/ui-bridge/src/data.test.tsx`

- Renderizar `DataGrid` com `renderToStaticMarkup` (padrão já usado em `multichannel-patterns.test.tsx`) em quatro combinações: sem opções, `enableSorting`, `enableSelection`, `enablePagination`.
- O teste deve falhar hoje e passar depois. É a prova exigida pela Fase 4 do método.

**Aceite da Etapa 1:** Overview, Automações e Contas e integrações renderizam; console sem `getIsSorted` e sem React #419; `pnpm --filter @plataforma/ui-bridge typecheck` verde sem `@ts-ignore`.

---

### Etapa 2 — Control plane de workers refletindo a realidade

**Passo 2.1 — `system-health` deve ler `worker_settings`**

Arquivo: `apps/web/src/app/system-health/page.tsx`

1. Substituir `desired: process.env[flagName(worker)] === "true"` por lookup em `worker_settings.enabled`.
2. Manter a flag de ambiente apenas como fallback quando não houver linha no banco, para casar com `packages/queue/src/runtime.ts`.
3. Remover o helper `flagName` da página quando deixar de ser usado.
4. Recalcular "Workers ativos" como *habilitado no banco* **e** *com heartbeat fresco* — hoje `filter(desired).length - missing` mistura duas dimensões.

**Passo 2.2 — Deduplicar heartbeat na Automações**

Arquivos: `apps/web/src/app/automations/page.tsx` e `apps/web/src/app/api/admin/automations/route.ts`

- Trocar o `LEFT JOIN worker_heartbeats` por `LEFT JOIN LATERAL (... ORDER BY last_beat_at DESC LIMIT 1)`, garantindo uma linha por worker (resolve C5.3).

**Passo 2.3 — Endurecer as páginas contra falha de Redis**

1. Em `system-health/page.tsx`, envolver cada `getJobCounts` em `catch` individual, devolvendo `null` como já é feito na Automações (X4).
2. Criar um registry de filas **singleton por processo** em `packages/queue/src/index.ts`, no mesmo padrão do pool de Postgres (`packages/db/src/index.ts`), e parar de abrir/fechar 41 filas por request (X5).

**Aceite:** com um worker habilitado no banco, `system-health` mostra `running`; desabilitado, `disabled` — sem tocar em variável de ambiente nem redeploy.

---

### Etapa 3 — Higiene de heartbeats e alertas

**Passo 3.1 — Retenção de instâncias**

1. Nova migration `0027_worker_heartbeat_retention`: `DELETE FROM worker_heartbeats WHERE last_beat_at < now() - interval '2 hours';` (limpeza do passivo). O índice necessário já existe (`worker_heartbeats_last_beat_idx`, migration `0003`).
2. Em `createPostgresHeartbeatStore` (`packages/db/src/index.ts`), ao registrar batida apagar as instâncias antigas do mesmo worker:
   `DELETE FROM worker_heartbeats WHERE worker=$1 AND instance_id<>$2 AND last_beat_at < now() - interval '10 minutes'`.
3. Complemento recomendado: derivar `instance_id` do nome do serviço compose em vez de `HOSTNAME`, para não gerar identidade nova a cada deploy.

**Passo 3.2 — Dead-man não deve alertar worker desligado de propósito**

Arquivo: `workers/alerts/src/main.ts` (bloco dead-man)

1. Fazer `JOIN` com `worker_settings` e ignorar heartbeats de workers com `enabled=false` — hoje um worker pausado por decisão operacional é indistinguível de um worker morto.
2. Resolver automaticamente os alertas abertos cujo `worker_instance` não existe mais em `worker_heartbeats`.

**Passo 3.3 — Limpar o passivo de alertas**

- Após 3.1 e 3.2, resolver em lote os `alerts` de `worker_dead_man` órfãos, com `decided_by='cleanup-2026-08-19'`.

**Aceite:** `system-health` mostra uma linha por worker vivo; "Alertas críticos" volta a zero e só sobe por falha real.

---

### Etapa 4 — Ligar a operação e tornar o agendamento configurável

**Passo 4.1 — Ligar o núcleo mínimo (dado, não código)**

Pela tela de Automações já desbloqueada (E1.3), habilitar nesta ordem:

1. `data-quality` — sem ele o Overview não consolida nada.
2. `alerts` — dead-man e canários.
3. `news-radar` — **exige antes** pelo menos uma linha `active=true` em `news_sources`.
4. `competitive-intel` — **exige antes** concorrentes vinculados à campanha em `campaign_competitors`.
5. `content-opportunity` — só produz depois que o passo 4 gerar `topics`.

Verificar `worker_heartbeats.state='running'` antes de seguir para o próximo. Não ligar os 41 de uma vez: o VPS tem 2 vCPU e 8 GB.

**Passo 4.2 — Agendamento gerenciável**

1. Contrato: usar `worker_settings.cadence` (hoje morto) como origem da verdade, aceitando `every:<ms>` ou expressão cron.
2. `packages/queue/src/index.ts`: `installPlatformSchedulers` passa a ler `worker_settings` e a fazer `upsertJobScheduler`/`removeJobScheduler` conforme a cadência gravada, mantendo os valores atuais como *default* de seed.
3. `POST /api/admin/automations`: aceitar a ação `set_schedule` com `{ workerName, cadence }`, validada por Zod, gravando em `worker_settings.cadence` + `audit_log`.
4. `AutomationsClient.tsx`: coluna e ação "Agendamento", exibindo o `next` do scheduler já devolvido pelo `GET` (`bullmq.schedulers`).
5. O `scheduler` reconcilia a cada hora; reduzir para 5 min para que a mudança na UI tenha efeito em tempo operacional.

**Passo 4.3 — Ampliar `run_now`**

- Substituir o mapa fixo de 7 payloads por um payload padrão declarado junto do `spec` de cada worker, para que "Executar agora" funcione em toda a grade (X6).

**Aceite:** o operador liga o radar pela UI, define "a cada 30 min", clica em "Executar agora" e `worker_runs` registra a execução — sem deploy.

---

### Etapa 5 — Fechar a cadeia editorial até as telas

**Passo 5.1 — Unificar o vocabulário de status de oportunidade**

1. Definir o conjunto canônico (`new`, `review`, `approved`, `rejected`, `expired`) e aplicar `CHECK` na migration `0028`.
2. Corrigir `OverviewReadiness`, `ContentOpportunityClient` e o worker para o mesmo vocabulário. Sem isso, qualquer contagem continua mentindo.

**Passo 5.2 — Ponte `content_suggestions` → `content_opportunities`**

Este é o passo que resolve o relato 7 de verdade.

1. Migration `0028_bridge_manual_baseline_to_opportunities`: promover as 20 sugestões manuais do baseline `growth-organic-baseline-v1` para `content_opportunities`, preservando `origin='manual'`, `evidence` apontando para `CRESCIMENTO-ORGANICO-ROTA-DE-ATAQUE.md` e o `locked_at` de proveniência (o trigger `enforce_manual_immutability` precisa continuar valendo).
2. Idempotente: `WHERE NOT EXISTS` por `source_references`, no padrão já usado em `0020`.

> **Decisão a tomar antes de implementar:** a alternativa é a tela Oportunidades ler a **união** de `content_opportunities` com `content_suggestions` em `curation_status='proposed'`. Menos migration, mais complexidade de query e de RBAC. Escolher uma; não fazer as duas.

**Passo 5.3 — Ponte oportunidade → conteúdo**

1. `ContentOpportunityClient`: ação "Transformar em conteúdo", chamando `POST /api/content-items` com `opportunity_id`, `thesis_id`, `angle`, `hook` (a coluna `content_items.opportunity_id` existe desde `0010`).
2. Semear os 7 itens de calendário do baseline como `content_items` em `draft`, ligados às teses já semeadas, para que Conteúdos deixe de nascer vazia.

**Passo 5.4 — Creative Bridge alimentado**

1. Com 5.2 e 5.3 no lugar, `POST /api/content-opportunities/{id}/creative` passa a ter insumo. Validar o fluxo ponta a ponta: oportunidade → entrega → editor do Design System → retorno com asset.
2. Corrigir o `tableFeatures({})` vazio de `creative-bridge/page.tsx:11` junto com E1.3.

**Aceite:** Oportunidades mostra as 20 sugestões do documento canônico; Conteúdos mostra os 7 itens do calendário; Creative Bridge cria entrega a partir de uma oportunidade aprovada.

---

### Etapa 6 — Copy completa em Publicação

**Passo 6.1 — Contrato de dados da copy**

1. Definir o schema de `scheduled_publications.content_structure` em Zod, em `apps/web/src/lib/admin-publishing-schemas.ts`:
   `{ roteiro?: string, slides?: Array<{ ordem, titulo, texto }>, legenda_longa?: string, observacoes?: string }`.
2. Migration `0029` para resolver X1: converter `hashtags text[]` → `jsonb` e `cta text` → `jsonb` **com `USING` explícito**, já que `0025` foi ignorada. Adicionar `IF NOT EXISTS` aos índices de `0025` (X2).

**Passo 6.2 — Carregar e expor**

1. `publishing/page.tsx`: incluir `scheduled.content_structure` no `SELECT`.
2. `PublishingClient.tsx`: nova seção "Copy" no diálogo de edição, com roteiro, slides de carrossel e legenda longa, além dos campos atuais.
3. Kanban e calendário: indicador de "tem copy / falta copy" e abertura direta na seção Copy.

**Passo 6.3 — Persistir**

1. `PublicationInput` em `/api/admin/publications`: aceitar `content_structure` validado — o schema é `.strict()`, então **precisa** ser declarado, não apenas enviado.
2. `PATCH` correspondente, com `audit_log` e respeito à trava de proveniência manual.

**Passo 6.4 — Semear as copys reais**

- `Docs/PLANO-DE-PUBLICACAO-15-DIAS.md` já tem as copys completas do calendário 17–31/08. Migration de seed idempotente preenchendo `content_structure` das publicações do batch `growth-organic-baseline-v1`.

**Aceite:** abrir um card do Kanban mostra a copy completa e permite editar; o texto sobrevive a reload e aparece no `audit_log`.

---

### Etapa 7 — Consistência de schema e contratos

**Passo 7.1 — Varredura sistemática de colunas**

C1 e C2 são o mesmo defeito: SQL escrito à mão contra colunas inexistentes, sem nada que detecte. Duas ocorrências iguais em telas diferentes indicam que **há mais**.

1. Script `scripts/check-sql-columns.mjs`: sobe um Postgres efêmero, aplica todas as migrations, extrai os literais SQL de `apps/web/src` e `workers/*/src` e executa `PREPARE` em cada um. Qualquer `42703`/`42P01` falha o build.
2. Rodar no CI (`.github/workflows`) e como gate de deploy.

**Passo 7.2 — Migrations reexecutáveis**

1. Auditar `0022`–`0026` procurando `CREATE INDEX`/`CREATE TABLE` sem `IF NOT EXISTS` e o padrão "ADD COLUMN IF NOT EXISTS com tipo diferente do existente" (X1/X2).
2. Adicionar ao `scripts/validate-vps-migrations.mjs` uma verificação de dupla execução (`up` → `up`).

**Passo 7.3 — Segurança (X7)**

1. Adicionar `CREDENCIAIS_VPS.txt`, `credenciais 2.txt` e afins ao `.gitignore` do repositório externo.
2. Confirmar com `git log --all --full-history -- CREDENCIAIS_VPS.txt` que nunca foram commitados.
3. Se confirmado que nunca entraram no histórico, nenhuma ação adicional é necessária — o arquivo fica na árvore local como referência, protegido pelo `.gitignore`.

---

### Etapa 8 — Testes, deploy e documentação

**Passo 8.1 — Testes obrigatórios antes do deploy**

| Teste | Onde | Prova |
|---|---|---|
| `DataGrid` renderiza nas 4 combinações | `packages/ui-bridge/src/data.test.tsx` | C3 |
| `OverviewReadiness` degrada em vez de derrubar a página | `apps/web/src/error-boundaries.test.tsx` | C1 |
| Contrato SQL × schema | `scripts/check-sql-columns.mjs` | C1, C2 |
| `system-health` lê `worker_settings` | teste de contrato novo | C4 |
| Dead-man ignora worker desabilitado | `workers/alerts` | C5, C6 |
| Migrations `up` → `down` → `up` | `packages/db/src/migrations.test.ts` | X1, X2 |

**Passo 8.2 — Ordem de rollout**

1. E1 + E7.1 juntos (correção + gate que impede reincidência) — deploy.
2. E2 + E3 + migration `0027` — deploy.
3. E4 (ligação gradual dos workers; 4.1 não exige deploy de código).
4. E5 + E6 + migrations `0028`/`0029` — deploy.
5. E7.2 e E7.3 em paralelo, sem dependência.

Backup PostgreSQL antes de cada deploy com migration (o pipeline já faz — ver `deploy/prospector-rebuild.log`).

**Passo 8.3 — Documentação a atualizar no mesmo ciclo**

- `Docs/PROSPECTOR.md`: estado real do control plane, agendamento configurável, cadeia editorial.
- `Docs/README.md`: incluir este plano no índice.
- `plataforma/CHANGELOG.md`: seção `Fixed` com C1–C8.
- `plataforma/docs/runbooks/automations.md`: como ligar worker e definir cadência pela UI.
- Novo `plataforma/docs/runbooks/worker-dead-man.md` — hoje o alerta aponta para uma URL de runbook que não existe.
- `Docs/RUNBOOK-OPERACAO-ORGANICA.md`: procedimento de ativação da Etapa 4.1.

---

## 5. Ordem crítica e paralelismo

```
E0 ──► E1 ──┬─► E2 ──► E3 ──► E4
            │
            └─► E5 ──► E6

E7.1 no mesmo deploy de E1
E7.2 / E7.3 independentes
E8 fecha cada bloco
```

**Bloqueios reais:**

- E4.1 (ligar radar) depende de haver fonte em `news_sources` — senão o worker sobe e não faz nada.
- E5.4 (Creative Bridge) depende de E5.2 — sem oportunidade não há entrega.
- E6.4 (seed das copys) depende da migration de tipo em E6.1.

**O que não deve ir junto:** E1.3 mexe no `ui-bridge`, consumido por 11 telas. Esse passo vai sozinho em um commit, com o teste de 1.4 no mesmo commit, para que qualquer regressão seja atribuível.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| A migração do `DataGrid` quebra telas que hoje "parecem" funcionar | Teste de renderização nas 4 combinações antes do deploy; commit isolado |
| Ligar os 41 workers de uma vez satura o VPS (2 vCPU / 8 GB) | Ativação gradual da E4.1, com verificação de heartbeat entre cada um |
| A conversão `text[]` → `jsonb` de `hashtags` perde dados | `USING to_jsonb(hashtags)` + backup pré-migration + teste `up`/`down`/`up` |
| Promover sugestões a oportunidades duplica conteúdo se rodar duas vezes | `WHERE NOT EXISTS` por `source_references`, no padrão de `0020` |
| O digest `1403321119` corresponder a outra causa | A Etapa 0.1 é bloqueante para E1.1 |
