# Plano de Consolidação de Workers — Prospector

> **Versão:** 2.0 — revisada contra o código real em 20/08/2026
> **Substitui:** `implementation_plan.md` (Antigravity/Gemini)
> **Objetivo:** reduzir 41 processos de worker para 6 grupos de domínio, sem perder o control plane existente.

---

## 0. Correções ao plano anterior

O plano v1 partiu de três premissas que **não se confirmam no código**. Elas estão corrigidas aqui antes de qualquer passo de execução.

### 0.1 `discovery` e `enrichment` NÃO são stubs

O plano v1 mediu apenas `src/index.ts` e concluiu "570 chars — só `export spec + createWorker(spec)`". A medição ignorou `src/main.ts`, que é o entrypoint real (`"start": "tsx src/main.ts"`).

| Worker | `index.ts` | `main.ts` | Realidade |
|---|---|---|---|
| `discovery` | 3.302 | **14.849** | Exa + Apify + Bright Data, reserva de budget, `provider_observations`, outlier MAD, `review_inbox` |
| `enrichment` | **17.929** | 123 | Lógica completa em `index.ts`; `main.ts` é só bootstrap |

**Consequência:** o passo 3 do plano v1 ("Implementar `discovery` e `enrichment`") é **removido**. Não há stub a escrever. Escrever um novo `discovery` sobrescreveria a integração de providers já em produção.

> [!WARNING]
> Nenhum passo deste plano deve reescrever `workers/discovery/src/main.ts` ou `workers/enrichment/src/index.ts`. Eles apenas mudam de processo hospedeiro.

### 0.2 O mapa estava incompleto — 39 de 41

`QUEUE_NAMES` (`packages/shared/src/index.ts:323-365`) tem **41 filas**, e `workers/` tem **41 pastas**. O plano v1 mapeou 39. Ficaram de fora:

- `extraction` — 12.995 chars, usa `@plataforma/browser` (Playwright)
- `news-radar` — 20.068 chars, tem scheduler gerenciado (`news-radar-rss-15m-v1`)

Ambos estão alocados neste plano.

### 0.3 `whatsapp-group-manager` não existe mais

A "questão aberta" nº 4 do plano v1 está resolvida: o nome **não está** em `QUEUE_NAMES`. Não há stub a criar nem entrada a remover. Questão encerrada.

### 0.4 O risco que o plano v1 não viu

O `src/index.ts` proposto no plano v1 instancia `new Worker(...)` diretamente do BullMQ. Isso **contorna `runWorker()`** (`packages/queue/src/runtime.ts`), que hoje é o control plane inteiro de cada worker:

| Responsabilidade de `runWorker()` | O que quebra se for contornado |
|---|---|
| `checkWorkerEnabled()` lê `worker_settings.enabled` a cada 5s → `pause()`/`resume()` | **O botão liga/desliga da UI para de funcionar** |
| `startWorkerHeartbeat()` grava em `worker_heartbeats` | **Dead-man alerta falso-positivo para as 41 filas** |
| `INSERT/UPDATE worker_runs` | Histórico de execução some da tela de Automações |
| `UPDATE worker_commands SET status='completed'` | Comandos `run_now` ficam presos em `pending` para sempre |
| `UPDATE worker_settings SET last_execution_at, items_processed, last_error` | KPIs de operação zeram |
| Backlog gauge (`getJobCounts` a cada 15s) | Métricas de fila somem do Prometheus |
| `SET LOCAL app.actor_type = 'automation'` | Auditoria de RLS perde o ator |

**Consequência:** consolidar sem antes generalizar `runWorker()` para múltiplas filas destrói silenciosamente todo o trabalho do control plane feito em 19/08. Isso vira a **Etapa 0 bloqueante** deste plano.

---

## 1. Arquitetura alvo — 6 grupos

O plano v1 propunha 5 grupos. Este propõe **6**, separando os workers que carregam Chromium.

