# Prompt de Finalização Completa — Plataforma Rota de Ataque

> **Contexto para o agente executor:** a Fase 0/1/2/3/9 do plano-mestre (`../../PROMPT_EXPANSAO_PROSPECTOR_E_GESTAO_REDES.md`) está **entregue** (relatório em `execution-report-2026-08-08.md`). O que existe hoje é o *cimento estrutural*: monorepo pnpm+turbo, 67 tabelas materializadas com todas as decisões D1–D8 travadas como `CHECK`/`FOREIGN KEY`, 9 packages com helpers reais, 29 workers como esqueletos, 17 páginas de dashboard como placeholder `FeaturePage`, backend das API routes implementado, deploy no VPS ativo em modo leitura. Este prompt finaliza o que falta.
>
> **Fonte de verdade:** o plano-mestre continua sendo o `.md` da pasta superior. Este prompt operacionaliza os passos 10.3.3 → 10.3.17 do cutover + destrava 3 bugs pendentes.
>
> **Ordem canônica:** execute Bloco 0 antes de qualquer outro. Depois Blocos 1 → 6 na sequência (cada um habilita o próximo passo do cutover).
>
> **Regra de proteção:** todo bloco fecha com o checklist do Apêndice B do plano-mestre. Nenhum bloco fecha se algum teste ficar `skipped`, `only` ou vermelho — ver Bloco 0.

---

## BLOCO 0 — Destravar o CI (bugs pendentes, obrigatório antes de qualquer coisa)

### 0.1 Corrigir os 2 testes E2E órfãos do design-system

**Problema:** `apps/design-system/tests/e2e/editor.spec.ts` procura os textos exatos `"Rota de Ataque"` no `<header>` e `"Formato"` no primeiro `<aside>`; os textos não existem no app atual. O relatório de execução justificou pular com "byte-a-byte impede corrigir", mas o Apêndice B do plano-mestre exige "test:e2e verde" como gate. **Ficar com CI vermelho para sempre elimina o valor da gate de não-regressão.**

**Ação (2 caminhos aceitáveis, escolha um por evidência, não por gosto):**

1. **Rodar o app localmente** (`pnpm --filter @plataforma/design-system dev`) e inspecionar visualmente o `<header>` e o primeiro `<aside>` da rota `/`. Documentar em `docs/e2e-drift-analysis.md`:
   - o que o `<header>` mostra hoje (texto exato);
   - o que o primeiro `<aside>` mostra hoje;
   - se o design intencional pede outro texto → **corrigir o app** (fonte de verdade é o design; testes ficaram desatualizados por drift natural);
   - se o design pede exatamente `"Rota de Ataque"`/`"Formato"` → **corrigir o app** para exibir esses textos;
   - se o design mudou e os textos antigos estão obsoletos → **atualizar os 2 testes** para bater com o design vigente.
2. Após a correção, rodar `pnpm --filter @plataforma/design-system test:e2e` e confirmar **verde**.
3. **Regenerar hashes de baseline** (`scripts/verify-baseline-hashes.mjs` deve rodar em modo "atualizar" ou você atualiza o `baseline/hashes.json` manualmente, refletindo os arquivos modificados) — os hashes mudam porque `tests/` faz parte do baseline do Passo 0.1.2.
4. Commit único: `fix(design-system): resolve e2e drift and refresh baseline hashes`. Documentar no CHANGELOG por que foi permitido alterar `tests/`.

**Definição de pronto do 0.1:** CI verde na branch principal, incluindo `design-system-no-regression`.

### 0.2 Reconciliar desvio D2 no plano-mestre

