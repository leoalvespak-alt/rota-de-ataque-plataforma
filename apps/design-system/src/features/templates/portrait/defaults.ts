import type { PtCoverElements } from './PtCover'
import type { PtContentElements } from './PtContent'
import type { PtImageElements } from './PtImage'
import type { PtQuoteElements } from './PtQuote'
import type { PtListElements } from './PtList'
import type { PtCtaElements } from './PtCta'

export const ptCoverDefaults: PtCoverElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'PREPARE A PRÓXIMA ETAPA',
  subtitle: 'Defina o tópico e o critério de conclusão.',
}

export const ptContentDefaults: PtContentElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'CONFIRA UMA REGRA',
  body: 'Localize a regra no material indicado. Registre a condição de aplicação e confira se há exceção na mesma fonte.',
}

export const ptImageDefaults: PtImageElements = {
  eyebrow: 'CAMPO COM FONTE',
  title: '[Tema confirmado]',
  body: '[Inclua informação vigente somente com fonte e data de consulta.]',
}

export const ptQuoteDefaults: PtQuoteElements = {
  quote: '[Citação autorizada para esta peça]',
  author: '[Fonte confirmada]',
  sub: '[Contexto necessário para interpretar a citação]',
}

export const ptListDefaults: PtListElements = {
  tag: 'EXEMPLO DIDÁTICO',
  title: 'ORGANIZE UMA REVISÃO',
  items: [
    'Escolha um tópico delimitado',
    'Separe o material de referência',
    'Registre os pontos que precisa conferir',
    'Confira suas anotações na fonte',
  ],
}

export const ptCtaDefaults: PtCtaElements = {
  eyebrow: 'PRÓXIMA AÇÃO',
  title: 'CONSULTE A REFERÊNCIA',
  body: 'Abra a fonte indicada e confira os pontos usados nesta explicação.',
  cta: 'CONFERIR A FONTE',
}
