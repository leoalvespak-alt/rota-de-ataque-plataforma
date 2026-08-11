# Prompt de Expansão Multicanal — Plataforma Rota de Ataque

> **Documento de expansão do plano-mestre.** Depende de `../../PROMPT_EXPANSAO_PROSPECTOR_E_GESTAO_REDES.md` (Fases 0–10) e do estado atual descrito em `execution-report-2026-08-08.md` + roteiro `finalizacao-completa-prompt.md`.
>
> **O que este documento adiciona:** transforma a plataforma de "prospector Instagram + gestão de redes" em **plataforma única de aquisição, relacionamento e conteúdo** onde Reddit é sensor de mercado, um `content_item` canônico origina versões por canal, Threads/Email/WhatsApp (individual e grupos) recebem produção adaptada, e uma **Universal Timeline + Next Best Channel + Contact Policy Engine** decidem quando, onde e com que texto falar com cada lead.
>
> **Numeração:** este documento começa em **FASE 11** para não colidir com o plano-mestre. Etapas e Passos seguem a mesma convenção (`Passo X.Y.Z`), com DoD, idempotência, feature flag e observabilidade em cada um.
>
> **Regra dura de compatibilidade:** nada aqui pode quebrar as decisões travadas D1–D8 do plano-mestre (pnpm+turbo, embedding local 384, BullMQ, hnsw, sem DM fria, sem liker mining, concorrentes flexíveis, duas contas Instagram com roles fixas). Novas decisões travadas ficam em D9–D15 (§0.5 abaixo).

---

## 0. Contexto (leia antes de tudo)

### 0.1 Fluxo macro-alvo

```
REDDIT (coleta passiva)
  → market_signals + pain_points + questions + topic_trends
    → Content Intelligence
      → cruzamento com as 7 Teses
        → Content Opportunity Engine
          → Design System
            → content_item CANÔNICO
              ├── instagram_variant  (carrossel + copy)
              ├── threads_variant    (texto ≤500 chars)
              ├── email_variant      (ângulo + segmento)
              └── whatsapp_variant   (individual e grupo)
                → Universal Timeline (evento por interação)
                  → intent + relationship + affinity + freshness + email_engagement + whatsapp_engagement
                    → Next Best Action (o quê)
                      → Next Best Channel (por onde)
                        → Contact Policy Engine (pode agora?)
                          → execução no canal escolhido
                            → conversão / resposta / silêncio
                              → attribution + source_roi + content_performance
                                → retroalimenta scoring + inteligência
                                  → novos content_items
```

### 0.2 Princípios adicionais (soma aos 9 do plano-mestre)

- **P10 — Um conteúdo, muitas encarnações.** O `content_item` é canônico. Legenda de Instagram, texto de Threads, ângulo de email e mensagem de grupo WhatsApp são *variants* do mesmo item, ligadas por `content_item_id`. Nunca duplicar tese, argumentos ou evidências entre canais.
- **P11 — Reddit é passivo, não prospecção.** Reddit produz **sinais de mercado**, não leads. Nenhum outbound é feito contra usuários do Reddit. Se um usuário do Reddit também aparecer em Instagram/email/WhatsApp por evidência independente, o merge de identidades é feito por D10 (§0.5); caso contrário, evidência do Reddit vive em `market_signals` sem `lead_id`.
- **P12 — Consentimento explícito por canal.** Nenhum canal outbound é acionado sem opt-in registrado como *entidade* (não flag booleana): `email` exige double opt-in ou origem rastreável a formulário; `whatsapp` exige opt-in explícito por template ou entrada autorizada; `threads` é publicação pública (sem opt-in), mas respostas privadas só se lead iniciar. Ver Apêndice J.
- **P13 — Um lead, muitas identidades.** `identities` é entidade separada: `(lead_id, channel, external_id, verified_at, evidence_source)`. Merge só com evidência confiável (D10). Coincidência de username **nunca** funde identidades.
- **P14 — Next Best Channel antes de Next Best Action.** Escolher o canal é decisão anterior à mensagem. Um lead ativo no WhatsApp hoje **não recebe email comercial amanhã** — decidido pelo Contact Policy Engine.
- **P15 — Feedback é obrigatório.** Todo canal outbound emite evento de resultado (`sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`, `unsubscribed`) que alimenta `content_performance` + `source_roi` + peso do scoring por afinidade.

### 0.3 Decisões travadas — D9 a D15 (novas)

| # | Decisão | Escolha travada | Onde vive |
|---|---------|-----------------|-----------|
| **D9** | Provedor de email para volume | **Resend** para transacional (já instalado — Apêndice §8.8) + **Amazon SES via SDK** para nutrição em massa. Retirar necessidade de ESP externo (Mailchimp/RD). Backup provider explícito em `.env`. | Fase 15 |
| **D10** | Merge de identidades (identity resolution) | **Só com evidência confiável**: (a) cadastro do próprio usuário informando dois canais; (b) clique identificado (email link → landing → login → cria vínculo com identidade IG/WhatsApp existente); (c) OAuth/OTP no site validando o vínculo. **Username idêntico entre canais NÃO funde.** Coincidência sugere `identity_candidates` que exige aprovação humana. | Fase 18 |
| **D11** | Provider Threads | **Threads Graph API oficial** (mesma família Meta Graph). Reusa `packages/meta-api` estendido, mesma conta `role='actor'` do Instagram (§7 do plano-mestre) usa a mesma conta vinculada ao IG. Limite: 500 chars/post, 250 API calls/24h no MVP. | Fase 14 |
| **D12** | Provider WhatsApp | **WhatsApp Cloud API oficial** (Meta) com Official Business Account. Nunca WhatsApp Web scraping. Opt-in é obrigatório antes de qualquer template. **Groups API** só se a conta atender aos requisitos oficiais no momento da vinculação — Passo 17.1.1 valida disponibilidade real antes de criar tabelas de grupo. | Fases 16 e 17 |
| **D13** | Reddit — política de scraping vs API | **API oficial do Reddit** (OAuth com script app, rate limit 100 req/min/OAuth), **nunca** scraping. Se um endpoint exigir Reddit Premium para volume, pausar até decisão explícita do usuário. User-Agent identificado. | Fase 12 |
| **D14** | Conteúdo canônico é imutável após publicação | Uma vez que qualquer *variant* do `content_item` for publicada num canal, o `content_item.frozen_at` é preenchido e futuras edições exigem *fork* (`content_item.parent_id`). Preserva auditoria e attribution. | Fase 11 |
| **D15** | Contact Policy Engine global — regra padrão | **1 contato por lead a cada 24h em canais outbound**, exceto: (a) resposta a inbound do lead (janela reset); (b) sequência de nutrição de email opt-in respeitando `email_flows.cadence_seconds`; (c) mensagem em grupo WhatsApp não conta como contato individual. Regras editáveis pela admin. | Fase 19 |

### 0.4 O que **NÃO** entra neste documento

- Redesenho do Design System (segue o Apêndice B do plano-mestre — proteção byte-a-byte).
- Novas plataformas fora das 5 canônicas (Reddit, Instagram, Threads, Email, WhatsApp). LinkedIn, TikTok, X etc. ficam para expansão futura.
- Substituição do Provedor de LLM/embedding (D2 do plano-mestre — bge/paraphrase-multilingual local, 384 dims).

---

## 1. Arquitetura macro atualizada

Amplia a árvore de `plataforma/` (§1 do plano-mestre). **Novos** diretórios em negrito.

```
plataforma/
├── apps/
│   ├── design-system/                     # inalterado
│   └── web/                               # amplia com telas multi-canal
├── workers/                               # +12 novos workers
│   ├── ... (29 existentes) ...
│   ├── reddit-intelligence/               # NOVO — Fase 12
│   ├── content-item-orchestrator/         # NOVO — Fase 11
│   ├── threads-adapter/                   # NOVO — Fase 14
│   ├── threads-publisher/                 # NOVO — Fase 14
│   ├── email-flow-engine/                 # NOVO — Fase 15
│   ├── email-events-consumer/             # NOVO — Fase 15
│   ├── whatsapp-inbound/                  # NOVO — Fase 16
│   ├── whatsapp-outbound/                 # NOVO — Fase 16
│   ├── whatsapp-group-manager/            # NOVO — Fase 17
│   ├── identity-resolver/                 # NOVO — Fase 18
│   ├── next-best-channel/                 # NOVO — Fase 19
│   └── contact-policy-engine/             # NOVO — Fase 19
├── packages/                              # +5 novos pacotes
│   ├── ... (9 existentes) ...
│   ├── reddit-api/                        # NOVO — Fase 12
│   ├── threads-api/                       # NOVO — Fase 14 (extensão fina de meta-api)
│   ├── whatsapp-cloud/                    # NOVO — Fase 16
│   ├── email-provider/                    # NOVO — Fase 15 (Resend + SES)
│   └── channel-router/                    # NOVO — Fase 19 (NBC + Policy)
└── docs/
    ├── ... (existentes) ...
    ├── runbooks/
    │   ├── reddit-api-outage.md          # NOVO
    │   ├── whatsapp-checkpoint.md        # NOVO
    │   ├── threads-rate-limit.md         # NOVO
    │   └── email-bounce-storm.md         # NOVO
    └── compliance/
        ├── whatsapp-optin-flow.md        # NOVO
        ├── email-lgpd.md                  # NOVO
        └── reddit-tos-notes.md            # NOVO
```

**Regra de importação (soma à do §1 do plano-mestre):** cada `packages/*-api` é fino e depende de `packages/shared`. `channel-router` depende de `packages/db + shared + queue`, **nunca** dos packages de canal (evita ciclo). Workers de canal (`whatsapp-outbound`, `threads-publisher`, `email-flow-engine`) importam do próprio `packages/*-api` + `channel-router`.