**Justificativa da separação:** 5 workers dependem de `@plataforma/browser` (`engagement`, `extraction`, `follower-mining`, `live-monitor`, `search-mining`) e montam os volumes `chromium_profiles` e `snapshots_tmp`. Um OOM de Chromium mata o processo inteiro. Se eles compartilharem processo com filas leves, **um crash de Playwright derruba 8 filas de IO que nada têm a ver com browser**. Isolar custa 1 container e limita o raio de explosão.

```
     [Exa / Apify / Bright Data / Reddit / RSS]      [Meta API / WhatsApp Cloud webhooks]
                        ↓                                            ↓
              ┌─────────┴─────────┐                      ┌───────────┴───────────┐
              │   worker-intel    │                      │  worker-engagement    │
              │   (8 filas, IO)   │                      │  (7 filas, webhooks)  │
              └─────────┬─────────┘                      └───────────┬───────────┘
                        │                                            │
              ┌─────────┴─────────┐                                  │
              │  worker-browser   │ ← isolado: Chromium              │
              │  (5 filas, RAM++) │                                  │
              └─────────┬─────────┘                                  │
                        └──────────────┬─────────────────────────────┘
                                       ↓
                        ┌──────────────┴──────────────┐
                        │      worker-analytics       │  ← qualifica, pontua, decide
                        │      (9 filas, CPU/SQL)     │
                        └──────────────┬──────────────┘
                                       ↓
                        ┌──────────────┴──────────────┐
                        │       worker-content        │  ← LLM, gera variantes
                        │       (7 filas, LLM)        │
                        └──────────────┬──────────────┘
                                       ↓
                        ┌──────────────┴──────────────┐
                        │     worker-distributor      │  ← outbound + aprovação humana
                        │     (5 filas, rate-limit)   │
                        └─────────────────────────────┘
```

### 1.1 Mapa completo — 41/41 filas

| Grupo | Filas | Perfil | Réplicas iniciais |
|---|---|---|---|
| **`worker-intel`** (8) | `adaptive-crawler`, `audience-overlap`, `collab-discovery`, `competitive-intel`, `discovery`, `mention-monitor`, `news-radar`, `reddit-intelligence` | IO / HTTP externo | 1 |
| **`worker-browser`** (5) | `engagement`, `extraction`, `follower-mining`, `live-monitor`, `search-mining` | Chromium, RAM alta | 1 |
| **`worker-analytics`** (9) | `alerts`, `community-map`, `conversion-tracking`, `data-quality`, `enrichment`, `nba-engine`, `next-best-channel`, `scoring`, `source-roi` | CPU / SQL pesado | 1 |
| **`worker-content`** (7) | `classification`, `content-item-orchestrator`, `content-opportunity`, `conversation-agent`, `dm-copilot`, `private-reply`, `threads-adapter` | LLM / embeddings | 1 |
| **`worker-distributor`** (5) | `email-events-consumer`, `email-flow-engine`, `publisher`, `threads-publisher`, `whatsapp-outbound` | Outbound, rate-limit | 1 |
| **`worker-engagement`** (7) | `contact-policy-engine`, `identity-resolver`, `meta-sync`, `meta-webhook-consumer`, `reciprocity-detector`, `retention-tracker`, `whatsapp-inbound` | Webhooks / merge | 1 |
| | **41** | | **6 containers** |

> [!NOTE]
> **`engagement` foi movido** de `worker-engagement` (plano v1) para `worker-browser`. Ele faz follow via Playwright — a restrição física (Chromium + `chromium_profiles`) pesa mais que a afinidade de domínio. `worker-engagement` fica com o que é de fato webhook/CRM.

> [!IMPORTANT]
> **Réplicas começam em 1 para todos.** O plano v1 sugeria 2 réplicas em `intel` e `content` já no primeiro deploy. Ver Etapa 5, Fase 5.1 — há uma interação não verificada entre réplicas e a limpeza de heartbeat da migration 0027 que precisa ser testada antes.

---

## ETAPA 0 — Fundação do runtime multi-fila (bloqueante)

> Nenhum passo de qualquer outra etapa pode começar antes desta fechar. Esta etapa **não muda comportamento em produção** — só adiciona capacidade ao pacote `@plataforma/queue`.

### Fase 0.1 — `runWorkers()` no `@plataforma/queue`

