# Auditoria da Execução Multicanal + Prompt de Correção

> **Data da auditoria:** 2026-08-11
> **Escopo auditado:** implementação das Fases 11–22 de `prompt-expansao-multicanal.md`, sobre a base entregue em `execution-report-2026-08-08.md`.
> **Método:** inspeção direta do código, migrations, workers, packages, rotas e git — não apenas leitura do relatório de execução.

---

## 1. Veredito por Fase (medido no código, não no relatório)

| Fase | Escopo | Real | Evidência verificada |
|------|--------|------|----------------------|
| **11** Content Item canônico | Schema + orchestrator + Zod + UI | 🟡 **85%** | `content_items`, `content_variants`, `content_publications` ✓; `content-item-orchestrator` com preflight D14 (`frozenAt`) e `variantJobId` idempotente ✓; `ThreadsTextPayloadSchema` com `.max(500)` ✓. **UI `/content-items` ausente.** |
| **12** Reddit Intelligence | Schema + api + worker + radar | ✅ **100%** | `reddit_watches`, `reddit_evidence`, `market_signals` ✓; `packages/reddit-api` ✓; `workers/reddit-intelligence` ✓; `/market-radar` + `/api/reddit/watches` ✓ |
| **13** 7 Teses | Schema + trigger + match | 🟡 **85%** | `theses`, `content_item_theses` ✓; **trigger de 7 teses ativas implementado** ✓; `packages/shared/theses.ts` ✓. **UI `/theses` ausente.** |
| **14** Threads | api + adapter + publisher | ✅ **100%** | `packages/threads-api` ✓; `threads-adapter` + `threads-publisher` ✓; enum de eventos Threads ✓ |
| **15** Email Engine | Schema + provider + flows | ✅ **100%** | 6 tabelas (`email_subscribers`, `email_flows`, `email_flow_state`, `email_events`, `email_suppressions`, `email_confirmation_tokens`) ✓; `packages/email-provider` (5.077 B) ✓; 2 workers ✓; 5 rotas API ✓; `/email-flows` ✓ |
| **16** WhatsApp individual | Schema + cloud + workers | ✅ **100%** | `whatsapp_optins`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_templates` ✓; `packages/whatsapp-cloud` (3.505 B) ✓; inbound+outbound ✓; 3 rotas API ✓ |
| **17** WhatsApp Groups | Condicional | ✅ **correto** | Adiado conforme Passo 17.1. Script `whatsapp-groups-availability-check.mjs` ✓; `docs/compliance/whatsapp-groups-availability.md` ✓; fila `whatsapp-group-manager` reservada no enum sem worker ✓ |
| **18** Timeline + Identities | Schema + resolver + rollback | ✅ **100%** | `identities`, `identity_candidates`, `identity_merge_snapshots`, `timeline_events` ✓; `identity-resolver` ✓; rollback 30d em `/api/identities/rollback/[id]` ✓; `/identities` ✓ |
| **19** Scoring + NBC + Policy | Scores + 2 workers + router | ✅ **100%** | `contact_policies`, `contact_policy_decisions` ✓; `next-best-channel` + `contact-policy-engine` ✓; `packages/channel-router` ✓; `packages/shared/multichannel-scoring.ts` ✓; `/contact-policies` + `/api/contact-policies/evaluate` ✓ |
| **20** Humanization compartilhada | Regras por canal | ⛔ **0%** | `packages/humanizer/src/index.ts` inalterado desde a Fase 2.7. **Sem `channel` no input, sem `rules/`, sem comparação cross-channel.** |
| **21** Feedback loop | `content_performance` + EMA + UI | 🟠 **20%** | Só existe `mv_content_performance` (view antiga da Fase 8.3). **Faltam:** tabela `content_performance` por variant/canal, `mv_content_performance_by_thesis`, job EMA (21.2), UI de performance (21.3) |
| **22** Roll-out | Flags + ordem | 🟡 **60%** | Flags e docker-compose (40 workers) ✓. Deploy não executado (correto — respeitou a ordem). Ordem 22.4 **violada** por causa da Fase 20 ausente. |
| **Apêndice K** | Vocabulário de eventos | ✅ **100%** | `packages/shared/src/timeline.ts` com todos os `event_type` das 5 famílias + system + conversion ✓ |
| **Apêndice L** | Patterns UI multicanal | ⛔ **0%** | Nenhum dos 11 patterns novos criado (`ChannelBadge`, `VariantPreview`, `MarketSignalCard`, `IdentityStrip`, `FlowCanvas`, etc.) |

**Infra transversal verificada:** 94 tabelas, 5 migrations com `up`/`down`, 40 workers, 14 packages, 41 filas declaradas (todas com worker exceto a reservada de grupos), 40 workers no docker-compose, 22 rotas de página, 33 rotas de API. **Nenhum stub encontrado** — todos os workers novos têm implementação real (983–3.218 bytes de lógica densa).

**Conclusão:** a execução foi **substancialmente melhor que o relatório do Codex sugeriu** (o resumo dele omitiu Threads, content_item e teses, que estão implementados). Mas **não está 100%**: há 2 bloqueadores operacionais, 1 fase inteira ausente e 1 fase parcial.

---

## 2. Correção do relatório do Codex

O relatório afirmou "implementação multicanal está completa". **Não está.** Discrepâncias:

| Afirmação do Codex | Realidade |
|---|---|
| "Workers, endpoints, persistência e UIs de Reddit, e-mail, WhatsApp individual, identidades, NBC e Contact Policy" | Correto — **mas omitiu** que Threads, content_item e teses também foram feitos (subestimou o próprio trabalho) |
| "A implementação multicanal está completa" | **Falso.** Fase 20 (Humanização por canal) = 0%. Fase 21 (Feedback loop) = 20%. Apêndice L = 0%. |
| "CI corrigida e completa" | O workflow existe, **mas nunca executou**: `plataforma/` tem **0 arquivos versionados**. CI sem repositório é CI que não roda. |
| "Segredo Meta removido do `.env.example`" | Confirmado removido. Não chegou ao git (diretório untracked), mas **a rotação continua necessária**. |

---

## BLOCO A — Bloqueadores (fazer antes de qualquer outra coisa)

### A.1 🔴 Versionar `plataforma/` — o trabalho inteiro está fora do git

**Evidência:** `git ls-files plataforma | wc -l` → **0**. `git status` mostra `?? plataforma/` (untracked em bloco).

**Consequência:** não há histórico, rollback, code review nem CI real. Um `rm -rf` acidental ou falha de disco apaga semanas de trabalho. O `ci.yml` referencia caminhos `plataforma/**` que não existem para o runner.

**Ação:**

- **Passo A.1.1** — Decidir o repositório-alvo. O repo git atual em `C:/Users/Lenovo` é o do projeto *Gazetacon blog* — **não** misture. Criar repositório dedicado (`rota-de-ataque-plataforma`), privado.
- **Passo A.1.2** — Antes do primeiro `git add`, auditar o que entra:
  ```bash
  cd plataforma
  git init
  git add -A --dry-run | head -50
  ```
  Confirmar que `node_modules/`, `.turbo/`, `dist/`, `baseline/*.bak` e qualquer `.env` real estão ignorados. O `.gitignore` atual tem `!.env.example` (negação intencional) — garanta que o arquivo esteja com **todos os valores vazios** antes de commitar.
- **Passo A.1.3** — Varredura de segredos antes do commit inicial:
  ```bash
  git add -A
  git diff --cached -U0 | grep -inE "(secret|token|password|api[_-]?key)\s*[=:]\s*[A-Za-z0-9_\-]{12,}"
  ```
  Qualquer hit → limpar antes de commitar. **Não** confie em revisão visual.
- **Passo A.1.4** — Commit inicial + push. Configurar branch protection exigindo CI verde.
- **Passo A.1.5** — Rodar o CI pela primeira vez de verdade e corrigir o que aparecer. Só depois disso a afirmação "CI completa" passa a ser verdadeira.
- **DoD:** `plataforma/` versionada, CI executando em PR real, `git log` com ao menos 1 commit, nenhum segredo no diff.

### A.2 🔴 Rotacionar o Meta App Secret

**Evidência:** o próprio Codex reportou ter removido um segredo real do `.env.example`. O arquivo está limpo agora (`META_APP_SECRET=` vazio) e o diretório nunca foi versionado — então **não vazou para o git**. Mas o valor esteve em texto plano em disco e passou por contexto de agente.

**Ação:**

- **Passo A.2.1** — Rotacionar o App Secret no painel Meta for Developers (Configurações do App → Básico → Mostrar → Redefinir).
- **Passo A.2.2** — Atualizar o valor apenas no `.env` real do VPS (nunca no `.env.example`).
- **Passo A.2.3** — Revisar se outros segredos citados no `.env.example` já foram usados com valor real em algum momento: `WHATSAPP_APP_SECRET`, `RESEND_API_KEY`, `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `OTP_SECRET`. Na dúvida, rotacione — é barato.
- **Passo A.2.4** — Adicionar um hook `pre-commit` que bloqueia commit de linha `KEY=valor` em qualquer `.env*` versionado.
- **DoD:** App Secret novo funcionando no VPS, hook instalado, `.env.example` só com chaves vazias.

---

## BLOCO B — Fase 20: Humanization Layer por canal (crítico antes de ligar outbound)

**Por que é crítico:** o Passo 22.4 do plano determina que a Fase 20 entra **antes** de qualquer canal outbound novo. Sem ela, `threads-adapter` e `email-flow-engine` geram texto sem restrição de canal — exatamente o cenário que o usuário pediu para evitar ("Threads não deve soar como email, email não deve soar como WhatsApp"). Além disso, sem comparação cross-channel, o mesmo `content_item` vira a mesma frase em 4 lugares.

### Etapa B.1 — Estender o contrato do humanizer

- **Passo B.1.1** — Alterar a assinatura de `humanize()` em `packages/humanizer/src/index.ts` para aceitar o input completo do Passo 20.1.1:
  ```ts
  humanize({
    channel: 'instagram'|'threads'|'email'|'whatsapp_dm'|'whatsapp_group',
    purpose, basePrompt, brandVoiceVersion,
    thesisId?, contentItemId?, leadId?, stage?, objective?,
    context, recent, generate
  })
  ```
  Manter compatibilidade retroativa: `channel` opcional com default `'instagram'` para não quebrar `dm-copilot` e `private-reply` já existentes.
- **Passo B.1.2** — Injetar no prompt as diretrizes do canal (tom, comprimento, formato de CTA) antes de chamar `generate`.
- **DoD:** teste unitário mostrando que prompts diferem por canal para o mesmo `basePrompt`.

### Etapa B.2 — Regras declarativas por canal

- **Passo B.2.1** — Criar `packages/humanizer/src/rules/` com um arquivo por canal, cada regra sendo **função pura** `(text, ctx) => { ok: boolean; violations: string[] }`:
  - `threads.rules.ts` — ≤500 chars (hard); ≤2 hashtags; exige quebra de linha estratégica; proíbe CTA "clique no link".
  - `email.rules.ts` — subject ≤60 chars; preheader não repete subject; exige 1 CTA link claro.
  - `whatsapp.rules.ts` — ≤400 chars; máx 2 emojis; exatamente 1 pergunta.
  - `instagram.rules.ts` — primeira linha (hook) ≤120 chars; hashtags vão para `first_comment`, não para o corpo.
  - `whatsapp-group.rules.ts` — ≤300 chars; sem CTA de venda direta; tom de comunidade.
- **Passo B.2.2** — `humanize()` roda as regras do canal após gerar; se houver violação, regenera com instrução corretiva explícita (máx 2 tentativas); persistindo violação, retorna `{ok:false, violations}` e o worker manda para `review_inbox` em vez de publicar.
- **DoD:** 5 arquivos de regras com testes unitários; teste que comprova regeneração ao violar limite de 500 chars.

### Etapa B.3 — Comparação cross-channel

- **Passo B.3.1** — Estender a checagem de similaridade: além de comparar contra `generated_texts` do **mesmo** canal (regra atual, threshold 0.92), comparar contra as demais variants do **mesmo `content_item_id`** em canais diferentes com threshold **0.85**. Acima disso, regenera pedindo formulação estruturalmente distinta.
- **Passo B.3.2** — `ALTER TABLE generated_texts ADD COLUMN channel text, ADD COLUMN content_item_id uuid REFERENCES content_items, ADD COLUMN variant_id uuid REFERENCES content_variants;` + índice `(content_item_id, channel)`. Migration `0006`.
- **Passo B.3.3** — `repetition_alerts` passa a registrar `channel_a`/`channel_b` quando a repetição for cross-channel.
- **DoD:** teste que reprova uma variant Threads com cosine 0.90 contra a variant Email do mesmo content_item.

### Etapa B.4 — Integrar nos workers que já geram texto

- **Passo B.4.1** — `threads-adapter` passa `channel:'threads'`.
- **Passo B.4.2** — `email-flow-engine` passa `channel:'email'` nos steps `send`.
- **Passo B.4.3** — `whatsapp-outbound` passa `channel:'whatsapp_dm'`.
- **Passo B.4.4** — `dm-copilot` e `private-reply` (Instagram) passam `channel:'instagram'`.
- **DoD:** teste de integração: 1 `content_item` → 4 variants, nenhuma com cosine ≥0.85 entre si.

---

## BLOCO C — Fase 21: Feedback loop multicanal

### Etapa C.1 — Schema

- **Passo C.1.1** — Migration `0006` (junto com B.3.2), criar a tabela do Passo 21.1.1:
  ```sql
  CREATE TABLE content_performance (
    variant_id uuid PRIMARY KEY REFERENCES content_variants ON DELETE CASCADE,
    channel text NOT NULL,
    impressions int DEFAULT 0, reach int DEFAULT 0, engagements int DEFAULT 0,
    clicks int DEFAULT 0, replies int DEFAULT 0, saves int DEFAULT 0, shares int DEFAULT 0,
    conversions int DEFAULT 0, revenue numeric DEFAULT 0,
    window_days int NOT NULL DEFAULT 30,
    computed_at timestamptz DEFAULT now()
  );
  CREATE INDEX ON content_performance (channel, computed_at DESC);
  ```
- **Passo C.1.2** — `CREATE MATERIALIZED VIEW mv_content_performance_by_thesis` agregando `content_performance` × `content_items.thesis_id` × canal.
- **Passo C.1.3** — Estender `source_metrics.source_type` com `'content_variant'` e `'email_flow'`.
- **DoD:** migration com `down` testado; contract test da FK e do índice.

### Etapa C.2 — Coleta de métricas por canal

- **Passo C.2.1** — `threads-publisher` já agenda insights D+1/D+7 — gravar o resultado em `content_performance` (hoje vai só para `content_publications.metrics`).
- **Passo C.2.2** — `worker-meta-sync` grava métricas de `own_media` vinculadas via `content_publications` → `content_performance` (canal `instagram`).
- **Passo C.2.3** — `email-events-consumer` agrega `email_events` por `variant_id` → `content_performance` (canal `email`): sent/delivered → impressions, opened → engagements, clicked → clicks, replied → replies.
- **Passo C.2.4** — `whatsapp-outbound` agrega status delivered/read → `content_performance` (canal `whatsapp_dm`).
- **DoD:** um `content_item` publicado em 2 canais produz 2 linhas em `content_performance` com métricas reais.

### Etapa C.3 — Retroalimentação com EMA (dry-run obrigatório)

- **Passo C.3.1** — Job semanal em `workers/source-roi` calcula conversão por `thesis_id` × canal e propõe ajuste de pesos em `campaign_scoring_config` via EMA (α=0.1).
- **Passo C.3.2** — **Modo dry-run por 14 dias** (Passo 21.2.2): grava a proposta em `events` com `level='config_change_proposed'` e **não aplica**. UI mostra o diff proposto.
- **Passo C.3.3** — Após validação humana, flag `SOURCE_ROI_AUTOAPPLY=true` habilita aplicação automática, sempre com `audit_log`.
- **Passo C.3.4** — `topic_affinity` do lead se ajusta por clicks/replies em variants por tópico.
- **DoD:** teste com 10 semanas de dados mock → pesos convergem para o tópico vencedor; nada é aplicado em dry-run.

---

## BLOCO D — UI especializada (Apêndice I + L)

**Situação atual:** 20 das 22 páginas renderizam o mesmo componente genérico `OperationalDashboard` (fetch em `/api/dashboard/[view]` → `DataTable` ou `ThreePaneLayout`). Funciona como andaime e prova que os dados chegam, mas **não entrega os layouts especificados**. Só `/leads` (com `LeadsClient`) e `/review-inbox` têm composição própria.

**Patterns do `ui-bridge` nunca usados:** `AsyncBanner`, `ConfidencePill`, `ConfirmDestructiveDialog`, `PageHeader`, `RoleBadge`, `RowActionsMenu`, `RunbookLink`, `SuggestedActionCard`.

### Etapa D.1 — Patterns novos do Apêndice L

- **Passo D.1.1** — Criar em `packages/ui-bridge/src/patterns/`: `ChannelBadge`, `ContentItemCard`, `VariantPreview`, `MarketSignalCard`, `IdentityStrip`, `ChannelTimeline`, `NbaWithChannel`, `ContactPolicyIndicator`, `OptinEvidenceCard`, `FlowCanvas`, `GroupPolicyForm`.
- **Passo D.1.2** — Cada pattern com Storybook cobrindo default/loading/empty/error/dense e teste `axe-core`.
- **DoD:** 11 patterns exportados, Storybook verde, a11y sem violação.

### Etapa D.2 — Rotas faltantes

- **Passo D.2.1** — `/content-items` + `/content-items/[id]` (Passo 11.4): lista com `SavedViewTabs` por status; detalhe em 3 pane (form canônico | preview por canal com `VariantPreview` | timeline de publicações). Botão "Aprovar" com as 4 pré-condições do Passo 11.4.3; "Fork" com `ConfirmDestructiveDialog` explicando D14.
- **Passo D.2.2** — `/theses` (Passo 13.4): grid 2×4 com os 7 cards + slot vazio; editor com preview de impacto ("N opportunities passariam a matchear").
- **Passo D.2.3** — `/communities` (Passo 17.5): criar como **placeholder explícito** com `EmptyState` "WhatsApp Groups aguardando liberação da conta Meta — ver `docs/compliance/whatsapp-groups-availability.md`". Não deixar rota 404.
- **DoD:** 3 rotas navegáveis, no menu lateral, com dados reais (ou empty state honesto).

### Etapa D.3 — Especializar as telas de maior valor

Ordem por impacto operacional — **não** refazer todas de uma vez:

- **Passo D.3.1** — `/engagement-queue` → `KanbanBoard` real por status, com `RoleBadge` distinguindo collector/actor, `QuotaMeter` no painel direito e kill-switch com confirmação de 3s (Etapa 6.9 do plano-mestre).
- **Passo D.3.2** — `/market-radar` → grid de `MarketSignalCard` ordenado por `velocity_7d`, com drawer de evidências linkando permalinks do Reddit (Etapa 12.6).
- **Passo D.3.3** — `/email-flows` → `FlowCanvas` (React Flow, já instalado) com nós arrastáveis `Entry/Send/Wait/Branch/Exit` (Passo 15.7.2).
- **Passo D.3.4** — `/identities` → `IdentityStrip` no topo + fila de `identity_candidates` com evidência lado a lado e ação de aprovar/rejeitar (Passo 18.4).
- **Passo D.3.5** — `/publishing` → calendário mensal + toggle Kanban, com filtro por canal Instagram|Threads (Passos 7.3 e 14.5).
- **Passo D.3.6** — `/system-health` → semáforo + heartbeats + grid de `QuotaMeter` + canários (Passo 8.9.10).
- **DoD por passo:** tela usa os patterns nomeados, tem os 4 estados (loading/empty/error/partial), passa `axe-core`, e tem Storybook.

### Etapa D.4 — Manter o genérico onde faz sentido

`OperationalDashboard` continua válido para telas de baixa interação (`/radar`, `/competitive-intel`, `/source-roi`, `/timeline`, `/conversations` até ter volume). **Não** refatorar por refatorar — especializar só quando a tela tiver uso real.

---

## BLOCO E — Ativação e cutover multicanal

Só após Blocos A e B verdes.

- **Passo E.1** — Preencher credenciais reais no `.env` do VPS: Reddit (client id/secret/refresh), Threads (access token pós-App-Review), WhatsApp Cloud (phone number id, WABA id, token, verify token, app secret), Resend/SES.
- **Passo E.2** — Rodar o deploy (ainda não executado). Validar `/api/health` e os 5 serviços.
- **Passo E.3** — Ativar na ordem do Passo 22, respeitando 7 dias entre cada:
  1. Fase 12 Reddit (passivo, risco zero) — validar que `market_signals` populam e **nenhum lead** é criado a partir do Reddit.
  2. Fase 13 Teses — preencher as 7 teses reais pela UI antes de qualquer `content_opportunity` novo.
  3. Fase 11 Content items — criar 1 item ponta a ponta.
  4. **Fase 20 Humanização** (Bloco B) — obrigatória antes do próximo passo.
  5. Fase 19 NBC + Contact Policy — validar que bloqueio de 24h funciona com lead de teste.
  6. Fase 15 Email — 14 dias só double-opt-in, sem bulk.
  7. Fase 14 Threads — 30 dias com aprovação humana obrigatória.
  8. Fase 16 WhatsApp — 30 dias só resposta a inbound.
  9. Fase 21 Feedback loop — após 30 dias de dados.
- **Passo E.4** — Fase 17 (Groups) só se `whatsapp-groups-availability-check.mjs` retornar disponível para a conta.
- **DoD:** cada canal ativado com evidência de funcionamento real e nenhum alerta crítico aberto por 7 dias.

---

## 3. Ordem recomendada

| Prioridade | Bloco | Por quê |
|---|---|---|
| **1** | A.1 versionar git | Todo o trabalho está sem rede de segurança |
| **2** | A.2 rotacionar segredo | Janela de exposição aberta |
| **3** | B (Fase 20) | Bloqueia ativação de qualquer outbound novo (Passo 22.4) |
| **4** | E.1–E.3 (1 a 5) | Ativa o que já está pronto e validado |
| **5** | D.2 rotas faltantes | Fecha buracos de navegação |
| **6** | C (Fase 21) | Precisa de dados acumulados antes de valer a pena |
| **7** | D.1 + D.3 | Melhoria incremental de UX, sem bloquear operação |

---

## 4. Comandos de verificação

```bash
cd plataforma
git ls-files | wc -l                                   # A.1: deve ser > 0
grep -c "channel" packages/humanizer/src/index.ts      # B.1: deve ser > 0
ls packages/humanizer/src/rules/                       # B.2: 5 arquivos
grep -rn "content_performance" packages/db/migrations/0006*.up.sql   # C.1
ls apps/web/src/app/content-items apps/web/src/app/theses            # D.2
pnpm typecheck && pnpm test && pnpm check:hashes
```

---

## 5. Nota de método

O relatório do Codex **subestimou** o que entregou (não citou Threads, content_item, teses — todos implementados) e ao mesmo tempo **superestimou** a completude ("implementação completa"). Recomendação para as próximas execuções: exigir que o relatório final liste, por Fase do prompt de origem, o percentual entregue e o que ficou de fora — em vez de um resumo narrativo. Um relatório que não consegue apontar o que falta é um relatório que não foi verificado.
