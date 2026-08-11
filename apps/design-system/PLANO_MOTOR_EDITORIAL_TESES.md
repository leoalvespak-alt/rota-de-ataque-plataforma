# Plano de implementacao — Motor editorial automatizado baseado em teses

> Documento gerado a partir da auditoria do projeto Gerador-React em 2026-08-03.
> Adaptado ao estado real do repositorio, tecnologias existentes e padroes ja estabelecidos.
> Projetado para execucao sequencial pelo Codex com autorizacao maxima.

---

## Resumo da auditoria

### O que ja existe e DEVE ser preservado

| Camada | Tecnologia | Detalhes |
|--------|-----------|---------|
| Frontend | Vite 8 + React 19 + TypeScript 6 | SPA, path alias `@/` |
| Estilizacao | Tailwind CSS 4 + Style Dictionary 5 | Tokens em `src/tokens/`, build em `src/tokens/build/` |
| UI | Radix UI + shadcn/ui + Lucide | Componentes em `src/components/ui/` |
| Editor rico | Tiptap 3 | 7 extensoes instaladas |
| Estado | Zustand 5 + Immer + zundo | 9 stores em `src/stores/` |
| Maquina de estados | XState 5 | `src/machines/creativeWorkflow.ts` |
| ORM | Drizzle ORM 0.45 + drizzle-kit | Schema em `src/db/schema.ts`, migrations em `drizzle/` |
| Banco | PostgreSQL 16 | Docker, db `rota_design`, user `rota` |
| Cache/Fila | Redis 7 + BullMQ 6 | 4 filas: render, export, image-gen, text-gen |
| Storage | MinIO (S3) | Adapter em `src/server/storage/StorageAdapter.ts` |
| IA texto | DeepSeek + Claude + OpenAI-compat | Provider em `src/lib/ai/providers/` |
| IA imagem | fal.ai FLUX/schnell | Provider em `src/lib/ai/providers/FalImageProvider.ts` |
| Interfaces IA | TextProvider, ImageProvider, EmbeddingProvider, VisionProvider | `src/lib/ai/providers/types.ts` |
| Templates | 26 templates (12 square, 6 portrait, 8 carousel) | `src/features/templates/registry.ts` |
| Renderizacao | Playwright + html-to-image + html2canvas | Server em `src/server/render/` |
| Exportacao | PNG, JPEG, HTML, PPTX | `src/lib/export/` |
| Processamento img | Sharp | `src/server/images/imageProcessor.ts` |
| Animacao | GSAP + Motion | `src/lib/animation/` |
| Graficos | D3 + ECharts | `src/features/charts/` |
| Diagramas | Mermaid + React Flow + ELK.js | `src/features/diagrams/` |
| Validacao | Zod 4 | Usado em schemas de templates e formularios |
| Observabilidade | Sentry + logger proprio | `src/lib/observability/` |
| Testes | Vitest + Testing Library + Playwright + axe-core | Config em `vite.config.ts` |
| Feature flags | 22 flags (todas false por padrao) | `src/domain/featureFlags.ts` |
| Workflow | draft -> in-review -> approved -> published | `src/domain/workflow.ts` |
| DnD | dnd-kit | Reordenacao de slides |
| Deploy | VPS em `design.rotadeataque.com.br` | Scripts em `deploy/` |

### Tabelas existentes no banco (17 tabelas)

`users`, `brands`, `brandTokens`, `templates`, `templateVersions`, `creatives`, `creativeVersions`, `decks`, `slides`, `documents`, `documentPages`, `assets`, `assetVariants`, `renders`, `exports`, `aiProviders`, `aiGenerations`, `settings`, `auditLogs`

### O que NAO existe e precisa ser criado

- Servidor API HTTP (nao existe Express, Fastify, Hono, tRPC)
- Tabelas do motor editorial (teses, argumentos, planos, briefs, etc.)
- pgvector e embeddings
- Base de conhecimento (upload, chunking, indexacao)
- Planejador editorial
- Pipeline de geracao de conteudo
- Sistema de similaridade e repeticao
- Calendario editorial
- Prompt management
- Avaliacao automatica de qualidade
- Geracao em lote com orquestracao
- Dashboard de progresso de lotes

### O que existe parcialmente e deve ser ESTENDIDO

- BullMQ (4 filas; precisara de ~10 filas novas para o motor editorial)
- Interfaces de IA (EmbeddingProvider ja declarada mas sem implementacao)
- Workflow (estados limitados; precisara de estados adicionais)
- Feature flags (precisara de novas flags para modulos do motor)
- Schema do banco (precisara de ~30 tabelas novas)
- AI Store (precisara de campos para embedding provider)

---

## Decisoes arquiteturais

### 1. Servidor API

Criar um servidor Hono em `src/server/api/` com as seguintes justificativas:
- Hono e leve, moderno, tipado e compativel com Node.js
- Se integra naturalmente com Drizzle e BullMQ
- Suporta middleware (auth, rate limiting, logging)
- O frontend fara chamadas HTTP para `localhost:3001` em dev

Alternativa: se Hono causar problemas de compatibilidade, usar Express.

### 2. ORM unico

Usar exclusivamente Drizzle ORM. Nao introduzir Prisma.

### 3. pgvector

Habilitar a extensao `pgvector` no PostgreSQL para busca vetorial.
Usar `drizzle-orm/pg-core` com tipo `vector` customizado.

### 4. Embeddings

Implementar `EmbeddingProvider` (interface ja existe em `src/lib/ai/providers/types.ts`).
Provedores iniciais: DeepSeek embeddings ou OpenAI embeddings (text-embedding-3-small).

### 5. Modulos novos

Todos os modulos do motor editorial ficam em:
- `src/features/editorial/` (UI)
- `src/domain/editorial/` (logica de dominio)
- `src/server/editorial/` (servicos de servidor)
- `src/db/editorial-schema.ts` (tabelas novas, importado pelo schema principal)

---

## FASE 0 — Infraestrutura base

> Objetivo: preparar o terreno para o motor editorial sem quebrar nada existente.

### Etapa 0.1 — Servidor API

**Passo 0.1.1** — Instalar dependencias do servidor API.

```bash
npm install hono @hono/node-server cors
```

**Passo 0.1.2** — Criar `src/server/api/index.ts` com servidor Hono.

```typescript
// src/server/api/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'

const app = new Hono()

app.use('*', cors({ origin: ['http://localhost:5173'] }))

app.get('/health', (c) => c.json({ status: 'ok' }))

// Rotas serao adicionadas por fase
// import { editorialRoutes } from './routes/editorial'
// app.route('/api/editorial', editorialRoutes)

const port = Number(process.env.API_PORT ?? 3001)
serve({ fetch: app.fetch, port })
console.log(`API server running on port ${port}`)
```

**Passo 0.1.3** — Criar `src/server/api/db.ts` com instancia do Drizzle para o servidor.

```typescript
// src/server/api/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

export const db = drizzle(process.env.DATABASE_URL!, { schema })
```

**Passo 0.1.4** — Adicionar script `api:dev` ao `package.json`.

```json
{
  "scripts": {
    "api:dev": "tsx watch src/server/api/index.ts"
  }
}
```

Instalar `tsx` como devDependency se nao estiver instalado:
```bash
npm install -D tsx
```

**Passo 0.1.5** — Adicionar `API_PORT=3001` ao `.env.example`.

**Passo 0.1.6** — Criar `src/lib/api/client.ts` com fetch wrapper para o frontend.

```typescript
// src/lib/api/client.ts
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}
```

**Passo 0.1.7** — Adicionar `VITE_API_URL=http://localhost:3001` ao `.env.example`.

### Etapa 0.2 — pgvector

**Passo 0.2.1** — Atualizar `docker-compose.yml` para usar imagem com pgvector.

Trocar a imagem do servico `postgres` de `postgres:16-alpine` para `pgvector/pgvector:pg16`.

**Passo 0.2.2** — Criar migration SQL para habilitar pgvector.

