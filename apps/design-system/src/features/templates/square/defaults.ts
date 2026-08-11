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
  eyebrow: 'CARREIRAS FISCAIS',
  title: 'CONQUISTE SUA APROVAÇÃO',
  subtitle: 'O plano está pronto. Agora é hora de executar.',
  redline: true,
}

export const sqTextImageDefaults: SqTextImageElements = {
  eyebrow: 'METODOLOGIA',
  title: 'ESTUDE COM ESTRATÉGIA',
  body: 'Cada hora de estudo deve ter um objetivo claro. Sem foco, não há aprovação. Defina sua meta diária e cumpra.',
  redline: true,
}

export const sqContentDefaults: SqContentElements = {
  eyebrow: 'DICA',
  title: 'TÉCNICA ATIVA DE REVISÃO',
  body: 'Após estudar cada tópico, feche o material e escreva tudo que você lembra. Esse simples exercício aumenta a retenção em até 70%.\n\nFaça isso todos os dias. Sem exceção.',
  redline: true,
}

export const sqQuoteDefaults: SqQuoteElements = {
  quote: '"A aprovação não é sorte. É a soma de cada sessão de estudo que você não pulou."',
  author: 'Rota de Ataque',
}

export const sqTipDefaults: SqTipElements = {
  tag: 'DICA 01',
  title: 'CRONOGRAMA SEMANAL',
  items: [
    'Distribua as matérias por blocos de 2h',
    'Reserve sempre 1h para revisão ativa',
    'Simule provas nos finais de semana',
  ],
}

export const sqTwoImagesDefaults: SqTwoImagesElements = {
  eyebrow: 'COMPARATIVO',
  title: 'ANTES vs DEPOIS',
  body: 'Veja a diferença entre estudar sem método e estudar com a Rota de Ataque.',
}

export const sqStepsDefaults: SqStepsElements = {
  eyebrow: 'PASSO A PASSO',
  title: 'DOMINE O CRONOGRAMA',
  steps: [
    'Defina as matérias prioritárias da semana',
    'Divida em blocos de estudo de 2h',
    'Revise ativamente ao final de cada dia',
    'Execute a prova simulada no fim de semana',
  ],
}

export const sqStatsDefaults: SqStatsElements = {
  eyebrow: 'RESULTADOS',
  title: 'APROVADOS EM 2024',
  stats: [
    { num: '94%', label: 'taxa de aprovação' },
    { num: '38 dias', label: 'tempo médio' },
    { num: '10.482', label: 'alunos ativos' },
    { num: '24/7', label: 'suporte ativo' },
  ],
}

export const sqProfileDefaults: SqProfileElements = {
  name: 'CARLOS AUGUSTO',
  role: 'Aprovado — Receita Federal 2024',
  quote:
    '"Em 5 meses com a Rota de Ataque eu saí de zero e passei em 1º lugar. O método é cirúrgico."',
}

export const sqTweetDefaults: SqTweetElements = {
  name: 'João Silva',
  handle: '@joaosilva_rf',
  body: 'O segredo da aprovação não é estudar 12h por dia. É estudar 4h todos os dias sem falta. Constância vence a intensidade.',
  time: '10:45 AM · 15 Ago 2024',
  metrics: '1.204 Retweets   4.892 Curtidas',
}

export const sqTableDefaults: SqTableElements = {
  title: 'COMPARE AS OPÇÕES',
  cols: ['SEM PLANO', 'ROTA DE ATAQUE'],
  rows: [
    ['Plano aleatório', 'Plano Rota de Ataque'],
    ['Sem foco definido', 'Meta diária clara'],
    ['Revisão por sorte', 'Revisão ativa agendada'],
    ['0 aprovados', '10.482 aprovados'],
  ],
}

export const sqChecklistDefaults: SqChecklistElements = {
  eyebrow: 'REVISÃO DIÁRIA',
  title: 'EXECUTE O CHECKLIST',
  items: [
    'Cumprir as 4h de estudo planejadas',
    'Resolver 30 questões da matéria do dia',
    'Fazer revisão ativa do conteúdo estudado',
    'Registrar dúvidas no caderno de erros',
  ],
}