**Passo 0.1.1 — Extrair o corpo de `runWorker()` para uma função por fila**

- Arquivo: `packages/queue/src/runtime.ts`
- Refatorar o `boot()` interno para `bootQueue(queue, processJob, shared)`, onde `shared` carrega `{ connection, database }` compartilhados.
- `runWorker()` (singular) passa a ser um wrapper de uma fila só, chamando `bootQueue`.
- **Critério de aceite:** os 41 workers atuais continuam funcionando sem nenhuma mudança em `main.ts`. `pnpm -r test` verde.

**Passo 0.1.2 — Criar `runWorkers()` (plural)**

```typescript
// packages/queue/src/runtime.ts
export function runWorkers(
  entries: Array<{ queue: QueueName; processJob: (job: WorkerJob<any>) => Promise<WorkerResult> }>,
  options?: { concurrency?: Partial<Record<QueueName, number>> },
): { isRunning: () => boolean; queues: QueueName[] }
```

Requisitos obrigatórios, um por linha da tabela de risco em §0.4:

- [ ] **Uma conexão Redis compartilhada** entre todas as filas do processo (hoje é uma por processo; consolidar 8 filas não pode virar 8 conexões).
- [ ] **Um pool Postgres compartilhado** — `createDatabase()` chamado uma única vez.
- [ ] **Um heartbeat por fila**, não por processo. `worker_heartbeats` continua com uma linha por `(worker, instance_id)`, mantendo o dead-man e a UI intactos.
- [ ] **Um `checkWorkerEnabled()` por fila** — o `pause()`/`resume()` precisa ser individual, senão desligar `scoring` na UI desliga também `alerts`.
- [ ] **Um único timer de reconciliação** (5s) que varre todas as filas do processo, em vez de N timers.
- [ ] **Concorrência por fila**, via `options.concurrency`. Hoje `WORKER_CONCURRENCY` é global do processo — com 8 filas juntas, um valor único é errado para todas.
- [ ] **Shutdown gracioso agregado** — `SIGTERM` fecha todas as filas em paralelo, depois o pool e a conexão, uma vez só.

- **Critério de aceite:** teste de integração que sobe `runWorkers()` com 3 filas fake, desliga uma via `worker_settings`, e verifica que só ela pausou e que as outras duas seguem batendo heartbeat.

**Passo 0.1.3 — Preservar o contrato de erro/DLQ**

- Verificar que `observeFailures()` (`packages/queue/src/index.ts:59`) continua funcionando por fila. Ele abre uma `QueueEvents` própria — confirmar que não há vazamento de conexão quando 8 filas rodam no mesmo processo.
- **Critério de aceite:** falha forçada em uma fila gera linha em DLQ e `worker_runs.status='failed'`, sem afetar as demais filas do processo.

### Fase 0.2 — Testes do runtime consolidado

**Passo 0.2.1** — Suite em `packages/queue/src/runtime.test.ts` cobrindo: boot múltiplo, pause seletivo, resume seletivo, heartbeat por fila, shutdown agregado, concorrência por fila.

**Passo 0.2.2** — Teste de regressão: `runWorker()` singular produz exatamente o mesmo efeito observável de antes (mesmas escritas em `worker_runs`, `worker_settings`, `worker_heartbeats`).

- **Critério de aceite da Etapa 0:** `pnpm --filter @plataforma/queue test` verde + `pnpm -r typecheck` verde, com zero alteração em `workers/`.

---

## ETAPA 1 — Scaffold dos 6 grupos

> Os 41 workers antigos continuam intactos e rodando. Esta etapa só **adiciona** pacotes novos.

### Fase 1.1 — Estrutura dos pacotes

**Passo 1.1.1 — Criar os 6 `package.json`**

Para cada grupo `G` em {intel, browser, analytics, content, distributor, engagement}:

```
workers/_groups/G/
  package.json      → "@plataforma/worker-G", start: "tsx src/main.ts"
  tsconfig.json
  src/main.ts       → composição via runWorkers()
```

Dependências: `@plataforma/queue`, `@plataforma/db`, `@plataforma/shared` + os pacotes de worker que ele hospeda (`workspace:*`).