**Fila BullMQ:** +12 filas novas (uma por worker), com jobIds determinísticos definidos por Fase.

---

## FASE 11 — Modelagem canônica: `content_item` e `content_variants`

### Objetivo
Antes de existir "post de Instagram" ou "post de Threads", existe um **conteúdo canônico**. Todas as tabelas/rotinas de conteúdo passam a operar sobre este modelo. O `apps/design-system` continua sendo o gerador visual, mas passa a receber briefings do `content_item` em vez de dados soltos.

### Etapa 11.1 — Schema canônico

- **Passo 11.1.1** — Nova migração em `packages/db` (numeração seguindo a existente, ex.: `0002_content_canonical.up.sql`), transacional com `down`:
  ```
  content_items (
    id uuid PK,
    campaign_id uuid REFERENCES campaigns,
    thesis_id uuid REFERENCES theses,            -- 7 Teses; ver Fase 13
    audience_segment text,                       -- ex.: 'PPCE', 'Área Fiscal'
    funnel_stage text CHECK (funnel_stage IN ('awareness','consideration','decision','retention')),
    objective text,                              -- 'traffic','engagement','lead','conversion','retention'
    angle text,
    hook text,
    arguments jsonb,                             -- ordem lógica dos argumentos
    cta jsonb,                                   -- {label, kind, target}
    intelligence_sources jsonb,                  -- refs a market_signals, topics, pain_points, questions
    brand_voice_version text NOT NULL,
    status text CHECK (status IN ('draft','approved','producing','published','archived','forked')) DEFAULT 'draft',
    created_by uuid, approved_by uuid,
    created_at timestamptz DEFAULT now(),
    approved_at timestamptz,
    frozen_at timestamptz,                       -- D14: preenche na 1ª publicação
    parent_id uuid REFERENCES content_items,     -- D14: fork mantém linhagem
    UNIQUE (campaign_id, thesis_id, hook, funnel_stage)
  )

  content_variants (
    id uuid PK,
    content_item_id uuid NOT NULL REFERENCES content_items ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('instagram','threads','email','whatsapp_dm','whatsapp_group')),
    format text NOT NULL,                        -- 'carousel','reel','feed','text','html','template'
    payload jsonb NOT NULL,                      -- estrutura por channel/format (ver 11.2.2)
    humanization_signature text,                 -- hash embedding do texto final
    similarity_score numeric,                    -- vs recentes do mesmo canal/purpose
    generated_by text,                           -- 'llm','human','copilot'
    status text CHECK (status IN ('draft','ready','approved','published','rejected','expired')) DEFAULT 'draft',
    approved_by uuid,
    published_at timestamptz,
    external_ref jsonb,                          -- IG media id, Threads post id, email message id, WA msg id
    UNIQUE (content_item_id, channel, format)
  )

  content_publications (
    id uuid PK,
    variant_id uuid NOT NULL REFERENCES content_variants,
    channel text, external_id text,
    published_at timestamptz DEFAULT now(),
    metrics jsonb                                -- métricas atualizadas pelo worker do canal
  )
  ```
- **Passo 11.1.2** — Índices essenciais: `INDEX content_items (campaign_id, status, funnel_stage)`, `INDEX content_variants (content_item_id, channel)`, `INDEX content_publications (variant_id, published_at DESC)`.
- **Passo 11.1.3** — Migração de dados existentes: converter linhas de `content_opportunities` que já viraram criativos do design-system em `content_items` + `content_variants (channel='instagram')`. Idempotente, backfill em transação.
- **Passo 11.1.4** — Contract tests em `packages/db/src/*.test.ts`: `UNIQUE`, `CHECK`, `FOREIGN KEY`, `frozen_at` só pode ser preenchido uma vez, fork exige `parent_id`.
- **DoD:** migração aplicada em dev + staging + produção sem erro; teste em CI cobrindo os 4 constraints; backfill sem perda de dados existentes.

### Etapa 11.2 — Payload por canal (contratos Zod)

- **Passo 11.2.1** — Em `packages/shared/src/content.ts` (novo), definir Zod schemas por `(channel, format)`:
  - `InstagramCarouselPayload`: `{ slides: Array<{templateId, tokens}>, caption, hashtags[], first_comment? }`.
  - `InstagramReelPayload`: `{ script, caption, hashtags[], cover_image_ref }`.
  - `ThreadsTextPayload`: `{ text: string /* ≤500 */, media_refs?: string[], reply_to?: string }` — validação de tamanho `.max(500)`.
  - `EmailPayload`: `{ subject, preheader, html, plain, list_id, segment_query, from_name, from_email }`.
  - `WhatsAppDmPayload`: `{ text | template_ref, media_refs?[] }`.
  - `WhatsAppGroupPayload`: `{ text, media_refs?[], group_id, mentions?[] }`.
- **Passo 11.2.2** — `content_variants.payload` valida via Zod na escrita (trigger no worker que grava; **não** no banco) — falha loud com `PREFLIGHT_FAILED` se schema quebrar.
- **Passo 11.2.3** — Registrar `content_variant.payload_version` em `content_items.brand_voice_version` para futura migração de payload sem quebrar variants antigos.
- **DoD:** teste unitário do Zod por canal + teste de rejeição (>500 chars em Threads deve falhar).

### Etapa 11.3 — `workers/content-item-orchestrator/`

- **Passo 11.3.1** — Novo worker que consome fila `content-item-orchestrator` acionada quando um `content_item` sobe para `status='approved'`. Ele:
  1. Lê `content_item` completo + intelligence_sources.
  2. Enfileira 1 job por `content_variant` prevista para aquele item (por default: instagram + threads; email/whatsapp opcionais por campanha).
  3. Cada job vai para o worker adequado (Fase 14/15/16/17) com o payload canônico.
- **Passo 11.3.2** — Idempotência: `enqueueOnce('threads-adapter', 'content:{content_item_id}:variant:threads', ...)` etc. jobIds em `packages/queue/src/jobIds.ts` novo (`variantJobId(contentItemId, channel)`).
- **Passo 11.3.3** — `preflight()` verifica: `frozen_at` ausente OU fork válido; brand_voice_version presente; campanha ativa; conta actor não em CHECKPOINT.
- **Passo 11.3.4** — Heartbeat + métricas Prometheus (`content_item_orchestrated_total{channel}`).
- **DoD:** dado um `content_item` com 4 canais habilitados, cria 4 jobs (um por canal); cada job idempotente sob retry.

### Etapa 11.4 — UI: editor de `content_item`

- **Passo 11.4.1** — Nova rota `apps/web/content-items/page.tsx` — lista com `SavedViewTabs` (Draft / Approved / Published / Archived / Forked). `DataTable` com colunas `[thesis, angle, funnel_stage, canais habilitados, status, ⋯]`.
- **Passo 11.4.2** — `/content-items/[id]/page.tsx` — 3 pane: form canônico à esquerda, preview de cada variant por canal ao centro (usando os patterns do `ui-bridge`), `TimelineFeed` de publicações à direita.
- **Passo 11.4.3** — Botão "Aprovar" só habilita se: pelo menos 1 variant `ready`, brand_voice_version válida, hook não vazio, thesis atribuída. `ConfirmDestructiveDialog` para "Fork" (D14 explica implicações).
- **Passo 11.4.4** — Handoff para o design-system (variant Instagram): rota já existe (`/creative-bridge`) — passar `content_item_id` via `postMessage`, nunca query string.
- **DoD:** operador consegue criar um `content_item` do zero, ver 4 variants geradas por workers de canal, aprovar e publicar. `audit_log` grava cada transição.

---

## FASE 12 — Reddit Intelligence (sensor de mercado, não prospecção)

### Objetivo
Um `reddit-intelligence-worker` que vira **sensor passivo do mercado**: descobre dores, dúvidas, tendências e tem essas evidências alimentando o Content Opportunity Engine. **Nenhum outbound é feito contra usuários do Reddit.**

### Etapa 12.1 — Schema

- **Passo 12.1.1** — Migração `0003_reddit_intelligence`:
  ```
  reddit_watches (
    id uuid PK, campaign_id uuid REFERENCES campaigns,
    kind text CHECK (kind IN ('subreddit','search_query','user','keyword_across')),
    value text NOT NULL,
    active boolean DEFAULT true,
    min_interval_seconds int DEFAULT 900,
    max_interval_seconds int DEFAULT 21600,
    last_run_at timestamptz, next_run_at timestamptz,
    UNIQUE (kind, value)
  )

  reddit_evidence (
    id uuid PK,
    watch_id uuid REFERENCES reddit_watches,
    external_kind text CHECK (external_kind IN ('post','comment')),
    external_id text NOT NULL,
    author_hash text,                             -- hash do autor (não PII)
    subreddit text, permalink text,
    text text, score int, num_comments int,
    posted_at timestamptz, collected_at timestamptz DEFAULT now(),
    embedding vector(384),
    UNIQUE (external_kind, external_id)
  )

  market_signals (
    id uuid PK,
    campaign_id uuid REFERENCES campaigns,
    kind text CHECK (kind IN ('pain_point','question','trend','comparison','commercial_intent','sentiment_shift')),
    label text NOT NULL,
    evidence_refs jsonb,                          -- lista de reddit_evidence.id + fontes
    embedding vector(384),
    velocity_7d numeric,                          -- % change em 7d
    velocity_30d numeric,
    volume_current int,
    first_seen_at timestamptz, last_seen_at timestamptz,
    status text CHECK (status IN ('new','rising','stable','saturated','decaying')) DEFAULT 'new',
    linked_content_opportunity_id uuid REFERENCES content_opportunities
  )
  ```