Criar arquivo `drizzle/0001_enable_pgvector.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Passo 0.2.3** — Criar helper de tipo vector para Drizzle.

Criar `src/db/pgvector.ts`:

```typescript
// src/db/pgvector.ts
import { customType } from 'drizzle-orm/pg-core'

export const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverParam: string }>({
    dataType: () => `vector(${dimensions})`,
    toDriver: (value: number[]) => `[${value.join(',')}]`,
    fromDriver: (value: string) => {
      const str = value.replace(/[\[\]]/g, '')
      return str.split(',').map(Number)
    },
  })(name)
```

### Etapa 0.3 — Feature flags do motor editorial

**Passo 0.3.1** — Adicionar novas feature flags em `src/domain/featureFlags.ts`.

Adicionar ao array `FEATURE_IDS`:
- `'editorial-engine'`
- `'editorial-theses'`
- `'editorial-knowledge-base'`
- `'editorial-planner'`
- `'editorial-batch'`
- `'editorial-calendar'`
- `'editorial-similarity'`
- `'editorial-quality'`
- `'editorial-prompts'`

### Etapa 0.4 — Estrutura de diretorios

**Passo 0.4.1** — Criar a seguinte estrutura de diretorios (criar com arquivos `index.ts` vazios exportando `{}`):

```
src/domain/editorial/
src/features/editorial/
src/features/editorial/theses/
src/features/editorial/knowledge/
src/features/editorial/planner/
src/features/editorial/batch/
src/features/editorial/calendar/
src/features/editorial/review/
src/server/editorial/
src/server/api/routes/
```

### Etapa 0.5 — Validacao

- Rodar `npm run build` — deve compilar sem erros.
- Rodar `npm run lint` — sem erros novos.
- Rodar `npm run typecheck` (ou `tsc --noEmit`) — sem erros.
- Verificar que a aplicacao existente abre normalmente no navegador.

---

## FASE 1 — Modelo de dominio e schema do banco

> Objetivo: criar todas as tabelas do motor editorial usando Drizzle ORM.

### Etapa 1.1 — Schema editorial

**Passo 1.1.1** — Criar `src/db/editorial-schema.ts` com todas as tabelas do motor editorial.

Tabelas a criar (todas com `uuid` como PK, `timestamp` para datas, convencao snake_case):

#### Grupo: Teses

```
editorial_theses
  id, title, slug (unique), summary, core_statement, full_text,
  status ('draft'|'active'|'archived'), priority (int), weight (numeric),
  tone (varchar), depth_level (varchar), audience_stage (varchar),
  allowed_cta (text[]), recommended_formats (text[]),
  vocabulary (text[]), forbidden_words (text[]),
  beliefs_to_reinforce (text[]), beliefs_to_combat (text[]),
  common_errors (text[]),
  tags (text[]), version (int default 1),
  created_at, updated_at

editorial_thesis_versions
  id, thesis_id (FK), version (int), snapshot (jsonb),
  changed_by (varchar), change_reason (text), created_at

editorial_thesis_arguments
  id, thesis_id (FK), type ('primary'|'secondary'),
  title, content, position (int), usage_count (int default 0),
  created_at

editorial_thesis_objections
  id, thesis_id (FK), objection, response,
  frequency ('high'|'medium'|'low'), position (int),
  usage_count (int default 0), created_at

editorial_thesis_examples
  id, thesis_id (FK), title, content, type ('example'|'analogy'|'case_study'),
  position (int), usage_count (int default 0), created_at

editorial_thesis_evidence
  id, thesis_id (FK), title, content, source_url (text nullable),
  source_name (varchar), position (int), created_at

editorial_thesis_relations
  id, thesis_a_id (FK), thesis_b_id (FK),
  relation_type ('supports'|'contrasts'|'extends'|'requires'),
  created_at
```

#### Grupo: Base de conhecimento

```
knowledge_documents
  id, title, type ('text'|'markdown'|'pdf'|'transcript'|'faq'|'note'|'research'),
  original_filename (varchar nullable), storage_key (varchar nullable),
  content_text (text), word_count (int), language (varchar default 'pt-BR'),
  thesis_id (FK nullable), tags (text[]),
  status ('pending'|'processing'|'indexed'|'failed'),
  version (int default 1), hash (varchar),
  created_at, updated_at

knowledge_chunks
  id, document_id (FK), chunk_index (int),
  title (varchar nullable), content (text), normalized_content (text),
  chunk_type ('heading'|'paragraph'|'list'|'quote'|'section'),
  section_path (text nullable), page_or_section (varchar nullable),
  tags (text[]), thesis_id (FK nullable),
  language (varchar default 'pt-BR'), hash (varchar),
  token_count (int), version (int default 1),
  created_at

knowledge_embeddings
  id, chunk_id (FK), model_name (varchar), model_version (varchar),
  embedding (vector(1536)),
  created_at
```

#### Grupo: Taxonomia editorial

```
editorial_intents
  id, name (varchar unique), label (varchar), description (text nullable),
  position (int), active (boolean default true)

editorial_angles
  id, name (varchar unique), label (varchar), description (text nullable),
  position (int), active (boolean default true)

editorial_hooks
  id, pattern (text), category ('curiosity'|'tension'|'contrast'|'promise'|'risk'|'authority'|'specificity'|'objection'|'identification'|'novelty'),
  usage_count (int default 0), last_used_at (timestamp nullable),
  active (boolean default true), created_at

editorial_depth_levels
  id, name (varchar unique), label (varchar), position (int)
```

#### Grupo: Planejamento editorial

```
editorial_campaigns
  id, title, description (text nullable),
  start_date (date), end_date (date),
  status ('draft'|'active'|'completed'|'archived'),
  preset (varchar nullable),
  config (jsonb — pesos, regras, limites),
  created_at, updated_at

editorial_plans
  id, campaign_id (FK), title,
  period_start (date), period_end (date),
  total_items (int),
  config (jsonb — quantidades por formato, pesos por tese, regras),
  status ('draft'|'approved'|'generating'|'completed'|'failed'),
  approved_at (timestamp nullable), approved_by (varchar nullable),
  created_at, updated_at

editorial_plan_items
  id, plan_id (FK), position (int),
  scheduled_date (date nullable),
  format ('post'|'carousel'|'story'|'slide'|'document'),
  thesis_id (FK), intent_id (FK nullable), angle_id (FK nullable),
  hook_strategy (varchar nullable),
  depth_level (varchar nullable), audience_stage (varchar nullable),
  cta (text nullable), visual_direction (text nullable),
  core_argument_id (FK nullable, ref editorial_thesis_arguments),
  template_suggestion (varchar nullable),
  sequence_position (int nullable),
  status ('planned'|'brief_generated'|'content_generated'|'reviewing'|'approved'|'rejected'|'published'),
  created_at, updated_at
```

#### Grupo: Conteudo gerado

```
content_briefs
  id, plan_item_id (FK), thesis_id (FK),
  format (varchar), intent (varchar), angle (varchar),
  audience_stage (varchar), hook_strategy (varchar),
  core_argument (text), supporting_points (text[]),
  evidence_ids (uuid[]), cta (text nullable),
  visual_direction (text), avoid (text[]),
  status ('draft'|'validated'|'rejected'),
  validation_errors (text[] nullable),
  thesis_version (int), created_at

content_items
  id, plan_item_id (FK nullable), brief_id (FK nullable),
  thesis_id (FK), format (varchar),
  copy_data (jsonb — estrutura depende do formato: headline, body, slides[], etc.),
  status ('draft'|'generating'|'reviewing'|'needs_revision'|'ready_for_approval'|'approved'|'rejected'|'scheduled'|'published'|'archived'|'failed'),
  template_id (varchar nullable),
  render_id (uuid nullable, ref renders),
  quality_score (jsonb nullable),
  similarity_score (numeric nullable),
  generation_model (varchar nullable),
  generation_cost (numeric nullable),
  version (int default 1),
  created_at, updated_at