> [!NOTE]
> Usar `workers/_groups/` mantém os 41 diretórios atuais intocados durante toda a migração. O glob do Dockerfile (`{./workers/**}...`) já cobre subdiretórios — verificar no Passo 3.2.1.

**Passo 1.1.2 — Registrar no `pnpm-workspace.yaml`**

- Confirmar que o glob atual (`workers/*`) alcança `workers/_groups/*`. Se não, adicionar entrada.
- **Critério de aceite:** `pnpm install` resolve os 6 pacotes novos; `pnpm -r typecheck` verde.

### Fase 1.2 — Padrão de composição

**Passo 1.2.1 — Escrever `src/main.ts` de referência (grupo `analytics`)**

O ponto-chave do design: **cada worker existente já exporta `spec` e o processor**. O grupo apenas os importa e compõe — nenhum handler é reescrito.

```typescript
// workers/_groups/analytics/src/main.ts
import { runWorkers } from '@plataforma/queue/runtime'
import { spec as scoringSpec, processJob as scoring } from '@plataforma/worker-scoring'
import { spec as alertsSpec, processJob as alerts } from '@plataforma/worker-alerts'
// ... demais 7

runWorkers([
  { queue: scoringSpec.queue, processJob: scoring },
  { queue: alertsSpec.queue,  processJob: alerts },
  // ...
], {
  concurrency: { scoring: 4, alerts: 1, 'data-quality': 1 },
})
```

**Passo 1.2.2 — Auditar a fronteira `index.ts` vs `main.ts` dos 41 workers**

Nem todos seguem o mesmo padrão (ver §0.1): alguns têm a lógica em `index.ts` com `main.ts` fino (`enrichment`), outros têm wiring pesado em `main.ts` (`discovery`, com clientes Exa/Apify/BrightData e um `repository` de ~200 linhas).

Para cada um dos 41, classificar:

| Padrão | Ação na consolidação |
|---|---|
| **A** — lógica em `index.ts`, `main.ts` fino | Import direto. Zero refactor. |
| **B** — wiring pesado em `main.ts` | Extrair o wiring para `createHandler()` exportado de `index.ts`; `main.ts` vira fino. |

- Produzir a tabela A/B completa antes de qualquer migração de grupo.
- **Critério de aceite:** planilha/tabela com os 41 classificados, commitada em `docs/`. Sem isso, a Etapa 2 vai bater em surpresas fila a fila.

> [!WARNING]
> O padrão B é onde mora o trabalho real desta consolidação. `discovery` (14.8k em `main.ts`), `meta-sync` (18.2k) e `identity-resolver` (13.1k) provavelmente exigem extração. **Não estime a Etapa 2 antes de fechar o Passo 1.2.2.**

---

## ETAPA 2 — Migração grupo a grupo

> Ordem por risco crescente. Cada fase é independente e reversível. Ao fim de cada fase o sistema está consistente: o grupo novo existe e é testável, os 41 antigos ainda rodam.

Cada fase segue os mesmos 4 passos:

| Passo | Ação |
|---|---|
| **.1** | Aplicar padrão B (extrair `createHandler`) nos workers do grupo que precisarem |
| **.2** | Escrever `src/main.ts` do grupo compondo todas as filas |
| **.3** | `pnpm --filter @plataforma/worker-G typecheck && test` |
| **.4** | `docker compose up worker-G --no-deps` local, com os antigos **parados**, e validar |

Validação do passo `.4`, para todo grupo:
- [ ] Todas as filas do grupo aparecem em `worker_heartbeats` com `state='running'`
- [ ] Desligar uma fila na UI pausa **só** ela
- [ ] `run_now` numa fila do grupo completa e fecha o `worker_commands`
- [ ] Uma falha forçada gera DLQ + `worker_runs.status='failed'`
- [ ] Uso de RAM do container dentro do orçamento do VPS

### Fase 2.1 — `worker-analytics` (9 filas) — risco baixo
Sem browser, sem outbound, sem LLM. É o grupo de calibração do padrão. **Faça este primeiro e não avance até ele estar 100%.**