- **Passo 12.1.2** — Índices: `INDEX reddit_evidence (subreddit, posted_at DESC)`, `INDEX reddit_evidence USING hnsw (embedding vector_cosine_ops)`, `INDEX market_signals (campaign_id, status, velocity_7d DESC)`.
- **Passo 12.1.3** — Migration não modifica tabelas existentes. `reddit_evidence` **não** cria linhas em `leads` (P11 do prompt).
- **DoD:** contract test que garante `reddit_evidence` não gera FK para `leads`.

### Etapa 12.2 — `packages/reddit-api`

- **Passo 12.2.1** — Cliente OAuth 2 do Reddit (script app + user OAuth). Reusa padrão de `packages/meta-api`: `RedditClient` com métodos `.subreddit(name).new()`, `.search(query)`, `.user(name).comments()`, `.comment(id).children()`.
- **Passo 12.2.2** — Rate limit rígido: **60 req/min sustentado** (menor que o teto oficial de 100 para margem). User-Agent identificado por convenção Reddit: `<platform>:<app-id>:<version> (by /u/<username>)`.
- **Passo 12.2.3** — Env vars adicionais em `.env.example`: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, `REDDIT_REFRESH_TOKEN`.
- **Passo 12.2.4** — Cache Redis de 5min por endpoint (`SETEX`) — reduz churn.
- **DoD:** teste com fixtures HTTP (nock/msw) cobrindo listing, search, tree de comentários, rate-limit response (429).

### Etapa 12.3 — `workers/reddit-intelligence/`

- **Passo 12.3.1** — Consome fila `reddit-intelligence` (jobIds `reddit:{watch_id}:{cursor}`).
- **Passo 12.3.2** — Para cada `reddit_watch` ativo: coleta itens novos (`external_id` unique), gera embedding (via `packages/nlp` — 384 dims), grava `reddit_evidence`.
- **Passo 12.3.3** — Roda a cada intervalo definido em `reddit_watches` (integrado ao `adaptive-crawler` — Passo 8.7 do plano-mestre): fontes que produzem sinal têm intervalo reduzido, fontes vazias têm intervalo dobrado.
- **Passo 12.3.4** — `preflight()`: token válido, budget de req/dia não estourado, embeddings healthy.
- **Passo 12.3.5** — Emite `enqueueOnce('classification', ...)` para cada evidência nova (a Fase 4.4 do plano-mestre já classifica; estender `comment_classification.scope` para aceitar `reddit`).
- **Passo 12.3.6** — Heartbeat + métricas: `reddit_evidence_new_total{subreddit}`, `reddit_api_errors_total`, `reddit_rate_limit_hits_total`.
- **DoD:** dado 3 subreddits monitorados, coleta ≥1 evidência de cada em 15min de execução; nenhum lead é criado (invariante checado no teste).

### Etapa 12.4 — Signal Aggregator (velocidade e clustering)

- **Passo 12.4.1** — Novo job dentro do worker (ou worker separado `signal-aggregator` — decidir por volume): a cada 30min, roda K-Means/HDBSCAN sobre `reddit_evidence.embedding` das últimas 30d por campanha; clusters viram `market_signals` (`kind` inferido por LLM sobre o texto centroide).
- **Passo 12.4.2** — Calcula `velocity_7d` como `(count_last_7d - count_previous_7d) / count_previous_7d`. `velocity_30d` idem. `status` derivado: `new` (velocity > 200%), `rising` (velocity > 30%), `stable` (|velocity| ≤ 30%), `saturated` (velocity_7d > 0 mas volume plateau), `decaying` (velocity < -30%).
- **Passo 12.4.3** — Labels legíveis via LLM sobre o cluster (ex.: "Dificuldade em memorizar legislação PPCE").
- **Passo 12.4.4** — Deduplicação semântica: se um novo cluster tem cosine similarity > 0.85 com um `market_signal` existente, mescla (`UPDATE ... SET evidence_refs = evidence_refs || new_refs`).
- **DoD:** dado seed de 500 evidências (fixture), gera ≤50 `market_signals` sem duplicatas e com `velocity_7d` calculado corretamente (teste de snapshot numérico).

### Etapa 12.5 — Integração com Content Opportunity Engine

- **Passo 12.5.1** — Estender `worker-content-opportunity` (existente — Fase 4.9 do plano-mestre) para consumir também `market_signals WHERE status IN ('new','rising')`.
- **Passo 12.5.2** — Regra de cruzamento com as 7 Teses (Fase 13): cada `market_signal` só vira `content_opportunity` se houver *tese-match* (via embedding cosine ≥ 0.70 contra `theses.centroid_embedding`). Se não houver match, marca `market_signals.status='new'` mas não gera opportunity — vai para revisão editorial.
- **Passo 12.5.3** — `content_opportunity` gerada carrega `intelligence_sources` populada com referências ao `market_signal` original.
- **DoD:** teste ponta-a-ponta: injeta 3 sinais fictícios, gera 3 opportunities (todas com tese-match), 0 opportunity sem tese.

### Etapa 12.6 — UI: Radar de mercado

- **Passo 12.6.1** — Nova rota `apps/web/market-radar/page.tsx`:
  - `KpiRow`: sinais rising / total ativo / velocidade média / próxima leva
  - Grid principal: cards de `market_signals` ordenados por `velocity_7d DESC` — cada card mostra label, velocity com seta ↑/↓, mini-sparkline 30d, `status` chip, botão "Ver evidências".
  - Filtros: campanha, status, kind, subreddit origem.
- **Passo 12.6.2** — Drawer com evidências: lista de posts/comentários (permalink no Reddit), contagem, gráfico de volume por dia.
- **Passo 12.6.3** — Botão "Gerar Content Opportunity" só habilita se `tese-match` existe (mostra qual tese).
- **DoD:** operador vê radar em produção com sinais reais coletados; abrir sinal mostra ≥3 evidências reais; gerar opportunity cria linha em `content_opportunities` com `intelligence_sources` populada.

### Etapa 12.7 — Compliance Reddit

- **Passo 12.7.1** — Runbook `docs/compliance/reddit-tos-notes.md`: rate limits oficiais, política de coleta pública, obrigação de User-Agent, não republicar textos integrais sem crédito, não usar para spam/harassment.
- **Passo 12.7.2** — Kill-switch dedicado: `POST /api/kill-switch { channel: 'reddit' }` pausa `reddit-intelligence-worker` globalmente.
- **Passo 12.7.3** — Auditoria: toda alteração em `reddit_watches` grava `audit_log`.

---

## FASE 13 — Content Intelligence + 7 Teses

### Objetivo
Materializar as 7 Teses como restrição editorial em banco (não hardcode) e forçar cruzamento entre elas e qualquer sinal externo antes de gerar `content_opportunity`.

### Etapa 13.1 — Schema das teses

- **Passo 13.1.1** — Migração `0004_theses`:
  ```
  theses (
    id uuid PK,
    campaign_id uuid REFERENCES campaigns,
    slug text NOT NULL,                          -- ex.: 'estudo-eficiente','concurso-e-realidade'
    title text NOT NULL,
    description text NOT NULL,
    tenets jsonb NOT NULL,                       -- lista de proposições que a tese defende
    forbidden_angles jsonb,                      -- ângulos que a tese REJEITA
    tone_guidelines text,
    example_hooks jsonb,
    centroid_embedding vector(384),              -- média dos exemplos + tenets
    version int NOT NULL DEFAULT 1,
    active boolean DEFAULT true,
    UNIQUE (campaign_id, slug, version)
  )

  content_item_theses (                          -- N:1 caso content_item toque mais de uma tese
    content_item_id uuid REFERENCES content_items,
    thesis_id uuid REFERENCES theses,
    weight numeric DEFAULT 1.0,
    PRIMARY KEY (content_item_id, thesis_id)
  )
  ```
- **Passo 13.1.2** — Seed inicial: **exatamente 7 teses** por campanha ativa (Rota de Ataque + Gazeta Concursos). Slugs/títulos preenchidos pelo usuário via admin (Etapa 13.4) — seed cria placeholders.
- **Passo 13.1.3** — Guarda: uma nova tese só é criada se `count(theses WHERE campaign_id=? AND active=true) < 7` — trigger PL/pgSQL.
- **DoD:** contract test do limite de 7 teses ativas.

### Etapa 13.2 — Cálculo de centroid embedding

- **Passo 13.2.1** — Ao criar/atualizar tese: gera embedding de `title + description + tenets + example_hooks` concatenados; salva em `centroid_embedding`.
- **Passo 13.2.2** — Job semanal recomputa centroids se `content_items` recentes com aquela tese mudarem o "centro de massa" — ajuste suave (EMA α=0.1).
- **DoD:** teste: alterar `tenets` regera embedding; embedding tem 384 dims.

### Etapa 13.3 — Regra dura de "tese-match"

- **Passo 13.3.1** — Função pura em `packages/shared/src/theses.ts`:
  ```
  matchThesis(signalEmbedding, theses) → { thesisId, similarity } | null
  ```
  retorna a tese com maior cosine similarity **se** ≥ 0.70; senão `null`.
- **Passo 13.3.2** — Toda geração de `content_opportunity` OU `content_item` chama `matchThesis` obrigatoriamente; item sem match cai em `review_inbox` com item_type='thesis_gap' para curadoria humana (pode gerar decisão de criar nova tese OU descartar sinal).
- **Passo 13.3.3** — Auditar: teste que garante que a `worker-content-opportunity` recusa gerar item sem tese e cria review_inbox.

### Etapa 13.4 — UI: editor das 7 Teses

- **Passo 13.4.1** — Rota `apps/web/theses/page.tsx`: grid 2×4 (7 cards + 1 slot vazio para nova). Cada card: título, descrição, tenets em lista, botão "Editar" (modal), toggle active.
- **Passo 13.4.2** — Editor mostra ao lado: "conteúdos produzidos com esta tese nos últimos 30d" (contagem + top 3 pelo `content_performance` — vem da Fase 21).
- **Passo 13.4.3** — Preview de impacto: ao editar tenets, mostra "N `content_opportunities` pendentes que passariam a matchear/desmatch com esta tese".