content_versions
  id, content_item_id (FK), version (int),
  copy_data (jsonb), template_id (varchar nullable),
  change_reason (text nullable),
  created_at

content_reviews
  id, content_item_id (FK), reviewer (varchar),
  action ('approve'|'reject'|'request_revision'),
  reason_code (varchar nullable — 'repetitive'|'superficial'|'off_thesis'|'wrong_tone'|'factual'|'visual'|'cta'|'title'|'format'|'other'),
  comment (text nullable),
  created_at

content_similarity_scores
  id, content_item_id (FK), compared_to_id (FK),
  semantic_score (numeric), lexical_score (numeric nullable),
  ngram_overlap (numeric nullable),
  layer (varchar — 'title'|'hook'|'argument'|'structure'|'full'),
  created_at
```

#### Grupo: Controle de repeticao

```
content_usage_ledger
  id, content_item_id (FK),
  thesis_id (FK nullable), argument_id (FK nullable),
  objection_id (FK nullable), example_id (FK nullable),
  evidence_id (FK nullable), angle_id (FK nullable),
  hook_id (FK nullable), intent_id (FK nullable),
  template_used (varchar nullable), cta_used (text nullable),
  keywords (text[]),
  used_at (date), created_at
```

#### Grupo: Geracao e jobs

```
generation_jobs
  id, plan_id (FK nullable), campaign_id (FK nullable),
  type ('plan_campaign'|'generate_brief'|'validate_brief'|'generate_copy'|'review_copy'|'calculate_similarity'|'rewrite_content'|'select_template'|'generate_visual_prompt'|'generate_image'|'render_creative'|'export_creative'|'finalize_item'|'finalize_campaign'),
  status ('pending'|'active'|'completed'|'failed'|'cancelled'|'paused'),
  input_data (jsonb), output_data (jsonb nullable),
  parent_job_id (FK nullable, self-ref),
  priority (int default 0),
  attempts (int default 0), max_attempts (int default 3),
  error (text nullable),
  provider (varchar nullable), model (varchar nullable),
  input_tokens (int nullable), output_tokens (int nullable),
  cost (numeric nullable), duration_ms (int nullable),
  bullmq_job_id (varchar nullable),
  created_at, started_at (timestamp nullable), completed_at (timestamp nullable)

prompt_templates
  id, name (varchar unique), type (varchar),
  template (text), variables (text[]),
  output_schema (jsonb nullable),
  version (int default 1), active (boolean default true),
  created_at, updated_at

prompt_versions
  id, prompt_template_id (FK), version (int),
  template (text), variables (text[]),
  output_schema (jsonb nullable),
  created_at
