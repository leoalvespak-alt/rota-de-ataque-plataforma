# Plano de implementação das 22 evoluções do Gerador de Criativos

> **Auditado em 2026-07-31.** Este plano foi revisado contra o estado real do código-fonte. Todas as referências a arquivos, stores, tipos e dependências foram verificadas. Notas de auditoria estão marcadas com **Atenção:** nos pontos críticos.

## 1. Objetivo

Evoluir o Gerador de Criativos sem perder os comportamentos, os 26 templates, a identidade visual e a qualidade de exportação já existentes. A implementação será incremental, com recursos protegidos por feature flags, migrações versionadas e validação de regressão ao final de cada etapa.

Este plano considera o estado atual do projeto: React 19, TypeScript estrito, Zustand, Immer, Zundo, IndexedDB, editor client-side, 26 templates tipados, modo série, histórico local, DeepSeek/Claude configuráveis e exportação PNG/ZIP.

### Estado de persistência atual (referência obrigatória)

| Store | Tecnologia | Chave | Observação |
|---|---|---|---|
| `useLibraryStore` | IndexedDB (idb-keyval) | `rda-library-v1` | Renders (blobs) e artes salvas (snapshots com thumb) |
| `useAIStore` | localStorage | `rda_ai_keys` | Modelos, chaves e provider selecionado |
| `useEditorStore` | **nenhuma** | — | Estado ephemeral; undo/redo temporal via zundo (30 estados em memória) |
| `useSeriesStore` | **nenhuma** | — | Slides de série em memória; dados perdidos ao recarregar a página |
| `useDecorStore` | **nenhuma** | — | Textura, watermark e fundo resetam ao recarregar |
| `useUiStore` | **nenhuma** | — | Tab ativa, filtros, painéis abertos |

**Nota para execução:** Qualquer funcionalidade que dependa de dados desses stores entre sessões (autosave, projetos, campanhas) precisa **criar** persistência, não "augmentar" uma existente.

### Bibliotecas e versões críticas

- **Zod v4.4** — a API mudou significativamente em relação à v3 (mais comum em treinamento de LLMs). Usar `z.object()`, `z.infer<>`, `z.pipe()` e transforms conforme a documentação Zod 4. Não usar padrões v3 como `z.string().transform()` sem verificar compatibilidade.
- **React 19.2** — usar APIs modernas (`use`, `useTransition`, `useOptimistic` quando relevante). O `flushSync` já é usado no export pipeline e deve ser mantido.
- **html2canvas-pro** — biblioteca browser-only que depende do DOM real. Não pode ser usada em workers, node.js ou renderização server-side.

## 2. Regras não negociáveis

1. Preservar os IDs, defaults, renderização e controles atuais dos 26 templates.
2. Não alterar silenciosamente uma arte existente durante migrações de dados.
3. Toda alteração em massa deve seguir o fluxo `configurar -> pré-visualizar -> confirmar -> aplicar -> desfazer/restaurar`.
4. Recursos opcionais começam desativados, salvo quando apenas expõem comportamento já existente.
5. Paleta, fontes, espaçamentos e demais tokens continuam tendo `Base/MARCA.md` e `src/index.css` como fontes de verdade.
6. Novas variantes de template só entram após validação visual; não haverá movimentação livre de elementos.
7. O editor atual deve continuar funcionando durante todas as etapas, inclusive com projetos criados em versões anteriores.
8. Dados persistidos terão `schemaVersion`, migrações idempotentes, backup antes da migração e recuperação em caso de falha.
9. Toda operação de IA deve gerar uma proposta revisável; nunca gravar diretamente sobre o conteúdo aprovado.
10. Exportação continua usando o nó dedicado, fontes carregadas, imagens decodificadas e captura determinística.

## 3. Arquitetura-alvo

### 3.1 Modelo de domínio

Criar uma camada de domínio aditiva, sem substituir imediatamente os stores atuais:

```ts
type ApplyScope = 'current-card' | 'entire-carousel'
type PersistScope = 'project' | 'campaign' | 'preset'

interface ProjectDocument {
  id: string
  schemaVersion: number
  name: string
  campaigns: CampaignDocument[]
  preferences: ProjectPreferences
  createdAt: number
  updatedAt: number
}

interface CampaignDocument {
  id: string
  name: string
  status: WorkflowStatus
  presetId?: string
  artifacts: ArtifactDocument[]
  linkedComponents: LinkedComponent[]
  featurePreferences: FeaturePreferenceMap
}

interface ArtifactDocument {
  id: string
  kind: 'post' | 'story' | 'carousel'
  cards: CardDocument[]
  exportProfileId?: string
}

interface CardDocument {
  id: string
  templateId: string
  elements: Record<string, unknown>
  darkMode: boolean
  decor: DecorState
  variantId?: string
  bindings?: DataBinding[]
  overrides?: ComponentOverride[]
}

// --- Tipos auxiliares referenciados acima (definir na Etapa 1.1) ---

type WorkflowStatus = 'draft' | 'in-review' | 'changes-requested' | 'approved' | 'published'

interface ProjectPreferences {
  defaultPresetId?: string
  defaultExportProfileId?: string
  brandLockMode?: 'off' | 'warn' | 'block'
}

interface FeaturePreferenceMap {
  [featureId: string]: { enabled: boolean; scope: ApplyScope }
}

interface DecorState {
  texture: { type: 'none' | 'organic' | 'noise' | 'hatching'; opacity: number }
  watermark: { visible: boolean; text: string; position: 'bottom-right' | 'bottom-left' | 'bottom-center'; opacity: number }
  bgLibraryId: string
}

interface LinkedComponent {
  id: string
  kind: 'logo' | 'footer' | 'seal' | 'numbering' | 'cta'
  data: Record<string, unknown>
  version: number
}

interface DataBinding {
  fieldPath: string
  sourceKind: 'reusable-data' | 'spreadsheet-column' | 'component'
  sourceId: string
  frozen: boolean
}

interface ComponentOverride {
  componentId: string
  fieldPath: string
  localValue: unknown
}
```