---

## FASE 14 — Threads: Adapter + Publisher

### Objetivo
Threads como canal de distribuição orgânica adicional. Não é cópia da legenda do Instagram — é **formulação textual independente** derivada do mesmo `content_item` canônico. Respeita limite de 500 chars e usa a conta `role='actor'` (a mesma vinculada ao IG Business).

### Etapa 14.1 — `packages/threads-api`

- **Passo 14.1.1** — Cliente tipado da Threads Graph API. Reusa `AccessToken` da conta actor (`accounts.meta_access_token_encrypted`) — mesma família Meta, mesma vinculação OAuth.
- **Passo 14.1.2** — Métodos: `createContainer({ media_type:'TEXT', text })`, `publishContainer(id)`, `readInsights(mediaId)`, `readReplies(mediaId)`.
- **Passo 14.1.3** — Rate limit local: 250 req/24h por token (default conservador); campo `threads_rate_used_24h` em `account_health` (nova coluna via ALTER).
- **Passo 14.1.4** — Validação: texto ≤500 chars; se mídia anexada, valida URL pública S3 (Fase 7.3 do plano-mestre).
- **DoD:** testes com fixtures cobrindo create+publish+insights+erros de rate limit e token inválido.

### Etapa 14.2 — Vinculação e App Review

- **Passo 14.2.1** — Adicionar checkbox no fluxo OAuth da conta actor (`apps/web/accounts` — Passo 6.10.4.5 do plano-mestre): "Também vincular Threads". Preencher `accounts.threads_user_id` (nova coluna).
- **Passo 14.2.2** — Cronograma de App Review Meta explicitando as permissões Threads (`threads_basic`, `threads_content_publish`, `threads_read_replies`, `threads_manage_replies`). Documentar em `docs/compliance/meta-app-review.md`.
- **Passo 14.2.3** — Degradação: se App Review negado ou pendente, publisher Threads mostra estado `waiting_approval` na UI e nunca tenta chamar API.
- **DoD:** conta actor com Threads vinculado mostra ambos IDs em `/accounts`.

### Etapa 14.3 — `workers/threads-adapter/`

- **Passo 14.3.1** — Consome fila `threads-adapter` (jobId `variantJobId(content_item_id, 'threads')` — Passo 11.3.2).
- **Passo 14.3.2** — Recebe `content_item` completo, gera texto próprio para Threads via LLM (prompt específico: "formule este raciocínio como post Threads standalone, ≤500 chars, sem soar como legenda de Instagram; use quebra de linha estratégica"). **Não** faz cópia da legenda IG.
- **Passo 14.3.3** — Passa por `packages/humanizer` (Fase 20) com regra de canal `channel='threads'` — comparação de similaridade contra `content_variants WHERE channel='threads'` últimos 30d.
- **Passo 14.3.4** — Grava `content_variant (channel='threads', format='text', payload={text}, status='ready')`.
- **Passo 14.3.5** — Cria item em `review_inbox` (aprovação humana obrigatória — Princípio 6). Após aprovação, enfileira `threads-publisher`.
- **DoD:** dado 1 `content_item`, gera 1 variant Threads em ≤10s, cria review_inbox, aprovação → publisher chamado.

### Etapa 14.4 — `workers/threads-publisher/`

- **Passo 14.4.1** — Consome fila `threads-publisher` (jobId `variant:{variant_id}:publish`).
- **Passo 14.4.2** — `preflight()`: role='actor'; token válido; `threads_rate_used_24h < 250`; variant.status='approved'.
- **Passo 14.4.3** — Executa `createContainer` → `publishContainer`. Grava `content_publications (variant_id, channel='threads', external_id, published_at)`.
- **Passo 14.4.4** — Emite `content.published { channel:'threads', variant_id }`.
- **Passo 14.4.5** — Agenda job de coleta de insights D+1, D+7 (chama `readInsights` + `readReplies`; atualiza `content_publications.metrics`).
- **Passo 14.4.6** — Réplicas (respostas) do Threads viram eventos `threads.reply` que alimentam `worker-mention-monitor` para descoberta de leads (P13).
- **DoD:** publica 1 post real em conta de teste; métrica retorna após 24h.

### Etapa 14.5 — UI: gestão Threads dentro de Publishing

- **Passo 14.5.1** — Estender `apps/web/publishing/page.tsx`: Kanban ganha filtro por canal (Instagram | Threads | Ambos). Cards de Threads mostram texto + contador de chars + status.
- **Passo 14.5.2** — Card de variant Threads mostra preview visual do post (fundo do Threads + typography + limite 500 chars destacado).

---

## FASE 15 — Email Engine (nutrição event-driven)

### Objetivo
Email não é newsletter. É **motor de nutrição, reativação e conversão** orientado por eventos (não cronologia). Cada lead entra com contexto (origem, interesse, tese, campanha) e sequência muda conforme comportamento (abre, clica, responde, silêncio).

### Etapa 15.1 — Schema

- **Passo 15.1.1** — Migração `0005_email_engine`:
  ```
  email_subscribers (
    id uuid PK, lead_id uuid REFERENCES leads,
    email citext NOT NULL,
    email_hash bytea NOT NULL,                    -- SHA-256 para lookup rápido/PII-safe
    optin_source text NOT NULL,                   -- 'form','manual','import','api'
    optin_evidence jsonb,                         -- {form_id, url, ip, ua, ts}
    optin_at timestamptz DEFAULT now(),
    double_optin_at timestamptz,
    campaign_of_entry uuid REFERENCES campaigns,
    thesis_of_entry uuid REFERENCES theses,
    initial_topic text,                           -- ex.: 'PPCE'
    unsubscribed_at timestamptz,
    unsubscribe_reason text,
    hard_bounced_at timestamptz,
    UNIQUE (email)
  )

  email_flows (
    id uuid PK, campaign_id uuid REFERENCES campaigns,
    name text NOT NULL, description text,
    entry_condition jsonb NOT NULL,               -- ex.: {optin_source:'form', initial_topic:'PPCE'}
    steps jsonb NOT NULL,                         -- lista ordenada de nós: send/wait/branch/end
    active boolean DEFAULT false,
    version int DEFAULT 1,
    UNIQUE (campaign_id, name, version)
  )

  email_flow_state (
    subscriber_id uuid REFERENCES email_subscribers,
    flow_id uuid REFERENCES email_flows,
    current_step_id text,
    status text CHECK (status IN ('active','paused','completed','exited','suppressed')) DEFAULT 'active',
    entered_at timestamptz DEFAULT now(),
    next_evaluate_at timestamptz,
    PRIMARY KEY (subscriber_id, flow_id)
  )

  email_events (
    id bigserial PK,
    subscriber_id uuid REFERENCES email_subscribers,
    variant_id uuid REFERENCES content_variants,  -- opcional; email pode não vir de content_item
    kind text CHECK (kind IN ('sent','delivered','opened','clicked','bounced','complained','replied','unsubscribed')),
    metadata jsonb,                               -- {message_id, link_url, ip, ua, timestamp_provider}
    at timestamptz DEFAULT now()
  )

  email_suppressions (
    email_hash bytea PK,
    reason text CHECK (reason IN ('hard_bounce','complaint','unsubscribe','manual','list_purge')),
    suppressed_at timestamptz DEFAULT now(),
    notes text
  )
  ```
- **Passo 15.1.2** — Índices: `email_subscribers (email_hash)`, `email_events (subscriber_id, kind, at DESC)`, `email_flow_state (status, next_evaluate_at) WHERE status='active'`.
- **Passo 15.1.3** — LGPD: `email` é `citext`, PII. `email_hash` é a chave de lookup para logs/eventos que não precisam ver o valor original. Runbook `docs/compliance/email-lgpd.md`: retenção, direito de exclusão, portabilidade.
- **DoD:** contract tests + verificação que remoção de subscriber por LGPD apaga suas linhas em `email_events` mas mantém agregados em `content_publications.metrics`.

### Etapa 15.2 — `packages/email-provider`

- **Passo 15.2.1** — Interface `EmailProvider { send(msg): Promise<Delivery>; parseWebhook(payload): EmailEvent[] }`.
- **Passo 15.2.2** — Implementações: `ResendProvider` (reusa `packages/notifications`) para transacional (welcome, double-optin, OTP) + `SESProvider` (AWS SDK) para nutrição em massa. Escolha automática por `email_flows.steps[i].kind` (`transactional` → Resend, `bulk` → SES).
- **Passo 15.2.3** — Webhooks: rota `/api/email/webhook/:provider` recebe callbacks; valida assinatura; enfileira em `email-events-consumer`.
- **Passo 15.2.4** — Retry com backoff exponencial + jitter para 4xx/5xx do provedor; após 3 falhas, marca subscriber `hard_bounced` se aplicável.
- **DoD:** teste unitário do parseWebhook para Resend e SES cobrindo delivered/bounced/complained/clicked/opened.

### Etapa 15.3 — Opt-in e ingestão

- **Passo 15.3.1** — Rota `apps/web/api/email/subscribe` recebe `{email, source, topic, campaign_id, evidence}` — grava `email_subscribers` com `optin_at` mas **`double_optin_at=null`** até confirmação.
- **Passo 15.3.2** — Envia email de confirmação (Resend, template com token expirável); `/api/email/confirm/:token` preenche `double_optin_at`.
- **Passo 15.3.3** — Se subscriber já tem lead vinculado por outro canal (via `identities` — Fase 18), preenche `lead_id`; senão cria novo `lead` e adiciona `identity (channel='email', external_id=email_hash)`.
- **Passo 15.3.4** — Nenhum email de nutrição enviado sem `double_optin_at` (constraint no worker).
- **DoD:** teste ponta-a-ponta: subscribe → email chega → confirm → subscriber elegível para fluxos.

