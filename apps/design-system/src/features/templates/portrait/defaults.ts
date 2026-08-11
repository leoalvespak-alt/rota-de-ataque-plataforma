import type { PtCoverElements } from './PtCover'
import type { PtContentElements } from './PtContent'
import type { PtImageElements } from './PtImage'
import type { PtQuoteElements } from './PtQuote'
import type { PtListElements } from './PtList'
import type { PtCtaElements } from './PtCta'

export const ptCoverDefaults: PtCoverElements = {
  eyebrow: 'MISSÃO HOJE',
  title: 'EXECUTE O PLANO',
  subtitle: 'Sem desculpas. A aprovação é sua.',
}

export const ptContentDefaults: PtContentElements = {
  eyebrow: 'CONTEÚDO',
  title: 'DIREITO ADMINISTRATIVO',
  body: 'Os atos administrativos são a base de qualquer prova de carreira fiscal. Domine este tópico e avance com confiança.',
}

export const ptImageDefaults: PtImageElements = {
  eyebrow: 'CONCURSO',
  title: 'RECEITA FEDERAL 2025',
  body: 'Vagas abertas. Salário inicial de R$ 21.029. Inscrições abertas até 15/08.',
}

export const ptQuoteDefaults: PtQuoteElements = {
  quote: '"A procrastinação não é falta de tempo. É falta de decisão."',
  author: 'Rota de Ataque',
  sub: 'Execute o plano hoje.',
}

export const ptListDefaults: PtListElements = {
  tag: 'HOJE',
  title: 'MISSÃO DO DIA',
  items: [
    'Estudar Direito Constitucional: 2h',
    'Resolver 50 questões de Português',
    'Revisar anotações de Matemática',
    'Assistir videoaula de Raciocínio Lógico',
  ],
}

export const ptCtaDefaults: PtCtaElements = {
  eyebrow: 'ACESSE AGORA',
  title: 'SEU CRONOGRAMA PRONTO',
  body: 'Pare de estudar sem método. Acesse a plataforma e receba seu plano personalizado em minutos.',
  cta: 'COMEÇAR AGORA',
}