O `useEditorStore` continuará representando o card aberto. O `useSeriesStore` será adaptado gradualmente para ler e gravar um `ArtifactDocument`, evitando uma reescrita simultânea do editor. **Atenção:** `useSeriesStore` atualmente não tem nenhuma persistência — os slides de série existem apenas em memória e são perdidos ao recarregar. A migração para `ArtifactDocument` inclui criar a persistência que hoje não existe.

### 3.2 Metadados de template

Estender `TemplateDefinition` apenas com campos opcionais:

- `fieldSchema`: campos semânticos, tipo, obrigatório, limite recomendado e suporte a vínculo.
- `capabilities`: imagem, CTA, listas, estilos, redimensionamento e regras suportadas.
- `variants`: combinações aprovadas de densidade, quantidade, imagem e CTA.
- `equivalents`: templates equivalentes por formato.
- `qualityRules`: limites e exceções específicos do template.
- `layoutRules`: regras determinísticas para conteúdo curto, médio e longo.

Enquanto esses metadados não existirem para um template, ele continuará usando o comportamento atual.

### 3.3 Motor transversal de aplicação segura

Criar um `MutationService` central para alterações que atingem mais de um campo ou card:

1. Receber comando, escopo e opções.
2. Resolver os cards afetados sem alterar o estado.
3. Produzir um `ChangeSet` com valores anteriores e propostos.
4. Validar compatibilidade, identidade visual e qualidade.
5. Exibir prévia visual e resumo por card.
6. Aplicar tudo em uma única transação.
7. Registrar a operação no histórico com `undo` e ponto de recuperação.

Edições simples de texto podem continuar no histórico temporal atual (zundo temporal, partialized em `elements`, limite 30 estados — `src/stores/useEditorStore.ts:126-129`). Presets, lote, IA, conversões, vínculos e regras condicionais obrigatoriamente passam pelo `MutationService`.

**Atenção:** O export de série (`src/features/series/useSeriesExport.ts`) já usa um padrão de backup/restore do editor state para iterar slides. O `MutationService` deve ser compatível com esse padrão — não iniciar uma transação durante um export em andamento.

### 3.4 Contrato transversal de interface

Todo recurso compatível deverá usar um controle comum:

- Toggle de ativação no painel direito ou no módulo ao qual pertence.
- Seletor `Card atual | Carrossel inteiro`.
- Botão `Pré-visualizar` antes de qualquer alteração em massa.
- Diálogo comparativo com cards afetados, avisos, erros e propriedades substituídas.
- Ações `Aplicar`, `Cancelar` e, após aplicação, `Desfazer`.
- Preferência opcional persistida em projeto, campanha ou preset.
- Estado visual para processamento, sucesso parcial, falha e recuperação.

Para recursos cujo domínio natural é campanha ou sistema, o seletor card/carrossel será exibido somente na ação de aplicar conteúdo às artes; configurações administrativas usarão o escopo próprio e explícito.

### 3.5 Persistência e serviços

- IndexedDB será a fonte local para documentos, blobs, snapshots e filas.
- Criar repositórios (`ProjectRepository`, `AssetRepository`, `SnapshotRepository`, `JobRepository`) para desacoplar stores da tecnologia de armazenamento.
- Processamento pesado de XLSX, validação de imagens e geração de prévias deverá usar Web Workers.
- Colaboração real, responsáveis, comentários entre usuários e exportação agendada com o navegador fechado exigem backend. Implementar essas funções atrás de interfaces de API e manter modo local para instalações sem servidor.
- Chaves de IA podem permanecer compatíveis com a configuração atual no modo local; em produção multiusuário, adicionar proxy de IA no backend para não expor segredos no navegador.

## 4. Matriz de rastreabilidade

| ID | Implementação | Etapa principal | Dependências |
|---:|---|---|---|
| 1 | Presets de campanha | 3 | Fundação, aplicação segura, biblioteca, **Impl. 15 (metadados de template)** |
| 2 | Criação em lote por planilha | 5 | Schemas de campos, campanhas, validação, **Impl. 15** |
| 3 | Componentes vinculados | 3 | Modelo de campanha, aplicação segura |
| 4 | Trava de identidade visual | 2 | Tokens, estilos semânticos, validador, **registro programático de tokens (Etapa 2 passo 0)** |
| 5 | Layouts inteligentes | 2 | Metadados e medições de template, **Impl. 15** |
| 6 | Validador de qualidade | 2 | Schemas, medições, regras de marca, **Impl. 15** |
| 7 | Assistente de carrossel com IA | 6 | IA estruturada, campanhas, templates parametrizados |
| 8 | Variações automáticas | 6 | Presets, trava de marca, aplicação segura |
| 9 | Redimensionamento multiformato | 5 | **Impl. 15 (equivalents)**, layouts inteligentes |
| 10 | Biblioteca central de conteúdo | 3 | Repositórios, hash de arquivos, tags |
| 11 | Sistema de estilos de texto | 2 | Tokens, permissões e escopos |
| 12 | Duplicação com conteúdo alternativo | 3 | Schemas de campos (**Impl. 15**), aplicação segura |
| 13 | Fluxo de revisão e aprovação | 7 | Projetos/campanhas, usuários/backend opcional |
| 14 | Exportação programada e padronizada | 8 | Validador, jobs, **backend obrigatório para agendamento real** |
| 15 | Templates parametrizados | 2 | Metadados e cobertura visual |
| 16 | Salvamento automático e recuperação | 1 | Repositórios, snapshots e migrações, **criar persistência para stores ephemeros** |
| 17 | Central de comandos e atalhos | 4 | Registro de comandos e preferências, **migrar atalhos de `src/app/AppShell.tsx`** |
| 18 | Regras condicionais de composição | 2 | Metadados, layouts e prévia, **Impl. 15** |
| 19 | Calendário editorial integrado | 7 | Campanhas, workflow e responsáveis |
| 20 | Central de dados reutilizáveis | 4 | Schemas (**Impl. 15**), vínculos e confirmação sincronizada |
| 21 | Pacotes de campanha completos | 6 | Campanhas, multiformato, presets e IA |
| 22 | Assistente de criação passo a passo | 6 | DeepSeek, schemas, templates e revisão |