### Etapa 15.4 — `workers/email-flow-engine/`

- **Passo 15.4.1** — Consome fila `email-flow-engine` acionada por: (a) novo `email_subscribers.double_optin_at` preenchido; (b) `email_events` novo (opened/clicked/replied); (c) job de tick a cada 5min varrendo `email_flow_state.next_evaluate_at < now()`.
- **Passo 15.4.2** — Executor de steps declarativos: `send`, `wait_until_event`, `wait_seconds`, `branch_on`, `set_topic_affinity`, `exit_flow`, `end`.
- **Passo 15.4.3** — Resolve `send` chamando o provider adequado; grava `email_events (kind='sent', variant_id se aplicável)`.
- **Passo 15.4.4** — `branch_on` avalia condição contra `email_events` + `intent_score` do lead + `content_affinity` — decisão pura, testável.
- **Passo 15.4.5** — **Regra hard:** se subscriber tem `email_events.kind='replied'` (via IMAP/webhook do provider), o fluxo é imediatamente pausado (`status='paused'`), evento `email.replied` emitido, e um item em `review_inbox` avisa que humano deve continuar.
- **Passo 15.4.6** — `preflight()` recusa se subscriber está em `email_suppressions` OR `unsubscribed_at IS NOT NULL`.
- **DoD:** teste com fluxo mock de 3 steps (send → wait 2d ou até open → send seguinte); comportamento reproduzível.

### Etapa 15.5 — `workers/email-events-consumer/`

- **Passo 15.5.1** — Consome fila de webhook do provider. Persiste `email_events` idempotente por `metadata.message_id + kind`.
- **Passo 15.5.2** — Efeitos colaterais:
  - `opened/clicked` → recompute `email_engagement_score` (Fase 19).
  - `clicked` → se link tem `?content_item_id=X`, incrementa `topic_affinity` do lead pelo tópico dessa tese.
  - `bounced` (hard) → move para `email_suppressions`.
  - `complained/unsubscribed` → seta `unsubscribed_at`, adiciona a `email_suppressions`, remove de fluxos ativos.
  - `replied` → 15.4.5.
- **Passo 15.5.3** — Cada evento também emite linha em `timeline_events` (Fase 18) com `channel='email'`.
- **DoD:** injetar 100 eventos mock; verificar deduplicação, efeitos e emissão de timeline_events.

### Etapa 15.6 — Distribuição personalizada por topic_affinity

- **Passo 15.6.1** — Novo tipo de fluxo: `broadcast_smart`. Entry condition: `content_item.id + audience_query`. Sistema resolve `audience_query` em SQL contra `leads` filtrando por `topic_affinity.<tópico> ≥ threshold`.
- **Passo 15.6.2** — Preview: antes de disparar, mostra volume estimado + amostra de 20 leads que baterão + estimativa de envio (respeitando quota SES).
- **Passo 15.6.3** — Disparo em batches respeitando `Contact Policy Engine` (Fase 19) — leads que receberam contato outbound nas últimas 24h ficam fora automaticamente.
- **DoD:** disparo real de teste em lista de 10 subscribers com `topic_affinity` mockada; audit_log preenchido.

### Etapa 15.7 — UI: editor de fluxos

- **Passo 15.7.1** — Rota `apps/web/email-flows/page.tsx`: lista de fluxos com métricas (entradas 30d, conversão, taxa de saída).
- **Passo 15.7.2** — Editor visual estilo canvas (React Flow — já instalado) com nós arrastáveis: `Entry`, `Send`, `Wait event`, `Wait time`, `Branch`, `Set affinity`, `Exit`, `End`. Cada nó configurável por form lateral.
- **Passo 15.7.3** — Publish do fluxo cria nova `version` — versões antigas continuam ativas para subscribers já dentro; novos entram na versão nova.
- **Passo 15.7.4** — Botão "Broadcast smart" abre modal de segmentação (query builder) + preview + confirmação.
- **DoD:** operador cria fluxo do zero, ativa, subscriber entra e recebe emails corretos.

### Etapa 15.8 — Compliance

- **Passo 15.8.1** — `docs/compliance/email-lgpd.md`: fluxo de exclusão a pedido (`/api/lgpd/email-purge/:hash`), retenção de logs (2 anos), portabilidade (`/api/lgpd/email-export/:hash`).
- **Passo 15.8.2** — Rodapé de todo email inclui link físico "Cancelar inscrição" que abre landing pública + POST `/api/email/unsubscribe/:token`.
- **Passo 15.8.3** — DKIM/SPF/DMARC configurados por domínio; documentado em `docs/runbooks/email-deliverability.md`.

---

## FASE 16 — WhatsApp Individual (Cloud API + opt-in)

### Objetivo
WhatsApp abaixo do funil. Número entra **apenas com opt-in explícito** (entidade de banco, não flag). Por decisão conservadora de operação, a resposta é escrita por humano e validada pelas regras do canal antes do envio; o `conversation-agent` permanece exclusivo de Instagram DM.

### Etapa 16.1 — Schema

- **Passo 16.1.1** — Migração `0006_whatsapp_individual`:
  ```
  whatsapp_optins (
    id uuid PK, lead_id uuid REFERENCES leads,
    phone_e164 text NOT NULL,
    phone_hash bytea NOT NULL,
    source text NOT NULL,                        -- 'site_button','ig_link','email_link','manual','import'
    evidence jsonb,                              -- {url, form_id, ts, ip}
    opted_in_at timestamptz DEFAULT now(),
    opted_out_at timestamptz,
    status text CHECK (status IN ('active','revoked','blocked')) DEFAULT 'active',
    UNIQUE (phone_e164)
  )

  whatsapp_conversations (
    id uuid PK,
    optin_id uuid REFERENCES whatsapp_optins,
    lead_id uuid REFERENCES leads,
    wa_conversation_id text,                     -- id do provider quando existente
    stage text CHECK (stage IN ('opened','engaged','qualified','converted','cooled')) DEFAULT 'opened',
    last_inbound_at timestamptz,
    last_outbound_at timestamptz,
    session_window_expires_at timestamptz,       -- janela 24h após último inbound
    requires_human_review boolean DEFAULT false
  )

  whatsapp_messages (
    id uuid PK,
    conversation_id uuid REFERENCES whatsapp_conversations,
    direction text CHECK (direction IN ('inbound','outbound')),
    kind text CHECK (kind IN ('text','template','image','audio','video','document','interactive')),
    template_ref text,                           -- se outbound e usa template
    text text,
    media_ref jsonb,
    variant_id uuid REFERENCES content_variants, -- se veio de content_item
    external_id text,                            -- msg id do provider
    status text CHECK (status IN ('queued','sent','delivered','read','failed')) DEFAULT 'queued',
    sent_at timestamptz, delivered_at timestamptz, read_at timestamptz,
    UNIQUE (external_id)
  )
  ```
- **Passo 16.1.2** — Índices: `whatsapp_optins (phone_hash)`, `whatsapp_conversations (lead_id, last_inbound_at DESC)`, `whatsapp_messages (conversation_id, sent_at DESC)`.
- **Passo 16.1.3** — **Constraint dura:** `whatsapp_messages (direction='outbound' AND kind IN ('text','image','audio','video','document','interactive'))` só permitido se `now() < session_window_expires_at` da conversa; senão exige `kind='template'` com `template_ref`. Trigger valida no INSERT.
- **DoD:** teste que mostra INSERT bloqueado fora da janela sem template + INSERT permitido com template.

### Etapa 16.2 — `packages/whatsapp-cloud`

- **Passo 16.2.1** — Cliente da WhatsApp Cloud API oficial. Env: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
- **Passo 16.2.2** — Métodos: `sendText`, `sendTemplate`, `sendMedia`, `sendInteractive`, `markAsRead`, `readTemplateApprovals`.
- **Passo 16.2.3** — Rate limit: respeita quotas oficiais por tier; expõe `whatsapp_rate_used_1h` em `account_health`.
- **Passo 16.2.4** — Verificação de webhook: `hub.verify_token` + assinatura `X-Hub-Signature-256`.
- **DoD:** testes com fixtures cobrindo cada método + parse de webhook de status + de mensagem inbound.

### Etapa 16.3 — Opt-in como entidade

- **Passo 16.3.1** — Endpoint `apps/web/api/whatsapp/optin` grava `whatsapp_optins` — invocado por: botão em landing, redirect após ler QR code, form em email, endpoint chamado pelo próprio site. Todos armazenam `evidence` verificável.
- **Passo 16.3.2** — Antes de disparar qualquer outbound, `preflight()` do `whatsapp-outbound` valida `whatsapp_optins.status='active'` — senão `PREFLIGHT_FAILED`.
- **Passo 16.3.3** — Se lead pede opt-out (mensagem "sair", "parar", "STOP"), o `whatsapp-inbound` marca `opted_out_at` + `status='revoked'` + cria review_inbox informativo.
- **DoD:** teste que impede envio para telefone sem opt-in ativo.

### Etapa 16.4 — `workers/whatsapp-inbound/`

- **Passo 16.4.1** — Consome fila de webhook (endpoint `/api/whatsapp/webhook` já enfileira).
- **Passo 16.4.2** — Roteia por tipo: `messages` (inbound de usuário) → grava `whatsapp_messages`, atualiza `session_window_expires_at = now() + 24h`, emite `whatsapp.message_inbound` na timeline; `statuses` (delivery updates) → atualiza `whatsapp_messages.status`.
- **Passo 16.4.3** — Se `lead_id` já vinculado, apenas atualiza; senão cria novo `lead` + `identity (channel='whatsapp', external_id=phone_hash)` (P13).
- **Passo 16.4.4** — Abre item em `review_inbox` para resposta escrita por humano. Antes do envio, `whatsapp-outbound` aplica `validateChannelText('whatsapp_dm', ...)`; não há resposta candidata automática enquanto o volume operacional não justificar um copiloto dedicado.
- **Passo 16.4.5** — Palavras-chave sensíveis (reclamação formal, jurídico, ameaça) → sempre review (regra hard já do §17 do plano-mestre).
- **DoD:** mensagem inbound de teste chega, cria lead se novo, abre revisão humana e bloqueia o envio de texto que viole as regras de `whatsapp_dm`.

