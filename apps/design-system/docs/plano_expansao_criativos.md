# Plano de Expansão — Criativos

> Documento de planejamento técnico para implementação das Regras de Negócio A (Importação/Exportação de Markdown Dinâmico) e B (Sistema de Multi-Perfis).
> Gerado em 2026-08-12.

---

## Visão Geral

O sistema atual opera com identidade visual fixa (Rota de Ataque) e a importação de Markdown depende de chamada à API de IA (`generateCarouselCopy`) para redistribuir copy nos cards. As duas novas regras ampliam o sistema em dois eixos:

- **Regra A**: Importar/exportar Markdown sem IA — o usuário baixa um template `.md` estruturado, preenche em qualquer ferramenta (inclusive LLMs externos) e re-importa; o parse é determinístico, sem custo de tokens.
- **Regra B**: Multi-perfis de marca — permitir que criativos sejam assinados por diferentes perfis (influenciadores, marcas parceiras), cada um com paleta e tipografia próprias, injetadas dinamicamente no canvas sem afetar o chrome da aplicação.

---

## Glossário rápido

| Termo | Significado neste documento |
|---|---|
| **Wizard** | Fluxo de criação em 5 passos (`WizardView.tsx`, steps 1–5) |
| **ScriptCard** | Objeto `{ id, role, title, body, eyebrow }` no `useWizardStore` |
| **Canvas** | Área de renderização do card (templates em `features/templates/`) |
| **Chrome** | UI da aplicação (dashboard, sidebar, menus) — usa tokens `--ui-*` |
| **Perfil** | Entidade de marca/influenciador com paleta + tipografia próprias |

---

## FASE 1 — Banco de Dados (Schema Drizzle)

### Etapa 1.1 — Tabela `brand_profiles`

**Arquivo**: `src/db/schema.ts`

Criar uma nova tabela `brand_profiles` ao lado da tabela `brands` existente. A tabela `brands` atual armazena tokens genéricos via JSONB; a nova tabela é específica para perfis de criativo com campos tipados.

**PASSO 1.1.1** — Definir a tabela:

```ts
export const brandProfiles = pgTable('brand_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  handle: varchar('handle', { length: 100 }).notNull(),        // @usuario
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  isDefault: boolean('is_default').default(false).notNull(),

  // Paleta de cores — campos explícitos para validação e query
  colorBackground: varchar('color_background', { length: 9 }).notNull(),  // hex #RRGGBB ou #RRGGBBAA
  colorText: varchar('color_text', { length: 9 }).notNull(),
  colorPrimary: varchar('color_primary', { length: 9 }).notNull(),
  colorButton: varchar('color_button', { length: 9 }).notNull(),

  // Tipografia
  fontHeading: varchar('font_heading', { length: 255 }).notNull().default('Rajdhani'),
  fontBody: varchar('font_body', { length: 255 }).notNull().default('IBM Plex Sans'),

  // Avatar/logo do perfil (storage key, nullable)
  avatarKey: varchar('avatar_key', { length: 1000 }),

  // Metadados extras (tom de voz, bio, etc.)
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

**PASSO 1.1.2** — Adicionar coluna `profileId` na tabela `creativeProjects`:

```ts
profileId: uuid('profile_id').references(() => brandProfiles.id),
```

Isso vincula cada projeto criativo a um perfil específico.

### Etapa 1.2 — Migration Drizzle

**PASSO 1.2.1** — Rodar `npx drizzle-kit generate` para gerar a migration SQL.

**PASSO 1.2.2** — Revisar a migration gerada em `drizzle/` e aplicar com `npx drizzle-kit push` ou `migrate`.

### Etapa 1.3 — Seed do perfil padrão

**PASSO 1.3.1** — Criar um script ou insert na migration que popule o perfil padrão "Rota de Ataque":

```
name: "Rota de Ataque"
handle: "@rotadeataque"
isDefault: true
colorBackground: "#0A0A0A"
colorText: "#F0F0F0"
colorPrimary: "#C1121F"
colorButton: "#C1121F"
fontHeading: "Rajdhani"
fontBody: "IBM Plex Sans"
```

---

## FASE 2 — Lógica de Markdown via Código (sem IA)

### Etapa 2.1 — Módulo de geração do template `.md`

**Novo arquivo**: `src/lib/markdown/generateMarkdownTemplate.ts`

**PASSO 2.1.1** — Implementar a função pura `generateMarkdownTemplate`:

```ts
interface MarkdownTemplateParams {
  aspectRatio: 'square' | 'portrait'
  cardCount: number   // 1–10
}

