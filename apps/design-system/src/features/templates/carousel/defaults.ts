import type { CrCoverElements } from './CrCover'
import type { CrCoverDarkElements } from './CrCoverDark'
import type { CrSlideElements } from './CrSlide'
import type { CrTextImageElements } from './CrTextImage'
import type { CrListElements } from './CrList'
import type { CrFactElements } from './CrFact'
import type { CrComparisonElements } from './CrComparison'
import type { CrCtaElements } from './CrCta'

export const crCoverDefaults: CrCoverElements = {
  eyebrow: 'GUIA COMPLETO',
  title: '5 TÉCNICAS PARA ESTUDAR MAIS EM MENOS TEMPO',
  subtitle: 'Deslize para ver cada técnica →',
  page: '01 / 05',
}

export const crCoverDarkDefaults: CrCoverDarkElements = {
  eyebrow: 'SÉRIE APROVADOS',
  title: 'COMO PASSAR NA RECEITA FEDERAL',
  subtitle: 'O caminho real — sem atalhos',
  page: '01 / 06',
}

export const crSlideDefaults: CrSlideElements = {
  eyebrow: 'TÉCNICA 01',
  title: 'BLOCO POMODORO',
  body: 'Estude por 25 minutos ininterruptos e descanse 5 minutos. Após 4 blocos, tire uma pausa longa de 20 minutos.\n\nSeu cérebro vai absorver mais com menos cansaço.',
  page: '02 / 05',
}

export const crTextImageDefaults: CrTextImageElements = {
  eyebrow: 'MÉTODO 02',
  title: 'REVISÃO ATIVA',
  body: 'Feche o material após estudar e escreva tudo que lembrar. Esse método triplica a retenção em relação à releitura passiva.',
  page: '03 / 05',
}

export const crListDefaults: CrListElements = {
  eyebrow: 'ROTINA VENCEDORA',
  title: '4 AÇÕES DIÁRIAS',
  steps: [
    'Estudar em blocos sem celular',
    'Resolver questões comentadas',
    'Fazer revisão ativa noturna',
    'Registrar erros e revisar no dia seguinte',
  ],
  page: '04 / 05',
}

export const crFactDefaults: CrFactElements = {
  tag: 'DADO IMPORTANTE',
  big: '70%',
  label: 'das questões de concurso fiscal repetem tópicos de edições anteriores',
  page: '03 / 06',
}

export const crComparisonDefaults: CrComparisonElements = {
  title: 'ANTES vs DEPOIS',
  left: ['Estuda sem foco', 'Pula matérias difíceis', 'Sem revisão programada', '0 aprovações'],
  right: [
    'Plano diário definido',
    'Ataca os pontos cegos',
    'Revisão ativa agendada',
    '10.482 aprovados',
  ],
  page: '02 / 06',
}

export const crCtaDefaults: CrCtaElements = {
  title: 'COMECE AGORA',
  body: 'Acesse a plataforma Rota de Ataque e receba seu cronograma personalizado hoje mesmo.',
  cta: 'ACESSAR AGORA',
  page: '05 / 05',
}