### Etapa 16.5 — `workers/whatsapp-outbound/`

- **Passo 16.5.1** — Consome fila `whatsapp-outbound`. `preflight()`: opt-in ativo; conta actor healthy; **Contact Policy Engine** libera (não houve outro contato outbound nas últimas 24h — D15); dentro da janela 24h OU `kind='template'` com template aprovado.
- **Passo 16.5.2** — Aprovação humana obrigatória (Princípio 6) via `review_inbox` até MVP validado.
- **Passo 16.5.3** — Grava `whatsapp_messages (direction='outbound', status='queued')` → envia → atualiza status pelos callbacks.
- **Passo 16.5.4** — Templates: cadastrados em `whatsapp_templates` (nova tabela pequena: `id, name, category, language, body, approval_status`). Só templates com `approval_status='APPROVED'` da Meta podem ser usados.
- **DoD:** envio real de template para número de teste; delivery status atualizado via webhook.

### Etapa 16.6 — UI: inbox WhatsApp individual

- **Passo 16.6.1** — Estender `apps/web/conversations/page.tsx` (Fase 6.8 do plano-mestre): tabs por canal incluem WhatsApp.
- **Passo 16.6.2** — Card específico "Janela de 24h" no header da conversa mostrando quanto tempo resta (WA session).
- **Passo 16.6.3** — Se fora da janela, editor de mensagem substitui livre por seletor de template aprovado.
- **Passo 16.6.4** — Opt-in evidence visível na aba de contexto do lead.

---

## FASE 17 — WhatsApp Groups (Groups API — condicional)

### Objetivo
Grupos como canais estruturados: comunidade, calendário, política de publicação, gestão programática.

### Etapa 17.1 — Verificação de disponibilidade (bloqueante)

- **Passo 17.1.1** — Antes de qualquer código: executar script `scripts/whatsapp-groups-availability-check.ts` que chama endpoint oficial da Cloud API para a conta vinculada e determina se Groups API está habilitada para aquela conta específica. **Se `false`, Fase 17 é adiada e reporta ao usuário.**
- **Passo 17.1.2** — Documentar resultado em `docs/compliance/whatsapp-groups-availability.md` com data, conta e evidência (screenshot da resposta API + versão da doc oficial no momento).

### Etapa 17.2 — Schema (só se 17.1 verde)

- **Passo 17.2.1** — Migração `0007_whatsapp_groups`:
  ```
  whatsapp_groups (
    id uuid PK,
    wa_group_id text UNIQUE,
    name text NOT NULL,
    purpose text,                                -- 'PPCE','Área Fiscal','Concursos Policiais'
    campaign_id uuid REFERENCES campaigns,
    invite_link text,
    subject text, description text,
    created_at timestamptz DEFAULT now(),
    created_via text CHECK (created_via IN ('api','import','manual')),
    policy jsonb NOT NULL DEFAULT '{}'           -- {max_daily_posts, allowed_topics[], quiet_hours[], require_approval}
  )

  whatsapp_group_participants (
    group_id uuid REFERENCES whatsapp_groups,
    phone_hash bytea, lead_id uuid REFERENCES leads,
    joined_at timestamptz DEFAULT now(), left_at timestamptz,
    role text CHECK (role IN ('member','admin','superadmin')) DEFAULT 'member',
    PRIMARY KEY (group_id, phone_hash)
  )

  whatsapp_group_messages (
    id uuid PK,
    group_id uuid REFERENCES whatsapp_groups,
    direction text CHECK (direction IN ('inbound','outbound')),
    variant_id uuid REFERENCES content_variants,
    text text, media_ref jsonb,
    from_phone_hash bytea,
    external_id text UNIQUE,
    sent_at timestamptz, delivered_at timestamptz
  )
  ```
- **Passo 17.2.2** — Índices: `whatsapp_group_messages (group_id, sent_at DESC)`, `whatsapp_group_participants (lead_id) WHERE left_at IS NULL`.
- **DoD:** contract test.

### Etapa 17.3 — `workers/whatsapp-group-manager/`

- **Passo 17.3.1** — Consome fila `whatsapp-group-manager`. Ações: `create_group`, `invite_participant`, `remove_participant`, `send_group_message`, `sync_participants`, `sync_messages`.
- **Passo 17.3.2** — Publicação obedece `whatsapp_groups.policy`:
  - `max_daily_posts` limita quantas mensagens por dia por grupo (contador em Redis).
  - `allowed_topics` bloqueia variants cujo `content_item.audience_segment` não bate.
  - `quiet_hours` posterga fora da janela.
  - `require_approval=true` cria `review_inbox` antes de enviar.
- **Passo 17.3.3** — Mensagem inbound de participante conhecido → atualiza `lead_interactions` + score; se pergunta relevante detectada por `packages/nlp` → cria `market_signal` local (não vira lead novo se participante não tem opt-in individual DM).
- **DoD:** enviar 1 mensagem para grupo real de teste; participante vira `lead` só se já tinha identidade prévia.

### Etapa 17.4 — Content Variant `whatsapp_group`

- **Passo 17.4.1** — Adicionar tipo de variant em Fase 11.2.1. Payload: `{text, media_refs?, mentions?}`.
- **Passo 17.4.2** — Adapter dedicado (`workers/content-item-orchestrator` já orquestra) gera texto adequado ao grupo (mais curto, menos formal, com CTA para conteúdo aprofundado em outro canal).
- **Passo 17.4.3** — Humanization Layer aplica regra `channel='whatsapp_group'`.

### Etapa 17.5 — UI: gestão de comunidades

- **Passo 17.5.1** — Nova rota `apps/web/communities/page.tsx`: lista de grupos com `[nome, purpose, participants_count, mensagens 7d, próxima publicação, status]`.
- **Passo 17.5.2** — Drawer de detalhe do grupo: policy editável (form), calendário de próximas publicações, timeline de mensagens (agregada), participantes com filtro por lead conhecido/anônimo.
- **Passo 17.5.3** — Botão "Publicar agora" abre seletor de `content_item` + preview do texto adaptado + confirmação.

### Etapa 17.6 — Compliance

- **Passo 17.6.1** — Runbook `docs/compliance/whatsapp-optin-flow.md` cobre também grupos (participação em grupo ≠ opt-in para DM individual).
- **Passo 17.6.2** — Kill-switch específico por grupo (`kill-switch:group:{id}`).

---

## FASE 18 — Universal Timeline + Identities

### Objetivo
Uma única `lead` com **várias `identities`** por canal, ligadas apenas com evidência confiável (D10). Todas as interações de todos os canais viram `timeline_events` padronizados.

### Etapa 18.1 — Schema Identities

- **Passo 18.1.1** — Migração `0008_identities`:
  ```
  identities (
    id uuid PK, lead_id uuid REFERENCES leads,
    channel text NOT NULL CHECK (channel IN ('instagram','threads','email','whatsapp','reddit')),
    external_id text NOT NULL,                   -- username IG, threads user id, email_hash, phone_hash, reddit_user_hash
    external_handle text,                        -- forma legível quando disponível (username, email masked)
    verified boolean DEFAULT false,
    verified_via text CHECK (verified_via IN ('user_declared','oauth','otp','click_signed','import_confirmed')),
    verified_at timestamptz,
    evidence jsonb,                              -- payload que embasa verified=true
    created_at timestamptz DEFAULT now(),
    UNIQUE (channel, external_id)
  )

  identity_candidates (                          -- merges sugeridos, aguardando aprovação
    id uuid PK,
    lead_id_a uuid REFERENCES leads,
    lead_id_b uuid REFERENCES leads,
    reason text,                                 -- 'username_match','name_match','similar_bio'
    confidence numeric,                          -- 0..1
    evidence jsonb,
    status text CHECK (status IN ('pending','approved','rejected','expired')) DEFAULT 'pending',
    decided_by uuid, decided_at timestamptz
  )
  ```
- **Passo 18.1.2** — Backfill de `identities` a partir de `leads.username_current` (canal='instagram', verified=false) — não gera candidatos automáticos.
- **DoD:** invariante: cada `(channel, external_id)` mapeia para no máximo 1 identity.

### Etapa 18.2 — `workers/identity-resolver/`

- **Passo 18.2.1** — Consome fila `identity-resolver` acionada por: opt-in de email/WhatsApp de um lead existente por outro canal, clique identificado em landing, OTP.
- **Passo 18.2.2** — Regra dura (D10): **só faz merge se pelo menos 1 sinal `verified=true` de canal diferente aponta para o mesmo lead**. Merges com só `username_match` viram `identity_candidates` com `confidence` calculada.
- **Passo 18.2.3** — Merge executa: (a) escolhe lead sobrevivente (o mais antigo ou o mais completo); (b) reaponta identities/lead_interactions/lead_sources/timeline_events/lead_scores; (c) marca o outro lead como `merged_into = survivor_id` (nova coluna); (d) grava `audit_log`.
- **Passo 18.2.4** — Merge é reversível por 30 dias (mantém snapshot em `identity_merge_snapshots`).
- **DoD:** teste que faz merge de 2 leads via clique identificado; timeline unificada; rollback restaura estado.

### Etapa 18.3 — `timeline_events` (padronização)