```

**Passo 1.1.2** — Importar o schema editorial no schema principal.

Editar `src/db/schema.ts` — adicionar no final:

```typescript
export * from './editorial-schema'
```

**Passo 1.1.3** — Atualizar `drizzle.config.ts` para incluir o novo schema.

Se o campo `schema` aceitar array, mudar para:
```typescript
schema: ['./src/db/schema.ts', './src/db/editorial-schema.ts']
```
Caso contrario, o re-export do passo anterior ja resolve.

**Passo 1.1.4** — Gerar migration com `npx drizzle-kit generate`.

**Passo 1.1.5** — Revisar a migration gerada. Verificar que:
- Nenhuma tabela existente foi alterada
- A extensao vector esta habilitada antes de qualquer coluna vector
- Todas as FKs apontam para tabelas corretas
- Indices foram criados para: thesis slug, status, tags; document hash; chunk document_id; plan campaign_id status; content_item thesis_id status format; usage_ledger thesis_id used_at; generation_jobs status type

**Passo 1.1.6** — Aplicar migration com `npx drizzle-kit push` ou `npx drizzle-kit migrate`.

### Etapa 1.2 — Tipos de dominio

**Passo 1.2.1** — Criar `src/domain/editorial/types.ts` com tipos TypeScript derivados do schema.

Usar `typeof editorial_theses.$inferSelect` para gerar tipos de leitura.
Criar tipos de escrita com `typeof editorial_theses.$inferInsert`.
Criar enums TypeScript para os valores fixos (status, format, type).

**Passo 1.2.2** — Criar `src/domain/editorial/schemas.ts` com schemas Zod para validacao de input.

Schemas necessarios:
- `createThesisSchema`
- `updateThesisSchema`
- `createArgumentSchema`
- `createObjectionSchema`
- `createExampleSchema`
- `createEvidenceSchema`
- `createDocumentSchema`
- `createCampaignSchema`
- `createPlanSchema`
- `createPlanItemSchema`
- `createBriefSchema`
- `createContentItemSchema`
- `createReviewSchema`

### Etapa 1.3 — Validacao

- Rodar `npx drizzle-kit generate` — sem erros.
- Rodar `tsc --noEmit` — sem erros de tipo.
- Verificar que o Docker Compose sobe com `docker compose up -d`.
- Verificar que as tabelas foram criadas: `docker compose exec postgres psql -U rota -d rota_design -c '\dt'`.

---

## FASE 2 — Seeds e taxonomia editorial

> Objetivo: popular as tabelas de taxonomia com dados iniciais.

### Etapa 2.1 — Seed de taxonomia

**Passo 2.1.1** — Criar `scripts/seed-editorial-taxonomy.ts`.

Inserir dados iniciais para:

**Intencoes** (editorial_intents):
educar, provocar, posicionar, quebrar-objecao, demonstrar-autoridade, gerar-identificacao, apresentar-prova, explicar-metodo, alertar, comparar, inspirar, converter, convidar, resumir, aprofundar

**Angulos** (editorial_angles):
erro-comum, mito, verdade-desconfortavel, passo-a-passo, comparacao, antes-e-depois, lista, bastidor, diagnostico, consequencia, causa, objecao, prova, estudo-de-caso, analogia, checklist, framework, opiniao-forte, previsao, alerta, pergunta, historia, contrarian-take, faq, resumo, aplicacao-pratica

**Niveis de profundidade** (editorial_depth_levels):
awareness, introdutorio, intermediario, avancado, revisao, opiniao, prova, execucao

**Passo 2.1.2** — Adicionar script `seed:editorial` ao `package.json`:

```json
{
  "scripts": {
    "seed:editorial": "tsx scripts/seed-editorial-taxonomy.ts"
  }
}
```

**Passo 2.1.3** — Executar seed: `npm run seed:editorial`.

### Etapa 2.2 — Seed de prompt templates

**Passo 2.2.1** — Criar `scripts/seed-editorial-prompts.ts`.

Inserir templates de prompt iniciais para:
- `structure-thesis` — estruturar tese a partir de texto colado
- `generate-plan` — gerar plano editorial mensal
- `generate-brief` — gerar brief de conteudo
- `generate-post` — gerar post estatico
- `generate-carousel` — gerar carrossel
- `generate-story` — gerar stories
- `review-content` — revisar conteudo gerado
- `rewrite-content` — reescrever conteudo reprovado
- `generate-visual-direction` — gerar direcao visual
- `generate-image-prompt` — gerar prompt de imagem
- `adapt-format` — adaptar conteudo entre formatos

Cada template deve ter placeholders `{{variavel}}` e schema de saida JSON definido.

**Passo 2.2.2** — Executar seed: `npm run seed:prompts` (criar script no package.json).

---

## FASE 3 — API: rotas do motor editorial

> Objetivo: criar endpoints REST para todas as operacoes do motor editorial.

### Etapa 3.1 — CRUD de teses

**Passo 3.1.1** — Criar `src/server/api/routes/theses.ts` com Hono.

Endpoints:
- `GET /` — listar teses (com filtros: status, tags, busca textual)
- `GET /:id` — detalhe da tese com argumentos, objecoes, exemplos, evidencias, relacoes
- `POST /` — criar tese (validar com Zod schema)
- `PUT /:id` — atualizar tese (criar versao automaticamente)
- `POST /:id/duplicate` — duplicar tese
- `PATCH /:id/status` — ativar/arquivar
- `GET /:id/usage` — estatisticas de uso
- `GET /:id/content` — conteudos gerados a partir desta tese
- `GET /:id/gaps` — lacunas tematicas (angulos/intencoes nao usados)

**Passo 3.1.2** — Criar `src/server/api/routes/thesis-arguments.ts`.

Endpoints CRUD para argumentos, objecoes, exemplos, evidencias, relacoes.
Cada entidade associada a uma tese via `thesis_id`.

**Passo 3.1.3** — Criar `src/server/api/routes/thesis-structurer.ts`.

Endpoint:
- `POST /structure` — recebe texto-base, chama LLM para propor estrutura (tese central, argumentos, exemplos, objecoes, angulos, hooks, formatos). Retorna proposta sem salvar.
- `POST /structure/apply` — salva a proposta aceita pelo usuario.

### Etapa 3.2 — Base de conhecimento

**Passo 3.2.1** — Criar `src/server/api/routes/knowledge.ts`.

Endpoints:
- `GET /documents` — listar documentos (filtros: type, thesis_id, status, tags)
- `POST /documents` — criar documento (texto ou markdown direto)
- `POST /documents/upload` — upload de arquivo (PDF, DOCX, MD, TXT)
- `GET /documents/:id` — detalhe com chunks
- `DELETE /documents/:id` — remover documento e chunks/embeddings
- `POST /documents/:id/reindex` — reprocessar e reindexar
- `GET /search` — busca hibrida (texto + vetorial + filtros SQL)

**Passo 3.2.2** — Criar `src/server/editorial/ingest.ts` — pipeline de ingestao.

Implementar o pipeline:
```
upload -> validacao -> extracao -> normalizacao -> segmentacao -> metadados -> embeddings -> persistencia -> indexacao
```

Chunking inteligente:
- Detectar headings (Markdown/PDF)
- Preservar paragrafos inteiros
- Preservar listas e citacoes
- Overlap controlado (10-15%)
- Tamanho configuravel (padrao: 500 tokens)
- Cada chunk guarda: documento, secao, titulo, tipo, tags, tese, idioma, hash, versao

**Passo 3.2.3** — Criar `src/server/editorial/embedding.ts` — servico de embeddings.

Implementar `EmbeddingService` que usa a interface `EmbeddingProvider` existente.
Criar `OpenAIEmbeddingProvider` em `src/lib/ai/providers/OpenAIEmbeddingProvider.ts`.
Funcoes:
- `embedText(text)` — gerar embedding de um texto
- `embedMany(texts)` — gerar embeddings em lote
- `embedChunks(chunks)` — gerar e persistir embeddings de chunks
- `reindex(modelVersion)` — reindexar todos os chunks

**Passo 3.2.4** — Criar `src/server/editorial/search.ts` — busca hibrida.

Implementar busca que combina:
1. Filtros SQL (thesis_id, tags, type, date range)
2. Full-text search PostgreSQL (`to_tsvector`, `to_tsquery`)
3. Similaridade vetorial (`<=>` operator do pgvector)
4. Score de recencia (decaimento temporal)
5. Score de uso (preferir conteudo pouco usado)
6. Prioridade da tese

Retornar resultados ranqueados com score combinado.

### Etapa 3.3 — Planejador editorial

**Passo 3.3.1** — Criar `src/server/api/routes/campaigns.ts`.

Endpoints CRUD para campanhas.

**Passo 3.3.2** — Criar `src/server/api/routes/plans.ts`.

Endpoints:
- `POST /generate` — gerar plano editorial a partir de config (teses, periodo, quantidades, regras)
- `GET /:id` — detalhe do plano com itens
- `PUT /:id` — atualizar plano
- `PATCH /:id/approve` — aprovar plano
- `PATCH /:id/items/:itemId` — atualizar item do plano
- `POST /:id/generate-content` — iniciar geracao do lote

**Passo 3.3.3** — Criar `src/server/editorial/planner.ts` — algoritmo de distribuicao.

Implementar distribuicao deterministica:
1. Calcular slots por formato a partir das quantidades solicitadas
2. Distribuir teses por peso/prioridade
3. Garantir distancia minima entre conteudos da mesma tese
4. Variar angulos e intencoes (consultar ledger de uso)
5. Alternar profundidades conforme proporcao solicitada
6. Respeitar calendario e campanhas
7. Selecionar argumentos priorizando os menos usados
8. Sugerir hooks baseados na categoria e verificando nao-repeticao
9. Sugerir template visual baseado em formato + intencao + densidade

Usar LLM apenas para REFINAR o plano apos a distribuicao deterministica, nao para gera-lo.

### Etapa 3.4 — Pipeline de geracao

**Passo 3.4.1** — Criar `src/server/editorial/pipeline.ts` — pipeline de geracao de conteudo.

Implementar as 10 etapas como funcoes puras encadeadas:
1. `buildContext(planItem)` — recuperar tese, argumentos, objecoes, exemplos, docs relevantes, conteudos recentes, design constraints
2. `generateBrief(context)` — gerar brief estruturado via LLM
3. `validateBrief(brief)` — validar aderencia, variedade, nao-repeticao, formato
4. `generateCopy(brief, context)` — gerar conteudo no formato correto (post/carousel/story/slide/document)
5. `reviewCopy(copy, brief, context)` — avaliador LLM separado
6. `calculateSimilarity(copy, recentContent)` — embeddings + n-grams + lexical
7. `rewriteIfNeeded(copy, reviewResult, similarityResult)` — reescrever se reprovado (max 3 tentativas)
8. `selectTemplate(copy, format, thesis)` — escolher template compativel
9. `renderPreview(copy, template)` — gerar preview
10. `persist(copy, brief, review, similarity, template, render)` — salvar tudo

**Passo 3.4.2** — Criar `src/server/editorial/copy-generators/` com geradores por formato.

Arquivos:
- `post.ts` — gera headline, apoio, legenda, CTA, direcao visual
- `carousel.ts` — gera capa, slides, conclusao, CTA, legenda, notas visuais
- `story.ts` — gera frame(s), texto, interacao, enquete, CTA
- `slide.ts` — gera outline, slides por tipo, notas, referencias
- `document.ts` — gera estrutura, secoes, conteudo, referencias

Cada gerador usa o prompt template correspondente do banco.

### Etapa 3.5 — Similaridade e repeticao

**Passo 3.5.1** — Criar `src/server/editorial/similarity.ts`.

Implementar calculo de similaridade em multiplas camadas:
1. Similaridade semantica (embeddings, cosine distance)
2. Similaridade lexical (Jaccard sobre tokens)
3. Sobreposicao de n-grams (bi/trigrams)
4. Repeticao de titulo (fuzzy match)
5. Repeticao de hook (fuzzy match)
6. Repeticao de argumento (por ID no ledger)
7. Repeticao de estrutura (comparar JSON structure do copy_data)
8. Repeticao de template (mesmo template em sequencia)

Thresholds configuraveis:
```
semantica > 0.86 => bloquear
semantica 0.78-0.86 => revisar
lexical elevada => reescrever
mesmo angulo no mesmo mes => bloquear (exceto se overridden)
mesmo template em sequencia => evitar
```

**Passo 3.5.2** — Criar `src/server/editorial/ledger.ts`.

Servico para registrar e consultar uso:
- `recordUsage(contentItem)` — registrar no ledger
- `getRecentUsage(thesisId, days)` — consultar uso recente
- `getAngleUsage(thesisId, month)` — angulos usados no mes
- `getHookUsage(thesisId, month)` — hooks usados no mes
- `getTemplateUsage(format, lastN)` — templates recentes
- `getArgumentUsage(thesisId)` — argumentos por frequencia de uso

### Etapa 3.6 — Geracao em lote

**Passo 3.6.1** — Criar novas filas BullMQ em `src/server/queue/editorialQueues.ts`.

Filas:
- `editorial-plan` — planejar campanha
- `editorial-brief` — gerar/validar brief
- `editorial-copy` — gerar copy
- `editorial-review` — revisar copy
- `editorial-similarity` — calcular similaridade
- `editorial-rewrite` — reescrever
- `editorial-template` — selecionar template
- `editorial-visual` — gerar prompt de imagem
- `editorial-render` — renderizar criativo
- `editorial-finalize` — finalizar item/campanha

Cada fila com: retries, exponential backoff, removeOnComplete, removeOnFail.

**Passo 3.6.2** — Criar workers em `src/server/editorial/workers/`.

Cada worker processa os jobs da sua fila e encadeia o proximo job:
```
plan_campaign -> generate_brief (para cada item) -> validate_brief -> generate_copy -> review_copy -> calculate_similarity -> (rewrite_content?) -> select_template -> render_creative -> finalize_item -> finalize_campaign
```

**Passo 3.6.3** — Criar `src/server/api/routes/batch.ts`.

Endpoints:
- `POST /start` — iniciar geracao em lote a partir de um plano aprovado
- `GET /:id/status` — status do lote (total, pendentes, gerando, aprovados, falhos, custo)
- `POST /:id/pause` — pausar lote
- `POST /:id/resume` — retomar lote
- `POST /:id/cancel` — cancelar lote
- `POST /:id/retry-failed` — reprocessar falhas
- `POST /:id/approve-all` — aprovar todos os prontos

### Etapa 3.7 — Revisao e aprovacao

**Passo 3.7.1** — Criar `src/server/api/routes/reviews.ts`.

Endpoints:
- `GET /pending` — conteudos pendentes de revisao
- `POST /:contentId/approve` — aprovar
- `POST /:contentId/reject` — rejeitar (com motivo estruturado)
- `POST /:contentId/revision` — solicitar ajuste
- `POST /:contentId/regenerate` — regenerar (parcial ou total)
- `GET /:contentId/versions` — comparar versoes
- `POST /:contentId/rollback/:version` — restaurar versao anterior

### Etapa 3.8 — Avaliacao automatica de qualidade

**Passo 3.8.1** — Criar `src/server/editorial/quality.ts`.

Implementar `QualityScore`:
```typescript
type QualityScore = {
  thesisAlignment: number    // 0-1
  novelty: number            // 0-1
  clarity: number            // 0-1
  specificity: number        // 0-1
  hookStrength: number       // 0-1
  formatFit: number          // 0-1
  voiceConsistency: number   // 0-1
  factualGrounding: number   // 0-1
  repetitionRisk: number     // 0-1 (invertido: 1 = sem risco)
  overall: number            // 0-1 (media ponderada)
}
```

Combinar:
1. Regras deterministicas (comprimento, palavras proibidas, CTA presente)
2. Metricas de similaridade (do servico de similarity)
3. Avaliador LLM separado (usando prompt template `review-content`, modelo DIFERENTE do que gerou)
4. Feedback humano (motivos de rejeicao alimentam o score)

### Etapa 3.9 — Prompt management

**Passo 3.9.1** — Criar `src/server/api/routes/prompts.ts`.

Endpoints CRUD para prompt templates:
- Listar, detalhar, criar, atualizar, versionar
- Cada atualizacao cria uma nova versao
- Rollback para versao anterior
- Preview com variaveis de teste

### Etapa 3.10 — Registro na rota principal

**Passo 3.10.1** — Atualizar `src/server/api/index.ts` para registrar todas as rotas:

```typescript
import { thesesRoutes } from './routes/theses'
import { knowledgeRoutes } from './routes/knowledge'
import { campaignRoutes } from './routes/campaigns'
import { planRoutes } from './routes/plans'
import { batchRoutes } from './routes/batch'
import { reviewRoutes } from './routes/reviews'
import { promptRoutes } from './routes/prompts'
import { taxonomyRoutes } from './routes/taxonomy'

