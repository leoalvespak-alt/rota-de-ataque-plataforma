import type { SqCoverElements } from './SqCover'
import type { SqTextImageElements } from './SqTextImage'
import type { SqContentElements } from './SqContent'
import type { SqQuoteElements } from './SqQuote'
import type { SqTipElements } from './SqTip'
import type { SqTwoImagesElements } from './SqTwoImages'
import type { SqStepsElements } from './SqSteps'
import type { SqStatsElements } from './SqStats'
import type { SqProfileElements } from './SqProfile'
import type { SqTweetElements } from './SqTweet'
import type { SqTableElements } from './SqTable'
import type { SqChecklistElements } from './SqChecklist'

export const sqCoverDefaults: SqCoverElements = {
  eyebrow: 'ESTUDO',
  title: 'ORGANIZE A PRÓXIMA REVISÃO',
  subtitle: 'Escolha um tópico e defina o que você quer conferir.',
}

export const sqTextImageDefaults: SqTextImageElements = {
  eyebrow: 'META DE ESTUDO',
  title: 'DEFINA UM CRITÉRIO',
  body: 'Antes de abrir o material, registre o que pretende compreender. Ao terminar, confira se consegue explicar esse ponto.',
}

export const sqContentDefaults: SqContentElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'REVISE EM ETAPAS',
  body: 'Feche o material, registre o que você lembra e consulte a fonte para localizar pontos que ficaram de fora.\n\nAnote o que precisa ser retomado.',
}

export const sqQuoteDefaults: SqQuoteElements = {
  quote: '[Citação autorizada para esta peça]',
  author: '[Fonte confirmada]',
}

export const sqTipDefaults: SqTipElements = {
  tag: 'EXEMPLO DIDÁTICO',
  title: 'ORGANIZE UMA SESSÃO',
  items: [
    'Escolha um tópico delimitado',
    'Defina o material de referência',
    'Registre o que precisa conferir',
  ],
}

export const sqTwoImagesDefaults: SqTwoImagesElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'FONTE E ANOTAÇÃO',
  body: 'Compare um trecho do material original com a explicação escrita durante o estudo.',
}

export const sqStepsDefaults: SqStepsElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'PLANEJE UMA REVISÃO',
  steps: [
    'Escolha o tópico que será estudado',
    'Separe a fonte que será consultada',
    'Registre dúvidas durante a leitura',
    'Confira cada anotação na fonte',
  ],
}

export const sqStatsDefaults: SqStatsElements = {
  eyebrow: 'CAMPO COM FONTE',
  title: 'DADO A CONFERIR',
  stats: [
    { num: '[DADO]', label: '[afirmação com fonte]' },
    { num: '[PERÍODO]', label: '[recorte da medição]' },
  ],
}

export const sqProfileDefaults: SqProfileElements = {
  name: '[Nome autorizado]',
  role: '[Contexto confirmado]',
  quote: '[Depoimento autorizado, reproduzido com fidelidade e fonte]',
}

export const sqTweetDefaults: SqTweetElements = {
  name: '[Pessoa autorizada]',
  handle: '[Perfil confirmado]',
  body: '[Texto aprovado para publicação]',
  time: '[Data confirmada]',
  metrics: '[Métricas documentadas, se pertinentes]',
}

export const sqTableDefaults: SqTableElements = {
  title: 'COMPARE AS FONTES',
  cols: ['MATERIAL ORIGINAL', 'ANOTAÇÃO DE ESTUDO'],
  rows: [
    ['Trecho consultado', 'Explicação escrita'],
    ['Termo técnico', 'Definição anotada'],
    ['Regra citada', 'Fonte registrada'],
    ['Dúvida pendente', 'Ponto a conferir'],
  ],
}

export const sqChecklistDefaults: SqChecklistElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'CONFIRA SUAS ANOTAÇÕES',
  items: [
    'O tópico está delimitado',
    'A fonte está identificada',
    'A explicação responde ao ponto',
    'As dúvidas ficaram registradas',
  ],
}