- **Passo 18.3.1** — Nova tabela `timeline_events` (**não** substitui `lead_interactions` existente — coexiste; view materializada unifica).
  ```
  timeline_events (
    id bigserial PK,
    lead_id uuid REFERENCES leads,
    channel text NOT NULL,
    event_type text NOT NULL,                    -- vocabulário Apêndice K
    content_item_id uuid REFERENCES content_items,
    variant_id uuid REFERENCES content_variants,
    campaign_id uuid REFERENCES campaigns,
    external_ref jsonb,
    metadata jsonb,
    at timestamptz DEFAULT now(),
    source text CHECK (source IN ('api','scrape','webhook','manual','system'))
  )
  ```
- **Passo 18.3.2** — Índice: `timeline_events (lead_id, at DESC)` + `(event_type, at DESC)` + `(campaign_id, at DESC)`.
- **Passo 18.3.3** — Enum `event_type` restrito ao Apêndice K (Zod + CHECK).
- **Passo 18.3.4** — Backfill em job: converte `lead_interactions` histórico em `timeline_events` (mapeamento kind→event_type).
- **DoD:** invariante: todo `timeline_event.event_type` bate com o Apêndice K.

### Etapa 18.4 — UI: timeline unificada

- **Passo 18.4.1** — Estender `apps/web/timeline/page.tsx` (Fase 6.5) para consumir `timeline_events` diretamente com filtros por canal + event_type + intervalo.
- **Passo 18.4.2** — Cabeçalho da timeline mostra **todas as identities** do lead com badges por canal (verified/candidate), botão "Ver merges pendentes".
- **Passo 18.4.3** — Aba secundária "Merges pendentes" lista `identity_candidates` com evidência + aprovação humana.

---

## FASE 19 — Multi-canal Scoring + NBA + Next Best Channel + Contact Policy

### Objetivo
Um lead tem múltiplos scores (não só `final_score`). NBA passa a enxergar todos os canais. **Next Best Channel** decide *por onde* antes de *o quê*. **Contact Policy Engine** global impede múltiplos contatos simultâneos.

### Etapa 19.1 — Novos scores

- **Passo 19.1.1** — ALTER `lead_scores` adicionando colunas: `content_affinity jsonb` (`{topic: score}`), `email_engagement_score numeric`, `whatsapp_engagement_score numeric`, `freshness_score numeric` (separado do `freshness_multiplier` — este último continua no cálculo do final).
- **Passo 19.1.2** — Fórmulas em `packages/shared/src/scoring.ts` (estender `computeScore` existente):
  ```
  email_engagement_score = f(recent_opens, recent_clicks, replies, unsubscribed?)
  whatsapp_engagement_score = f(inbound_msgs_30d, response_rate, avg_response_time)
  content_affinity[topic] = EMA(clicks + comments + saves em variants desse topic)
  freshness_score = 100 * exp(-lambda * days_since_last_touch_any_channel)
  ```
  Pesos vindos de `campaign_scoring_config` (extender).
- **Passo 19.1.3** — Job diário recomputa; sob demanda por eventos (`timeline_event` novo emite recompute).
- **Passo 19.1.4** — `final_score` continua sendo priorização global; scores específicos alimentam NBA/NBC.
- **DoD:** teste unitário de cada função pura + teste de integração recomputando após evento sintético.

### Etapa 19.2 — Estender NBA para todos canais

- **Passo 19.2.1** — `nba_rules.action_expr` passa a aceitar canal: `{ channel:'email', kind:'send_flow', flow_id:... }`, `{ channel:'whatsapp', kind:'send_template', ... }`, etc.
- **Passo 19.2.2** — Regras hard adicionadas ao seed:
  - Se `dm_inbound` no WhatsApp nas últimas 24h → sugerir `wait_and_reply`, **não** email/threads outbound.
  - Se `email.replied` recente → suspender fluxos e criar review_inbox.
  - Se lead veio via Reddit sem identidade verificada → **nunca** outbound (P11).
- **Passo 19.2.3** — Recomendações do NBA passam pelo NBC (19.3) antes de virar `engagement_actions` ou `whatsapp_outbound` ou `email_flow_engine`.
- **DoD:** teste que verifica que NBA + NBC não escolhem canal em conflito com contact policy.

### Etapa 19.3 — `workers/next-best-channel/`

- **Passo 19.3.1** — Consome fila `next-best-channel` alimentada por eventos que mudam scores.
- **Passo 19.3.2** — Para cada lead alvo: calcula probabilidade de sucesso por canal (função linear ou pequena regressão logística treinada com histórico) usando `email_engagement_score`, `whatsapp_engagement_score`, `intent_score`, `relationship_score`, `content_affinity`, canais elegíveis (opt-in ativo por canal).
- **Passo 19.3.3** — Aplica **Contact Policy Engine** (19.4) como filtro final. Retorna um único `chosen_channel` ou `none`.
- **Passo 19.3.4** — Persiste decisão em `nba_recommendations.chosen_channel` (nova coluna) + rationale.
- **DoD:** para 3 personas mockadas com scores diferentes, canais escolhidos são distintos e coerentes.

### Etapa 19.4 — `workers/contact-policy-engine/` + rules

- **Passo 19.4.1** — Nova tabela `contact_policies` (rules globais + por-canal + por-campanha):
  ```
  contact_policies (
    id uuid PK, scope text CHECK (scope IN ('global','campaign','channel','lead')),
    scope_ref uuid,
    rule_kind text CHECK (rule_kind IN (
      'max_contacts_per_window',
      'block_if_recent_channel',
      'suspend_on_human_reply',
      'suppress_on_optout',
      'exit_on_conversion',
      'quiet_hours',
      'lead_stage_gate'
    )),
    params jsonb NOT NULL,
    priority int DEFAULT 100,
    active boolean DEFAULT true
  )
  ```
- **Passo 19.4.2** — `channel-router/policy.ts`: função pura `canContact(lead, channel, contentItem?) → { allowed: boolean, reason?: string }`. Consulta rules em ordem de prioridade.
- **Passo 19.4.3** — Seed inicial das rules D15: `max_contacts_per_window {window_hours: 24, max: 1}`, `suspend_on_human_reply {window_hours: 168}`, `suppress_on_optout` (bloqueia canal do opt-out), `exit_on_conversion` (remove de aquisição, entra em jornada de cliente).
- **Passo 19.4.4** — Todo worker outbound (`whatsapp-outbound`, `email-flow-engine.send`, `threads-publisher`, `worker-engagement` do IG, `private-reply`) chama `canContact` obrigatoriamente antes de executar. Bloqueio grava evento `contact_blocked` na timeline.
- **DoD:** teste com lead que recebeu email às 09h → tentativa de whatsapp às 15h no mesmo dia é bloqueada.

### Etapa 19.5 — UI: dashboard multi-canal

- **Passo 19.5.1** — Novo widget no Overview: "Distribuição de canais NBA última semana" (donut mostrando %).
- **Passo 19.5.2** — Aba nova em `/leads/[id]`: "Scores multi-canal" com radar chart (intent/relationship/email_engagement/whatsapp_engagement/freshness/affinity_top).
- **Passo 19.5.3** — `/configs`: sub-aba "Contact Policies" — CRUD de rules com preview de impacto (leads bloqueados hoje se rule fosse ativada).

---

## FASE 20 — Humanization Layer compartilhada

### Objetivo
Extensão do `packages/humanizer` (Fase 2.7 do plano-mestre) para cobrir todos os canais, com regras por canal.

### Etapa 20.1 — Contrato do humanizer

- **Passo 20.1.1** — Estender `humanize(input)` para aceitar:
  ```
  input = { brand_voice_version, thesis_id, content_item_id?, lead_id?, stage?, channel, objective, seed_text }
  ```
- **Passo 20.1.2** — `channel` habilita regras específicas: comprimento máximo (Threads 500), tom (Email formal, WhatsApp coloquial), CTA (Instagram implícito visual, Threads texto conversacional, Email link direto, WhatsApp pergunta aberta).
- **Passo 20.1.3** — Comparação semântica **cross-channel**: além de comparar com variants do mesmo canal (regra existente), garante que Threads não fica muito próximo do texto da variant Email (cosine < 0.85) — evita "mesma mensagem repetida em canais diferentes".
- **DoD:** teste que reprova variant Threads muito similar à variant Email do mesmo `content_item`.

### Etapa 20.2 — Regras específicas por canal

- **Passo 20.2.1** — Config declarativa em `packages/humanizer/rules/`:
  - `threads.rules.ts`: sem hashtags excessivas (>2), quebra de linha estratégica, evitar CTA "clique no link" (Threads não linka bem).
  - `email.rules.ts`: subject ≤60 chars, preheader complementa não repete subject, CTA link claro.
  - `whatsapp.rules.ts`: ≤400 chars, evitar emojis em série, uma pergunta por mensagem.
  - `instagram.rules.ts`: primeira linha "hook" ≤120 chars, hashtags no primeiro comentário (variant preserva `first_comment`).
- **Passo 20.2.2** — Cada rule é função pura com testes.
- **DoD:** rules cobrem 100% dos canais + testes unitários.

### Etapa 20.3 — Persistência

- **Passo 20.3.1** — Estender `generated_texts` (existente) com colunas `channel`, `content_item_id`, `variant_id`. Índices adequados.
- **Passo 20.3.2** — `repetition_alerts` idem — passa a considerar canal.

---

## FASE 21 — Feedback loop multi-canal

### Objetivo
Todo canal outbound produz eventos de resultado que retroalimentam `content_performance` + `source_roi` + pesos do scoring.

### Etapa 21.1 — Schema

- **Passo 21.1.1** — Nova tabela `content_performance`:
  ```
  content_performance (
    variant_id uuid PK REFERENCES content_variants,
    channel text NOT NULL,
    impressions int, reach int, engagements int,
    clicks int, replies int, saves int, shares int,
    conversions int, revenue numeric,
    computed_at timestamptz,
    window_days int
  )
  ```
