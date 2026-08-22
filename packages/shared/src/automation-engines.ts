/**
 * automation-engines.ts
 *
 * Catálogo compartilhado dos 7 motores de automação do Prospector.
 * Consumido por: web (API + UI), scheduler e testes.
 *
 * GARANTIA: nenhuma lógica de worker existente é modificada aqui.
 * Os `workers` de cada motor referenciam queue_names já existentes em QUEUE_NAMES.
 * Nenhum worker é criado ou removido.
 */

import type { QueueName } from './index.js'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type EngineKey = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'

export type EngineState = 'off' | 'starting' | 'on' | 'attention' | 'error'

export type PrerequisiteKey =
  | 'news_source_active'
  | 'connected_account_healthy'
  | 'budget_ceiling_set'
  | 'embeddings_healthy'
  | 'ai_provider_configured'
  | 'thesis_exists'
  | 'actor_account_healthy'
  | 'kill_switch_off'
  | 'approved_variant_exists'
  | 'contact_policy_configured'

export interface PrerequisiteDefinition {
  key: PrerequisiteKey
  label_pt: string
  /** Rota onde o usuário resolve o pré-requisito */
  href: string
}

export interface AutomationEngine {
  key: EngineKey
  slug: string
  name_pt: string
  description_pt: string
  alwaysOn: boolean
  /** Engine keys que devem estar on para este funcionar */
  dependsOn: EngineKey[]
  /** Queue names dos workers pertencentes a este motor */
  workers: QueueName[]
  /** Pré-requisitos que bloqueiam a UI de ligar este motor */
  prerequisites: PrerequisiteKey[]
}

export interface CadencePreset {
  id: string
  label_pt: string
  /** Valor cron ou every: para enviar ao backend */
  value: string
}

// ---------------------------------------------------------------------------
// AUTOMATION_ENGINES — catálogo dos 7 motores
// Contagem de workers por motor (total = 41):
//   M0: 2 | M1: 12 | M2: 8 | M3: 2 | M4: 3 | M5: 11 | M6: 3
// ---------------------------------------------------------------------------

export const AUTOMATION_ENGINES: AutomationEngine[] = [
  {
    key: 'M0',
    slug: 'base-operacional',
    name_pt: 'Base Operacional',
    description_pt: 'Monitora saúde do sistema e atualiza dados agregados. Sempre ativo.',
    alwaysOn: true,
    dependsOn: [],
    prerequisites: [],
    workers: ['alerts', 'data-quality'],
  },
  {
    key: 'M1',
    slug: 'coleta-radar',
    name_pt: 'Coleta e Radar',
    description_pt: 'Captura notícias, RSS, Reddit, busca web, menções e concorrentes.',
    alwaysOn: false,
    dependsOn: [],
    prerequisites: ['news_source_active', 'connected_account_healthy'],
    workers: [
      'news-radar',
      'reddit-intelligence',
      'adaptive-crawler',
      'discovery',
      'extraction',
      'meta-sync',
      'meta-webhook-consumer',
      'mention-monitor',
      'follower-mining',
      'search-mining',
      'live-monitor',
      'collab-discovery',
    ],
  },
  {
    key: 'M2',
    slug: 'inteligencia',
    name_pt: 'Inteligência e Priorização',
    description_pt: 'Classifica temas, extrai sentimento, ranqueia leads e calcula scores.',
    alwaysOn: false,
    dependsOn: ['M1'],
    prerequisites: ['embeddings_healthy', 'ai_provider_configured'],
    workers: [
      'competitive-intel',
      'classification',
      'scoring',
      'enrichment',
      'community-map',
      'audience-overlap',
      'reciprocity-detector',
      'nba-engine',
    ],
  },
  {
    key: 'M3',
    slug: 'motor-editorial',
    name_pt: 'Motor Editorial',
    description_pt: 'Transforma sinais em oportunidades de pauta e distribui formatos.',
    alwaysOn: false,
    dependsOn: ['M2'],
    prerequisites: ['thesis_exists'],
    workers: ['content-opportunity', 'content-item-orchestrator'],
  },
  {
    key: 'M4',
    slug: 'publicacao',
    name_pt: 'Publicação',
    description_pt:
      'Envia posts aprovados para Instagram e Threads. Ligar não posta nada sem aprovação humana prévia.',
    alwaysOn: false,
    dependsOn: ['M3'],
    prerequisites: ['actor_account_healthy', 'kill_switch_off', 'approved_variant_exists'],
    workers: ['publisher', 'threads-publisher', 'threads-adapter'],
  },
  {
    key: 'M5',
    slug: 'relacionamento',
    name_pt: 'Relacionamento e Mensageria',
    description_pt: 'Orquestra conversas, envios de e-mail, respostas privadas e WhatsApp.',
    alwaysOn: false,
    dependsOn: ['M2'],
    prerequisites: ['contact_policy_configured', 'connected_account_healthy'],
    workers: [
      'email-flow-engine',
      'email-events-consumer',
      'whatsapp-inbound',
      'whatsapp-outbound',
      'conversation-agent',
      'dm-copilot',
      'private-reply',
      'engagement',
      'contact-policy-engine',
      'next-best-channel',
      'identity-resolver',
    ],
  },
  {
    key: 'M6',
    slug: 'medicao-resultado',
    name_pt: 'Medição e Resultado',
    description_pt: 'Calcula ROI por origem, conversões de leads e retenção.',
    alwaysOn: false,
    dependsOn: ['M4', 'M5'],
    prerequisites: [],
    workers: ['source-roi', 'conversion-tracking', 'retention-tracker'],
  },
]