## 5. Etapas e passos

### Etapa 0 - Baseline, decisões e proteção contra regressões

#### Passos

1. Congelar um inventário dos 26 templates, defaults, formatos, filtros e campos editáveis. O registry está em `src/features/templates/registry.ts` (array `TEMPLATES`, 26 entradas). Cada template exporta `XxxRender`, `XxxControls` e `xxxDefaults` do seu arquivo em `src/features/templates/{square,portrait,carousel}/`.
2. Verificar e atualizar as 52 capturas de referência light/dark já existentes em `tests/visual/baseline/` (com `manifest.json`). Não regenerar do zero — apenas atualizar o manifesto se houve mudança aprovada e adicionar capturas faltantes.
3. Ampliar os E2E existentes em `tests/visual/e2e/` (5 screenshots atuais) para cobrir os fluxos completos: selecionar template, editar texto, alternar campo, dark mode, decor, série, salvar, carregar, render e exportar PNG/ZIP. O Playwright já está configurado (`playwright.config.ts`).
4. Registrar tempos e tamanhos-base: inicialização, edição, captura PNG, ZIP e uso do IndexedDB.
5. Criar feature flags locais por recurso e uma tela de diagnóstico apenas em desenvolvimento. Sugestão: usar um store Zustand com persist em localStorage, chave `rda_feature_flags`.
6. Documentar ADRs para modelo de projeto, persistência, backend opcional, histórico de comandos e segurança das chaves de IA.
7. Definir convenção de IDs estáveis, timestamps, autoria e versionamento de documentos.

#### Critério de saída

- Build, lint, testes unitários, E2E e baseline visual executáveis em CI.
- Nenhuma diferença visual não aprovada nos templates atuais.
- Feature flags permitem integrar código desativado sem mudar a experiência existente.

### Etapa 1 - Fundação de projetos, campanhas, alterações seguras e recuperação

#### 1.1 Projetos e campanhas

1. Implementar tipos e schemas Zod para projeto, campanha, arte e card.
2. Criar adaptadores entre o modelo atual (`useEditorStore`/`useSeriesStore`) e documentos versionados.
3. Criar stores finos de seleção e sessão; regras de negócio ficam em serviços puros.
4. Migrar arte avulsa atual para uma campanha padrão somente após backup e confirmação quando necessário.
5. Preservar leitura do histórico `rda-library-v1` e das chaves `rda_ai_keys`.

#### 1.2 Aplicação segura transversal

1. Implementar `Command`, `ChangeSet`, `ChangePreview`, `ValidationResult` e `MutationReceipt`.
2. Criar o seletor comum de escopo e o diálogo comum de pré-visualização.
3. Agrupar alterações em massa em uma transação indivisível.
4. Integrar desfazer/refazer de comandos com o histórico atual sem duplicar eventos de digitação. **Estratégia recomendada:** O zundo temporal atual rastreia apenas `elements` (partialized). Manter o zundo para edições granulares de texto (digitação). Para operações do `MutationService` (que alteram múltiplos campos/cards), usar uma pilha de comandos separada com `ChangeSet` que o zundo não captura. O undo global (`Ctrl+Z`) deve verificar qual pilha tem a operação mais recente.
5. Criar restauração por snapshot para operações que alterem muitos cards.

#### 1.3 Implementação 16 - Salvamento automático e recuperação

**Pré-requisito crítico:** Atualmente `useEditorStore`, `useSeriesStore`, `useDecorStore` e `useUiStore` **não têm persistência nenhuma**. Este passo deve criar a camada de persistência antes de implementar autosave.

1. Criar persistência IndexedDB (via repositórios da 1.1) para os stores hoje ephemeros: editor, séries, decor e UI. Manter `useLibraryStore` (IndexedDB, `rda-library-v1`) e `useAIStore` (localStorage, `rda_ai_keys`) inalterados.
2. Salvar alterações com debounce, flush ao trocar de card/aba e tentativa final em `visibilitychange`.
3. Manter journal de operações e snapshots periódicos com política de retenção por projeto.
4. Detectar sessão interrompida e oferecer `Restaurar`, `Comparar` ou `Descartar`.
5. Permitir nomear e restaurar versões de card ou carrossel.
6. Não incluir segredos de API nos snapshots exportáveis. Lembrar que `useAIStore` usa localStorage e chaves ficam em `rda_ai_keys` — excluir explicitamente do snapshot.
7. Testar fechamento durante digitação, quota cheia, IndexedDB indisponível e migração interrompida.

#### Critério de saída

- Um projeto pode ser fechado e reaberto sem perda de conteúdo.
- Uma alteração em massa pode ser pré-visualizada, aplicada e desfeita como unidade.
- Falhas de persistência são visíveis e não apagam a última versão válida.

### Etapa 2 - Contratos de template, identidade, layout e qualidade

#### 2.0 Pré-requisito — Extensão de tipos e registro de tokens

**Este passo deve ser executado ANTES de qualquer implementação da Etapa 2.**

