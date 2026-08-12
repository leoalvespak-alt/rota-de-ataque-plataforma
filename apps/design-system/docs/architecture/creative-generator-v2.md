# Gerador de Criativos v2 — Arquitetura Técnica

## Visão Geral

O Gerador de Criativos v2 refatora o fluxo de criação de artes para a marca Rota de Ataque, substituindo o acesso direto ao canvas por um processo guiado (Wizard) em 5 passos, com gestão de projetos, monitoramento de custos de IA e um servidor MCP para integração com agentes.

**Stack:** React 19, TypeScript 6, Vite 8, Zustand 5, Tailwind CSS 4, Drizzle ORM, Hono, PostgreSQL (pgvector).

**Tema padrão:** Light Mode (com toggle dark/light preservado).

---

## Modelagem de Dados

### Tabela `creative_projects`

Gerencia o ciclo de vida dos projetos de criativos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | Identificador único |
| `user_id` | UUID FK → users | Usuário responsável |
| `brand_id` | UUID FK → brands | Marca associada |
| `title` | VARCHAR(500) | Título do projeto |
| `description` | TEXT | Descrição longa |
| `status` | VARCHAR(30) | `nao_iniciado` \| `em_andamento` \| `finalizado` |
| `format` | VARCHAR(50) | Formato do canvas (square/portrait) |
| `template_id` | VARCHAR(100) | Template selecionado |
| `card_count` | INTEGER | Quantidade de cards (1-10) |
| `wizard_step` | INTEGER | Passo atual do wizard (1-5) |
| `wizard_data` | JSONB | Estado serializado do wizard |
| `elements` | JSONB | Elementos do card principal |
| `slides` | JSONB | Array de slides (carrossel) |
| `metadata` | JSONB | Metadados adicionais |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |
| `completed_at` | TIMESTAMP | Data de conclusão |

### Tabela `ai_token_logs`

Registra o consumo de tokens de IA para monitoramento de custos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | Identificador único |
| `user_id` | UUID FK → users | Usuário |
| `model` | VARCHAR(255) | Nome do modelo (deepseek-chat, claude-sonnet-4-6) |
| `provider` | VARCHAR(100) | Provider (deepseek, claude, fal) |
| `operation` | VARCHAR(100) | Tipo de operação (copy, image, carousel) |
| `input_tokens` | INTEGER | Tokens de entrada |
| `output_tokens` | INTEGER | Tokens de saída |
| `total_tokens` | INTEGER | Total de tokens |
| `cost_usd` | NUMERIC(12,8) | Custo em dólares |
| `metadata` | JSONB | Dados adicionais |
| `created_at` | TIMESTAMP | Data/hora da operação |

**Migração:** `drizzle/0002_creative_projects_and_token_logs.sql`

---

## Estado Zustand

### `useUiStore` (atualizado)

- **Novo tipo AppTab:** `'dashboard' | 'brand' | 'ai-config' | 'renders' | 'history' | 'editorial' | 'create' | 'wizard'`
- **Tema padrão:** `'light'` (era `'dark'`)
- **Tab inicial:** `'dashboard'` (era `'create'`)

### `useWizardStore` (novo)

Gerencia o fluxo de criação linear em 5 passos.

```typescript
interface WizardState {
  active: boolean
  step: 1 | 2 | 3 | 4 | 5
  creativeType: 'post' | 'carousel' | 'story' | null
  aspectRatio: 'square' | 'portrait' | null
  templateId: string | null
  thesisId: string | null
  freeText: string
  cardCount: number                // 1-10
  generateCoverWithAI: boolean
  scriptCards: ScriptCard[]
  projectId: string | null
}
```

**Ações principais:** `startWizard()`, `exitWizard()`, `nextStep()`, `prevStep()`, `canAdvance()`, `getResolvedFormat()`, `getResolvedFilter()`.

**Validações por passo:**
1. `creativeType` obrigatório; se post/carrossel, `aspectRatio` obrigatório
2. `templateId` obrigatório
3. `cardCount` entre 1 e 10; texto ou tese obrigatório
4. Todos os `scriptCards` devem ter `title` preenchido
5. Sempre válido (finalização)

---

## Fluxo Wizard (5 Passos)

### Passo 1 — Formato
- Seleção do tipo: Post Estático, Carrossel ou Story
- Story fixa proporção vertical automaticamente
- Post/Carrossel exigem escolha entre Quadrado e Retrato

### Passo 2 — Modelo
- Biblioteca de layouts filtrada pelo formato escolhido
- Templates agrupados por categoria
- Prévia miniaturizada de cada template com renderização real

### Passo 3 — Conteúdo e Parametrização
- Modo Tese (busca do banco via `/api/theses`) ou Texto Livre
- Seletor de quantidade de cards (1-10, apenas carrossel)
- Toggle para gerar capa com IA (fal.ai)