- **Passo 21.1.2** — Materialized view `mv_content_performance_by_thesis` agrega por `content_items.thesis_id` e canal.
- **Passo 21.1.3** — Estender `source_metrics` (Fase 8.6 do plano-mestre) com `source_type='content_variant'` e `source_type='email_flow'`.

### Etapa 21.2 — Retroalimentação de scoring

- **Passo 21.2.1** — Job semanal calcula: taxa de conversão por `thesis_id` × canal; ajusta pesos em `campaign_scoring_config` (EMA α=0.1) na direção do melhor desempenho.
- **Passo 21.2.2** — Dry-run 2 semanas antes de virar automático (Passo 10.3.15 do plano-mestre estende para incluir esses pesos).
- **Passo 21.2.3** — `topic_affinity` de cada lead se ajusta por clicks + replies em variants de tópicos específicos.
- **DoD:** teste: 10 semanas de dados mock → pesos convergem para tópico "vencedor".

### Etapa 21.3 — UI: performance por canal

- **Passo 21.3.1** — Nova aba em `apps/web/content-items/[id]/page.tsx`: "Performance" — cards por variant com métricas + gráfico de linha ao longo do tempo.
- **Passo 21.3.2** — Comparação: ao selecionar 2+ `content_items` na lista, botão "Comparar" abre view lateral com métricas empilhadas.
- **Passo 21.3.3** — Estender `apps/web/source-roi/page.tsx` com filtro por tipo de fonte (canal / tese / content_variant).

---

## FASE 22 — Roll-out multicanal

### Ordem canônica (cada bloco espera o anterior estabilizar por 7 dias)

- **Passo 22.1** — Fases 11 (canônico) + 18 (identities/timeline) — pré-requisito de tudo.
- **Passo 22.2** — Fase 13 (7 Teses) — sem elas nenhum content_opportunity novo é criado.
- **Passo 22.3** — Fase 12 (Reddit) — passivo, sem risco de contato indevido.
- **Passo 22.4** — Fase 20 (Humanização compartilhada) — antes de qualquer outbound novo.
- **Passo 22.5** — Fase 19 (NBC + Contact Policy) — antes de qualquer canal outbound novo.
- **Passo 22.6** — Fase 15 (Email) em modo somente double-opt-in por 14 dias, sem bulk. Depois liga bulk com Contact Policy ativa.
- **Passo 22.7** — Fase 14 (Threads) — aprovação humana obrigatória por 30 dias.
- **Passo 22.8** — Fase 16 (WhatsApp individual) — só respostas a inbound por 30 dias, depois templates aprovados com aprovação humana.
- **Passo 22.9** — Fase 17 (WhatsApp Groups) — só se Passo 17.1 verde. Início com 1 grupo piloto.
- **Passo 22.10** — Fase 21 (Feedback loop) — ativa após 30 dias de dados coletados em cada canal.

### Feature flags para tudo
Cada worker novo tem `Config.workers.<nome>.enabled` (Redis + env). Kill-switch F.6 do plano-mestre estende para cobrir cada canal (`kill-switch:channel:reddit|threads|email|whatsapp|whatsapp_groups`).

---

## Apêndice J — Compliance por canal (obrigatório antes de ligar cada Fase outbound)

| Canal | Requisito | Onde vive no plano | Consequência de violar |
|-------|-----------|-------------------|------------------------|
| **Reddit** | User-Agent identificado, rate limit oficial, sem republicação integral, sem uso para spam/DM. | Fase 12.7 | Ban de token + IP + possível ação legal |
| **Threads** | App Review Meta aprovado com escopos corretos. 500 chars max. 250 req/24h no MVP. Publicações públicas. | Fase 14.2 | App suspenso, conta actor pode cair junto |
| **Email** | LGPD: opt-in duplo, direito de exclusão/portabilidade, rodapé com unsubscribe, DKIM/SPF/DMARC. Suppression list obedecida. | Fase 15.8 | Multas LGPD, blocking em provedores, reputação IP |
| **WhatsApp Cloud (individual)** | Opt-in explícito como entidade, janela 24h respeitada, templates aprovados fora da janela, opt-out imediato. | Fase 16.3 + Trigger 16.1.3 | Ban da conta WABA + Business Verification revogada |
| **WhatsApp Groups** | Groups API disponível na conta (17.1.1). Consentimento de participação ≠ opt-in para DM. Sem broadcast massivo. | Fase 17.1 + 17.6 | Ban de conta, expulsão de grupos |

---

## Apêndice K — Vocabulário canônico de `timeline_events.event_type`

Toda emissão de evento no sistema deve usar exatamente uma destas strings. CI valida por Zod enum + CHECK.

**Instagram:** `instagram.comment`, `instagram.follow`, `instagram.follow_back`, `instagram.like_received`, `instagram.mention`, `instagram.dm_inbound`, `instagram.dm_outbound`, `instagram.story_view`, `instagram.reply_public`, `instagram.reply_private`.

**Threads:** `threads.publication`, `threads.reply_inbound`, `threads.reply_outbound`, `threads.engagement`, `threads.repost`, `threads.quote`.

**Email:** `email.subscribed`, `email.double_optin_confirmed`, `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.replied`, `email.bounced`, `email.complained`, `email.unsubscribed`.

**WhatsApp:** `whatsapp.opt_in`, `whatsapp.opt_out`, `whatsapp.message_inbound`, `whatsapp.message_outbound`, `whatsapp.template_sent`, `whatsapp.status_delivered`, `whatsapp.status_read`, `whatsapp.group_join`, `whatsapp.group_leave`, `whatsapp.group_message_inbound`, `whatsapp.group_message_outbound`.

**Reddit:** `reddit.evidence_collected` (não gera lead — só liga se identidade existir por outro canal).

**Sistema/decisão:** `system.identity_verified`, `system.identity_merge`, `system.contact_blocked`, `system.nba_recommended`, `system.nbc_decided`, `system.score_recomputed`, `system.flow_entered`, `system.flow_exited`.

**Conversão:** `conversion.purchase`, `conversion.lead_form`, `conversion.dm_reply`, `conversion.follow_back`.

---

## Apêndice L — Padrões de UI/UX específicos da expansão multi-canal

Estende o **Apêndice I** do plano-mestre. Novos patterns em `packages/ui-bridge/patterns/`:

- **`ChannelBadge`** — chip com ícone + cor do canal (Instagram roxo/rosa, Threads preto/branco, Email azul, WhatsApp verde, Reddit laranja).
- **`ContentItemCard`** — card canônico mostrando thesis + hook + status + linhas de variants por canal.
- **`VariantPreview`** — preview visual do variant no canal alvo (mockup do post IG, cartão Threads, template email, balão WA).
- **`MarketSignalCard`** — card do radar com label + velocity + mini-sparkline + status chip.
- **`IdentityStrip`** — strip horizontal no header do lead mostrando todas identities com badges de verificação.
- **`ChannelTimeline`** — timeline vertical multi-canal com ícones e cores por canal.
- **`NbaWithChannel`** — versão do `SuggestedActionCard` que mostra **canal escolhido** + probabilidade + rationale.
- **`ContactPolicyIndicator`** — semáforo (verde/amarelo/vermelho) por canal indicando se lead pode ser contatado agora.
- **`OptinEvidenceCard`** — mostra fonte + timestamp + evidência do opt-in (audit visual).
- **`FlowCanvas`** — canvas React Flow para desenhar `email_flows` (Passo 15.7.2).
- **`GroupPolicyForm`** — form para editar `whatsapp_groups.policy`.

**Novas rotas em `apps/web/`:**
- `/content-items` + `/content-items/[id]` (Fase 11.4)
- `/market-radar` (Fase 12.6)
- `/theses` (Fase 13.4)
- `/email-flows` + editor (Fase 15.7)
- `/communities` (Fase 17.5)
- Aba "Merges pendentes" em `/timeline` (Fase 18.4.3)
- Aba "Contact Policies" em `/configs` (Fase 19.5.3)

---

## Governança da execução deste prompt

1. **Cada Fase entra atrás de feature flag** e passa por 7 dias em observação antes da próxima ligar.
2. **Cada Passo tem DoD.** Se DoD não pode ser cumprido, escalonar ao usuário com evidência (nunca pular ou marcar como concluído por conveniência).
3. **Compliance (Apêndice J) é bloqueante.** Nenhum canal outbound liga sem o check do compliance associado documentado e verde.
4. **Testes de integração ponta-a-ponta são obrigatórios** para: gerar `content_item` → todas variants publicadas → timeline unificada → scores atualizados → NBA + NBC → Contact Policy → execução no canal escolhido → attribution.
5. **Todo desvio de contrato/versão de provider** (Reddit ToS, Threads limits, WhatsApp Groups disponibilidade) precisa update no CHANGELOG e no plano-mestre — nunca só em um.
6. **Aprovação humana obrigatória** para toda saída de qualquer canal novo até 30 dias após ligar, mesmo depois disso mantém-se para casos sensíveis (mesmo critério do Princípio 6).
7. **CI verde** em todas as PRs (design-system-no-regression + workspace-quality + testes novos por fase).

## Anexo — Comandos de sanity check contínuos (soma ao anexo do `finalizacao-completa-prompt.md`)

```bash
# no diretório plataforma/
pnpm --filter @plataforma/reddit-api test
pnpm --filter @plataforma/threads-api test
pnpm --filter @plataforma/whatsapp-cloud test
pnpm --filter @plataforma/email-provider test
pnpm --filter @plataforma/channel-router test
pnpm --filter @plataforma/web build            # verifica novas rotas
pnpm exec drizzle-kit check                    # checa migrations 0002..0008 aplicáveis
node scripts/whatsapp-groups-availability-check.mjs   # antes de Fase 17
```

Cada agente que executar uma Fase deve rodar este bloco antes de começar e só prosseguir com verde.