1. Estender `TemplateDefinition` em `src/features/templates/types.ts` com os campos opcionais descritos na Seção 3.2: `fieldSchema`, `capabilities`, `variants`, `equivalents`, `qualityRules`, `layoutRules`. Todos opcionais (`?:`) para não quebrar os 26 templates existentes.
2. Criar tipos TypeScript concretos para cada campo (não deixar como `unknown`):
   ```ts
   interface FieldSchema { fields: FieldDef[] }
   interface FieldDef { name: string; semantic: string; type: 'text' | 'image' | 'boolean' | 'list' | 'number'; required: boolean; maxLength?: number; bindable: boolean }
   interface TemplateCapabilities { image: boolean; cta: boolean; list: boolean; resize: boolean; styles: string[] }
   interface TemplateVariant { id: string; label: string; density: string; itemCount?: number; hasImage: boolean; ctaPosition?: string }
   interface FormatEquivalent { format: CanvasFormat; templateId: string }
   interface QualityRule { id: string; field?: string; severity: 'error' | 'warning' | 'info'; check: string; params: Record<string, unknown> }
   interface LayoutRule { contentRange: 'short' | 'medium' | 'long'; adjustments: LayoutAdjustment[] }
   interface LayoutAdjustment { property: string; value: unknown }
   ```
3. Criar registro programático de design tokens extraídos de `src/index.css`: cores, fontes (IBM Plex Sans, Rajdhani, Space Grotesk — `@fontsource`), espaçamentos. Esse registro será fonte de verdade para trava de marca e validação.
4. Cadastrar `fieldSchema` para pelo menos 3 templates representativos (um square, um portrait, um carousel) como prova de conceito antes de estender aos 26.

#### 2.1 Implementação 11 - Sistema de estilos de texto

1. Definir estilos semânticos `title`, `subtitle`, `body`, `highlight`, `caption`, `cta`, `eyebrow` e `list-item` usando tokens aprovados.
2. Mapear os primitives atuais (`TTitle`, `TBody`, `TEyebrow`, `TTag`, `TBox`, `TSlot`, `TRedline`, `TPageIndicator` — todos em `src/features/templates/primitives/`) para os estilos sem alterar o CSS renderizado inicialmente.
3. Permitir overrides controlados apenas em propriedades autorizadas.
4. Implementar aplicação em card, carrossel, campanha ou sistema conforme permissão.
5. Exibir impacto e conflitos antes de propagar uma alteração de estilo.
6. Criar testes de contrato para garantir que cada template usa estilos compatíveis.

#### 2.2 Implementação 15 - Templates parametrizados

1. Adicionar variantes declarativas ao registry: densidade, número de itens, imagem, posição de CTA e destaque.
2. Cadastrar primeiro variantes equivalentes ao layout atual, sem mudança visual.
3. Implementar seletor de variante apenas quando a combinação estiver registrada e validada.
4. Definir migração de elementos entre variantes com fallback explícito para campos excedentes.
5. Gerar matriz visual por template, variante, tema e formato.
6. Bloquear combinações não aprovadas no tipo, na interface e no carregamento de dados.

#### 2.3 Implementação 5 - Layouts inteligentes

1. Definir faixas de conteúdo por campo, medições e prioridades de redução.
2. Implementar regras determinísticas de fonte, line-height, quebra, gap e distribuição dentro dos limites de cada template.
3. Medir overflow no nó real com fontes carregadas, sem depender apenas do número de caracteres. **Atenção:** O único nó 1:1 existente é o `ExportNode` (`src/lib/export/ExportNode.tsx`, `position: fixed, left: -99999`). Para evitar race conditions com o pipeline de exportação, criar um segundo nó offscreen dedicado a medições (`MeasureNode`), ou usar o `ExportNode` com um mutex que impede medição durante captura PNG.
4. Oferecer ativação por card/carrossel e prévia lado a lado.
5. Nunca alterar posição livre; o motor escolhe apenas variantes e tokens aprovados.
6. Registrar no `ChangeSet` cada ajuste automático para permitir revisão e undo.

#### 2.4 Implementação 18 - Regras condicionais de composição

1. Criar DSL limitada e tipada para condições (`empty`, `length`, `itemCount`, `hasImage`, `format`).
2. Disponibilizar ações seguras: ocultar campo vazio, escolher variante, reduzir estilo, limitar itens e ajustar destaque.
3. Validar ciclos, conflitos, prioridades e ações incompatíveis ao salvar uma regra.
4. Executar regras em modo dry-run e mostrar a causa de cada alteração.
5. Permitir ativação por card/carrossel e persistência em projeto/campanha/preset.
6. Não permitir JavaScript arbitrário nas regras.

#### 2.5 Implementação 4 - Trava de identidade visual

1. Modelar políticas por categoria: cores, fontes, contraste, espaçamento, estilos, logos, imagens e templates.
2. Derivar valores permitidos dos tokens e assets aprovados, evitando listas duplicadas.
3. Implementar modos `desativada`, `aviso` e `bloqueio` por campanha.
4. Permitir bloquear tudo ou categorias selecionadas.
5. Aplicar a política na entrada, na importação, na IA, nas variações e na exportação.
6. Registrar exceções com motivo e permissão quando o modo da campanha permitir.

#### 2.6 Implementação 6 - Validador de qualidade

1. Criar engine de regras puras com severidades `error`, `warning` e `info`.
2. Cobrir texto cortado, excesso, contraste, resolução de imagem, campo obrigatório vazio, inconsistência de estilo, vínculo quebrado e asset ausente.
3. Usar medições reais do DOM de exportação para overflow e dimensões efetivas da imagem para resolução.
4. Organizar resultados por arte/card e oferecer navegação direta ao campo.
5. Rodar validação incremental durante edição e validação completa antes da exportação.
6. Bloquear exportação somente em erros configurados como impeditivos; recomendações podem ser ignoradas com registro.

