import type { ProjectDocument } from '@/domain/documents'
import { ProjectRepository } from '@/domain/repositories'
import { getDefaultElements } from '@/features/templates/registry'

type SeedCard = {
  templateId: string
  elements: Record<string, unknown>
  darkMode?: boolean
}

type SeedEdition = {
  id: string
  name: string
  kind: 'post' | 'carousel'
  cards: SeedCard[]
}

const decor = {
  texture: { type: 'none' as const, opacity: 0 },
  watermark: {
    visible: true,
    text: 'Rota de Ataque',
    position: 'bottom-right' as const,
    opacity: 0.35,
  },
  bgLibraryId: 'none',
}

const card = (
  templateId: string,
  elements: Record<string, unknown>,
  darkMode = false,
): SeedCard => ({ templateId, elements, darkMode })

const carousel = (id: string, name: string, cards: SeedCard[]): SeedEdition => ({
  id,
  name,
  kind: 'carousel',
  cards,
})

const post = (id: string, name: string, postCard: SeedCard): SeedEdition => ({
  id,
  name,
  kind: 'post',
  cards: [postCard],
})

const EDITORIAL_SEEDS: SeedEdition[] = [
  carousel('t1-a', 'Tese 1 • Carrossel A — O PDF que faltava não existe', [
    card('cr-cover', { eyebrow: 'DIREÇÃO > VOLUME', title: 'O PDF QUE FALTAVA NÃO EXISTE', subtitle: 'Talvez o que falte seja decidir o que vem primeiro.', page: '01 / 05' }),
    card('cr-fact', { tag: 'CENA CONHECIDA', big: '12 ABAS', label: 'abertas, três professores salvos e nenhuma certeza sobre o que estudar hoje', page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'O PROBLEMA REAL', title: 'MATERIAL DEMAIS TAMBÉM PARALISA', body: 'Quanto mais fontes disputam sua atenção, mais energia você gasta escolhendo. E menos energia sobra para aprender.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'FAÇA A TRIAGEM', title: 'ANTES DE ABRIR OUTRO PDF', steps: ['Qual assunto mais pesa na prova?', 'Onde seus erros se repetem?', 'Qual fonte será a principal?', 'Qual entrega cabe no estudo de hoje?'], page: '04 / 05' }),
    card('cr-cta', { title: 'MENOS COLEÇÃO. MAIS EXECUÇÃO.', body: 'Escolha uma frente relevante, termine o bloco e só depois reavalie a rota.', cta: 'SALVE PARA O PRÓXIMO ESTUDO', page: '05 / 05' }),
  ]),
  carousel('t1-b', 'Tese 1 • Carrossel B — Estudar sem ordem custa caro', [
    card('cr-cover-dark', { eyebrow: 'CURADORIA OPERACIONAL', title: 'ESTUDAR SEM ORDEM CUSTA CARO', subtitle: 'Não em dinheiro. Em horas que não voltam.', page: '01 / 05' }, true),
    card('cr-comparison', { title: 'OCUPADO vs AVANÇANDO', left: ['Troca de curso', 'Aula sem prioridade', 'Revisão aleatória', 'Sensção de atraso'], right: ['Fonte definida', 'Peso da banca', 'Revisão por erro', 'Próximo passo claro'], page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'PENSE COMO TRIAGEM', title: 'NEM TUDO É URGENTE AGORA', body: 'Profundidade importa. Mas ela precisa ser proporcional ao edital, à banca e ao seu desempenho — não ao tamanho da biblioteca.', page: '03 / 05' }),
    card('cr-fact', { tag: 'REGRA SIMPLES', big: '1 ROTA', label: 'uma fonte-base, uma meta de questões e um critério claro para revisar', page: '04 / 05' }),
    card('cr-cta', { title: 'VOCÊ NÃO PRECISA VER TUDO', body: 'Precisa saber por que este assunto entrou no seu dia e qual resultado espera dele.', cta: 'DEFINA O PRÓXIMO PASSO', page: '05 / 05' }),
  ]),

  carousel('t2-a', 'Tese 2 • Carrossel A — O plano precisa caber no dia ruim', [
    card('cr-cover-dark', { eyebrow: 'CONSTÂNCIA REAL', title: 'SEU PLANO CABE NUM DIA RUIM?', subtitle: 'Porque segunda-feira perfeita não dura o ano inteiro.', page: '01 / 05' }, true),
    card('cr-slide', { eyebrow: 'VIDA REAL', title: 'TRABALHO ATRASOU. A CRIANÇA ADOECEU.', body: 'O cronograma não deveria transformar imprevisto em culpa. Ele deveria ajudar você a preservar o que ainda é possível fazer.', page: '02 / 05' }),
    card('cr-fact', { tag: 'META MÍNIMA VIÁVEL', big: '30 MIN', label: 'podem manter o vínculo com a preparação quando o dia sai do controle', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'PLANO DE CONTINUIDADE', title: 'PARA O DIA APERTADO', steps: ['10 min de revisão', '15 min de questões', '5 min para registrar erros', 'Retomar a carga normal sem punição'], page: '04 / 05' }),
    card('cr-cta', { title: 'NÃO ZERE O DIA POR ORGULHO', body: 'Fazer menos hoje pode ser exatamente o que permite continuar amanhã.', cta: 'MONTE SUA META MÍNIMA', page: '05 / 05' }),
  ]),
  carousel('t2-b', 'Tese 2 • Carrossel B — Recomeçar toda semana cansa', [
    card('cr-cover', { eyebrow: 'CONSISTÊNCIA ADAPTATIVA', title: 'RECOMEÇAR TODA SEMANA TAMBÉM CANSA', subtitle: 'Seu plano não precisa quebrar porque dois dias deram errado.', page: '01 / 05' }),
    card('cr-comparison', { title: 'PLANO RÍGIDO vs PLANO VIVO', left: ['Atrasou: abandona', 'Culpa acumulada', 'Compensa com excesso', 'Quebra de novo'], right: ['Atrasou: redistribui', 'Preserva prioridade', 'Retoma aos poucos', 'Continua avançando'], page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'MARCHA LONGA', title: 'RITMO NÃO É FALTA DE AMBIÇÃO', body: 'Sustentável não significa fácil. Significa uma carga que cresce sem destruir a rotina que precisa sustentá-la.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'NA PRÁTICA', title: 'REPLANEJE SEM DRAMA', steps: ['Mantenha as matérias prioritárias', 'Corte tarefas de menor impacto', 'Evite dobrar a carga do dia seguinte', 'Volte ao ritmo em 48 horas'], page: '04 / 05' }),
    card('cr-cta', { title: 'CONSTÂNCIA É VOLTAR RÁPIDO', body: 'Não é nunca falhar. É impedir que uma falha vire abandono.', cta: 'ENVIE PARA QUEM PRECISA LER', page: '05 / 05' }),
  ]),

  carousel('t3-a', 'Tese 3 • Carrossel A — Horas líquidas podem enganar', [
    card('cr-cover', { eyebrow: 'PROGRESSO MENSURÁVEL', title: 'HORAS LÍQUIDAS PODEM ENGANAR', subtitle: 'Tempo sentado não é a mesma coisa que aprendizagem.', page: '01 / 05' }),
    card('cr-fact', { tag: 'PERGUNTA HONESTA', big: 'E A NOTA?', label: 'subiu nos assuntos estudados ou apenas o relógio ganhou mais um registro?', page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'SEM PUNIÇÃO', title: 'MÉTRICA SERVE PARA DECIDIR', body: 'Percentual de acertos, retenção e erros recorrentes mostram onde ajustar a rota. Não servem para diminuir o seu esforço.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'PAINEL ENXUTO', title: 'ACOMPANHE O QUE MUDA DECISÕES', steps: ['Acertos por assunto', 'Erros que se repetem', 'Retenção após a revisão', 'Cobertura real do edital'], page: '04 / 05' }),
    card('cr-cta', { title: 'ESFORÇO MERECE FEEDBACK', body: 'No fim da semana, olhe menos para o total de horas e mais para o que agora você consegue resolver.', cta: 'REVISE SEUS INDICADORES', page: '05 / 05' }),
  ]),
  carousel('t3-b', 'Tese 3 • Carrossel B — O assunto que rouba sua vaga', [
    card('cr-cover-dark', { eyebrow: 'MAPA DE CALOR', title: 'QUAL ASSUNTO ESTÁ ROUBANDO SUA NOTA?', subtitle: 'A resposta raramente aparece na sensação.', page: '01 / 05' }, true),
    card('cr-comparison', { title: 'SENSAÇÃO vs EVIDÊNCIA', left: ['"Acho que sei"', 'Revisa o favorito', 'Evita o desconforto', 'Repete a rotina'], right: ['Mede por assunto', 'Ataca o gargalo', 'Confere retenção', 'Ajusta a semana'], page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'DIAGNÓSTICO', title: 'O ERRO PRECISA DE ENDEREÇO', body: 'Não basta saber que acertou 68%. Descubra em quais temas, tipos de questão e distrações os pontos ficaram pelo caminho.', page: '03 / 05' }),
    card('cr-fact', { tag: 'PRÓXIMA AÇÃO', big: '1 GARGALO', label: 'escolhido por evidência vale mais que uma revisão geral feita no automático', page: '04 / 05' }),
    card('cr-cta', { title: 'PARE DE ESTUDAR NO ESCURO', body: 'Use os dados para escolher a próxima batalha, não para se cobrar perfeição.', cta: 'MAPEIE SUA NOTA', page: '05 / 05' }),
  ]),

  carousel('t4-a', 'Tese 4 • Carrossel A — Corrigir o gabarito não basta', [
    card('cr-cover-dark', { eyebrow: 'CICLO DE CORREÇÃO', title: 'VER O GABARITO NÃO CORRIGE O ERRO', subtitle: 'Entender a causa muda a próxima tentativa.', page: '01 / 05' }, true),
    card('cr-slide', { eyebrow: 'DEPOIS DA QUESTÃO', title: 'POR QUE VOCÊ ERROU?', body: 'Faltou teoria? Confundiu duas regras? Leu rápido? Caiu numa exceção? Cada causa pede uma correção diferente.', page: '02 / 05' }),
    card('cr-list', { eyebrow: 'DIAGNÓSTICO RÁPIDO', title: 'CLASSIFIQUE ANTES DE REVISAR', steps: ['Lacuna de conteúdo', 'Confusão entre conceitos', 'Desatenção na leitura', 'Falha de retenção'], page: '03 / 05' }),
    card('cr-fact', { tag: 'FECHAR O CICLO', big: 'TESTE DE NOVO', label: 'a correção só termina quando você encontra uma questão parecida e acerta pelo motivo certo', page: '04 / 05' }),
    card('cr-cta', { title: 'ERRO NÃO É VEREDITO', body: 'Bem analisado, ele vira instrução clara para o próximo bloco.', cta: 'SALVE ESTE CICLO', page: '05 / 05' }),
  ]),
  carousel('t4-b', 'Tese 4 • Carrossel B — Seu caderno de erros virou museu?', [
    card('cr-cover', { eyebrow: 'REVISÃO QUE VOLTA PARA A PROVA', title: 'SEU CADERNO DE ERROS VIROU MUSEU?', subtitle: 'Bonito, organizado e quase nunca visitado.', page: '01 / 05' }),
    card('cr-comparison', { title: 'ARQUIVAR vs CORRIGIR', left: ['Copia a resolução', 'Sublinha tudo', 'Nunca retesta', 'Erro reaparece'], right: ['Resume a causa', 'Microrevisa', 'Agenda nova bateria', 'Confere retenção'], page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'QUALIDADE > VOLUME', title: '100 QUESTÕES PODEM ESCONDER O PADRÃO', body: 'Repetir sem ajustar postura consolida o desvio. Às vezes, dez questões bem analisadas ensinam mais que uma maratona automática.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'ROTINA DE 15 MIN', title: 'DÊ VIDA AO CADERNO', steps: ['Escolha um erro recorrente', 'Escreva a causa em uma frase', 'Revise apenas o ponto necessário', 'Resolva três questões semelhantes'], page: '04 / 05' }),
    card('cr-cta', { title: 'NÃO COLECIONE ERROS', body: 'Transforme cada padrão em uma intervenção pequena, objetiva e verificável.', cta: 'CORRIJA UM HOJE', page: '05 / 05' }),
  ]),

  carousel('t5-a', 'Tese 5 • Carrossel A — O TAF não começa depois da prova', [
    card('cr-cover-dark', { eyebrow: 'PREPARAÇÃO 360°', title: 'O TAF NÃO COMEÇA DEPOIS DA PROVA', subtitle: 'Condicionamento exige antecedência, progressão e orientação.', page: '01 / 05' }, true),
    card('cr-fact', { tag: 'RISCO PREVISÍVEL', big: 'NÃO ADIE', label: 'descobrir tarde que o índice está distante transforma planejamento em urgência', page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'SEM PROMESSA MÁGICA', title: 'CORPO TAMBÉM PRECISA DE CICLO', body: 'Avaliação, progressão e recuperação devem ser acompanhadas por profissional qualificado. Improviso aumenta risco de lesão.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'ENTRE NO CALENDÁRIO', title: 'TRATE COMO ETAPA DO CONCURSO', steps: ['Conheça os índices do edital', 'Faça avaliação profissional', 'Treine com progressão', 'Monitore prazo e recuperação'], page: '04 / 05' }),
    card('cr-cta', { title: 'A PROVA OBJETIVA É UMA FASE', body: 'Prepare as outras com a mesma seriedade, dentro dos limites técnicos de cada área.', cta: 'ANTECIPE O RISCO', page: '05 / 05' }),
  ]),
  carousel('t5-b', 'Tese 5 • Carrossel B — A etapa esquecida também elimina', [
    card('cr-cover', { eyebrow: 'OPERAÇÃO EM FASES', title: 'A ETAPA ESQUECIDA TAMBÉM ELIMINA', subtitle: 'Prova, TAF, exames, documentos, psicológico e formação.', page: '01 / 05' }),
    card('cr-comparison', { title: 'DEPOIS EU VEJO vs PREPARAÇÃO 360°', left: ['TAF pós-prova', 'Documento na urgência', 'Fases desconhecidas', 'Risco acumulado'], right: ['TAF no calendário', 'Pendências mapeadas', 'Etapas conhecidas', 'Risco antecipado'], page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'CHECKLIST DE VOO', title: 'O BÁSICO PRECISA ESTAR EM ORDEM', body: 'Leia o edital anterior. Liste documentos, exames e prazos. Não para controlar o imprevisível, mas para não perder por algo evitável.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'REVISÃO MENSAL', title: 'QUATRO FRENTES', steps: ['Desempenho na prova objetiva', 'Evolução física acompanhada', 'Documentação e requisitos', 'Conhecimento das próximas fases'], page: '04 / 05' }),
    card('cr-cta', { title: 'MISSÃO COMPLETA, PLANO COMPLETO', body: 'Cumprir a primeira etapa não encerra o concurso. Organize hoje o que leva meses para construir.', cta: 'FAÇA SEU CHECKLIST', page: '05 / 05' }),
  ]),

  carousel('t6-a', 'Tese 6 • Carrossel A — O salário não conta a rotina', [
    card('cr-cover-dark', { eyebrow: 'ESCOLHA DE CARREIRA', title: 'O SALÁRIO NÃO CONTA A ROTINA', subtitle: 'A remuneração aparece no edital. A vida real, nem sempre.', page: '01 / 05' }, true),
    card('cr-slide', { eyebrow: 'ALÉM DA FARDA', title: 'O QUE VOCÊ ACEITA VIVER POR ANOS?', body: 'Escala, hierarquia, risco, mobilidade, ambiente e atribuições pesam todos os dias. Prestígio sozinho não sustenta uma escolha.', page: '02 / 05' }),
    card('cr-comparison', { title: 'IMAGEM vs REALIDADE', left: ['Status', 'Salário', 'Farda', 'Aprovação'], right: ['Atribuição', 'Escala', 'Risco', 'Permanência'], page: '03 / 05' }),
    card('cr-list', { eyebrow: 'PESQUISE ANTES', title: 'PERGUNTAS QUE AJUDAM', steps: ['Como é um plantão comum?', 'Quais restrições a carreira impõe?', 'Há mobilidade que afeta sua família?', 'As atribuições combinam com você?'], page: '04 / 05' }),
    card('cr-cta', { title: 'ESCOLHA SEM ROMANTIZAR', body: 'Conhecer a realidade não diminui o sonho. Ajuda a transformá-lo em compromisso consciente.', cta: 'CONVERSE COM QUEM VIVE A ROTINA', page: '05 / 05' }),
  ]),
  carousel('t6-b', 'Tese 6 • Carrossel B — As carreiras policiais não são iguais', [
    card('cr-cover', { eyebrow: 'COMPATIBILIDADE DE CARREIRA', title: 'PM, PC, PF E PRF NÃO SÃO VERSÕES DA MESMA VIDA', subtitle: 'O destino profissional muda com o terreno.', page: '01 / 05' }),
    card('cr-fact', { tag: 'ANTES DO EDITAL', big: 'COMPARE', label: 'atribuições, ambiente, mobilidade, risco, formação e rotina real', page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'SEM ESTEREÓTIPO', title: 'PERFIL AJUDA. NÃO DEFINE.', body: 'Pessoas e funções variam entre órgãos e estados. Use a comparação para investigar melhor, não para encaixar todo mundo em uma caixa.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'MAPA DE DECISÃO', title: 'CRUZE DESEJO E REALIDADE', steps: ['Trabalho que você quer exercer', 'Requisitos que consegue cumprir', 'Rotina compatível com sua vida', 'Riscos que aceita assumir'], page: '04 / 05' }),
    card('cr-cta', { title: 'A MELHOR CARREIRA É A QUE FAZ SENTIDO', body: 'Não para o vídeo de outra pessoa. Para a vida que você quer sustentar depois da posse.', cta: 'PESQUISE COM HONESTIDADE', page: '05 / 05' }),
  ]),

  carousel('t7-a', 'Tese 7 • Carrossel A — O cronograma do aprovado não é o seu', [
    card('cr-cover-dark', { eyebrow: 'ESTRATÉGIA PESSOAL', title: 'O CRONOGRAMA DO APROVADO NÃO É O SEU', subtitle: 'Você pode aprender com ele sem copiar a vida dele.', page: '01 / 05' }, true),
    card('cr-slide', { eyebrow: 'CONTEXTO IMPORTA', title: 'O PONTO DE PARTIDA MUDA A ROTA', body: 'Base, tempo, trabalho, família, banca e dificuldades alteram a dose. O princípio pode ser bom e ainda assim precisar de adaptação.', page: '02 / 05' }),
    card('cr-comparison', { title: 'IMITAR vs ADAPTAR', left: ['Copia as horas', 'Copia a sequência', 'Ignora restrições', 'Se sente incapaz'], right: ['Entende o princípio', 'Mede a própria base', 'Ajusta carga e ordem', 'Evolui com consistência'], page: '03 / 05' }),
    card('cr-list', { eyebrow: 'USE COMO REFERÊNCIA', title: 'QUATRO FILTROS', steps: ['Isso resolve uma dor minha?', 'Cabe na minha semana?', 'Combina com a minha banca?', 'Consigo medir se funcionou?'], page: '04 / 05' }),
    card('cr-cta', { title: 'VOCÊ NÃO ESTÁ ATRASADO', body: 'Está em outro ponto de partida. Construa a rota a partir dele.', cta: 'PARE DE COPIAR. COMECE A AJUSTAR.', page: '05 / 05' }),
  ]),
  carousel('t7-b', 'Tese 7 • Carrossel B — Trocar de método toda semana', [
    card('cr-cover', { eyebrow: 'ROTA INDIVIDUAL', title: 'MÉTODO NOVO TODA SEMANA É DESVIO', subtitle: 'A ansiedade promete atalho. A execução pede tempo.', page: '01 / 05' }),
    card('cr-fact', { tag: 'SINAL DE ALERTA', big: '7 DIAS', label: 'geralmente não bastam para avaliar um método, mas bastam para interromper outro', page: '02 / 05' }),
    card('cr-slide', { eyebrow: 'GPS, NÃO TELETRANSPORTE', title: 'AJUSTAR É DIFERENTE DE RECOMEÇAR', body: 'Mantenha os princípios que funcionam. Mude carga, ordem ou formato quando os dados mostrarem necessidade.', page: '03 / 05' }),
    card('cr-list', { eyebrow: 'ANTES DE TROCAR', title: 'FAÇA ESTE CHECK', steps: ['Execute por tempo suficiente', 'Defina o que seria melhora', 'Observe seu desempenho', 'Altere uma variável por vez'], page: '04 / 05' }),
    card('cr-cta', { title: 'DÊ TEMPO PARA A ROTA RESPONDER', body: 'Personalizar não é viver sem método. É aplicar o método à sua realidade.', cta: 'TESTE COM CRITÉRIO', page: '05 / 05' }),
  ]),

  post('t1-post', 'Tese 1 • Post — Antes de baixar outro material', card('sq-cover', { eyebrow: 'ANTES DE BAIXAR OUTRO PDF', title: 'QUAL DECISÃO ESTE MATERIAL VAI MELHORAR?', subtitle: 'Se você não sabe, talvez o próximo passo não seja acumular. Seja escolher.', redline: true })),
  post('t2-post', 'Tese 2 • Post — O dia imperfeito também conta', card('sq-quote', { quote: '“O dia imperfeito também conta quando ele impede você de abandonar a semana inteira.”', author: 'Para quem estuda entre trabalho, casa e cansaço' }, true)),
  post('t3-post', 'Tese 3 • Post — Fechamento semanal', card('sq-checklist', { eyebrow: 'FECHAMENTO SEMANAL', title: 'MEÇA PARA DECIDIR, NÃO PARA SE PUNIR', items: ['Qual assunto melhorou?', 'Onde o erro se repetiu?', 'O que ainda não ficou retido?', 'Qual será a prioridade da próxima semana?'] })),
  post('t4-post', 'Tese 4 • Post — Quatro passos após errar', card('sq-steps', { eyebrow: 'ERRO BEM USADO', title: 'NÃO PASSE DIRETO PARA A PRÓXIMA', steps: ['Nomeie a causa do erro', 'Revise apenas o ponto necessário', 'Resolva uma questão semelhante', 'Confira se acertou pelo motivo certo'] })),
  post('t5-post', 'Tese 5 • Post — Concurso policial tem fases', card('sq-tip', { tag: 'PREPARAÇÃO 360°', title: 'A PROVA OBJETIVA NÃO ENCERRA A MISSÃO', items: ['TAF com orientação e antecedência', 'Documentos e requisitos mapeados', 'Próximas fases conhecidas desde cedo'] }, true)),
  post('t6-post', 'Tese 6 • Post — Escolha além do salário', card('sq-table', { title: 'ANTES DE ESCOLHER A CARREIRA', cols: ['NÃO OLHE SÓ', 'INVESTIGUE TAMBÉM'], rows: [['Salário', 'Rotina e escala'], ['Farda', 'Atribuições'], ['Prestígio', 'Risco e restrições'], ['Vaga', 'Vida depois da posse']] })),
  post('t7-post', 'Tese 7 • Post — Referência não é receita', card('sq-content', { eyebrow: 'ESTRATÉGIA PESSOAL', title: 'REFERÊNCIA NÃO É RECEITA', body: 'Aprenda com quem passou. Mas filtre tudo pela sua base, sua banca e sua rotina.\n\nO objetivo é comum. A rota precisa ser sua.', redline: true })),
]

function toProject(seed: SeedEdition, index: number): ProjectDocument {
  const timestamp = Date.UTC(2026, 7, 4, 12, index)
  return {
    id: `project_editorial_seed_v1_${seed.id}`,
    schemaVersion: 1,
    name: seed.name,
    preferences: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    campaigns: [
      {
        id: `campaign_editorial_seed_v1_${seed.id}`,
        name: 'Conteúdo editorial',
        status: 'draft',
        linkedComponents: [],
        featurePreferences: {},
        artifacts: [
          {
            id: `artifact_editorial_seed_v1_${seed.id}`,
            kind: seed.kind,
            cards: seed.cards.map((seedCard, cardIndex) => ({
              id: `card_editorial_seed_v1_${seed.id}_${cardIndex + 1}`,
              templateId: seedCard.templateId,
              elements: { ...getDefaultElements(seedCard.templateId), ...seedCard.elements },
              darkMode: seedCard.darkMode ?? false,
              decor,
            })),
          },
        ],
      },
    ],
  }
}

export function buildEditorialSeedEditions(): ProjectDocument[] {
  return EDITORIAL_SEEDS.map(toProject)
}

/**
 * Instala o pacote editorial uma única vez por navegador. IDs estáveis impedem
 * duplicatas e edições existentes nunca são sobrescritas.
 */
export async function ensureEditorialSeedEditions(repository: ProjectRepository): Promise<void> {
  const existingIds = new Set((await repository.list()).map((project) => project.id))
  for (const edition of buildEditorialSeedEditions()) {
    if (!existingIds.has(edition.id)) await repository.save(edition)
  }
}