**Problema:** o `.env.example` e o CHANGELOG usam `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (decisão correta — 384 dims, multilíngue, disponível no registry), mas o plano-mestre ainda diz `bge-small-pt` em §0.5 tabela D2 e Passo 2.6.1.

**Ação:** editar `../../PROMPT_EXPANSAO_PROSPECTOR_E_GESTAO_REDES.md`:
- Em §0.5 tabela D2 (linha ~96): trocar `**`bge-small-pt`, 384 dims, local no VPS**` por `**`paraphrase-multilingual-MiniLM-L12-v2`, 384 dims, multilíngue, local no VPS**`.
- Em Passo 2.6.1: substituir todas as ocorrências de `bge-small-pt` pelo mesmo id acima.
- Adicionar linha ao final do Passo 2.6.1: `**Desvio documentado (2026-08-08):** o id `bge-small-pt` não existe no registry `text-embeddings-inference`; a decisão foi manter `EMBEDDING_DIM=384` e trocar o modelo para o multilíngue equivalente, sem impacto de schema.`

**Definição de pronto do 0.2:** plano-mestre e código citam o mesmo id.

### 0.3 Sinalizar honestamente onde o cutover parou

**Problema:** o relatório dá impressão de estar em 10.3.5+ ("workers outbound desligados até vinculação Meta"), mas na prática está em **10.3.2** — porque nenhum worker inbound coleta nada (todos stubs).

**Ação:** atualizar `docs/execution-report-2026-08-08.md` com uma seção nova "Estado do cutover" que diga literalmente:
- Passos 10.3.1 e 10.3.2 concluídos (design-system deployed + web em modo leitura + shells de páginas + backend das API routes).
- Passos 10.3.3 a 10.3.17 **pendentes** — dependem dos Blocos 1–6 deste prompt.
- Não foi possível vincular contas Meta ainda porque nenhum worker inbound demonstrou coleta funcional; a validação Meta será feita no fim do Bloco 1.

**Definição de pronto do 0.3:** relatório reflete a realidade sem inflar.

---

## BLOCO 1 — Intelligence Base (Passos 10.3.3 → 10.3.4)

### Objetivo
Fazer a coleta rodar de ponta a ponta em um concorrente real: `meta-sync` traz metadados/mídia, `extraction` traz comentários dos posts, `classification` classifica cada comentário, `scoring` calcula prioridade. Sem outbound. Sem UI ainda — validação por SQL + logs Prometheus.

### Escopo dos workers a implementar de verdade

**1.1 `workers/meta-sync/src/index.ts`** — completar:
- Consumir jobs `meta-sync-competitor` e `meta-sync-own` (jobIds do §25 do plano).
- Usar `packages/meta-api` para Business Discovery: `.env` `META_ACCESS_TOKEN` + `META_INSTAGRAM_ACCOUNT_ID`. Para cada `campaign_competitors WHERE status='active'`: puxar metadados atualizados + últimos N posts (default 25); comparar `shortcode` contra `posts` já em banco; novos posts entram com `source='api'` e `enqueueOnce('extraction', ...)` é chamado para cada novo.
- Para conta própria (`role='actor'`): `own_media`, `own_comments`, insights, mentions, DM threads/messages via API.
- Registrar consumo de rate limit em `account_health.api_rate_limited_count`.
- Emitir métricas Prometheus: `meta_sync_posts_new_total`, `meta_sync_api_errors_total{endpoint}`, `meta_sync_duration_ms`.
- Batir heartbeat em `worker_heartbeats` a cada 30s (usar helper novo em `packages/shared/worker.ts`).
- Executar `preflight()` (D8 role check + token válido + `EMBEDDING_DIM` do servidor bate).

**1.2 `workers/extraction/src/index.ts`** — completar:
- Consumir fila `extraction` com jobIds `post:{id}:extraction:{runId}`.
- Rodar **exclusivamente em `role='collector'`** (`preflight()` aborta se não).
- Abrir Playwright via `packages/browser` (`launchPersistentContext`), respeitar mutex Redis (`account:{id}:lock`), aplicar ritmo humano (delays 2–8s aleatórios — do Passo 4.3.5 do plano).
- Expandir "ver mais" + respostas aninhadas em loop até esgotar.
- `INSERT ... ON CONFLICT (post_id, comment_external_id) DO NOTHING`.
- Coleta oportunista de snippet do perfil (Passo 4.3.8) — grava campos leves em `leads` (avatar, verified).
- Emitir `enqueueOnce('classification', ...)` para cada comment novo.
- Enviar métrica `extraction_coverage` (Passo 4.3.7): `collected / comment_count_shown`; alerta se <60% em posts com >100 comentários (usar `alerts` fila).
- Circuit breaker específico (Passo 4.3.6): se `recent_success_rate < 90%` OU `checkpoints_count` sobe → pausar worker 6h + `alerts.severity='critical'`.
- Heartbeat.

**1.3 `workers/classification/src/index.ts`** — completar:
- Consumir fila `classification` com jobIds `comment:{scope}:{id}:classification`.
- Filtros SQL baratos primeiro (muito curto / só emoji / spam óbvio) — do Passo 2.6.3.
- Chamar servidor local de embeddings (container `embeddings`, endpoint `EMBEDDINGS_ENDPOINT`) via `packages/nlp`. Falhar loud se dim retornada ≠ 384.
- LLM local **ou** provider externo aprovado (verificar Config; provider `openai` proibido por Zod — respeitar D2).
- Grava `comment_classification (scope, intent, topic, sentiment, purchase_signal, is_question, pain_point, confidence, embedding)`.
- Após grava, `enqueueOnce('scoring', {leadId, campaignId, trigger:'classification'})`.
- Heartbeat + métrica `classification_latency_ms`, `classification_llm_errors_total`.

**1.4 `workers/scoring/src/index.ts`** — completar:
- Consumir fila `scoring`. Ler pesos de `campaign_scoring_config` (nunca hardcode).
- Implementar `base_score`, `intent_score`, `relationship_score`, `freshness_multiplier`, `final_score`, `priority` (funções puras já expostas em `packages/shared` — `computeScore`).
- Escrever atomicamente em `lead_scores` + `lead_score_history` (transação).
- **É o único dono de `final_score`** (Apêndice E do plano, propriedade de tabela). Overlap só toca `audience_overlap_score`.
- Emitir evento `lead.priority.changed` (via `INSERT INTO events`) quando priority sobe/desce.
- Heartbeat + métricas.

### Deliverables do Bloco 1
- 4 workers com implementação real (não stub).
- `packages/nlp` completado com cliente do servidor de embeddings + wrapper LLM.
- `packages/browser` completado com `launchPersistentContext`, mutex Redis, rate controller, `withReasonCode` (Passo 2.4.5), circuit breaker do Passo 2.4.4.
- Migração de dados: seed inicial dos 2 concorrentes reais das campanhas `Rota de Ataque` e `Gazeta Concursos` (usuário fornece via `/api/admin/competitors`).
- Teste de integração ponta-a-ponta em CI (Postgres em container): dado 1 competitor + 1 post mockado + 3 comments mockados → `lead_scores` populado com `final_score > 0`.
- Vinculação Meta real das 2 contas (`collector` e `actor`) via fluxo OAuth em `apps/web/accounts/page.tsx` (Passo 6.10.4.5).

### Definição de pronto do Bloco 1
- 1 concorrente real produz `comments` reais em produção, com `comment_classification` populada e `lead_scores` calculado.
- Nenhum worker outbound ligado ainda.
- CI verde (design-system-no-regression + workspace-quality + testes de integração novos).
- Passo 10.3.4 marcado como completo no CHANGELOG.

---

## BLOCO 2 — Telas críticas do dashboard (Passo 10.3.6 antecipado)

### Objetivo
Substituir 6 das 17 páginas `FeaturePage` por composições reais dos patterns do `ui-bridge`. As demais 11 seguem como placeholder até seus blocos correspondentes.

### Escopo (na ordem)

**2.1 `/leads` (Etapa 6.3 do plano) — `TableWithDetail`**
- `DataTable` virtualizada (react-virtual) ordenada por `final_score DESC, priority ASC`.
- Colunas default: `[checkbox, Lead (avatar+username), ScoreBadge, PriorityChip, Intent chips, Fontes ícones, Última atividade relativo, ⋯]`.
- `SavedViewTabs` persistidos em `localStorage` por usuário + `FilterBar` (score, prioridade, intent, comunidade, público apenas).
- `BulkActionBar` flutuante com "Aprovar → gera engagement_action `follow`" (mas botão fica **desabilitado** até Bloco 3, com tooltip "Habilita após Passo 10.3.7").
- `RightDetailPane` com header do lead, 2 KpiCards (Intent/Relationship), `TimelineFeed` dos últimos 20 `lead_interactions`, `SuggestedActionCard` (do `nba-engine` — Bloco 3, por ora mostrar EmptyState "Sem sugestão ainda").
- API `/api/leads?filters=...&cursor=...` implementar (paginação por cursor, não offset).

**2.2 `/review-inbox` (Etapa 6.4) — `ThreePaneLayout`**
- Lista à esquerda: `review_inbox` agrupado por `item_type` com contadores.
- Centro: detalhe + variantes horizontais + ações fixas.
- Direita: mini-perfil do lead + timeline compacta + histórico de decisões.
- Atalhos `A/E/R/B/./j/k/1/2/3` conforme Apêndice I.7.
- API `/api/review-inbox/:id/approve|edit|reject|block|snooze` — todas gravam `audit_log`.
- Estado vazio: "Nada para revisar agora 🎉" com stats do dia (query `SELECT COUNT(*) FILTER (WHERE decided_at::date = CURRENT_DATE)`).

**2.3 `/accounts` (Etapa 6.10.4 sub-aba Contas) — cards por conta**
- 2 cards grandes, um por conta, com `RoleBadge`, `HealthDial`, `KpiRow` mini, lista de `action_policies` com toggle enabled (policies incompatíveis com role ficam disabled com tooltip explicativo).
- Botão "Vincular Meta" quando token ausente/expirado — abre fluxo OAuth (já existente em backend).
- Faixa vermelha persistente se `status` em CHECKPOINT/STOPPED, com CTA "Ver runbook".
- Aba secundária "Concorrentes" (Etapa 6.10.4.1) — DataTable com CRUD; add por username (autocomplete Business Discovery com feedback ✅/⚠ em tempo real); add em lote; toggle pause/archive; slider weight.

**2.4 `/system-health` (Etapa 8.9.10) — DashboardGrid**
- Semáforo geral (OK/Atenção/Crítico) com 3 sinais mais quentes.
- Tabela de heartbeats por worker (query `worker_heartbeats`).
- Grid de `QuotaMeter` (Meta API por token, budget Playwright, disco, Redis, S3, DB conns).
- Cards de canários com última execução + latência + sparkline.
- Kill-switch persistente no topo direito (endpoint `/api/kill-switch` já existe) com confirmação 3s.

**2.5 `/engagement-queue` (Etapa 6.9) — `KanbanBoard`**
- Colunas por status (Pending / Awaiting Approval / Running / Done 24h / Failed 24h / Blocked).
- Cards compactos com `action_type` ícone, target, `PriorityChip`, `reason_code`, `RoleBadge` da conta executora.
- `LiveBadge` + timestamp da última atualização (via SSE `/api/engagement/stream` — endpoint já existe, adicionar publicação de eventos reais).
- Painel direito colapsável com `QuotaMeter` por action_type + `HealthDial` de cada conta.
- Drawer de detalhe do card com `trace_id`, `runbook_url`.

**2.6 `/notifications` (Etapa 8.8.7) — 4 sub-abas**
- Triggers (CRUD de `error_triggers`), Canais (heartbeat + teste manual — endpoint já existe), Incidentes (timeline de `alerts` agrupada por dia), Entregas (DataTable de `notification_deliveries`).

### Deliverables do Bloco 2
- 6 páginas reais compondo os patterns do `ui-bridge` (o resto continua `FeaturePage`).
- APIs correspondentes com validação Zod + `requireRole` + `audit_log`.
- Storybook adicionado no `apps/web` para cada page (snapshot visual).
- `axe-core` em CI para `apps/web` (nova gate).

### Definição de pronto do Bloco 2
- Operador consegue: listar leads reais coletados pelo Bloco 1, ver detalhe, ver `system-health` mostrando heartbeats, vincular Meta pelas cards em `/accounts`, adicionar/pausar concorrente.
- Nenhuma ação outbound ainda executa (Bloco 3).
- CI verde + a11y (axe) passando nas 6 páginas.

---

## BLOCO 3 — Action System conservador (Passos 10.3.7 → 10.3.11)

### Objetivo
Ligar outbound de forma incremental na conta `actor`, respeitando D5 (sem DM fria) e D8 (role check).

### Escopo dos workers

**3.1 `workers/engagement/src/index.ts`** — só `follow` inicialmente:
- Consumir fila `engagement`. `preflight()` recusa se `role != 'actor'`.
- `action_policies` conservadoras (default seed: 20 follows/dia, cooldown 300s, hourly 5).
- Playwright leve (só endpoints de follow/like — não scrape pesado).
- Registrar `reason_code` obrigatório em cada ação, emitir `lead_interactions.kind='follow_sent'` + evento.
- **Nunca** age contra lead sem trilha em `lead_interactions` (Passo 5.2.5 — proteção anti-prospecção às cegas).
- Heartbeat + métricas.

**3.2 `workers/reciprocity-detector/src/index.ts`**:
- Batch a cada 6h correlacionando `lead_interactions` inbound com `engagement_actions` outbound.
- Escrever `reciprocity_events` com `latency_seconds`.
- Emitir `reciprocity.detected` → aciona `nba-engine` recompute (`INSERT INTO events`).

**3.3 `workers/retention-tracker/src/index.ts`** (Etapa 5.10):
- Agendar checkpoints D+1/D+7/D+30/D+90 para cada `engagement_action` de tipo `follow`.
- Preencher `follow_retention` (schema já criado).
- Emitir `retention.churned` quando aplicável.

**3.4 `workers/meta-webhook-consumer/src/index.ts`**:
- Consumir fila `meta-webhook-consumer` (endpoint `/api/meta/webhook` já enfileira jobs — Bloco 0 pronto).
- Roteamento por tipo: `messages` → grava `own_dm_messages` + emite `dm_inbound` (que **só isso** libera `dm-copilot`), `mentions` → `own_mentions` + `mention-monitor`, `comments` → `own_comments` + `classification`.
- `enqueueOnce` deduplicando por `event_id`.

**3.5 `workers/mention-monitor/src/index.ts`**: consome `own_mentions`, vincula/cria `lead`, classifica, `lead_interactions.kind='mention_received'`, se `sentiment=neg` ou `is_question` cria item em `review_inbox`.

**3.6 `workers/private-reply/src/index.ts`** (Etapa 5.5):
- Monitora `own_comments` recém-classificados.
- Se intent em `{duvida, pedido_recomendacao, intencao_compra, buscando_material}` E (`purchase_signal` OR `is_question`): gera texto contextualizado via `packages/humanizer`.
- Cria item em `review_inbox` (aprovação humana obrigatória por Princípio 6).
- Após aprovação, `POST /{comment-id}/private_replies` via `packages/meta-api`.
- Expira draft após 7 dias (janela IG).

**3.7 `workers/dm-copilot/src/index.ts`** — expandir do stub atual:
- `dmPreflight` já bloqueia frio ✅. Agora consumir triggers `dm_inbound` do webhook.
- Reunir contexto, gerar N variantes via LLM, passar por `humanizer`, persistir `dm_drafts (trigger_kind='inbound')`, criar `review_inbox`.
- Após aprovação, `POST` via Messaging API dentro da janela de 24h.

**3.8 `workers/conversation-agent/src/index.ts`**: processar DM inbound subsequente na mesma thread, atualizar `conversation_state`, gerar resposta candidata via humanizer, regras hard (palavras-chave sensíveis → sempre review).

### Deliverables do Bloco 3
- 8 workers reais.
- Fluxo real fim-a-fim: lead comenta em post do concorrente → coletado → classificado → sobe prioridade → operador aprova `follow` no `/leads` → conta `actor` executa via Playwright leve → `reciprocity-detector` detecta follow_back → `retention-tracker` monitora.
- Métrica `dm_cold_attempts_blocked_total` exposta (deve ser 0 sempre).

### Definição de pronto do Bloco 3
- 100 follows executados em produção com `success_rate >= 95%` (medido em 7 dias após ligar).
- 0 `DM_COLD_BLOCKED` disparado por bug de código (só se disparar, é regressão).
- Passos 10.3.7 → 10.3.11 marcados completos.

---

## BLOCO 4 — Mining Layer (Passo 10.3.12)

Implementar 5 workers **na ordem** (cada um fica 3-7 dias em observação antes do próximo — critério de subir: nenhum aumento de `checkpoints_count` na conta `collector`, cobertura estável).

**Ordem obrigatória (do plano-mestre, Passo 10.3.12):** `search-mining` → `follower-mining` → `collab-discovery` → `audience-overlap` → `live-monitor`.

Cada worker:
- `preflight()` (role check + budget do Adaptive Crawler não estourado).
- Consome de `crawl_schedule` (fonte única do "quando rodar", Passo 8.7.4) — não cron próprio.
- Alimenta `lead_sources` (`source_kind` correspondente) + eventos.
- Métricas + heartbeat.

**Detalhes:** ver plano-mestre §4B.2 a §4B.6.

### Definição de pronto do Bloco 4
- 5 workers rodando, cada um contribuindo leads mensuráveis via `mv_lead_rankings`.
- `audience_overlap_score` populado.
- Nenhuma nova regressão de checkpoint.
- Passo 10.3.12 completo.

---

## BLOCO 5 — Confiabilidade real (Passos 10.3.15 + Fase 8.6/8.7/8.9)

### 5.1 `workers/source-roi/src/index.ts`
- Batch diário/semanal agregando `source_metrics`.
- Retroalimentação de `campaign_scoring_config` **em modo dry-run 2 semanas** (Passo 10.3.15) — só sugere, não aplica. Depois vira automático com log em `audit_log`.
- Alerta `source_regression` se top-10 cai >50% em 7d.

### 5.2 `workers/adaptive-crawler/src/index.ts`
- Batch cada 15min. Recomputa `current_interval_seconds` por fonte a partir de `source_metrics.source_score` + `leads_generated` + `consecutive_empty_runs` + custo estimado.
- Guardrails: `min_interval_seconds` rígido; budget global por conta/dia. Registra decisões em `crawl_schedule_history`.

### 5.3 Heartbeats + canários + preflight universal
- **Heartbeat helper** em `packages/shared/worker.ts` que todo `createWorker` já usa automaticamente (batendo em `worker_heartbeats` a cada 30s).
- **Dead-man switch** (Passo 8.9.2): job dentro de `workers/alerts` que verifica `worker_heartbeats.last_beat_at` e dispara `error_event` `critical` se `now - last_beat_at > 3× intervalo` OU se `backlog > 0 AND jobs_done = 0` por N janelas.
- **Canários sintéticos** (Passo 8.9.5): job diário que injeta item `synthetic=true` em cada pipeline crítico e mede latência ponta-a-ponta. `assertExternalAllowed(synthetic)` (já existe em `packages/shared`) barra saída externa.
- **Preflight universal**: todo worker chama `preflight()` antes de processar (migrations aplicadas, `EMBEDDING_DIM` bate, token válido, budget não estourado, role compatível). Falha cedo com `PREFLIGHT_FAILED` (reason code já existe).

### 5.4 `packages/notifications` + roteamento por severidade
- Consolidar em `workers/alerts` o consumo de `error_event` + aplicação de `error_triggers` + dispatch por `NotificationChannel`.
- Deduplicação por fingerprint + escalonamento + auto-resolução (Passos 8.8.4/8.8.5).
- Persistir em `notification_deliveries` para auditoria.

### Definição de pronto do Bloco 5
- Painel `/system-health` (Bloco 2.4) mostrando dados reais.
- Um "drill" de falha: derrubar manualmente um worker → dead-man switch dispara em ≤3 intervalos → chega notificação no Telegram + email → conteúdo do alerta traz `trace_id`, `metric`, `observed vs threshold`, link runbook.
- Passos 10.3.15 completo.

---

## BLOCO 6 — Fechamento (Passos 10.3.13 + 10.3.14 + 10.3.16 + 10.3.17)

### 6.1 `workers/nba-engine/src/index.ts`
- Consumir eventos `classification.done`, `reciprocity.detected`, `lead.priority.changed`, `dm_inbound`, `live_interaction`, `new_follower_detected`.
- Avaliar `nba_rules` (regras declarativas) antes de modelo — do §15 do plano.
- Gerar `nba_recommendations` com `rationale` + `confidence`.
- Se `confidence >= threshold` E `action_type` permitido em `action_policies` → auto-enfileira em `engagement_actions`. Senão → `review_inbox`.
- Respeitar Princípio 8: DM só é sugerida se `dm_inbound` já ocorreu para aquele lead.

### 6.2 Fase 4.8/4.9/4.10 (Intelligence de mercado)
- `workers/competitive-intel/src/index.ts`: caption + comentários agregados → embeddings → classificação → `topics/pain_points/questions`. Alimenta `mv_topic_trends`.
- `workers/content-opportunity/src/index.ts`: cruza tópicos × dores × perguntas × oportunidades → `content_opportunities` com thesis/angle/hook/evidence.
- `workers/community-map/src/index.ts`: batch semanal, grafo bipartido, K-Means/HDBSCAN, `communities`/`lead_community_membership`/`community_edges`, `competitor_candidates`.

### 6.3 Fase 7 — Publisher + bridge criativos completa
- `apps/web/creative-bridge/page.tsx`: implementar `postMessage` handoff bidirecional com o `apps/design-system` (rota nova no design-system que recebe payload e carrega no editor). **Nada em query string** (Princípio 6).
- `workers/publisher/src/index.ts`: consumir `scheduled_publications`, upload PNG para bucket S3 público (URL temporária), `POST /{ig-user-id}/media` + `media_publish` via `packages/meta-api`. Roda em `role='actor'`.
- `apps/web/publishing/page.tsx`: implementar calendário + Kanban (Etapa 7.3 UI/UX).

### 6.4 Fase 8.2 (Data Quality) + 8.3 (Materialized Views)
- `workers/data-quality/src/index.ts`: merge de leads duplicados, repair de órfãos, recompute de contadores, validação de IDs externos, refresh `username_current`, coerência `prospect_status ↔ engagement_actions`.
- `workers/conversion-tracking/src/index.ts`: snapshot diário do próprio perfil em `profile_snapshots`, correlaciona janelas de ações com deltas de perfil e `conversion_events`.
- Criar todas as materialized views do §32 do plano + refresh incremental via BullMQ.

### 6.5 Telas restantes (11 páginas ainda em `FeaturePage`)
Substituir por composições reais:
- `/` (Overview — DashboardGrid conforme 6.2 UI/UX).
- `/radar`, `/competitive-intel`, `/content-opportunity` (Etapa 6.6 UI/UX).
- `/community` (Etapa 6.7 UI/UX — React Flow).
- `/conversations` (Etapa 6.8 UI/UX — ThreePaneLayout de inbox).
- `/timeline` (Etapa 6.5 UI/UX).
- `/source-roi` (Etapa 8.6 UI/UX).
- `/configs` (Etapa 6.10.3 UI/UX — FormPanel2Pane).
- `/creative-bridge`, `/publishing` (Fase 7).

### 6.6 Cutover final (Passos 10.3.16 + 10.3.17)
- Habilitar Publisher em produção.
- Ativar Data Quality em cronograma.
- Rodar restore de backup em staging (validação do runbook `plataforma/docs/runbooks/restore.md`).

### Definição de pronto do Bloco 6
- 17/17 páginas do dashboard implementadas com pattern real (sem `FeaturePage` sobrando).
- Publisher publica 1 post real de teste com `attributions.action_path` populado.
- Restore de backup validado em staging.
- Passos 10.3.13 → 10.3.17 completos.

---

## Governança da execução deste prompt

### Regras que valem para todos os blocos
1. **Cada bloco fecha com o checklist do Apêndice B do plano-mestre** rodado localmente + em CI:
   - `pnpm --filter @plataforma/design-system test|test:e2e|build|lint` — todos verdes.
   - `pnpm test|typecheck|build|lint` no workspace todo — verdes.
   - `pnpm check:hashes` verde (baselines protegidos).
   - `pnpm check:runtime-deps` verde.
   - `axe-core` verde nas páginas modificadas (a partir do Bloco 2).
2. **CI nunca pode ficar vermelho por >24h.** Se um teste flakea, quarentená-lo com issue rastreada; não desligar.
3. **Cada worker novo entra atrás de feature flag** (`Config.workers.<nome>.enabled`) — kill-switch (F.6) precisa poder desligar sem redeploy.
4. **Toda decisão de desvio** (como o D2 do modelo de embedding) vai para o CHANGELOG **e** para o plano-mestre — nunca só em um dos dois.
5. **Nunca "corrigir" test:e2e desabilitando ou marcando `.skip`.** Se um teste está errado, escalar ao usuário com evidência (o que era esperado × o que aparece hoje) para decisão consciente.
6. **Aprovação humana obrigatória** para toda ação outbound até MVP validado (Princípio 6) — mesmo depois do Bloco 3.
7. **Baseline de hashes** só é atualizado com commit dedicado explicando o quê e por quê.

### Ordem de execução recomendada
- **Semana 1:** Bloco 0 (destravar CI) + Bloco 1 (Intelligence base).
- **Semana 2:** Bloco 2 (6 telas críticas) — em paralelo se houver mais de um agente.
- **Semana 3:** Bloco 3 (Action conservador — só follow) — 7 dias de observação.
- **Semana 4:** Bloco 3 continuação (private_reply, dm-copilot inbound).
- **Semana 5-6:** Bloco 4 (Mining, um worker por 3-7 dias).
- **Semana 7:** Bloco 5 (confiabilidade real).
- **Semana 8:** Bloco 6 (fechamento).

### Sinais de sucesso final
- Todo o cutover 10.3.1 → 10.3.17 marcado completo no CHANGELOG.
- `plataforma/docs/execution-report-final.md` com KPIs de negócio da Fase 10.4 (leads P0 detectados/semana, follow_back rate, DM reply rate, conversões).
- 0 alertas `critical` abertos há >1h.
- 100% dos workers batendo heartbeat consistente por 7 dias.
- CI verde em todas as PRs.
- Contas `collector` e `actor` com `health_score >= 90` por 30 dias consecutivos.

---

## Anexo — Comandos de sanity check contínuos

```bash
# no diretório plataforma/
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @plataforma/design-system test:e2e -- --forbid-only
pnpm check:hashes
pnpm check:runtime-deps
pnpm --filter @plataforma/web test
docker compose -f docker/docker-compose.yml config    # valida YAML
```

Cada agente que executar um bloco deve começar rodando este bloco de comandos e só prosseguir com verde.