#### Critério de saída

- Todos os templates possuem schema mínimo, estilo semântico e regras de qualidade.
- Layout inteligente e regras condicionais nunca geram overflow nem combinação não aprovada.
- Exportações atuais permanecem pixel-equivalentes quando os novos recursos estão desligados.

### Etapa 3 - Presets, componentes, biblioteca e duplicação

#### 3.1 Implementação 10 - Biblioteca central de conteúdo

1. Unificar renders atuais e novos tipos: logos, imagens, fundos, ícones, selos, CTAs, textos e texturas.
2. Manter adaptador para as quatro categorias existentes de renders (`'pessoas' | 'brasoes' | 'objetos' | 'icones'`, definidas em `src/stores/useLibraryStore.ts`) durante a migração. Também migrar:
   - `BG_LIBRARY` — 10 itens de fundo hardcoded em `src/stores/useDecorStore.ts` (gradientes e sólidos). Migrar para a biblioteca como assets do tipo `background`, mantendo o array atual como fallback readonly até a migração completa.
   - Texturas SVG — definidas em `src/lib/textures.ts` (organic, noise, hatching). Registrar como assets do tipo `texture` sem duplicar as definições SVG.
3. Persistir metadados separados dos blobs: nome, tipo MIME, dimensões, hash, tags, categoria, favorito e usos.
4. Calcular hash em Web Worker e alertar sobre duplicidade antes de armazenar.
5. Implementar busca, filtros, ordenação, favoritos, edição de tags e painel de uso.
6. Impedir exclusão destrutiva quando houver vínculos; oferecer substituir ou arquivar.
7. Virtualizar listas e gerar thumbnails para não degradar memória e inicialização.

#### 3.2 Implementação 1 - Presets de campanha

1. Modelar preset versionado com paleta, estilos, logos, texturas, rodapés, selos e CTAs.
2. Permitir criar preset a partir da campanha ou seleção atual.
3. Exibir seleção granular das propriedades que serão substituídas.
4. Resolver compatibilidade por `fieldSchema` e `capabilities` do template.
5. Pré-visualizar card atual ou todos os cards do carrossel antes da aplicação.
6. Salvar preferências de aplicação no projeto/campanha/preset sem reaplicar automaticamente.
7. Registrar versão do preset usada para permitir atualização ou permanência na versão anterior.

#### 3.3 Implementação 3 - Componentes vinculados

1. Criar componentes compartilhados para logo, rodapé, selo, numeração e CTA.
2. Armazenar referência ao componente e overrides locais, sem copiar valores silenciosamente.
3. Indicar visualmente vínculo, origem, versão e cards consumidores.
4. Propagar atualização via prévia e confirmação no escopo selecionado.
5. Permitir desvincular um card preservando o valor materializado naquele momento.
6. Detectar vínculo quebrado, conflito de tipo e componente excluído no validador.
7. Incluir vínculos e overrides em duplicação, importação e exportação de projeto.

#### 3.4 Implementação 12 - Duplicação com conteúdo alternativo

1. Usar o `fieldSchema` para listar variáveis substituíveis por significado, não por nome bruto.
2. Permitir duplicar card, carrossel ou campanha.
3. Exibir matriz `manter | substituir | limpar` para concurso, disciplina, cargo, público, CTA e demais campos compatíveis.
4. Validar valores, vínculos, assets e trava de marca antes da criação.
5. Mostrar prévia do conjunto duplicado e nomes resultantes.
6. Criar novos IDs e preservar apenas os vínculos explicitamente escolhidos.

#### Critério de saída

- Assets atuais continuam acessíveis após a migração.
- Presets e componentes podem ser propagados e desfeitos sem perder overrides locais.
- Duplicação nunca compartilha estado mutável acidentalmente.

### Etapa 4 - Comandos, atalhos e dados reutilizáveis

#### 4.1 Implementação 17 - Central de comandos e atalhos

1. Criar registro único de comandos com ID, título, categoria, contexto, permissão, atalho e função.
2. Migrar os atalhos atuais de undo, redo, salvar, exportar e abas para o registro sem mudar seu comportamento. Os atalhos hoje estão implementados inline em `src/app/AppShell.tsx` (event listeners de teclado dentro de `useEffect`).
3. Implementar command palette com busca por ações, templates, assets, formatos, presets e exportações.
4. Permitir personalização, detectar conflitos internos e reservar combinações do navegador/sistema.
5. Não disparar comandos globais durante digitação, seleção de texto ou diálogo modal.
6. Persistir atalhos por projeto ou preferência local e oferecer restauração dos padrões.
7. Testar teclado Windows/macOS e acessibilidade de foco.

#### 4.2 Implementação 20 - Central de dados reutilizáveis

1. Criar schemas configuráveis para concurso, banca, cargo, salário, disciplina, datas e registros futuros.
2. Oferecer CRUD, importação, busca, tags, fonte, data de atualização e status de verificação.
3. Vincular campos de card por binding tipado com fallback materializado.
4. Ao atualizar um registro, calcular impacto e pedir confirmação antes de sincronizar artes.
5. Permitir congelar valor em um card, desvincular ou aceitar atualização.
6. Validar formato de datas, moeda, campos obrigatórios e referências quebradas.
7. Registrar histórico de alterações do dado e das artes sincronizadas.

#### Critério de saída

- Todos os comandos existentes funcionam pelo novo registro e continuam acessíveis pela UI atual.
- Atualizações de dados exibem exatamente quais cards e campos serão alterados antes da confirmação.

### Etapa 5 - Lote, multiformato e processamento em escala

#### 5.1 Implementação 2 - Criação em lote por planilha