/** Lookup rápido por key */
export const ENGINE_BY_KEY: Record<EngineKey, AutomationEngine> = Object.fromEntries(
  AUTOMATION_ENGINES.map((e) => [e.key, e]),
) as Record<EngineKey, AutomationEngine>

// ---------------------------------------------------------------------------
// Pré-requisitos
// ---------------------------------------------------------------------------

export const PREREQUISITE_DEFINITIONS: PrerequisiteDefinition[] = [
  { key: 'news_source_active',      label_pt: 'Pelo menos 1 fonte de notícias ativa',         href: '/configuracoes?aba=contas' },
  { key: 'connected_account_healthy', label_pt: 'Conta social conectada e saudável',           href: '/configuracoes?aba=contas' },
  { key: 'budget_ceiling_set',       label_pt: 'Teto de orçamento definido',                    href: '/desempenho?aba=orcamento' },
  { key: 'embeddings_healthy',       label_pt: 'Serviço de embeddings ativo',                   href: '/configuracoes?aba=saude' },
  { key: 'ai_provider_configured',   label_pt: 'Provedor de IA configurado',                    href: '/configuracoes?aba=ia' },
  { key: 'thesis_exists',            label_pt: 'Pelo menos 1 tese editorial cadastrada',        href: '/conteudo?aba=teses' },
  { key: 'actor_account_healthy',    label_pt: 'Conta com papel actor saudável',                href: '/configuracoes?aba=contas' },
  { key: 'kill_switch_off',          label_pt: 'Kill-switch global desligado',                  href: '/automacoes?aba=motores' },
  { key: 'approved_variant_exists',  label_pt: 'Pelo menos 1 variante aprovada aguardando',    href: '/conteudo?aba=funil' },
  { key: 'contact_policy_configured', label_pt: 'Políticas de contato definidas',              href: '/relacionamento?aba=politicas' },
]

/** Lookup rápido por key */
export const PREREQUISITE_BY_KEY: Record<PrerequisiteKey, PrerequisiteDefinition> =
  Object.fromEntries(PREREQUISITE_DEFINITIONS.map((p) => [p.key, p])) as Record<
    PrerequisiteKey,
    PrerequisiteDefinition
  >

// ---------------------------------------------------------------------------
// Presets de cadência (passo 2.3)
// ---------------------------------------------------------------------------