app.route('/api/theses', thesesRoutes)
app.route('/api/knowledge', knowledgeRoutes)
app.route('/api/campaigns', campaignRoutes)
app.route('/api/plans', planRoutes)
app.route('/api/batch', batchRoutes)
app.route('/api/reviews', reviewRoutes)
app.route('/api/prompts', promptRoutes)
app.route('/api/taxonomy', taxonomyRoutes)
```

### Etapa 3.11 — Validacao

- Rodar servidor API: `npm run api:dev` — sem erros.
- Testar `GET /health` retorna 200.
- Testar `GET /api/theses` retorna array vazio.
- Rodar `tsc --noEmit` — sem erros.

---

## FASE 4 — Frontend: Gestao de teses

> Objetivo: criar a interface de cadastro, edicao e gestao de teses.

### Etapa 4.1 — Navegacao

**Passo 4.1.1** — Adicionar tab `editorial` ao `useUiStore.ts`.

Adicionar `'editorial'` ao tipo de tab existente. Adicionar item no `AppShell.tsx` ou `AppHeader.tsx` para acessar a area editorial.

**Passo 4.1.2** — Criar `src/features/editorial/EditorialView.tsx`.

Componente principal com sub-navegacao interna:
- Teses
- Base de conhecimento
- Planejador
- Lote/Batch
- Calendario
- Revisao

### Etapa 4.2 — Lista de teses

**Passo 4.2.1** — Criar `src/features/editorial/theses/ThesesListView.tsx`.

Funcionalidades:
- Tabela com: titulo, status (badge colorido), prioridade, peso, tags, conteudos gerados (count), ultima atualizacao
- Filtros: status, tags, busca textual
- Ordenacao: prioridade, peso, recente, alfabetica
- Acoes: criar, editar, duplicar, ativar, arquivar
- Indicador visual de uso (barra de progresso relativa)

Usar componentes shadcn/ui existentes: Table, Badge, Button, Input, Select, DropdownMenu.

### Etapa 4.3 — Editor de tese

**Passo 4.3.1** — Criar `src/features/editorial/theses/ThesisEditorView.tsx`.

Formulario completo com abas:
1. **Geral**: titulo, slug (auto-gerado), resumo, tese central, status, prioridade, peso
2. **Texto completo**: editor Tiptap para o texto-base da tese
3. **Argumentos**: lista CRUD de argumentos (primarios e secundarios) com drag-and-drop para reordenar
4. **Objecoes**: lista CRUD de objecoes + respostas
5. **Exemplos e evidencias**: lista CRUD de exemplos, analogias, estudos de caso, evidencias
6. **Diretrizes**: tom, publico, estagio de consciencia, CTA, formatos, vocabulario, palavras proibidas, crencas
7. **Relacoes**: vincular com outras teses (supports, contrasts, extends, requires)
8. **Tags e configuracao**: tags, nivel de profundidade, relacoes com outras teses

Usar react-hook-form + Zod para validacao.
Usar Tiptap para campos de texto rico (texto completo).
Usar dnd-kit para reordenar argumentos/objecoes/exemplos.

### Etapa 4.4 — Assistente de estruturacao

**Passo 4.4.1** — Criar `src/features/editorial/theses/ThesisStructurer.tsx`.

Componente que:
1. Permite colar um texto-base (textarea ou Tiptap)
2. Botao "Estruturar com IA"
3. Chama `POST /api/theses/structure`
4. Exibe a proposta em formato editavel (accordion/cards)
5. Permite aceitar/rejeitar cada parte
6. Botao "Salvar como tese" chama `POST /api/theses/structure/apply`
7. Nada e salvo sem revisao do usuario

### Etapa 4.5 — Validacao

- Abrir a aplicacao no navegador.
- Navegar ate a area editorial.
- Criar uma tese de teste com todos os campos.
- Verificar que ela aparece na lista.
- Editar a tese e salvar — verificar versionamento.
- Duplicar a tese.
- Testar o assistente de estruturacao (requer chave de IA configurada).

---

## FASE 5 — Frontend: Base de conhecimento

> Objetivo: criar interface para upload e gestao de documentos da base de conhecimento.

### Etapa 5.1 — Lista de documentos

**Passo 5.1.1** — Criar `src/features/editorial/knowledge/KnowledgeListView.tsx`.

Funcionalidades:
- Lista de documentos com: titulo, tipo, status (badge), tese associada, tags, word count, data
- Filtros: tipo, status, tese, tags
- Upload de arquivos (usar react-dropzone existente)
- Acoes: visualizar, editar metadados, reindexar, excluir

### Etapa 5.2 — Upload e ingestao

**Passo 5.2.1** — Criar `src/features/editorial/knowledge/DocumentUploader.tsx`.

Componente de upload que:
1. Aceita texto, Markdown, PDF, TXT
2. Permite associar a uma tese (opcional)
3. Permite adicionar tags
4. Mostra progresso de ingestao (status: uploading -> processing -> indexing -> done)
5. Exibe chunks gerados apos processamento

### Etapa 5.3 — Busca

**Passo 5.3.1** — Criar `src/features/editorial/knowledge/KnowledgeSearch.tsx`.

Componente de busca hibrida:
1. Campo de busca textual
2. Filtros laterais (tipo, tese, tags, periodo)
3. Resultados com highlight de trechos relevantes
4. Score de relevancia visivel
5. Preview do chunk com contexto

### Etapa 5.4 — Validacao

- Upload de um documento Markdown de teste.
- Verificar que chunks foram gerados.
- Verificar que embeddings foram criados (consultar banco).
- Buscar por termo do documento e verificar resultados.

---

## FASE 6 — Frontend: Planejador editorial

> Objetivo: criar interface para gerar e revisar planos editoriais.

### Etapa 6.1 — Configuracao do plano

**Passo 6.1.1** — Criar `src/features/editorial/planner/PlannerConfigView.tsx`.

Interface de configuracao com:
1. **Selecao de teses**: checkboxes + sliders de peso
2. **Periodo**: date range picker (inicio e fim)
3. **Quantidades por formato**: inputs numericos para posts, carrosseis, stories, slides, documentos
4. **Regras**: 
   - Repeticao maxima de angulo por mes
   - Intervalo minimo entre conteudos da mesma tese
   - Distribuicao de profundidade (% baixa/media/alta)
   - Proporcao por intencao (educativo, autoridade, prova, objecao, inspiracao, conversao)
5. **Presets**: selecionar preset salvo (mes educativo, autoridade, lancamento, etc.)
6. **Configuracao avancada**: dias da semana, canais, campanhas, modelos, custos, nivel de revisao

### Etapa 6.2 — Visualizacao do plano

**Passo 6.2.1** — Criar `src/features/editorial/planner/PlanReviewView.tsx`.

Apos gerar o plano, mostrar:
1. **Tabela**: data, formato, tese, angulo, intencao, hook, CTA, template sugerido, status
2. **Calendario**: visualizacao mensal com cards nos dias
3. **Estatisticas**: distribuicao por tese (grafico de pizza), por formato (barras), por intencao, por profundidade
4. **Validacao**: alertas de repeticao, teses sub-representadas, dias vazios

Permitir:
- Editar itens individuais (mudar tese, angulo, data)
- Drag-and-drop para reordenar/trocar datas
- Aprovar plano
- Regenerar plano com config diferente

### Etapa 6.3 — Validacao

- Configurar um plano com 3 teses, 5 posts, 3 carrosseis, 5 stories.
- Gerar plano e verificar distribuicao.
- Verificar que nao ha repeticao excessiva.
- Aprovar plano.

---

## FASE 7 — Frontend: Geracao em lote e revisao

> Objetivo: criar interface para acompanhar geracao e revisar conteudos.

### Etapa 7.1 — Painel de lote

**Passo 7.1.1** — Criar `src/features/editorial/batch/BatchDashboard.tsx`.

Dashboard mostrando:
- Total de itens
- Barras de progresso por status: pendentes, gerando, revisando, renderizando, aprovados, rejeitados, falhos
- Custo estimado vs. real
- Tempo estimado vs. real
- Botoes: pausar, cancelar, regenerar falhas, aprovar em massa

### Etapa 7.2 — Revisao de conteudo

**Passo 7.2.1** — Criar `src/features/editorial/review/ContentReviewView.tsx`.

Interface de revisao:
1. Lista de conteudos pendentes de revisao
2. Para cada conteudo:
   - Preview do texto gerado (formatado por tipo: post, carrossel, story)
   - Preview visual com template aplicado (se renderizado)
   - Score de qualidade (barras/medidores por criterio)
   - Score de similaridade (comparacao com conteudos recentes)
   - Botoes: aprovar, rejeitar (com motivo), solicitar ajuste, regenerar
3. Filtros: formato, tese, status, score
4. Bulk actions: aprovar selecionados, rejeitar selecionados

**Passo 7.2.2** — Criar `src/features/editorial/review/ContentCompare.tsx`.

Componente para comparar versoes lado a lado (diff visual).

### Etapa 7.3 — Validacao

- Iniciar geracao em lote a partir de um plano aprovado.
- Acompanhar progresso no dashboard.
- Pausar e retomar lote.
- Revisar conteudos gerados.
- Aprovar e rejeitar conteudos.

---

## FASE 8 — Frontend: Calendario editorial

> Objetivo: criar visualizacao de calendario para os conteudos planejados e gerados.

### Etapa 8.1 — Calendario

**Passo 8.1.1** — Criar `src/features/editorial/calendar/CalendarView.tsx`.

Visualizacoes:
1. **Mes**: grid de dias com cards de conteudo (cor por tese, icone por formato)
2. **Semana**: timeline vertical com detalhes
3. **Lista**: tabela ordenada por data
4. **Kanban**: colunas por status (draft, planned, generating, reviewing, approved, published)

Filtros: tese, formato, canal, status, campanha.

Drag-and-drop apenas para datas e ordem, NAO para elementos visuais.

Usar componentes shadcn/ui e dnd-kit existentes.

### Etapa 8.2 — Validacao

- Visualizar conteudos no calendario mensal.
- Trocar visualizacao para semana, lista, kanban.
- Arrastar conteudo para outra data.

---

## FASE 9 — Integracao com templates visuais

> Objetivo: conectar o motor editorial ao sistema de templates existente.

### Etapa 9.1 — Selecao automatica de template

**Passo 9.1.1** — Criar `src/server/editorial/template-selector.ts`.

Algoritmo que seleciona template baseado em:
1. Formato do conteudo (post -> square, story -> portrait, carousel -> carousel)
2. Comprimento do texto (templates com mais/menos espaco)
3. Presenca de imagem (templates com/sem slot de imagem)
4. Intencao (templates mais visuais para inspiracao, mais textuais para educacao)
5. Densidade (templates densos vs. limpos)
6. Historico de uso (evitar repeticao)
7. Tese (peso visual da marca)

Usar o `registry.ts` existente e os `templateContracts.ts` para verificar compatibilidade.

### Etapa 9.2 — Fallback de conteudo

**Passo 9.2.1** — Criar `src/server/editorial/content-fit.ts`.

Quando o conteudo nao couber no template:
1. Ajustar quebras de texto
2. Tentar variante mais compacta
3. Reduzir conteudo (cortar supporting points)
4. Trocar template
5. Solicitar reescrita ao pipeline
6. Bloquear exportacao e sinalizar no review

### Etapa 9.3 — Validacao

- Gerar conteudo e verificar que template foi selecionado automaticamente.
- Verificar que nao repete mesmo template em sequencia.
- Testar com conteudo longo e verificar fallback.

---

## FASE 10 — Integracao com imagens

> Objetivo: conectar geracao de imagens ao fluxo editorial.

### Etapa 10.1 — Decisor de imagem

**Passo 10.1.1** — Criar `src/server/editorial/image-resolver.ts`.

Para cada conteudo, decidir:
1. Precisa de imagem? (baseado no template)
2. Buscar ativo existente por tags/embeddings (usar busca hibrida)
3. Se nao encontrar, gerar prompt de imagem baseado na tese + conteudo + direcao visual
4. Gerar imagem via fal.ai (fila `image-gen` existente)
5. Registrar uso do ativo ou geracao

### Etapa 10.2 — Validacao

- Gerar conteudo com template que requer imagem.
- Verificar que busca de ativo existente funciona.
- Se nao encontrar, verificar que imagem e gerada.

---

## FASE 11 — Persistencia e reaproveitamento

> Objetivo: garantir que todo conteudo pode ser reaberto, editado e reutilizado.

### Etapa 11.1 — Conteudo editavel

**Passo 11.1.1** — Criar `src/features/editorial/review/ContentEditor.tsx`.

Permitir:
- Editar copy diretamente (por campo)
- Trocar template
- Trocar imagem
- Alterar CTA
- Criar nova versao
- Duplicar conteudo
- Converter formato (post -> carrossel, carrossel -> stories, etc.)
- Reutilizar em outro mes (duplicar com nova data)

### Etapa 11.2 — Conversao entre formatos

**Passo 11.2.1** — Criar `src/server/editorial/format-converter.ts`.

Funcoes:
- `postToCarousel(contentItem)` — expandir post em slides
- `carouselToStories(contentItem)` — adaptar slides para stories
- `thesisToSlides(thesis)` — criar deck de slides a partir de tese
- `planToDocument(plan)` — gerar documento consolidado do plano

Usar prompt template `adapt-format` para assistir a conversao.

### Etapa 11.3 — Validacao

- Abrir conteudo aprovado e editar.
- Converter post em carrossel e verificar resultado.
- Duplicar conteudo para outro mes.

---

## FASE 12 — Provedores de IA e prompt management

> Objetivo: finalizar abstracoes de provedores e gerenciamento de prompts.

### Etapa 12.1 — Provedores adicionais

**Passo 12.1.1** — Implementar `OpenAIEmbeddingProvider` em `src/lib/ai/providers/OpenAIEmbeddingProvider.ts`.

Usar a interface `EmbeddingProvider` existente em `types.ts`.
Adicionar `embedMany(texts)` e `getDimensions()` como metodos extras.

**Passo 12.1.2** — Criar `src/lib/ai/providers/ModerationProvider.ts` (opcional).

Interface para moderacao de conteudo. Implementacao inicial pode ser regras deterministicas (palavras proibidas, limites).

**Passo 12.1.3** — Atualizar `useAIStore.ts` para incluir configuracao de embedding provider.

Adicionar campo `embeddingKey` e `embeddingModel` ao store.

### Etapa 12.2 — UI de prompts

**Passo 12.2.1** — Criar `src/features/editorial/prompts/PromptManagerView.tsx`.

Interface para gerenciar prompt templates:
- Lista de templates
- Editor com preview de variaveis
- Historico de versoes
- Comparacao entre versoes
- Rollback

### Etapa 12.3 — Validacao

- Verificar que embedding provider funciona com chave configurada.
- Criar e versionar um prompt template via UI.
- Verificar rollback de versao.

---

## FASE 13 — Observabilidade e dashboards

> Objetivo: adicionar metricas e dashboards internos.

### Etapa 13.1 — Metricas editoriais

**Passo 13.1.1** — Criar `src/server/editorial/metrics.ts`.

Registrar via logger/metrics existentes:
- Duracao do lote e por etapa
- Falhas e retries por tipo
- Custo por provider/model
- Tese mais/menos usada
- Similaridade media
- Taxa de aprovacao/rejeicao
- Taxa de regeneracao
- Templates mais usados
- Erros de render/embedding

**Passo 13.1.2** — Criar `src/features/editorial/analytics/AnalyticsDashboard.tsx`.

Dashboard simples com:
- Cards de resumo (total gerados, aprovados, rejeitados, custo total)
- Grafico de geracao por mes
- Distribuicao por tese
- Distribuicao por formato
- Score medio de qualidade
- Top argumentos usados
- Angulos sub-utilizados

Usar ECharts existente para graficos.

### Etapa 13.2 — Validacao

- Verificar que metricas sao registradas apos geracao.
- Verificar que dashboard mostra dados reais.

---

## FASE 14 — Testes

> Objetivo: garantir qualidade com testes em multiplas camadas.

### Etapa 14.1 — Testes unitarios

**Passo 14.1.1** — Criar testes em `tests/editorial/` (Vitest):

- `planner.test.ts` — distribuicao, pesos, distancia entre teses
- `similarity.test.ts` — calculo de similaridade, thresholds
- `ledger.test.ts` — registro e consulta de uso
- `template-selector.test.ts` — selecao de template
- `content-fit.test.ts` — fallback de conteudo
- `schemas.test.ts` — validacao Zod dos schemas
- `quality.test.ts` — calculo de quality score (parte deterministica)

### Etapa 14.2 — Testes de integracao

**Passo 14.2.1** — Criar testes de integracao em `tests/editorial/integration/`:

- `db.test.ts` — CRUD de teses, documentos, planos no banco real
- `embeddings.test.ts` — gerar e buscar embeddings (requer pgvector)
- `search.test.ts` — busca hibrida
- `queue.test.ts` — enfileirar e processar job

### Etapa 14.3 — Testes E2E

**Passo 14.3.1** — Criar testes E2E em `tests/editorial/e2e/` (Playwright):

- `thesis-crud.spec.ts` — cadastrar, editar, versionar tese
- `knowledge-upload.spec.ts` — upload e indexacao de documento
- `plan-generate.spec.ts` — gerar e aprovar plano
- `batch-generate.spec.ts` — gerar lote e revisar
- `review-flow.spec.ts` — aprovar, rejeitar, regenerar

### Etapa 14.4 — Testes de qualidade

**Passo 14.4.1** — Criar testes de qualidade em `tests/editorial/quality/`:

- `no-duplicate-titles.test.ts`
- `no-duplicate-hooks.test.ts`
- `angle-diversity.test.ts`
- `thesis-adherence.test.ts`
- `format-limits.test.ts`
- `design-system-compliance.test.ts`
- `job-idempotency.test.ts`
- `job-resume.test.ts`

### Etapa 14.5 — Validacao

- Rodar `npm run test` — todos os testes unitarios passam.
- Rodar testes de integracao com banco de teste.
- Rodar testes E2E com servidor rodando.

---

## FASE 15 — Documentacao

> Objetivo: criar documentacao completa do motor editorial.

### Etapa 15.1 — Documentos de arquitetura

**Passo 15.1.1** — Criar documentos em `docs/editorial-engine/`:

1. `00-current-state-audit.md` — auditoria do estado atual (baseado neste documento)
2. `01-domain-model.md` — modelo de dominio e entidades
3. `02-master-implementation-plan.md` — este plano de implementacao
4. `03-execution-checklist.md` — checklist de execucao
5. `04-rag-and-embeddings.md` — arquitetura de RAG e embeddings
6. `05-content-generation-pipeline.md` — pipeline de geracao
7. `06-quality-and-similarity.md` — qualidade e similaridade
8. `07-batch-processing.md` — processamento em lote
9. `08-user-workflows.md` — fluxos de uso
10. `09-data-model.md` — modelo de dados (ER diagram em Mermaid)
11. `10-final-report.md` — relatorio final

**Passo 15.1.2** — Atualizar `docs/architecture/README.md` com referencia ao motor editorial.

**Passo 15.1.3** — Atualizar `docs/architecture/` com novos documentos para os modulos adicionados.

### Etapa 15.2 — Validacao

- Verificar que todos os documentos foram criados.
- Verificar que links internos funcionam.
- Verificar que diagramas Mermaid renderizam.

---

## FASE 16 — Validacao final e build

> Objetivo: garantir que tudo funciona junto sem quebrar o que existia.

### Etapa 16.1 — Checklist final

- [ ] Aplicacao existente funciona normalmente (templates, editor, IA, renders, historico)
- [ ] Area editorial acessivel pela navegacao
- [ ] CRUD de teses funcional
- [ ] Versionamento de teses funcional
- [ ] Upload de documentos funcional
- [ ] Embeddings gerados e persistidos
- [ ] Busca hibrida retorna resultados relevantes
- [ ] Plano editorial gerado com distribuicao correta
- [ ] Plano pode ser revisado e aprovado
- [ ] Geracao em lote funcional
- [ ] Lote pode ser pausado e retomado
- [ ] Falhas podem ser reprocessadas
- [ ] Conteudos persistidos com brief, copy, fontes, avaliacao
- [ ] Sistema detecta repeticao
- [ ] Sistema varia angulos e hooks
- [ ] Templates selecionados automaticamente
- [ ] Criativos renderizados via templates existentes
- [ ] Conteudos podem ser reabertos e editados
- [ ] Aprovacao e rejeicao funcional
- [ ] Conversao entre formatos funcional
- [ ] Custos e modelos registrados
- [ ] Testes passam
- [ ] Build compila sem erros
- [ ] Nenhuma chave exposta no codigo
- [ ] Historico anterior continua funcional
- [ ] Feature flags controlam ativacao dos modulos

### Etapa 16.2 — Build e lint

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

Todos devem passar sem erros.

---

## Resumo de dependencias a instalar

```bash
# Servidor API
npm install hono @hono/node-server

