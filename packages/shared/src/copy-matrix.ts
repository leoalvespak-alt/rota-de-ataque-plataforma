/**
 * copy-matrix.ts
 * Matriz editorial tipo-conteúdo × formato (copy-matrix.v1).
 * Fonte canônica para o job de slots; espelha
 * `apps/design-system/src/domain/editorial/copy-matrix.v1.json`.
 * Manter os dois sincronizados ao versionar a matriz.
 */
export const COPY_MATRIX_VERSION = 'copy-matrix.v1' as const

export const COPY_MATRIX_V1 = {
  version: COPY_MATRIX_VERSION,
  regras_globais: {
    proibido_travessao_duplo: true,
    cta_bio: 'Faça parte da plataforma pelo link da BIO: plano de estudos, questões, teoria em PDF e muito mais.',
    canvas: '1080x1350',
    pisos_px: { titulo: 67, corpo: 30, nota: 24 },
  },
  tipos: {
    noticia: {
      copy: 'O que mudou, fonte e data, grau de confirmação e efeito prático para quem estuda',
      formatos_permitidos: ['estatico', 'carrossel'],
    },
    prova_social: {
      copy: 'Caso real autorizado, contexto, fonte e limites; sem depoimento, resultado ou métrica inventados',
      formatos_permitidos: ['estatico', 'carrossel'],
    },
    feature: {
      copy: 'Recurso demonstrado, benefício específico e evidência real da interface',
      formatos_permitidos: ['estatico', 'carrossel', 'story'],
    },
    educativo: {
      copy: 'Critério, passo aplicável, exemplo e condição de uso',
      formatos_permitidos: ['carrossel', 'estatico'],
    },
  },
  templates: {
    estatico: ['SqCover'],
    carrossel: ['CrCover', 'CrSlide', 'CrFact', 'CrList', 'CrCta'],
    story: ['PtCover', 'PtContent', 'PtCta'],
  },
} as const
