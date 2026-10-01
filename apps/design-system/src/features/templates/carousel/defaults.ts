import type { CrCoverElements } from './CrCover'
import type { CrCoverDarkElements } from './CrCoverDark'
import type { CrSlideElements } from './CrSlide'
import type { CrTextImageElements } from './CrTextImage'
import type { CrListElements } from './CrList'
import type { CrFactElements } from './CrFact'
import type { CrComparisonElements } from './CrComparison'
import type { CrCtaElements } from './CrCta'

export const crCoverDefaults: CrCoverElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'COMO REVISAR UM TÓPICO',
  subtitle: 'Uma sequência para organizar a conferência da matéria.',
}

export const crCoverDarkDefaults: CrCoverDarkElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'ORGANIZE SUA PRÓXIMA REVISÃO',
  subtitle: 'Escolha o conteúdo e registre as dúvidas.',
}

export const crSlideDefaults: CrSlideElements = {
  eyebrow: 'ETAPA DE REVISÃO',
  title: 'REGISTRE O QUE LEMBRA',
  body: 'Feche o material e anote os pontos centrais do tópico. Depois, consulte a fonte e marque o que precisa ser revisto.',
}

export const crTextImageDefaults: CrTextImageElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'COMPARE COM A FONTE',
  body: 'Localize no material os trechos que confirmam, corrigem ou completam suas anotações.',
}

export const crListDefaults: CrListElements = {
  eyebrow: 'EXEMPLO DIDÁTICO',
  title: 'ETAPAS DE CONFERÊNCIA',
  steps: [
    'Delimite o tópico',
    'Identifique a fonte',
    'Registre uma explicação',
    'Confira cada ponto',
  ],
}

export const crFactDefaults: CrFactElements = {
  tag: 'CAMPO COM FONTE',
  big: '[DADO]',
  label: '[Insira informação confirmada e cite a fonte.]',
}

export const crComparisonDefaults: CrComparisonElements = {
  title: 'EXEMPLO DIDÁTICO: DOIS REGISTROS',
  left: ['Tópico amplo', 'Fonte ausente', 'Dúvida não anotada'],
  right: ['Tópico delimitado', 'Fonte identificada', 'Dúvida registrada'],
}

export const crCtaDefaults: CrCtaElements = {
  title: 'RETOME A REFERÊNCIA',
  body: 'Confira a fonte antes de fechar a explicação.',
  cta: 'CONFERIR A FONTE',
}
