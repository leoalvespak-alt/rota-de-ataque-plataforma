import { CONTENT_FORMATS, type ContentFormat } from '@/domain/editorial/types'
import { SOCIAL_COPY_GUIDELINES, SOCIAL_CAPTION_GUIDELINES, type SocialCaptionBrief, buildSocialCaptionPrompt } from '@/domain/editorial/copyGuidelines'

export interface CopyContract {
  purpose: string
  requirements: string[]
  outputShape: string
}

export const COPY_CONTRACTS: Record<ContentFormat, CopyContract> = {
  post: {
    purpose: 'Entregar uma orientação, descoberta, comparação ou convite completo em uma imagem.',
    requirements: [
      'Comece pela situação ou decisão reconhecível pelo público.',
      'Em conteúdo educativo, explique o que fazer e inclua o motivo ou critério necessário para aplicar.',
      'Use uma prova visual apenas quando ela estiver legível e sustentar a afirmação.',
      'Não dependa de legenda para completar a orientação principal.',
    ],
    outputShape: 'Retorne título, texto final da arte e CTA somente quando houver uma ação pertinente.',
  },
  carousel: {
    purpose: 'Desenvolver um argumento ou ensinar uma decisão por etapas.',
    requirements: [
      'Entregue a promessa da capa ao longo da sequência.',
      'Cada card deve acrescentar critério, motivo, exemplo, distinção, aplicação ou limite.',
      'Escreva o argumento completo antes de dividi-lo e não repita a mesma ideia em cards diferentes.',
      'Não inclua numeração visível de cards.',
    ],
    outputShape: 'Separe os cards com uma linha contendo [[CARD]]. Identifique a função de cada card fora do texto publicável.',
  },
  story: {
    purpose: 'Explicar um passo, aproximar uma situação ou responder a uma dúvida em leitura rápida.',
    requirements: [
      'Dê uma contribuição compreensível por tela e faça a sequência avançar.',
      'Repita o referente necessário para quem entrar no meio da sequência.',
      'Preserve instruções e condições de aplicação; não reduza cada tela a frases de efeito.',
      'Não simule enquete, caixa, botão ou link dentro da arte.',
    ],
    outputShape: 'Separe as telas com uma linha contendo [[FRAME]]. Não numere as telas no texto publicável.',
  },
  slide: {
    purpose: 'Apresentar uma ideia por tela em uma sequência que preserve contexto e raciocínio.',
    requirements: [
      'Use títulos informativos e desenvolva cada ponto com a explicação necessária.',
      'Mantenha termos, números e conclusões ligados à fonte que os sustenta.',
      'Evite transformar uma explicação em uma coleção de slogans.',
    ],
    outputShape: 'Retorne cada tela com título e conteúdo separados; preserve a ordem lógica da apresentação.',
  },
  document: {
    purpose: 'Responder uma pergunta com contexto, passos, demonstração e limites suficientes para consulta.',
    requirements: [
      'Responda ao núcleo da pergunta nos primeiros parágrafos.',
      'Organize as seções por decisões do leitor e inclua exemplos identificados quando ajudarem a aplicar.',
      'Diferencie fato confirmado, interpretação, recomendação didática e lacuna factual.',
      'Use referências próximas às afirmações factuais quando as fontes estiverem disponíveis.',
    ],
    outputShape: 'Retorne título e texto desenvolvido em Markdown, com seções quando ajudarem a leitura.',
  },
}

export const COPY_SAFETY_RULES = [
  'Escreva em português brasileiro natural.',
  'Não invente fatos sobre produto, oferta, concursos, resultados, depoimentos, datas ou números.',
  'Use somente as fontes fornecidas para afirmações verificáveis; se faltar base, descreva a lacuna em nota separada do texto publicável.',
  'Preserve distinções entre fato confirmado, interpretação, recomendação didática e exemplo hipotético.',
  'Não use travessão em texto publicável de posts, carrosséis ou Stories.',
  'Evite estas palavras e flexões no texto novo: Tapeçaria, Promover, Explorar, Integrar, Alavancar, Otimizar, Utilizar, Modernizar, Construir, Implementar, Transformar, Meticuloso, Navegando, Complexidades, De ponta, Sob medida e Crucial.',
  'Evite: “Ah, o velho...”, “Mergulhe em”, “Vamos dar uma olhada”, “Libere”, “Revolucionário”, “Junte-se a mim”, “Prepare-se”, perguntas retóricas, emojis decorativos, listas no padrão “X e também Y” e construções contrastivas retóricas.',
  'Mantenha o conteúdo em revisão humana. Uma nota de qualidade automática não comprova a veracidade de uma alegação.',
] as const

export function toContentFormat(format: string): ContentFormat {
  if ((CONTENT_FORMATS as readonly string[]).includes(format)) return format as ContentFormat
  throw new Error(`Formato editorial sem contrato: ${format}`)
}

export function splitCopyUnits(text: string, marker: '[[CARD]]' | '[[FRAME]]') {
  const marked = text.split(marker)
  const units = (marked.length > 1 ? marked : text.split(/\n\s*\n+/))
    .map((unit) => unit.trim())
    .filter(Boolean)
  return units
}

export function buildCopyPrompt(input: {
  format: ContentFormat
  thesis: string
  argument: string
  hook: string
  tone?: string | null
  supportingPoints: string[]
  cta?: string | null
}) {
  const contract = COPY_CONTRACTS[input.format]
  const sections = [
    'CONTRATO DO FORMATO',
    `Função: ${contract.purpose}`,
    ...contract.requirements.map((item) => `- ${item}`),
    `Estrutura: ${contract.outputShape}`,
    '',
    'REGRAS DE REDAÇÃO',
    ...SOCIAL_COPY_GUIDELINES.map((item) => `- ${item}`),
    ...COPY_SAFETY_RULES.map((item) => `- ${item}`),
    '',
    'BRIEF EDITORIAL',
    `Formato: ${input.format}`,
    `Tese: ${input.thesis}`,
    `Argumento: ${input.argument}`,
    `Abertura proposta: ${input.hook}`,
    `Tom informado: ${input.tone?.trim() || 'sem especificação adicional'}`,
    `Pontos de apoio fornecidos:\n${input.supportingPoints.length ? input.supportingPoints.map((item) => `- ${item}`).join('\n') : '- nenhum'}`,
    `Ação/CTA fornecida: ${input.cta?.trim() || 'nenhuma'}`,
    '',
    'Retorne somente o rascunho e, se necessário, uma nota editorial separada. Não declare a peça aprovada.',
  ]
  return sections.join('\n')
}

export function buildCaptionPrompt(input: SocialCaptionBrief) {
  return [
    'CONTRATO DE LEGENDA',
    ...SOCIAL_CAPTION_GUIDELINES.map((item) => `- ${item}`),
    buildSocialCaptionPrompt(input),
  ].join('\n')
}