# Dev tools
npm install -D tsx

# pgvector (se necessario driver especifico)
# O drizzle-orm ja suporta PostgreSQL; pgvector e extensao do banco

# Processamento de PDF (para base de conhecimento)
npm install pdf-parse

# Processamento de DOCX (opcional)
npm install mammoth
```

Nao instalar pacotes ja presentes no projeto. Verificar `package.json` antes de cada `npm install`.

---

## Resumo de arquivos a criar

### Servidor / Backend
```
src/server/api/index.ts
src/server/api/db.ts
src/server/api/routes/theses.ts
src/server/api/routes/thesis-arguments.ts
src/server/api/routes/thesis-structurer.ts
src/server/api/routes/knowledge.ts
src/server/api/routes/campaigns.ts
src/server/api/routes/plans.ts
src/server/api/routes/batch.ts
src/server/api/routes/reviews.ts
src/server/api/routes/prompts.ts
src/server/api/routes/taxonomy.ts
src/server/editorial/ingest.ts
src/server/editorial/embedding.ts
src/server/editorial/search.ts
src/server/editorial/planner.ts
src/server/editorial/pipeline.ts
src/server/editorial/similarity.ts
src/server/editorial/ledger.ts
src/server/editorial/quality.ts
src/server/editorial/template-selector.ts
src/server/editorial/content-fit.ts
src/server/editorial/image-resolver.ts
src/server/editorial/format-converter.ts
src/server/editorial/metrics.ts
src/server/editorial/workers/
src/server/editorial/copy-generators/post.ts
src/server/editorial/copy-generators/carousel.ts
src/server/editorial/copy-generators/story.ts
src/server/editorial/copy-generators/slide.ts
src/server/editorial/copy-generators/document.ts
src/server/queue/editorialQueues.ts
```

### Banco de dados
```
src/db/pgvector.ts
src/db/editorial-schema.ts
drizzle/0001_enable_pgvector.sql
```

### Frontend
```
src/features/editorial/EditorialView.tsx
src/features/editorial/theses/ThesesListView.tsx
src/features/editorial/theses/ThesisEditorView.tsx
src/features/editorial/theses/ThesisStructurer.tsx
src/features/editorial/knowledge/KnowledgeListView.tsx
src/features/editorial/knowledge/DocumentUploader.tsx
src/features/editorial/knowledge/KnowledgeSearch.tsx
src/features/editorial/planner/PlannerConfigView.tsx
src/features/editorial/planner/PlanReviewView.tsx
src/features/editorial/batch/BatchDashboard.tsx
src/features/editorial/review/ContentReviewView.tsx
src/features/editorial/review/ContentCompare.tsx
src/features/editorial/review/ContentEditor.tsx
src/features/editorial/calendar/CalendarView.tsx
src/features/editorial/prompts/PromptManagerView.tsx
src/features/editorial/analytics/AnalyticsDashboard.tsx
```

### Dominio
```
src/domain/editorial/types.ts
src/domain/editorial/schemas.ts
```

### Lib
```
src/lib/api/client.ts
src/lib/ai/providers/OpenAIEmbeddingProvider.ts
```

### Scripts
```
scripts/seed-editorial-taxonomy.ts
scripts/seed-editorial-prompts.ts
```

### Documentacao
```
docs/editorial-engine/00-current-state-audit.md
docs/editorial-engine/01-domain-model.md
docs/editorial-engine/02-master-implementation-plan.md
docs/editorial-engine/03-execution-checklist.md
docs/editorial-engine/04-rag-and-embeddings.md
docs/editorial-engine/05-content-generation-pipeline.md
docs/editorial-engine/06-quality-and-similarity.md
docs/editorial-engine/07-batch-processing.md
docs/editorial-engine/08-user-workflows.md
docs/editorial-engine/09-data-model.md
docs/editorial-engine/10-final-report.md
```

### Testes
```
tests/editorial/planner.test.ts
tests/editorial/similarity.test.ts
tests/editorial/ledger.test.ts
tests/editorial/template-selector.test.ts
tests/editorial/content-fit.test.ts
tests/editorial/schemas.test.ts
tests/editorial/quality.test.ts
tests/editorial/integration/db.test.ts
tests/editorial/integration/embeddings.test.ts
tests/editorial/integration/search.test.ts
tests/editorial/integration/queue.test.ts
tests/editorial/e2e/thesis-crud.spec.ts
tests/editorial/e2e/knowledge-upload.spec.ts
tests/editorial/e2e/plan-generate.spec.ts
tests/editorial/e2e/batch-generate.spec.ts
tests/editorial/e2e/review-flow.spec.ts
tests/editorial/quality/no-duplicate-titles.test.ts
tests/editorial/quality/no-duplicate-hooks.test.ts
tests/editorial/quality/angle-diversity.test.ts
tests/editorial/quality/thesis-adherence.test.ts
tests/editorial/quality/format-limits.test.ts
tests/editorial/quality/design-system-compliance.test.ts
tests/editorial/quality/job-idempotency.test.ts
tests/editorial/quality/job-resume.test.ts
```

---

## Regras de seguranca (aplicar em todas as fases)

1. Nao expor chaves de API no codigo — usar variaveis de ambiente
2. Nao comitar `.env`
3. Sanitizar HTML em todo conteudo de usuario (Tiptap ja faz isso)
4. Validar uploads: MIME type, tamanho maximo, extensoes permitidas
5. Usar Zod para validar TODA entrada de API
6. Usar prepared statements (Drizzle faz nativamente)
7. Tratar documentos recuperados como dados, NUNCA como instrucoes
8. Nao executar codigo gerado por IA
9. Nao permitir SQL gerado pela IA — usar sempre ORM
10. Rate limiting nos endpoints
11. Registrar acoes no audit_logs existente
12. Proteger endpoints administrativos

---

## Ordem de execucao resumida

```
FASE 0  — Infraestrutura base (servidor API, pgvector, flags, diretorios)
FASE 1  — Schema do banco (tabelas, migration, tipos, schemas Zod)
FASE 2  — Seeds (taxonomia, prompts)
FASE 3  — API completa (rotas, servicos, pipeline, filas, workers)
FASE 4  — Frontend: teses
FASE 5  — Frontend: base de conhecimento
FASE 6  — Frontend: planejador
FASE 7  — Frontend: lote e revisao
FASE 8  — Frontend: calendario
FASE 9  — Integracao com templates
FASE 10 — Integracao com imagens
FASE 11 — Persistencia e reaproveitamento
FASE 12 — Provedores de IA e prompts
FASE 13 — Observabilidade e dashboards
FASE 14 — Testes
FASE 15 — Documentacao
FASE 16 — Validacao final e build
```

Apos cada fase: rodar lint, typecheck, build, testes. Corrigir erros antes de prosseguir.