### Fase 2.2 — `worker-distributor` (5 filas) — risco médio
Todas as filas têm `outbound: true` + `assertHumanApproval`.
- [ ] Confirmar que `WORKERS_DEFAULT_ENABLED` e os flags por fila continuam sendo lidos via `worker_settings` no runtime consolidado
- [ ] **Nenhum envio real** durante o teste — validar com `worker_settings.enabled=false` e checar que a fila fica `paused`

### Fase 2.3 — `worker-content` (7 filas) — risco médio
LLM-bound. Atenção a concorrência: 7 filas chamando LLM no mesmo processo podem estourar rate limit do provider.
- [ ] Definir `concurrency` por fila conservadora (1–2)
- [ ] Verificar o ponto de integração `content-item-orchestrator` → `/creative-bridge` (Design System via `@plataforma/ui-bridge`) segue intacto

### Fase 2.4 — `worker-engagement` (7 filas) — risco alto
Webhooks Meta/WhatsApp + `identity-resolver` (merge/rollback de identidades).
- [ ] `meta-sync` (18.2k) e `identity-resolver` (13.1k) provavelmente são padrão B — extração cuidadosa
- [ ] Webhooks têm requisito de latência: medir p95 antes e depois

### Fase 2.5 — `worker-intel` (8 filas) — risco alto
`discovery` reserva budget em transação (`organic_budgets`, `organic_budget_reservations`).
- [ ] `discovery` é padrão B pesado — extrair `provider` + `repository` para `index.ts` sem alterar uma linha de SQL
- [ ] Validar que reserva/refund de budget segue atômico no processo compartilhado
- [ ] `news-radar` tem scheduler gerenciado — confirmar que `MANAGED_SCHEDULER_CONFIG` segue apontando para a fila certa (o nome da fila não muda, então deve ser transparente — **verificar mesmo assim**)

### Fase 2.6 — `worker-browser` (5 filas) — risco mais alto
Chromium compartilhado entre 5 filas no mesmo processo.
- [ ] Volumes `chromium_profiles` e `snapshots_tmp` montados
- [ ] **Testar OOM deliberadamente:** matar o Chromium e confirmar que o processo se recupera ou reinicia limpo
- [ ] Definir `concurrency: 1` para todas — paralelismo de browser no mesmo processo é a receita de OOM
- [ ] Medir RSS do container sob carga das 5 filas simultâneas

---

## ETAPA 3 — Infraestrutura

### Fase 3.1 — `docker-compose.yml`

**Passo 3.1.1 — Adicionar os 6 services, mantendo os 41**
- Arquivo: `docker/docker-compose.yml`
- Os 6 novos nascem com `profiles: ["consolidated"]` para não subirem por padrão. Isso permite `docker compose --profile consolidated up worker-analytics` sem tocar no fluxo atual.

**Passo 3.1.2 — Ajustar a âncora `x-worker`**
- Hoje a âncora monta `chromium_profiles` e `snapshots_tmp` em **todos** os workers. Criar uma segunda âncora `x-worker-browser` com os volumes, e limpar a base — só `worker-browser` precisa deles.
- **Critério de aceite:** `docker compose config` válido; os 5 grupos sem browser não montam volumes de Chromium.

**Passo 3.1.3 — Replicar em `docker-compose.production.yml`**
- Espelhar as mudanças. Verificar divergências entre os dois arquivos antes.

> [!WARNING]
> Regra do `CLAUDE.md`: **nunca adicionar `env_file` para o Dokploy** — ele apaga a pasta antes de cada deploy e injeta as env vars pelo painel. A âncora atual usa `env_file: ../.env`; confirmar qual dos dois compose o Dokploy consome antes de mexer.

### Fase 3.2 — Build

**Passo 3.2.1 — Validar os globs do Dockerfile**
- `docker/worker.Dockerfile` usa `pnpm install --filter "{./workers/**}..."`. Confirmar que `workers/_groups/*` entra no filtro.
- `pnpm check:runtime-deps` roda no build — confirmar que os pacotes novos passam.