1. Adicionar importadores isolados para CSV e XLSX, com limite de tamanho e processamento em Web Worker. **Biblioteca recomendada:** `xlsx` (SheetJS Community Edition) para leitura com suporte a `.xlsx`, `.xls` e `.csv` em um único pacote. Alternativa leve: `read-excel-file` (~50KB) se apenas `.xlsx` for necessário. Instalar a dependência escolhida antes de iniciar este passo.
2. Detectar cabeçalhos, encoding, separador, planilha e linhas vazias sem adivinhar silenciosamente.
3. Criar interface de mapeamento coluna -> campo semântico do template/campanha.
4. Permitir mapear URLs ou nomes de assets existentes para campos de imagem.
5. Validar cada linha com schema e separar erros impeditivos de avisos.
6. Exibir prévia paginada dos cards/carrosséis/campanhas e estimativa de volume.
7. Gerar em lotes transacionais, com progresso, cancelamento e relatório de falhas por linha.
8. Evitar duplicação por chave escolhida pelo usuário e permitir reprocessar apenas falhas.
9. Criar testes com acentos, fórmulas, células vazias, arquivos grandes e conteúdo malformado.

#### 5.2 Implementação 9 - Redimensionamento multiformato

1. Cadastrar equivalências aprovadas entre quadrado, retrato/story e carrossel.
2. Definir mapeamento semântico de campos e política para conteúdo sem destino equivalente.
3. Escolher template equivalente pela capacidade, densidade e presença de imagem.
4. Aplicar layout inteligente e regras condicionais no destino.
5. Exibir prévia de cada formato com avisos de truncamento, omissão e troca de variante.
6. Criar nova arte por padrão; substituição da origem exige confirmação explícita.
7. Validar qualidade e marca antes de confirmar a conversão.

#### Critério de saída

- Importação de lote não bloqueia a interface e pode retomar falhas.
- Conversão nunca cria template novo nem posicionamento livre; usa somente equivalências aprovadas.
- Operações grandes podem ser canceladas sem deixar documentos parciais inválidos.

### Etapa 6 - Geração assistida, variações e pacotes

#### 6.1 Fundação de IA estruturada

1. Criar `AIOrchestrator` como wrapper sobre os módulos atuais `src/lib/ai/generateCopy.ts` e `src/lib/ai/generateImage.ts`, separado da interface e dos stores. **Não substituir** os módulos existentes — encapsulá-los. O `useAIStore` (`src/stores/useAIStore.ts`) continua sendo a fonte de configuração de modelos e chaves.
2. Definir respostas com JSON Schema/Zod para briefing, estrutura, cards, campos e alternativas.
3. Incluir limites e capacidades dos templates no contexto, sem enviar blobs desnecessários.
4. Validar e reparar resposta uma vez; falhar de forma clara se continuar inválida.
5. Registrar modelo, prompt versionado, tempo, custo estimado e decisão do usuário, sem registrar chave.
6. Implementar cancelamento, timeout, retry controlado e proteção contra respostas duplicadas.

#### 6.2 Implementação 22 - Assistente de criação passo a passo

1. Adicionar ação `Criar com assistente` na central de comandos e ponto visível na área de criação.
2. Implementar wizard com uma pergunta por etapa: objetivo, público, tema, informações obrigatórias, tom, formato, quantidade, CTA, imagens e campos recomendados pelo schema.
3. Salvar rascunho do wizard e permitir voltar sem perder respostas.
4. Enviar ao DeepSeek um contrato contendo somente formatos, templates, variantes, campos e limites aprovados.
5. Proibir no contrato novos templates, novas cores, novas fontes e alterações da identidade visual.
6. Exibir estrutura e copy propostos, templates escolhidos e alertas antes da geração.
7. Permitir editar, regenerar apenas um campo/card ou trocar por template compatível.
8. Gerar via `MutationService`, validar, salvar snapshot e abrir automaticamente o resultado no editor.
9. Preservar a possibilidade de download e ajustes manuais controlados após a geração.

#### 6.3 Implementação 7 - Assistente de carrossel com IA

1. Receber briefing e restrições de quantidade, público, objetivo e CTA.
2. Gerar estrutura semântica: capa, desenvolvimento, exemplos, conclusão e CTA.
3. Exibir outline editável antes de selecionar templates.
4. Recomendar somente templates/variantes compatíveis com o papel e a densidade de cada card.
5. Permitir gerar novo carrossel ou propor substituição do atual, sempre com comparação.
6. Validar continuidade, repetição, numeração, CTA, marca e overflow.
7. Permitir regeneração isolada sem alterar cards aprovados.

#### 6.4 Implementação 8 - Variações automáticas

1. Definir tipos de variação: título, corpo, CTA, imagem, paleta autorizada e template compatível.
2. Permitir selecionar campos que podem variar e campos bloqueados.
3. Gerar candidatos imutáveis em branches, sem sobrescrever o original.
4. Aplicar preset e trava de marca a todos os candidatos.
5. Exibir comparação visual e textual, com qualidade e diferenças destacadas.
6. Permitir aceitar por card ou conjunto e desfazer a promoção.
7. Evitar explosão combinatória com limites configuráveis e deduplicação semântica.

#### 6.5 Implementação 21 - Pacotes de campanha completos

1. Criar fluxo de briefing para selecionar formatos, templates, preset, conteúdos, volume e dados vinculados.
2. Planejar o pacote antes de gerar: feed, stories, retratos e carrosséis com papéis coordenados.
3. Reutilizar conteúdos e componentes por vínculo, com overrides por formato.
4. Gerar cada peça somente com templates e variantes existentes.
5. Exibir visão geral do pacote e prévia individual antes de confirmar.
6. Manter `campaignId`, `packageId` e origem comum mesmo após edição individual.
7. Permitir regenerar ou converter uma peça sem quebrar as demais.