### Passo 4 — Roteiro
- Formulário de texto organizado em Capa / Slides / CTA
- Botão de prévia read-only por card (modal com render do template)
- Regeneração individual ou total com campo de contexto adicional

### Passo 5 — Canvas Final
- Preview do card renderizado com o template selecionado
- Botão "Trocar Modelo" (aplica novo layout mantendo o conteúdo)
- Barra de ferramentas WYSIWYG restrita: negrito, itálico, caixa alta/normal, alinhamento
- Paleta de cores restrita à marca
- Opções de fundo: upload de imagem, cor sólida, SVG
- Toggle dark/light por card
- DnD desativado (canvas em modo `pointer-events-none`)

---

## Navegação

### Dashboard (novo)
- Tab inicial da aplicação
- Cards para iniciar nova criação (Post, Carrossel, Story)
- Gestão de projetos por status (Em Andamento → Não Iniciado → Finalizado)
- Botão "Continuar" em projetos não finalizados

### Tabs do Header (atualizadas)
| Tab | Label | Descrição |
|-----|-------|-----------|
| `dashboard` | Início | Dashboard de projetos |
| `brand` | Marca | Guia de identidade visual |
| `ai-config` | IA | Configuração de chaves + painel de custos |
| `renders` | Renders | Galeria de renders exportados |
| `history` | Histórico | Histórico de artes salvas |
| `editorial` | Teses | Motor editorial completo |

### Painel de Custos de IA (novo)
- Localizado na tab IA, acima da lista de modelos
- Filtros: 24h, 7 dias, 30 dias, Total
- Métricas: custo total (USD), tokens consumidos, requisições
- Breakdown por modelo/provider
- API: `GET /api/token-logs/summary?period=7d`

---

## API Routes (novas)

### `/api/projects`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/projects` | Lista todos os projetos |
| GET | `/api/projects/:id` | Detalhe de um projeto |
| POST | `/api/projects` | Cria novo projeto |
| PATCH | `/api/projects/:id` | Atualiza projeto (status, dados) |
| DELETE | `/api/projects/:id` | Remove projeto |

### `/api/token-logs`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/token-logs?period=7d&model=deepseek-chat` | Lista logs filtrados |
| GET | `/api/token-logs/summary?period=30d` | Resumo agregado + breakdown por modelo |
| POST | `/api/token-logs` | Registra novo consumo |

---

## Servidor MCP

**Entrada:** `src/server/mcp/index.ts`
**Execução:** `npm run mcp:dev` (stdio transport)

### Ferramentas Expostas

| Ferramenta | Descrição |
|------------|-----------|
| `list_templates` | Lista os 26 templates com metadados e schemas |
| `get_template_schema` | Schema Zod e defaults de um template por ID |
| `get_default_elements` | Elementos default para preencher o canvas |
| `validate_template_metadata` | Valida objeto contra o schema Zod |
| `write_creative_json` | Gera JSON estruturado pronto para o editor |
| `list_template_filters` | Contagem de templates por filtro (square/portrait/carousel) |
| `get_zod_schemas` | Descrição dos schemas Zod registrados |

---

## Estrutura de Arquivos (novos/alterados)

```
src/
  db/
    schema.ts                          # +creativeProjects, +aiTokenLogs
  stores/
    useUiStore.ts                      # Refatorado (dashboard default, light theme)
    useWizardStore.ts                  # NOVO — estado do wizard
  features/
    dashboard/
      DashboardView.tsx                # NOVO — tela inicial com projetos
    wizard/
      WizardView.tsx                   # NOVO — container do wizard com stepper
      steps/
        WizardStep1Format.tsx          # NOVO — seleção de formato
        WizardStep2Template.tsx        # NOVO — seleção de modelo
        WizardStep3Content.tsx         # NOVO — conteúdo e parametrização
        WizardStep4Script.tsx          # NOVO — roteiro com preview
        WizardStep5Canvas.tsx          # NOVO — canvas travado com WYSIWYG
    ai/
      AICostPanel.tsx                  # NOVO — painel de custos
      AIConfigView.tsx                 # Alterado (+AICostPanel)
  server/
    api/
      index.ts                         # Alterado (+projectRoutes, +tokenLogRoutes)
      routes/
        projects.ts                    # NOVO — CRUD de projetos
        token-logs.ts                  # NOVO — logs de tokens
    mcp/
      index.ts                         # NOVO — servidor MCP
  app/
    AppShell.tsx                        # Refatorado (dashboard/wizard tabs)
    AppHeader.tsx                       # Refatorado (nova navegação)
drizzle/
  0002_creative_projects_and_token_logs.sql   # NOVA migração
```