**Passo 3.2.2 — `worker-entrypoint.sh`**
- O script extrai o nome do pacote de `@plataforma/worker-*` só para logar. Funciona igual com `@plataforma/worker-analytics`. **Nenhuma mudança necessária** — apenas confirmar.

### Fase 3.3 — Observabilidade

**Passo 3.3.1 — Prometheus**
- `docker/prometheus.yml` provavelmente faz scrape por serviço. Com 6 alvos em vez de 41, ajustar targets.
- Garantir que as métricas continuem **rotuladas por fila**, não por processo — senão o dashboard perde granularidade.

**Passo 3.3.2 — Grafana**
- Revisar dashboards que agrupem por container. Trocar a dimensão de `container` para `queue`.

**Passo 3.3.3 — Dead-man / alertas**
- `installPlatformSchedulers` mantém `dead-man-v1` a cada 30s. O `checkDeadMan` em `workers/alerts/src/main.ts` lê `worker_settings` e pula os desabilitados.
- **Critério de aceite:** com os 6 grupos no ar e os 41 antigos parados, zero alerta `worker_dead_man` falso.

---

## ETAPA 4 — Corte para produção

### Fase 4.1 — Ensaio completo em staging

**Passo 4.1.1** — Subir os 6 grupos com os 41 antigos **parados**, ambiente completo.
**Passo 4.1.2** — Rodar por 24h com carga sintética.
**Passo 4.1.3** — Comparar contra a baseline: throughput por fila, p95, RAM total, contagem de erros.

- **Critério de aceite:** as 41 filas processam; RAM total ≤ baseline; zero regressão de p95 > 20%.

### Fase 4.2 — Estratégia de corte

> [!IMPORTANT]
> **Nem big-bang, nem gradual — corte por grupo.**
>
> O plano v1 recomendava big-bang. O problema: como os nomes de fila não mudam, se o worker novo e o antigo estiverem no ar ao mesmo tempo, **os dois consomem a mesma fila** — processamento duplicado, não coexistência segura. Isso torna a migração "gradual com feature flags" do plano v1 inviável sem um flag de posse por fila.
>
> A alternativa segura: cortar **um grupo por vez**. Para o grupo G, parar os N containers antigos e subir o container novo, na mesma janela. Cada corte é atômico por grupo e reversível em segundos.

**Passo 4.2.1 — Ordem de corte:** analytics → distributor → content → engagement → intel → browser (mesma ordem da Etapa 2).

**Passo 4.2.2 — Procedimento por grupo:**
1. `docker compose stop` nos workers antigos do grupo
2. `docker compose up -d worker-G`
3. Verificar `worker_heartbeats` — todas as filas do grupo com `state='running'` em ≤ 60s
4. Observar 30 min: zero dead-man, backlog drenando

**Passo 4.2.3 — Rollback (por grupo, ≤ 2 min):**
1. `docker compose stop worker-G`
2. `docker compose up -d` nos antigos do grupo
3. Jobs em voo são retomados pelo BullMQ (as filas são as mesmas)

### Fase 4.3 — Limpeza

> [!WARNING]
> **Só depois de 7 dias estáveis com os 6 grupos em produção.**

**Passo 4.3.1** — Remover os 41 services de `docker-compose.yml` e `docker-compose.production.yml`.
**Passo 4.3.2** — Remover `profiles: ["consolidated"]` dos 6.
**Passo 4.3.3** — Remover os `main.ts` dos 41 workers antigos, mantendo `index.ts` (que virou biblioteca de handler). **Não apagar as pastas** — os grupos importam delas.
**Passo 4.3.4** — Rodar `pnpm -r typecheck` e a suite completa.

---

## ETAPA 5 — Pós-corte

### Fase 5.1 — Réplicas (só depois de estabilizar)

> [!WARNING]
> **Verificar antes de habilitar `replicas: 2`.** A migration 0027 adicionou limpeza de heartbeat em `createPostgresHeartbeatStore.beat()`:
> ```sql
> DELETE FROM worker_heartbeats
> WHERE worker=$1 AND instance_id<>$2 AND last_beat_at < now() - interval '10 minutes'
> ```
> Com réplicas, cada instância apaga heartbeats das outras que estejam > 10min paradas. Como o intervalo de batida é 30s, réplicas saudáveis não se apagam — **mas uma réplica pausada ou lenta será removida da tabela**, e o dead-man pode reagir de forma inesperada. Testar explicitamente antes.

