import { z } from 'zod'

export const HelpContentSchema = z.object({
  title: z.string(),
  what: z.string(),
  whenToUse: z.string(),
  metrics: z.array(z.object({ name: z.string(), explanation: z.string() })).optional(),
  steps: z.array(z.object({ title: z.string(), description: z.string() })),
  dataSources: z.array(z.object({ name: z.string(), frequency: z.string() })),
  integrations: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  shortcuts: z.array(z.object({ key: z.string(), action: z.string() })).optional(),
  relatedLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
})

export type HelpContent = z.infer<typeof HelpContentSchema>

export const helpRegistry: Record<string, HelpContent> = {
  '/': {
    title: 'Visão Geral',
    what: 'Um painel executivo com o resumo da operação da campanha atual.',
    whenToUse: 'Use para acompanhar o volume de leads, taxa de conversão e saúde geral das integrações.',
    steps: [
      { title: 'Verificar prioridades', description: 'O painel superior mostra as ações mais urgentes.' },
      { title: 'Acompanhar conversão', description: 'Observe o funil de leads para identificar gargalos.' },
      { title: 'Checar integrações', description: 'O quadro de saúde indica falhas em fontes de dados.' }
    ],
    dataSources: [
      { name: 'Banco de leads', frequency: 'Tempo real' },
      { name: 'Controle de saúde', frequency: 'A cada 5 min' }
    ]
  },
  '/leads': {
    title: 'Leads',
    what: 'A central de CRM onde todos os leads prospectados ou inbound são armazenados e pontuados.',
    whenToUse: 'Use para filtrar leads, preparar contatos ou investigar o histórico (visão 360) de um lead específico.',
    steps: [
      { title: 'Filtrar leads', description: 'Use os filtros no topo ou o command palette para encontrar leads.' },
      { title: 'Analisar perfil', description: 'Clique em uma linha para abrir a visão 360 do lead.' },
      { title: 'Ação em massa', description: 'Selecione múltiplos leads para enviar para filas de engajamento.' }
    ],
    dataSources: [
      { name: 'Banco de leads', frequency: 'Tempo real' }
    ]
  },
  '/theses': {
    title: 'Teses Editoriais',
    what: 'Diretrizes, ganchos e restrições para a criação de conteúdo. Cada tese organiza o propósito editorial de uma campanha.',
    whenToUse: 'Use para alinhar a produção de conteúdo com a estratégia da marca e para criar pautas vindas do Radar.',
    steps: [
      { title: 'Criar tese', description: 'Defina o título, princípios e ângulos proibidos.' },
      { title: 'Vincular oportunidades', description: 'Aprove oportunidades do Radar para adicionar à tese.' },
      { title: 'Acompanhar performance', description: 'Monitore as métricas de engajamento dos conteúdos vinculados.' }
    ],
    dataSources: [
      { name: 'Banco de conteúdo', frequency: 'Tempo real' },
      { name: 'Auditoria Interna', frequency: 'Ao criar/editar' }
    ]
  },
  '/conversations': {
    title: 'Conversas',
    what: 'Caixa de entrada unificada para canais como WhatsApp, Email e Redes Sociais.',
    whenToUse: 'Use para responder leads em tempo real usando a identidade da campanha.',
    steps: [
      { title: 'Selecionar conversa', description: 'Clique em uma conversa na barra lateral.' },
      { title: 'Responder', description: 'Digite e envie. O canal original será usado.' },
      { title: 'Filtrar por canal', description: 'Use a busca no topo para filtrar por intenção ou participante.' }
    ],
    dataSources: [
      { name: 'WhatsApp API', frequency: 'Tempo real via webhook' }
    ]
  },
  '/system-health': {
    title: 'Saúde do Sistema',
    what: 'Monitoramento técnico dos serviços, APIs e workers.',
    whenToUse: 'Use quando notar lentidão ou erro para checar se há indisponibilidade sistêmica.',
    steps: [
      { title: 'Verificar painel', description: 'Um status verde indica operação normal.' },
      { title: 'Pausar integrações', description: 'Use a chave de emergência para suspender tráfego.' },
      { title: 'Consultar canários', description: 'Os canários validam o pipeline ponta a ponta automaticamente.' }
    ],
    dataSources: [
      { name: 'Serviço de Health', frequency: 'A cada 60s' }
    ]
  },
  '/radar': {
    title: 'Radar',
    what: 'Monitoramento de oportunidades em tempo real nas redes sociais.',
    whenToUse: 'Use para encontrar discussões relevantes e converter em leads.',
    steps: [
      { title: 'Analisar oportunidade', description: 'Revise o contexto da oportunidade identificada.' },
      { title: 'Aprovar para Tese', description: 'Clique em Aprovar para vincular à tese editorial.' },
      { title: 'Criar Arte', description: 'Use o botão Criar Arte para encaminhar ao Creative Bridge.' }
    ],
    dataSources: [
      { name: 'Social Scraper', frequency: 'Contínuo' }
    ]
  },
  '/source-roi': {
    title: 'ROI por Origem',
    what: 'Métricas de conversão agrupadas por fonte de aquisição.',
    whenToUse: 'Use para entender quais canais trazem leads de maior qualidade.',
    steps: [
      { title: 'Comparar fontes', description: 'Analise o gráfico de barras para ver a distribuição.' },
      { title: 'Drill-down', description: 'Clique em uma fonte para explorar os leads desta origem.' },
      { title: 'Exportar', description: 'Use o botão Exportar CSV para análise externa.' }
    ],
    dataSources: [
      { name: 'Analytics', frequency: 'Diário' }
    ]
  },
  '/email-flows': {
    title: 'Fluxos de E-mail',
    what: 'Nutrição por eventos e sequências automáticas.',
    whenToUse: 'Use para acompanhar o engajamento e a estrutura dos funis de e-mail.',
    steps: [
      { title: 'Explorar fluxo', description: 'Navegue pelo canvas visual para ver o caminho do lead.' },
      { title: 'Ativar fluxo', description: 'Verifique se os passos têm assunto e corpo antes de ativar.' },
      { title: 'Monitorar entrega', description: 'Acompanhe as métricas de abertura e cliques.' }
    ],
    dataSources: [
      { name: 'Motor de Engajamento', frequency: 'Tempo real' }
    ]
  },
  '/contact-policies': {
    title: 'Políticas de Contato',
    what: 'Regras de cadência e horários permitidos para envio de mensagens.',
    whenToUse: 'Use para garantir conformidade e evitar spam.',
    steps: [
      { title: 'Definir limites', description: 'Configure o máximo de contatos por hora e por dia.' },
      { title: 'Testar política', description: 'Simule um envio para validar se a política permite o contato.' },
      { title: 'Ver histórico', description: 'Acesse o histórico de alterações para auditoria.' }
    ],
    dataSources: [
      { name: 'Motor de Políticas', frequency: 'Tempo real' }
    ]
  },
  '/content-opportunity': {
    title: 'Oportunidades de Conteúdo',
    what: 'Recomendações de conteúdo baseadas em dores do mercado e teses.',
    whenToUse: 'Use para transformar insights em pautas acionáveis.',
    steps: [
      { title: 'Revisar oportunidade', description: 'Analise a dor identificada e o público-alvo.' },
      { title: 'Aprovar pauta', description: 'Transforme a oportunidade em item de conteúdo.' },
      { title: 'Criar Arte', description: 'Encaminhe para o Creative Bridge para produção visual.' }
    ],
    dataSources: [
      { name: 'Inteligência Competitiva', frequency: 'Contínuo' }
    ]
  },
  '/competitive-intel': {
    title: 'Inteligência Competitiva',
    what: 'Análise de concorrentes, temas e dores do mercado.',
    whenToUse: 'Use para descobrir lacunas de mercado e ajustar o posicionamento.',
    steps: [
      { title: 'Filtrar concorrente', description: 'Filtre por concorrente para ver os ângulos mais explorados.' },
      { title: 'Identificar dores', description: 'Veja as dores mapeadas e perguntas frequentes detectadas.' },
      { title: 'Exportar insights', description: 'Use os dados para criar teses ou pautas de conteúdo.' }
    ],
    dataSources: [
      { name: 'Scraper de Redes', frequency: 'Semanal' }
    ]
  },
  '/community': {
    title: 'Comunidades (Clusters)',
    what: 'Mapeamento de clusters e relações entre os leads.',
    whenToUse: 'Use para identificar influenciadores e sub-nichos.',
    steps: [
      { title: 'Explorar cluster', description: 'Identifique os nós centrais de uma comunidade.' },
      { title: 'Sincronizar mensagens', description: 'Use Sincronizar Agora para coletar dados do grupo.' },
      { title: 'Analisar coesão', description: 'Verifique o score de coesão para priorizar grupos.' }
    ],
    dataSources: [
      { name: 'Grafo de Interações', frequency: 'Mensal' }
    ]
  },
  '/communities': {
    title: 'Grupos WhatsApp',
    what: 'Gestão dos grupos do WhatsApp monitorados pela plataforma.',
    whenToUse: 'Use para adicionar novos grupos, revisar mensagens coletadas e identificar leads emergentes.',
    steps: [
      { title: 'Adicionar grupo', description: 'Insira o link de convite do grupo para iniciar a coleta passiva.' },
      { title: 'Revisar membros', description: 'Veja quais membros do grupo já são leads conhecidos.' },
      { title: 'Exportar contatos', description: 'Encaminhe membros relevantes para a fila de engajamento.' }
    ],
    dataSources: [
      { name: 'WhatsApp Cloud API', frequency: 'Tempo real via webhook' }
    ],
    limitations: ['Requer aprovação de administrador do grupo', 'WhatsApp Groups API em beta — pode estar indisponível']
  },
  '/timeline': {
    title: 'Timeline',
    what: 'Histórico unificado das interações do lead.',
    whenToUse: 'Use para entender a jornada do usuário e histórico de conversas.',
    steps: [
      { title: 'Revisar eventos', description: 'Veja a cronologia das interações para cada contato.' },
      { title: 'Filtrar canal', description: 'Use a busca para filtrar por tipo de evento ou canal.' },
      { title: 'Identificar padrões', description: 'Observe os picos de engajamento para definir o melhor horário.' }
    ],
    dataSources: [
      { name: 'Motor de Eventos', frequency: 'Tempo real' }
    ]
  },
  '/configs': {
    title: 'Configurações de Score',
    what: 'Parâmetros do algoritmo de scoring da campanha.',
    whenToUse: 'Use para calibrar os limites de classificação (P0, P1, P2) e pesos.',
    steps: [
      { title: 'Ajustar limites', description: 'Altere os limites e simule o impacto.' },
      { title: 'Calibrar pesos', description: 'Defina a importância relativa de cada sinal.' },
      { title: 'Salvar e monitorar', description: 'Salve e acompanhe o impacto na distribuição de leads.' }
    ],
    dataSources: [
      { name: 'Algoritmo de Score', frequency: 'Tempo real' }
    ]
  },
  '/accounts': {
    title: 'Contas e Integrações',
    what: 'Gestão das contas sociais e de disparo conectadas.',
    whenToUse: 'Use para acompanhar o status, quotas diárias e renovar tokens de acesso.',
    steps: [
      { title: 'Verificar status', description: 'Consulte a aba de saúde para identificar desconexões.' },
      { title: 'Renovar token', description: 'Clique em Vincular Meta para renovar o acesso OAuth.' },
      { title: 'Adicionar integração', description: 'Use Nova Integração para conectar novos provedores.' }
    ],
    dataSources: [
      { name: 'Motor de Integrações', frequency: 'Tempo real' }
    ]
  },
  '/ai-settings': {
    title: 'Configurações de IA',
    what: 'Parâmetros e prompts dos modelos de Inteligência Artificial.',
    whenToUse: 'Use para calibrar a temperatura e instruções da triagem de leads e respostas.',
    steps: [
      { title: 'Ajustar prompt', description: 'Altere as instruções base e salve para entrar em vigor imediatamente.' },
      { title: 'Reordenar modelos', description: 'Use as setas para definir a prioridade de fallback dos modelos.' },
      { title: 'Testar conexão', description: 'Clique em Testar para validar a latência do modelo.' }
    ],
    dataSources: [
      { name: 'Gateway de LLM', frequency: 'Ao salvar' }
    ]
  },
  '/content-items': {
    title: 'Itens de Conteúdo',
    what: 'Galeria unificada de peças de conteúdo prontas ou em produção.',
    whenToUse: 'Use para encontrar ativos, visualizar status e vincular a fluxos de engajamento.',
    steps: [
      { title: 'Buscar peça', description: 'Filtre por tese ou formato para encontrar imagens/textos.' },
      { title: 'Alternar visualização', description: 'Use os botões Galeria/Tabela para mudar a exibição.' },
      { title: 'Criar Arte', description: 'Use o botão 🎨 Criar Arte para encaminhar ao Creative Bridge.' }
    ],
    dataSources: [
      { name: 'Repositório de Assets', frequency: 'Tempo real' }
    ]
  },
  '/creative-bridge': {
    title: 'Creative Bridge',
    what: 'Fila de requisições criativas geradas por IA ou encaminhadas para design.',
    whenToUse: 'Use para acompanhar a fila de produção de novos banners e textos.',
    steps: [
      { title: 'Acompanhar fila', description: 'Veja o progresso dos workers na criação de mídia.' },
      { title: 'Assumir job', description: 'Clique em Assumir para pegar um job de design ou copy.' },
      { title: 'Criar novo job', description: 'Use a rota /creative-bridge?mode=create para criar um brief.' }
    ],
    dataSources: [
      { name: 'Fila de Tarefas', frequency: 'A cada 30s' }
    ]
  },
  '/engagement-queue': {
    title: 'Fila de Engajamento',
    what: 'Acompanhamento da fila de ações (curtidas, comentários, DMs) pendentes.',
    whenToUse: 'Use para aprovar ações, checar falhas e monitorar limites diários de uso das contas.',
    steps: [
      { title: 'Aprovar ações', description: 'Filtre por "Aguardando Aprovação" e revise antes de disparar.' },
      { title: 'Alternar visualização', description: 'Use ?mode=kanban para ver nas raias de prioridade.' },
      { title: 'Monitorar quotas', description: 'O painel lateral mostra limites diários de cada conta.' }
    ],
    dataSources: [
      { name: 'Motor de Execução', frequency: 'A cada 15s (Polling)' }
    ]
  },
  '/identities': {
    title: 'Identidades',
    what: 'Resolução de entidades para juntar perfis de múltiplas redes de uma mesma pessoa.',
    whenToUse: 'Use para fundir (merge) ou separar contatos duplicados.',
    steps: [
      { title: 'Revisar conflitos', description: 'Aprove as sugestões de unificação identificadas pelo sistema.' },
      { title: 'Visualizar impacto', description: 'Clique em Visualizar Impacto do Merge antes de confirmar.' },
      { title: 'Confirmar unificação', description: 'Confirme para combinar os perfis e atualizar o score.' }
    ],
    dataSources: [
      { name: 'Algoritmo de Identidade', frequency: 'Diário' }
    ]
  },
  '/market-radar': {
    title: 'Radar de Mercado',
    what: 'Acompanhamento macro de tendências e palavras-chave.',
    whenToUse: 'Use para descobrir novos movimentos do setor antes de criar teses.',
    steps: [
      { title: 'Explorar tendências', description: 'Navegue pelos termos em alta no seu nicho.' },
      { title: 'Criar alerta', description: 'Adicione uma palavra-chave ao Radar para monitoramento contínuo.' },
      { title: 'Converter em tese', description: 'Aprove a tendência e transforme em pauta editorial.' }
    ],
    dataSources: [
      { name: 'Scraper Macro', frequency: 'Semanal' }
    ]
  },
  '/notifications': {
    title: 'Notificações',
    what: 'Avisos sobre limites de contas, falhas de sistema ou SLAs estourados.',
    whenToUse: 'Use como sua caixa de entrada técnica e operacional.',
    steps: [
      { title: 'Revisar alertas', description: 'Priorize notificações de severidade crítica.' },
      { title: 'Limpar fila', description: 'Marque como lido após agir sobre o alerta.' },
      { title: 'Configurar triggers', description: 'Acesse a aba Triggers para criar novos gatilhos de alerta.' }
    ],
    dataSources: [
      { name: 'Sistema de Alertas', frequency: 'Tempo real' }
    ]
  },
  '/publishing': {
    title: 'Publicação',
    what: 'Agendamento e histórico de postagens nos canais orgânicos.',
    whenToUse: 'Use para programar as peças criadas a partir das teses editoriais.',
    steps: [
      { title: 'Agendar post', description: 'Selecione o asset, a legenda e a data.' },
      { title: 'Verificar conflitos', description: 'Use o IntegrationGate para checar sobreposições de horário.' },
      { title: 'Alternar visualização', description: 'Use ?mode=calendar para ver o calendário mensal.' }
    ],
    dataSources: [
      { name: 'Scheduler Meta', frequency: 'Tempo real' }
    ]
  },
  '/review-inbox': {
    title: 'Caixa de Revisão',
    what: 'Fila de respostas e interações geradas por IA pendentes de aprovação humana.',
    whenToUse: 'Use para revisar rapidamente, aprovar ou editar textos antes do disparo final.',
    steps: [
      { title: 'Revisar e aprovar', description: 'Use o atalho para aprovar rapidamente a resposta da IA.' },
      { title: 'Editar resposta', description: 'Clique em Editar para ajustar o texto gerado antes de enviar.' },
      { title: 'Pular item', description: 'Use S para pular e passar para o próximo item da fila.' }
    ],
    dataSources: [
      { name: 'Fila de Revisão', frequency: 'Tempo real' }
    ]
  }
}