export const CADENCE_PRESETS: CadencePreset[] = [
  { id: 'every-15m',    label_pt: 'A cada 15 minutos', value: 'every:900000'      },
  { id: 'every-1h',     label_pt: 'A cada hora',       value: 'every:3600000'     },
  { id: 'daily-6h',     label_pt: 'Diariamente às 06:00', value: '0 6 * * *'    },
  { id: 'daily-1h',     label_pt: 'Diariamente à 01:00',  value: '0 1 * * *'    },
  { id: 'daily-4h',     label_pt: 'Diariamente às 04:00', value: '0 4 * * *'    },
  { id: 'weekly-monday', label_pt: 'Semanalmente (segunda às 05:00)', value: '0 5 * * 1' },
  { id: 'every-1m',     label_pt: 'A cada minuto (publishers)',       value: 'every:60000' },
  { id: 'every-5m',     label_pt: 'A cada 5 minutos',  value: 'every:300000'     },
]

/**
 * parseCadenceLabel — converte um valor cron técnico na frase PT-BR equivalente.
 * Usado para exibir cadências já salvas sem forçar o usuário a reeditar.
 */
export function parseCadenceLabel(cadence: string): string {
  const preset = CADENCE_PRESETS.find((p) => p.value === cadence)
  if (preset) return preset.label_pt

  // every:N — converter para frase legível
  if (cadence.startsWith('every:')) {
    const ms = Number(cadence.slice(6))
    if (!Number.isFinite(ms) || ms <= 0) return cadence
    const mins = Math.round(ms / 60_000)
    if (mins < 60) return `A cada ${mins} min`
    const hours = Math.round(ms / 3_600_000)
    if (hours < 24) return `A cada ${hours}h`
    const days = Math.round(ms / 86_400_000)
    return `A cada ${days}d`
  }

  // Padrão cron — exibir como está (modo avançado)
  return cadence
}

// ---------------------------------------------------------------------------
// Funções de cascata (puras, sem efeito colateral) — passo 2.4
// ---------------------------------------------------------------------------

/**
 * resolveEnableCascade — retorna a lista ordenada de motores que precisam
 * ser ligados junto ao ligar `engineKey`, respeitando `dependsOn`.
 * Pura e testável sem banco.
 */
export function resolveEnableCascade(engineKey: EngineKey): EngineKey[] {
  const result: EngineKey[] = []
  const visited = new Set<EngineKey>()

  function visit(key: EngineKey) {
    if (visited.has(key)) return
    visited.add(key)
    const engine = ENGINE_BY_KEY[key]
    for (const dep of engine.dependsOn) {
      visit(dep as EngineKey)
    }
    result.push(key)
  }

  visit(engineKey)
  // Remove o próprio motor alvo — o caller já sabe qual é
  return result.filter((k) => k !== engineKey)
}

/**
 * resolveDisableCascade — retorna a lista de motores que seriam afetados
 * ao desligar `engineKey`, por dependerem dele (direta ou indiretamente).
 * Pura e testável sem banco.
 */
export function resolveDisableCascade(engineKey: EngineKey): EngineKey[] {
  const dependents: EngineKey[] = []

  function findDependents(key: EngineKey) {
    for (const engine of AUTOMATION_ENGINES) {
      if (engine.dependsOn.includes(key) && !dependents.includes(engine.key)) {
        dependents.push(engine.key)
        findDependents(engine.key)
      }
    }
  }

  findDependents(engineKey)
  return dependents
}

/**
 * hasDepCycle — detecta ciclos no grafo de dependências.
 * Retorna true se houver ciclo.
 */
export function hasDepCycle(): boolean {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color: Record<EngineKey, number> = {} as Record<EngineKey, number>
  for (const e of AUTOMATION_ENGINES) color[e.key] = WHITE

  function dfs(key: EngineKey): boolean {
    color[key] = GRAY
    for (const dep of ENGINE_BY_KEY[key].dependsOn) {
      const depKey = dep as EngineKey
      if (color[depKey] === GRAY) return true
      if (color[depKey] === WHITE && dfs(depKey)) return true
    }
    color[key] = BLACK
    return false
  }

  for (const e of AUTOMATION_ENGINES) {
    if (color[e.key] === WHITE && dfs(e.key)) return true
  }
  return false
}