**Passo 5.1.1** — Teste com 2 réplicas em staging, uma delas pausada via `worker_settings`, por 30 min. Confirmar comportamento do heartbeat e do dead-man.
**Passo 5.1.2** — Se OK: habilitar `replicas: 2` em `worker-intel` e `worker-content`.
**Passo 5.1.3** — Se não OK: ajustar o predicado da limpeza para não remover instâncias pausadas, e retestar.

### Fase 5.2 — Documentação (obrigatória, mesmo work unit)

Conforme a política de documentação do projeto:

**Passo 5.2.1** — `Docs/ARQUITETURA-UNIFICADA.md`: substituir a topologia de 41 processos pela de 6 grupos.
**Passo 5.2.2** — `Docs/PROSPECTOR.md`: nova seção sobre agrupamento de workers e o mapa 41/41.
**Passo 5.2.3** — `plataforma/docs/runbooks/automations.md`: como ligar/desligar uma fila agora que N filas dividem um container.
**Passo 5.2.4** — `plataforma/docs/runbooks/worker-dead-man.md`: diagnóstico com processos compartilhados.
**Passo 5.2.5** — `Docs/DEPLOY-DOKPLOY.md`: novos nomes de service.
**Passo 5.2.6** — `plataforma/CHANGELOG.md` + `Docs/README.md` (índice).

---

## Resumo executivo

| | Plano v1 | Este plano |
|---|---|---|
| Grupos | 5 | **6** (Chromium isolado) |
| Filas mapeadas | 39/41 | **41/41** |
| Stubs a implementar | 2 (`discovery`, `enrichment`) | **0** — ambos já implementados |
| Pré-requisito de runtime | não identificado | **Etapa 0 bloqueante** (`runWorkers()`) |
| Estratégia de corte | big-bang | **corte por grupo**, reversível em ≤2 min |
| Réplicas | 2 desde o início | **1**, até validar interação com migration 0027 |
| Etapas / Fases / Passos | 6 passos lineares | **6 etapas / 18 fases / ~50 passos** |

### Caminho crítico

```
Etapa 0 (runWorkers)  ──► Passo 1.2.2 (auditoria A/B dos 41)  ──► Etapa 2 (6 fases)
       BLOQUEANTE              DEFINE O ESFORÇO REAL                MIGRAÇÃO
```

**As duas coisas a fazer antes de estimar prazo:**
1. Fechar a Etapa 0 — sem `runWorkers()`, a consolidação destrói o control plane.
2. Fechar o Passo 1.2.2 — a auditoria A/B dos 41 workers é o que revela o volume real de refactor. `discovery`, `meta-sync` e `identity-resolver` sozinhos somam ~46k chars de wiring que pode precisar de extração.

---

## Questões que continuam abertas

> [!IMPORTANT]
> **Nomes dos grupos.** `worker-intel`, `worker-browser`, `worker-analytics`, `worker-content`, `worker-distributor`, `worker-engagement`. O nome `worker-browser` descreve tecnologia, não domínio — alternativas: `worker-scraping`, `worker-headless`.

> [!IMPORTANT]
> **`engagement` no grupo browser.** Aceita a separação por restrição física (Chromium), ou prefere manter afinidade de domínio em `worker-engagement` e aceitar o risco de OOM cruzado?

> [!NOTE]
> **`workers/_groups/` vs `workers/`.** O prefixo `_` evita colisão com os 41 nomes atuais durante a migração. Depois da Fase 4.3, vale renomear para `workers/groups/` ou promover para a raiz de `workers/`.

> [!NOTE]
> **Orçamento de RAM do VPS.** Nenhum passo deste plano mede o consumo atual dos 41 containers. Vale coletar a baseline (`docker stats`) antes da Etapa 2 — é o número que justifica ou não o esforço inteiro.