function generateMarkdownTemplate(params: MarkdownTemplateParams): string
```

**PASSO 2.1.2** — Lógica de montagem da string (hardcoded, zero IA):

A função monta um Markdown com a seguinte estrutura fixa:

```markdown
# Roteiro para Criativo — [Formato: Quadrado 1080×1080 | Retrato 1080×1350]
# Cards: N

> INSTRUÇÕES PARA IA EXTERNA: Preencha os campos entre colchetes
> com textos curtos e impactantes. Mantenha a estrutura exata.
> Não remova as linhas de separador (---).

---

## CAPA

**eyebrow**: [TAG CURTA EM MAIÚSCULAS — 1 a 3 palavras]
**title**: [TÍTULO IMPACTANTE — 4 a 8 palavras em maiúsculas]
**body**: [Texto de apoio — 1 a 2 frases diretas]

---

## SLIDE 1

**eyebrow**: [TAG CURTA]
**title**: [TÍTULO DO SLIDE]
**body**: [Conteúdo principal do slide]

---

(repete para slides 2..N-2)

---

## CTA

**eyebrow**: [TAG DE AÇÃO]
**title**: [CHAMADA PARA AÇÃO]
**body**: [Instrução final direta]
```

Regras de montagem:
- Se `cardCount === 1`: só bloco CAPA (sem CTA).
- Se `cardCount === 2`: CAPA + CTA.
- Se `cardCount >= 3`: CAPA + (N-2) SLIDES + CTA.
- O formato (Quadrado/Retrato) é informativo no cabeçalho.

**PASSO 2.1.3** — Exportar como download:

```ts
function downloadMarkdownTemplate(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### Etapa 2.2 — Módulo de parse do Markdown preenchido

**Novo arquivo**: `src/lib/markdown/parseMarkdownScript.ts`

**PASSO 2.2.1** — Implementar a função de parse:

```ts
interface ParsedCard {
  role: 'cover' | 'slide' | 'cta'
  eyebrow: string
  title: string
  body: string
}

function parseMarkdownScript(content: string): ParsedCard[]
```

**PASSO 2.2.2** — Lógica de parse (regex/split):

1. Dividir o conteúdo por `---` (separadores de seção).
2. Para cada seção, identificar o heading `## CAPA`, `## SLIDE N`, `## CTA`.
3. Extrair os valores de `**eyebrow**:`, `**title**:`, `**body**:` via regex.
4. Mapear para o role correspondente (`cover`, `slide`, `cta`).
5. Retornar array de `ParsedCard[]`.

**PASSO 2.2.3** — Validação:

- Se nenhuma seção foi encontrada: lançar erro "Formato inválido".
- Se algum campo obrigatório (title) estiver vazio ou ainda contiver `[...]`: avisar que o campo não foi preenchido.
- Se a quantidade de cards parseados for diferente da esperada pelo Wizard: avisar discrepância.

### Etapa 2.3 — Testes unitários

**Novo arquivo**: `src/lib/markdown/generateMarkdownTemplate.test.ts`
**Novo arquivo**: `src/lib/markdown/parseMarkdownScript.test.ts`

**PASSO 2.3.1** — Testar round-trip: gerar template com N cards, preencher mock, parsear e validar que o array resultante tem N itens com os campos corretos.

**PASSO 2.3.2** — Testar edge cases: 1 card (sem CTA), 2 cards (capa+CTA), 10 cards, Markdown mal-formado, campos não preenchidos.

---

## FASE 3 — Integração do Markdown no Wizard

### Etapa 3.1 — Adaptar o WizardStep3Content

**Arquivo**: `src/features/wizard/steps/WizardStep3Content.tsx`

**PASSO 3.1.1** — Adicionar um terceiro modo de conteúdo: `'markdown'` (ao lado de `'thesis'` e `'free'`).

Alterar o state local:
```ts
const [contentMode, setContentMode] = useState<'thesis' | 'free' | 'markdown'>(...)
```

**PASSO 3.1.2** — Adicionar o botão/card "Importar Markdown" na grade de seleção de fonte de conteúdo:

```tsx
<button onClick={() => setContentMode('markdown')}>
  <Upload /> Importar Markdown
</button>
```

**PASSO 3.1.3** — Quando `contentMode === 'markdown'`, renderizar o painel de Markdown com:

1. **Botão "Baixar Formato Esperado"**:
   - Estado `disabled` calculado: `!aspectRatio || cardCount < 1`.
   - `onClick`: chamar `generateMarkdownTemplate({ aspectRatio, cardCount })` e disparar download.
   - Tooltip quando disabled: "Selecione o formato e a quantidade de cards primeiro".

2. **Zona de Upload** (drag & drop + input file):
   - Aceita `.md`, `.markdown`, `.txt`.
   - Limite de 1 MB.
   - Ao receber o arquivo: chamar `parseMarkdownScript(content)`.
   - Converter cada `ParsedCard` para `ScriptCard` (gerar UUID, mapear role).
   - Chamar `setScriptCards(convertedCards)` no `useWizardStore`.
   - Exibir toast de sucesso/erro.

### Etapa 3.2 — Adaptar o useWizardStore

**Arquivo**: `src/stores/useWizardStore.ts`

**PASSO 3.2.1** — Adicionar campo `contentSource` ao state:

```ts
contentSource: 'thesis' | 'free' | 'markdown'
```

**PASSO 3.2.2** — Adicionar action `setContentSource`:

```ts
setContentSource: (source: 'thesis' | 'free' | 'markdown') => void
```

**PASSO 3.2.3** — Atualizar `canAdvance` para step 3: quando `contentSource === 'markdown'`, avançar é permitido se `scriptCards.length > 0` (o parse já injetou os cards).

### Etapa 3.3 — Componente dedicado MarkdownImportPanel

**Novo arquivo**: `src/features/wizard/steps/MarkdownImportPanel.tsx`

Componente extraído para manter `WizardStep3Content` limpo. Responsabilidades:
- Renderizar botão de download + zona de upload.
- Gerenciar estado local de `fileName`, `parseError`.
- Consumir `useWizardStore` para ler `aspectRatio`, `cardCount` e escrever `scriptCards`.

---

## FASE 4 — Gestão de Perfis na UI (CRUD)

### Etapa 4.1 — API de Perfis (Server-side)

**Novo arquivo**: `src/server/api/routes/profiles.ts`

**PASSO 4.1.1** — Implementar rotas REST:

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/profiles` | Listar todos os perfis do usuário |
| GET | `/api/profiles/:id` | Obter perfil por ID |
| POST | `/api/profiles` | Criar perfil |
| PUT | `/api/profiles/:id` | Atualizar perfil |
| DELETE | `/api/profiles/:id` | Deletar perfil (não permite deletar `isDefault`) |

**PASSO 4.1.2** — Validação Zod para body de criação/edição:

```ts
const profileSchema = z.object({
  name: z.string().min(1).max(255),
  handle: z.string().min(1).max(100).regex(/^@/),
  colorBackground: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  colorText: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  colorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  colorButton: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  fontHeading: z.string().max(255),
  fontBody: z.string().max(255),
  avatarKey: z.string().max(1000).optional(),
})
```

**PASSO 4.1.3** — Registrar as rotas no router principal (arquivo de rotas existente).

### Etapa 4.2 — Store de Perfis (Zustand)

**Novo arquivo**: `src/stores/useProfileStore.ts`

**PASSO 4.2.1** — State:

```ts
interface ProfileState {
  profiles: BrandProfile[]
  activeProfileId: string | null
  loading: boolean
}
```

**PASSO 4.2.2** — Actions:

```ts
interface ProfileActions {
  fetchProfiles: () => Promise<void>
  createProfile: (data: ProfileInput) => Promise<void>
  updateProfile: (id: string, data: Partial<ProfileInput>) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  setActiveProfile: (id: string) => void
  getActiveProfile: () => BrandProfile | null
}
```

### Etapa 4.3 — UI de Gestão de Perfis

**Arquivo modificado**: `src/features/brand/BrandView.tsx`

**PASSO 4.3.1** — Adicionar uma nova seção "08 — Perfis" no final do `BrandView`, com:

- Lista de perfis em cards compactos mostrando: nome, @handle, swatches das 4 cores, fonte heading/body.
- Botão "Novo Perfil" que abre modal/dialog.
- Ações por perfil: Editar, Duplicar, Deletar (com confirmação).
- Badge "Padrão" no perfil marcado como `isDefault`.

**Novo arquivo**: `src/features/brand/ProfileFormDialog.tsx`

**PASSO 4.3.2** — Dialog de criação/edição com:

- Campos de texto: Nome, @Handle.
- 4 color pickers: Fundo, Texto, Primária, Botões.
- 2 selects de tipografia: Heading, Body (lista de fontes disponíveis no sistema).
- Upload de avatar (opcional).
- Preview ao vivo: mini-card simulando como o criativo ficaria com aquela paleta.
- Botões: Cancelar, Salvar.

**Novo arquivo**: `src/features/brand/ProfileCard.tsx`

**PASSO 4.3.3** — Componente de card compacto para a lista de perfis.

### Etapa 4.4 — Seletor de Perfil no Wizard

**Arquivo modificado**: `src/stores/useWizardStore.ts`

**PASSO 4.4.1** — Adicionar campo `profileId: string | null` ao state do Wizard.

**PASSO 4.4.2** — Adicionar action `setProfileId`.

**Arquivo modificado**: `src/features/wizard/steps/WizardStep1Format.tsx`

**PASSO 4.4.3** — Adicionar um seletor de perfil no topo do Step 1, antes da seleção de tipo:

- Select/dropdown com os perfis do `useProfileStore`.
- Pré-seleciona o perfil marcado como `isDefault`.
- Mostra mini-preview da paleta selecionada (4 círculos de cor).

**Alternativa**: o seletor pode ficar em um novo sub-componente `ProfileSelector.tsx` dentro de `features/wizard/steps/`.

---

## FASE 5 — Injeção Dinâmica de Tokens CSS

### Etapa 5.1 — Hook de injeção de tokens

**Novo arquivo**: `src/hooks/useProfileTokens.ts`

**PASSO 5.1.1** — Implementar hook `useProfileTokens(profileId: string | null)`:

```ts
function useProfileTokens(profileId: string | null): CSSProperties
```

O hook:
1. Lê o perfil ativo do `useProfileStore`.
2. Retorna um objeto `CSSProperties` com as variáveis CSS mapeadas:

```ts
{
  '--profile-bg': profile.colorBackground,
  '--profile-text': profile.colorText,
  '--profile-primary': profile.colorPrimary,
  '--profile-button': profile.colorButton,
  '--profile-font-heading': profile.fontHeading,
  '--profile-font-body': profile.fontBody,
}
```

### Etapa 5.2 — Wrapper de canvas com tokens de perfil

**Novo arquivo**: `src/features/templates/ProfileCanvasWrapper.tsx`

**PASSO 5.2.1** — Componente wrapper que aplica `style={profileTokens}` ao redor do canvas:

```tsx
function ProfileCanvasWrapper({ profileId, children }: Props) {
  const tokens = useProfileTokens(profileId)
  return (
    <div style={tokens} className="profile-canvas-scope">
      {children}
    </div>
  )
}
```

**PASSO 5.2.2** — Envolver os renders de template dentro deste wrapper nos pontos de renderização:
- `WizardStep5Canvas.tsx` — preview do canvas no Wizard.
- `WizardStep4Script.tsx` — modal de preview do card.
- Editor principal (`features/editor/`) — workspace de edição.
- `lib/export/ExportEngine.ts` — exportação de imagem (o wrapper precisa estar no DOM clonado).

### Etapa 5.3 — Adaptar os templates para consumir tokens de perfil

**Arquivos**: Todos os componentes de template em `src/features/templates/square/`, `src/features/templates/portrait/`, `src/features/templates/carousel/`.

**PASSO 5.3.1** — Onde os templates hoje referenciam tokens fixos, usar os tokens do perfil com fallback:

Adicionar ao `src/index.css`:

```css
.profile-canvas-scope {
  --red: var(--profile-primary, #C1121F);
  --light-bg: var(--profile-bg, #F5F5F0);
  --light-text: var(--profile-text, #0A0A0A);
  --dark-bg: var(--profile-bg, #0A0A0A);
  --dark-text: var(--profile-text, #F0F0F0);
}
```

Dessa forma, os templates existentes continuam funcionando com os mesmos nomes de variáveis (`--red`, `--light-bg`, etc.), mas dentro do `.profile-canvas-scope` esses valores são substituídos pelos do perfil. Fora do scope (chrome da app), nada muda.

**PASSO 5.3.2** — Para a tipografia, nos templates que usam `font-heading` e `font-sans` via Tailwind classes:

Adicionar regra CSS dentro do scope:

```css
.profile-canvas-scope {
  --font-heading: var(--profile-font-heading, 'Rajdhani'), sans-serif;
  --font-body: var(--profile-font-body, 'IBM Plex Sans'), sans-serif;
}
```

**PASSO 5.3.3** — Garantir que as fontes personalizadas do perfil estejam carregadas. Implementar carregamento dinâmico via `document.fonts` ou `@font-face` injetado:

Novo utilitário: `src/lib/fonts/loadProfileFonts.ts`

```ts
async function loadProfileFonts(fontHeading: string, fontBody: string): Promise<void>
```

O utilitário verifica se a fonte já está no `document.fonts` e, se não, cria um `<link>` para o Fontsource correspondente ou informa o usuário que a fonte não está disponível.

### Etapa 5.4 — Integração com o Export Engine

**Arquivo**: `src/lib/export/ExportEngine.ts`

**PASSO 5.4.1** — No clone de DOM para exportação, garantir que o `ProfileCanvasWrapper` com seus tokens inline esteja presente, para que a imagem exportada use a paleta do perfil e não os tokens globais.

---

## FASE 6 — Validação e QA

### Etapa 6.1 — Testes de integração

**PASSO 6.1.1** — Testar fluxo completo do Wizard com importação Markdown:
1. Selecionar formato (Quadrado, 5 cards).
2. Baixar template `.md`.
3. Verificar conteúdo do arquivo baixado (5 seções: CAPA + 3 SLIDES + CTA).
4. Re-importar o `.md` preenchido.
5. Verificar que 5 `ScriptCard` foram criados no store com os textos corretos.
6. Avançar para Step 4 e verificar que os cards estão preenchidos.

**PASSO 6.1.2** — Testar CRUD de perfis:
1. Criar perfil com paleta personalizada.
2. Editar o perfil.
3. Deletar perfil não-padrão (deve funcionar).
4. Tentar deletar perfil padrão (deve ser bloqueado).

**PASSO 6.1.3** — Testar injeção de tokens:
1. Criar perfil com cores distintas (ex: fundo azul).
2. Criar criativo selecionando esse perfil.
3. Verificar que o canvas renderiza com as cores do perfil.
4. Verificar que o chrome da app permanece inalterado.
5. Exportar imagem e verificar que as cores do perfil estão na imagem final.

### Etapa 6.2 — Testes E2E (Playwright)

**PASSO 6.2.1** — Adicionar cenário E2E para o fluxo Markdown no Wizard.
**PASSO 6.2.2** — Adicionar cenário E2E para criação de perfil e verificação visual.

---

## Resumo de Arquivos

### Novos arquivos

| Arquivo | Fase | Descrição |
|---|---|---|
| `src/lib/markdown/generateMarkdownTemplate.ts` | 2 | Gera string do template `.md` |
| `src/lib/markdown/parseMarkdownScript.ts` | 2 | Parse do `.md` preenchido para `ScriptCard[]` |
| `src/lib/markdown/generateMarkdownTemplate.test.ts` | 2 | Testes do gerador |
| `src/lib/markdown/parseMarkdownScript.test.ts` | 2 | Testes do parser |
| `src/features/wizard/steps/MarkdownImportPanel.tsx` | 3 | UI de download + upload no Wizard |
| `src/server/api/routes/profiles.ts` | 4 | Rotas REST para CRUD de perfis |
| `src/stores/useProfileStore.ts` | 4 | Store Zustand de perfis |
| `src/features/brand/ProfileFormDialog.tsx` | 4 | Modal de criação/edição de perfil |
| `src/features/brand/ProfileCard.tsx` | 4 | Card compacto na lista de perfis |
| `src/hooks/useProfileTokens.ts` | 5 | Hook que monta CSS vars do perfil ativo |
| `src/features/templates/ProfileCanvasWrapper.tsx` | 5 | Wrapper que aplica tokens no canvas |
| `src/lib/fonts/loadProfileFonts.ts` | 5 | Carregamento dinâmico de fontes |

### Arquivos modificados

| Arquivo | Fase | Alteração |
|---|---|---|
| `src/db/schema.ts` | 1 | Nova tabela `brandProfiles`, nova coluna `profileId` em `creativeProjects` |
| `src/stores/useWizardStore.ts` | 3, 4 | Novos campos `contentSource`, `profileId`; novas actions |
| `src/features/wizard/steps/WizardStep3Content.tsx` | 3 | Terceiro modo "Importar Markdown" |
| `src/features/wizard/steps/WizardStep1Format.tsx` | 4 | Seletor de perfil |
| `src/features/brand/BrandView.tsx` | 4 | Seção 08 — Gestão de Perfis |
| `src/index.css` | 5 | Regras CSS `.profile-canvas-scope` com fallback |
| `src/features/wizard/steps/WizardStep4Script.tsx` | 5 | Envolver preview em `ProfileCanvasWrapper` |
| `src/features/wizard/steps/WizardStep5Canvas.tsx` | 5 | Envolver canvas em `ProfileCanvasWrapper` |
| `src/lib/export/ExportEngine.ts` | 5 | Tokens de perfil no DOM clonado |
| `src/server/api/routes/*.ts` (router principal) | 4 | Registrar rotas de perfis |

---

## Ordem de Execução Recomendada

```
FASE 1 (Schema)
  └── Etapa 1.1 → 1.2 → 1.3

FASE 2 (Markdown core — pode rodar em paralelo com Fase 1)
  └── Etapa 2.1 → 2.2 → 2.3

FASE 3 (Markdown no Wizard — depende de Fase 2)
  └── Etapa 3.1 → 3.2 → 3.3

FASE 4 (Perfis — depende de Fase 1)
  └── Etapa 4.1 → 4.2 → 4.3 → 4.4

FASE 5 (Tokens dinâmicos — depende de Fases 1 e 4)
  └── Etapa 5.1 → 5.2 → 5.3 → 5.4

FASE 6 (QA — depende de todas as anteriores)
  └── Etapa 6.1 → 6.2
```

As Fases 1 e 2 podem ser desenvolvidas em paralelo. As Fases 3 e 4 podem ser desenvolvidas em paralelo entre si (desde que Fase 1 e 2 estejam concluídas). A Fase 5 é sequencial após a 4. A Fase 6 fecha tudo.