#### Critério de saída

- Nenhuma resposta de IA entra no documento sem validação estrutural e revisão humana.
- O assistente usa apenas templates, paleta, fontes e identidade existentes.
- Falha ou cancelamento de IA não altera a arte atual.

### Etapa 7 - Revisão, aprovação e calendário editorial

#### 7.1 Implementação 13 - Fluxo de revisão e aprovação

1. Modelar estados `draft`, `in-review`, `changes-requested`, `approved` e `published` com transições permitidas.
2. Criar comentários por card com resolução, autor, responsável e timestamps.
3. Registrar decisões e transições em trilha imutável de auditoria.
4. Implementar responsáveis, prazos, filtros e notificações dentro da aplicação.
5. Oferecer bloqueio opcional de edição após aprovação; reabrir exige motivo e permissão.
6. Gerar nova revisão quando conteúdo aprovado for alterado.
7. No modo local, identificar autores locais; no modo multiusuário, usar autenticação e backend.
8. **Modo local:** autorização pode ser enforced apenas no cliente, pois não há servidor. Implementar como validação de transições (estado → estado) nos serviços de domínio, não na UI. **Modo multiusuário:** duplicar a validação no servidor; o cliente nunca é a única barreira de autorização. Separar claramente os dois modos com interface comum e implementações distintas.

#### 7.2 Implementação 19 - Calendário editorial integrado

1. Adicionar aba `Planejamento`, independente de `Arte` e `Marca`, sem remover abas atuais.
2. Criar visões calendário, lista e campanha com pautas, prazos, responsáveis e status.
3. Vincular itens editoriais a campanhas, artes e pacotes existentes por ID.
4. Implementar filtros por período, responsável, campanha, formato e status.
5. Permitir abrir a arte correspondente diretamente no editor e voltar ao contexto do calendário.
6. Tratar fuso horário, data sem hora e prazo com hora explicitamente.
7. Impedir exclusão silenciosa de pauta vinculada; arquivar por padrão.
8. Preparar sincronização futura por API sem acoplar o calendário ao store visual.

#### Critério de saída

- Transições inválidas e edições pós-aprovação são impedidas conforme política.
- Comentários e decisões permanecem vinculados à revisão correta.
- Navegação calendário -> arte -> calendário preserva filtros e posição.

### Etapa 8 - Exportação padronizada e programada

#### 8.1 Implementação 14 - Perfis de exportação

1. Modelar perfis com formato, escala/resolução, qualidade, padrão de nome, ordem e estrutura ZIP.
2. Validar tokens de nome e sanitizar caracteres incompatíveis com sistemas de arquivos.
3. Reutilizar `ExportEngine` e o nó offscreen; não criar uma segunda implementação de captura.
4. Executar o validador completo antes de enfileirar.
5. Gerar manifesto do lote com arquivos, checksums, avisos e falhas.
6. Permitir salvar perfil em projeto, campanha ou preset e pré-visualizar nomes/ordem.

#### 8.2 Agendamento e fila

1. Criar estados de job `queued`, `running`, `completed`, `failed`, `cancelled` e `needs-attention`.
2. No modo local, suportar fila processada enquanto o app estiver aberto e deixar essa limitação explícita.
3. Para execução no horário com navegador fechado, implementar API, armazenamento de assets e worker de renderização server-side. **Atenção arquitetural:** `html2canvas-pro` é uma biblioteca browser-only (depende do DOM). A renderização server-side exige uma abordagem diferente: Puppeteer ou Playwright headless com as mesmas fontes e templates carregados. Isso é um escopo significativo — considerar implementar apenas a fila client-side na primeira versão e deixar o agendamento offline como feature futura marcada com flag.
4. Fixar versão do documento e do renderer no job para garantir reprodutibilidade.
5. Implementar retry com limite, cancelamento, relatório por arte e retomada de falhas.
6. Não marcar job como concluído se houver arquivo ausente ou checksum inválido.

#### Critério de saída

- O mesmo documento e perfil geram nomes, ordem, dimensões e estrutura reproduzíveis.
- Jobs falhos indicam o card e a causa e podem ser retomados sem repetir sucessos.
- Exportação manual atual continua disponível e produz o mesmo resultado quando usado com perfil padrão.

### Etapa 9 - Endurecimento, desempenho e rollout

#### Passos

1. Executar migrações com cópia de segurança e teste em dados reais anonimizados.
2. Medir projetos com 1, 20, 100 e 500 cards; corrigir renderizações e subscriptions desnecessárias.
3. Virtualizar galerias, calendário, biblioteca e prévias extensas.
4. Auditar acessibilidade: teclado, foco, leitores de tela, contraste e modais.
5. Auditar segurança: upload, MIME real, nomes de arquivo, CSV injection, fórmulas XLSX, XSS, URLs externas, segredos e autorização.
6. Testar offline, quota de armazenamento, falha de rede, retry, cancelamento e recuperação.
7. Liberar por feature flag em grupos, com telemetria de erro sem conteúdo sensível.
8. Só remover adaptadores antigos após duas versões estáveis e migração comprovadamente reversível.

## 6. Estratégia de testes por camada

### Unitários

- Schemas e migrações de documentos.
- Mapping semântico de campos e formatos.
- Regras condicionais, políticas de marca e qualidade.
- Geração de `ChangeSet`, undo, snapshots e conflitos.
- Nomes de exportação, transições de workflow e atalhos.

### Integração

- Stores + repositórios IndexedDB.
- Editor atual + documento de campanha.
- Presets, componentes vinculados e dados sincronizados.
- Importação CSV/XLSX e retomada parcial.
- IA estruturada com respostas mockadas válidas, inválidas e incompletas.

### E2E

- Criar, editar, salvar, recuperar e exportar arte atual.
- Aplicar/desfazer em card e carrossel.
- Converter formatos, gerar lote e pacote.
- Revisar/aprovar, comentar e bloquear edição.
- Planejar no calendário e retornar ao editor.
- Executar fila de exportação e tratar falhas.

### Visual

- Baseline dos 26 templates em light/dark.
- Variantes parametrizadas e layouts curto/médio/longo.
- Prévia, editor e exportação nas resoluções oficiais.
- Topbar, painéis e fluxos novos em desktop, tablet e mobile.

### Desempenho

- Tempo de abertura do projeto e troca de card.
- Memória com biblioteca grande e prévias de lote.
- Autosave durante digitação.
- Captura individual, ZIP e fila extensa.
- Parsing de planilha e hashing em Web Worker.

## 7. Critérios globais de pronto

Uma implementação só pode ser considerada concluída quando:

1. Possui flag, permissões e preferência persistente quando aplicável.
2. Implementa ativação individual e escopo `Card atual | Carrossel inteiro` quando compatível.
3. Operações em massa têm dry-run, prévia, confirmação e undo/restauração.
4. Passa por trava de marca, validação de schema e validador de qualidade.
5. Não altera documentos enquanto a proposta ainda está em revisão.
6. Possui estados de loading, vazio, erro, cancelamento e recuperação.
7. Tem testes proporcionais ao risco e documentação de uso/manutenção.
8. Mantém build TypeScript estrito, lint e testes sem erros.
9. Não muda o baseline visual atual com o recurso desligado.
10. Migração é versionada, idempotente e testada para ida e recuperação.

## 8. Auditoria final

### 8.1 Auditoria funcional das 22 implementações

1. Executar uma matriz de aceite com uma linha por implementação e evidência de teste.
2. Confirmar que todos os recursos compatíveis exibem toggle, escopo, prévia, undo e persistência.
3. Testar operações individuais e em carrossel com cards de templates diferentes.
4. Validar combinações entre recursos: preset + trava, planilha + dados, IA + layouts, aprovação + exportação e pacote + multiformato.
5. Confirmar que cancelar, falhar ou fechar um fluxo não deixa mutações parciais.

### 8.2 Auditoria de regressão

1. Comparar capturas dos 26 templates, light/dark, com o baseline aprovado.
2. Reexecutar todos os fluxos existentes de edição, decor, IA, renders, histórico, série e exportação.
3. Validar atalhos atuais e responsividade da topbar e dos painéis laterais.
4. Abrir projetos anteriores, exportá-los e comparar resultado com a versão anterior.
5. Confirmar que o perfil padrão de exportação mantém dimensões, escala e qualidade atuais.

### 8.3 Auditoria de dados e recuperação

1. Testar migração a partir de cada versão persistida suportada.
2. Simular interrupção no meio da migração, autosave, lote, sincronização e exportação.
3. Validar restauração de snapshot e integridade de blobs por hash.
4. Confirmar retenção, arquivamento e exclusão segura de assets vinculados.
5. Verificar que nenhum segredo de API aparece em exportações, logs, snapshots ou telemetria.

### 8.4 Auditoria de segurança

1. Revisar upload e parsing contra arquivos maliciosos, CSV injection, fórmulas, MIME falso e URLs inseguras.
2. Revisar sanitização de conteúdo renderizado e nomes de arquivo.
3. Revisar CORS, rate limit, autenticação, autorização e isolamento por projeto no backend.
4. Confirmar que prompts e respostas de IA não contornam schemas, tokens e políticas de marca.
5. Executar análise de dependências e corrigir vulnerabilidades relevantes antes do rollout.

### 8.5 Auditoria de acessibilidade e responsividade

1. Testar 390, 768, 1024, 1280 e 1440 pixels, além de zoom do navegador em 200%.
2. Garantir ausência de overflow horizontal e sobreposição entre header, drawers, diálogos e canvas.
3. Validar navegação completa por teclado, ordem de foco, escape e retorno de foco.
4. Conferir nomes acessíveis, mensagens de erro e anúncios de progresso.
5. Validar contraste tanto na aplicação quanto nas artes geradas.

### 8.6 Auditoria de desempenho e operação

1. Comparar métricas com o baseline da Etapa 0 e definir limites de regressão.
2. Executar testes de carga para bibliotecas, campanhas, calendário e lotes grandes.
3. Validar observabilidade de jobs e erros sem coletar conteúdo sensível.
4. Documentar backup, restauração, rollback de release e compatibilidade de schema.
5. Realizar rollout gradual; remover flags apenas após estabilidade observada.

### Saída da auditoria

Produzir `AUDITORIA_22_RECURSOS.md` contendo, para cada item, status, versão, evidências, diferenças aprovadas, riscos residuais e decisão de liberação. Nenhum recurso com erro impeditivo, migração sem recuperação ou regressão visual não aprovada poderá ser liberado como padrão.

## 9. Ordem recomendada de entrega

1. Baseline e fundação de documentos.
2. Autosave, snapshots e aplicação segura.
3. Metadados, estilos, variantes, layouts, regras, trava e validador.
4. Biblioteca, presets, componentes e duplicação.
5. Central de comandos e dados reutilizáveis.
6. Planilhas e redimensionamento.
7. IA guiada, carrossel, variações e pacotes.
8. Revisão, aprovação e calendário.
9. Exportação padronizada e programada.
10. Endurecimento, auditoria final e rollout gradual.

Essa ordem reduz retrabalho: as funcionalidades de alto nível reutilizam o mesmo modelo de campanha, os mesmos schemas de template, o mesmo validador e o mesmo mecanismo de prévia/undo, em vez de criarem fluxos paralelos incompatíveis.
