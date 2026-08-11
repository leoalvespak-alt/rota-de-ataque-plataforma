# Plano completo — melhoria de UI/UX do Prospector

Status: **planejado, ainda não executado**  
Escopo: todas as páginas, abas, estados, componentes e integrações do Prospector em `/prospector`  
Princípio central: interface clean, densa na medida certa, previsível, acessível, sem dados simulados e sem ações decorativas.

## 1. Objetivo

Transformar o Prospector em uma aplicação operacional completa, com:

- navegação estável, sem flashes, saltos de layout ou carregamentos duplicados;
- informação suficiente para decidir e agir sem abrir o banco ou consultar logs;
- dados reais, filtrados pela campanha ativa e com origem/frescor explícitos;
- ações funcionais, com confirmação, progresso, sucesso, erro e auditoria;
- integrações reais quando configuradas e estados honestos de “não configurado” quando faltarem credenciais;
- responsividade, acessibilidade e consistência visual em todas as páginas;
- cobertura automatizada contra regressões funcionais e visuais.

## 2. Regras inegociáveis da execução

1. Nenhuma página de produção poderá exibir fixtures, números estáticos, eventos inventados, “ao vivo” fixo ou fallback sintético.
2. Fixtures continuarão permitidas somente em testes e Storybook, sem importação pelo bundle de produção.
3. Nenhum botão, aba, filtro, seletor, link ou atalho poderá existir sem comportamento implementado.
4. Uma integração sem variável obrigatória deverá aparecer como **Não configurada**, listar o que falta e desabilitar apenas as ações dependentes dela.
5. Dados vazios deverão gerar orientação útil, nunca conteúdo fictício.
6. Todas as leituras e mutações serão escopadas por campanha, papel e permissão.
7. Todas as mutações terão feedback de progresso, proteção contra clique duplo, erro recuperável e registro de auditoria.
8. A interface manterá o último dado válido durante atualizações em segundo plano.
9. Builds, E2E e auditorias pesadas rodarão no GitHub/VPS, com concorrência limitada; a máquina local receberá apenas verificações leves.
10. O deploy só ocorrerá após os critérios de aceite deste documento estarem verdes.

## 3. Diagnóstico confirmado

### 3.1 Carregamento e “piscar”

- Páginas baseadas em `OperationalDashboard` passam pelo `loading.tsx` da rota e depois montam um segundo skeleton no cliente.
- A classe `.page` anima opacidade e deslocamento em toda navegação, reforçando o flash.
- O componente zera `items` a cada atualização, removendo conteúdo válido antes da resposta nova.
- A view de Leads lê a view salva no `localStorage` depois da hidratação, podendo trocar o conteúdo já renderizado.
- Skeletons genéricos não preservam a geometria da página final.

### 3.2 Falhas de componentes

- `DataTable` estima linhas com 44 px, mas várias linhas reais têm aproximadamente 68 px; isso causa sobreposição e textos duplicados visualmente.
- `SavedViewTabs` e `FilterBar` renderizam botões sem callbacks; em Leads existe ainda uma segunda barra de filtros funcional, duplicando controles.
- `SuggestedActionCard`, `MarketSignalCard`, `GroupPolicyForm` e outros padrões possuem ações sem implementação ou sem feedback.
- O seletor global de campanha não altera as consultas.
- O botão `Ctrl+K` não abre uma central de comandos.
- O indicador global “Ao vivo” está fixo como conectado.
- A navegação não destaca corretamente a rota ativa e é longa, sem agrupamento ou boa adaptação móvel.
- Links e chamadas misturam caminhos absolutos, `/prospector` hardcoded e `appPath`, aumentando risco de 404.

### 3.3 Informação insuficiente

- Diversas páginas mostram apenas “registros reais” e uma tabela genérica, sem KPIs específicos, tendências, explicações, filtros ou ações contextualizadas.
- Campos JSON aparecem crus para o operador.
- Datas, percentuais, scores, status e canais não têm formatação consistente.
- Estados vazios não diferenciam ausência legítima de dados, integração desligada, worker parado, filtro sem resultado ou erro.
- Não há indicação consistente de última atualização, origem do dado ou cobertura da coleta.

### 3.4 Integrações e funcionalidade

- Formulários multicanal exigem UUID e JSON manual em vez de seletores e construtores guiados.
- Algumas mutações ignoram corpo de erro, não exibem sucesso e não fazem rollback visual.
- Review Inbox oferece “Editar”, mas não apresenta editor.
- Leads contém ação em massa permanentemente desabilitada e sugestão vazia.
- A troca entre Rota de Ataque e Gazeta Concursos é apenas visual.
- Ausência de credenciais não é apresentada de forma uniforme e acionável.
- Consultas grandes não possuem paginação/cursor e algumas páginas criam seu próprio ciclo de conexão diretamente.

## 4. Arquitetura de experiência pretendida

### 4.1 Shell persistente

- Sidebar agrupada em: **Visão**, **Prospecção**, **Conteúdo**, **Canais**, **Governança** e **Sistema**.
- Item ativo, contadores reais e estados de integração visíveis.
- Seletor de campanha funcional, persistido em cookie/URL e aplicado no servidor.
- Header contextual com campanha, período, frescor, busca/command palette e saúde real.
- Navegação móvel por drawer; tablet com rail compacto; desktop com sidebar redimensionável ou recolhível.

### 4.2 Estratégia sem flicker

- Renderização inicial no servidor com dados reais.
- Remoção do segundo fetch inicial das páginas operacionais.
- Atualizações client-side recebem `initialData` e preservam os dados anteriores.
- Indicador de navegação discreto só após 150 ms; skeleton apenas quando realmente não existir conteúdo anterior.
- Skeleton específico por layout, com dimensões iguais às do conteúdo final.
- Remoção da animação global de opacidade/deslocamento; animações somente em mudanças locais relevantes.
- `AbortController`, deduplicação e prevenção de respostas fora de ordem.
- Atualização em segundo plano marcada como “Atualizando…”, sem desmontar a tela.

### 4.3 Contrato de dados

Toda leitura interativa deverá retornar:

```ts
type ApiEnvelope<T> = {
  data: T
  meta: {
    requestId: string
    campaignId: string | null
    generatedAt: string
    freshness: 'live' | 'recent' | 'stale'
    sourceStatus: 'ready' | 'partial' | 'not_configured' | 'error'
    pagination?: { cursor: string | null; hasMore: boolean }
  }
}
```

Toda mutação deverá retornar resultado tipado, evento de auditoria e próximo estado canônico. Erros usarão código estável, mensagem para operador, `requestId` e ação de recuperação.

### 4.4 Camada de domínio para a UI

- Criar serviços por domínio entre páginas e banco, eliminando SQL e formatação duplicados em componentes.
- Validar entrada e saída com schemas compartilhados.
- Centralizar campanha, permissão, paginação, ordenação, períodos e formatação.
- Separar estados `loading`, `refreshing`, `empty`, `filtered_empty`, `partial`, `not_configured`, `error` e `success`.
- Expor saúde real de Meta, Reddit, Resend, WhatsApp, banco, filas, workers e SSE.

## 5. Fases de execução

## Fase 0 — Baseline e proteção contra regressão

### Etapa 0.1 — Inventário executável

- [ ] Criar manifesto de todas as rotas, abas, ações, permissões, fontes e integrações.
- [ ] Mapear cada controle visível para handler, endpoint, tabela e evento de auditoria.
- [ ] Marcar explicitamente controles a remover quando não houver caso de uso real.
- [ ] Registrar estados esperados por página: cheio, vazio, filtrado, indisponível, erro e carregamento.

### Etapa 0.2 — Evidência atual

- [ ] Capturar baseline visual desktop, tablet e mobile das rotas.
- [ ] Medir navegação, LCP, CLS, consultas lentas, tamanho do bundle e erros de console/rede.
- [ ] Criar teste que falha se produção importar fixtures/stories ou textos de demonstração.
- [ ] Criar teste que falha para botões sem ação, links inválidos e abas sem mudança observável.

Critério de aceite: cobertura de 100% das rotas listadas na seção 6 e baseline armazenado na CI.

## Fase 1 — Fundação visual e shell

### Etapa 1.1 — Tokens e padrões

- [ ] Consolidar cores, tipografia, espaçamento, raios, sombras, densidade e motion no Design System incorporado ao monorepo.
- [ ] Definir variantes de superfície, tabela, painel, formulário, badge, status e botão.
- [ ] Padronizar português, capitalização, datas, números, percentuais, scores e estados.
- [ ] Remover `transition: all` e limitar transições a propriedades seguras.

### Etapa 1.2 — Navegação

- [ ] Agrupar rotas por domínio e destacar a rota ativa.
- [ ] Implementar sidebar recolhível, drawer mobile e navegação por teclado.
- [ ] Implementar command palette real com busca de páginas, leads, conteúdos e ações permitidas.
- [ ] Implementar breadcrumbs somente em hierarquias reais, como detalhe de lead e content item.

### Etapa 1.3 — Contexto global

- [ ] Tornar o seletor de campanha funcional.
- [ ] Persistir campanha em cookie seguro e refletir em URL quando a página for compartilhável.
- [ ] Escopar consultas, contadores e ações à campanha selecionada.
- [ ] Substituir “Ao vivo” fixo por estado vindo da saúde de integrações e workers.
- [ ] Exibir último sync e motivo quando o dado estiver parcial ou atrasado.

Critério de aceite: trocar de campanha altera dados reais sem reload completo; nenhum estado global é hardcoded.

## Fase 2 — Eliminação do flicker e estados assíncronos

### Etapa 2.1 — Renderização inicial

- [ ] Migrar páginas genéricas para receber dados iniciais no servidor.
- [ ] Remover fetch inicial duplicado em `OperationalDashboard`.
- [ ] Compartilhar cache de requisição e conexão de banco sem manter dados obsoletos entre campanhas.
- [ ] Adicionar paginação/cursor nas listas grandes.

### Etapa 2.2 — Atualização

- [ ] Criar `useOperationalQuery` com `initialData`, abort, retry controlado e preservação do dado anterior.
- [ ] Atualizar apenas blocos afetados após mutações.
- [ ] Reconciliar SSE/polling com dados canônicos e mostrar estado de reconexão real.
- [ ] Impedir requests concorrentes e respostas fora de ordem.

### Etapa 2.3 — Loading estável

- [ ] Remover animação global `.page-in`.
- [ ] Criar skeletons específicos para lista, três painéis, kanban, calendário, formulário e detalhe.
- [ ] Reservar espaço para cabeçalhos, KPIs e tabelas, mantendo CLS abaixo de 0,05.
- [ ] Respeitar `prefers-reduced-motion` sem introduzir flashes.

Critério de aceite: navegação gravada em vídeo não apresenta tela vazia, dupla troca de skeleton ou desaparecimento do conteúdo anterior.

## Fase 3 — Componentes funcionais e acessíveis

### Etapa 3.1 — Tabelas e listas

- [ ] Corrigir altura/medição da virtualização ou desativá-la abaixo do limiar necessário.
- [ ] Implementar cabeçalho semântico, ordenação, paginação, seleção, foco e estado selecionado.
- [ ] Adicionar busca, filtros reais, chips removíveis e reset consistente.
- [ ] Tornar colunas configuráveis sem esconder informações essenciais.

### Etapa 3.2 — Abas, filtros e views

- [ ] Transformar `SavedViewTabs` e `FilterBar` em componentes controlados.
- [ ] Persistir filtros compartilháveis na URL; preferências pessoais ficam no servidor ou armazenamento estável sem alteração pós-hidratação.
- [ ] Implementar criação, renomeação e remoção de view apenas onde houver persistência real.
- [ ] Remover “Nova view” quando o backend correspondente não fizer parte do domínio.

### Etapa 3.3 — Mutações

- [ ] Criar padrão único de botão assíncrono, toast, mensagem inline e confirmação.
- [ ] Implementar idempotência e desabilitar repetição durante a requisição.
- [ ] Fazer optimistic update somente onde houver rollback seguro.
- [ ] Mostrar código de suporte/request ID em falhas, sem expor stack ou segredo.

### Etapa 3.4 — Estados

- [ ] Diferenciar vazio natural, filtro sem resultado, integração ausente, coleta pendente, worker parado e erro.
- [ ] Oferecer próxima ação real em cada estado vazio.
- [ ] Criar error boundaries por seção para uma falha parcial não derrubar a página inteira.

Critério de aceite: nenhum controle sem efeito e nenhuma resposta de ação silenciosa.

## Fase 4 — Prospecção e relacionamento

### Etapa 4.1 — Overview

- [ ] KPIs por campanha: leads novos/qualificados, P0/P1, conversões, ações concluídas, conversas abertas e cobertura de coleta.
- [ ] Tendências reais por período, funil, alertas prioritários e atalhos para filas.
- [ ] Comparação Rota de Ataque × Gazeta apenas quando “Todas as campanhas” estiver selecionado.
- [ ] Drill-down de cada KPI para a lista filtrada correspondente.

### Etapa 4.2 — Leads

- [ ] Busca, prioridade, intenção, canal, origem, privacidade, verificação, período e ordenação reais.
- [ ] Detalhe com identidades, score explicado, evidências, timeline, comunidades, conversas e próxima melhor ação.
- [ ] Implementar seleção em massa e geração auditável de ações elegíveis; remover botão permanentemente desabilitado.
- [ ] Corrigir view persistida sem flicker e remover barras de filtro duplicadas.

### Etapa 4.3 — Review Inbox

- [ ] Editor real para a ação “Editar”, com preview e validação.
- [ ] Contexto humano legível em vez de JSON cru.
- [ ] Histórico real de decisões, responsável, timestamps e efeito produzido.
- [ ] Atalhos com ajuda visível, prevenção de ação acidental e feedback de erro.

### Etapa 4.4 — Timeline

- [ ] Filtros por lead, canal, direção, evento, origem e período.
- [ ] Agrupamento cronológico, paginação e detalhe de metadata formatado.
- [ ] Links para lead, conversa, publicação ou ação relacionados.

### Etapa 4.5 — Identidades

- [ ] Busca e agrupamento por lead, canal, verificação e status.
- [ ] Comparação lado a lado das evidências do candidato.
- [ ] Aprovação/rejeição com confirmação, motivo e resultado imediato.
- [ ] Tela de histórico e rollback disponível durante os 30 dias prometidos.

Critério de aceite: o fluxo “descobrir lead → entender evidência → decidir contato → auditar resultado” funciona sem UUID manual.

## Fase 5 — Inteligência e conteúdo

### Etapa 5.1 — Teses

- [ ] Criar, editar, ativar, pausar e arquivar teses com limite de sete ativas aplicado no servidor.
- [ ] Mostrar origem, evidências, impacto, conteúdos derivados e desempenho.
- [ ] Substituir “slot livre” por CTA funcional com formulário validado.

### Etapa 5.2 — Radar e Radar de Mercado

- [ ] Unificar linguagem visual sem misturar radar de posts e sinais passivos.
- [ ] Exibir velocidade, volume, confiança, evidências e frescor.
- [ ] Abrir publicação/evidências e permitir criar oportunidade ou watch real.
- [ ] Criar watches com campanha e seletores legíveis, sem UUID manual.

### Etapa 5.3 — Competitive Intel

- [ ] Visões por concorrente, tema, dor, pergunta e hook.
- [ ] Tendências 7/30 dias e evidências navegáveis.
- [ ] Ação real para gerar tese ou oportunidade preservando atribuição.

### Etapa 5.4 — Content Opportunity

- [ ] Pipeline por estado com score explicado, campanha, tese, ângulo, hook e evidências.
- [ ] Aprovar, rejeitar, editar e enviar para Creative Bridge.
- [ ] Preview antes de criar content item e trilha entre oportunidade e publicação.

### Etapa 5.5 — Content Items e detalhe

- [ ] Abas de status funcionais e refletidas na URL.
- [ ] Busca, filtros, paginação e contadores reais.
- [ ] Detalhe com briefing, variantes, status por canal, aprovações, publicações e métricas.
- [ ] Aprovação e fork com feedback, validação e navegação usando `appPath`.

### Etapa 5.6 — Creative Bridge

- [ ] Integrar a fila real de oportunidades e content items aprovados.
- [ ] Abrir o editor do Design System com contexto e IDs canônicos.
- [ ] Receber status do render, preview, erros e artefato final.
- [ ] Eliminar qualquer conteúdo de exemplo na rota de produção.

### Etapa 5.7 — Publicação

- [ ] Calendário com navegação mensal, timezone, filtros por campanha/canal/status e conflito de horário.
- [ ] Kanban funcional com ações permitidas; drag-and-drop somente se persistir no servidor.
- [ ] Detalhes, retry, cancelamento seguro, IDs externos e link para publicação.
- [ ] Métricas pós-publicação e estado de sincronização Meta/Threads/e-mail.

Critério de aceite: o fluxo “sinal → tese → oportunidade → item → variante → render → publicação → desempenho” é navegável e integralmente real.

## Fase 6 — Canais e políticas

### Etapa 6.1 — Fluxos de e-mail

- [ ] Lista por campanha, status, versão, inscritos ativos e métricas.
- [ ] Editor visual de Entry/Send/Wait/Branch/Exit com validação de grafo.
- [ ] Preview e teste usando destinatário explicitamente informado pelo operador.
- [ ] Ativar/pausar/versionar com Resend configurado; estado “Não configurado” quando ausente.
- [ ] Remover edição por JSON cru.

### Etapa 6.2 — Community e Grupos WhatsApp

- [ ] Mapa de comunidades com tamanho, coesão, origem, atualização e membros.
- [ ] Drill-down para leads e fontes da comunidade.
- [ ] Página de grupos mostra disponibilidade real da API e requisitos faltantes.
- [ ] Controles de política permanecem desabilitados até suporte real, sem prometer execução inexistente.

### Etapa 6.3 — Conversations

- [ ] Lista de conversas real por canal, conta, campanha, status, não lidas e intenção.
- [ ] Histórico completo, opt-in, janela de 24h, política aplicável e próxima ação.
- [ ] Composer contextual: texto permitido dentro da janela; template aprovado fora dela.
- [ ] Seletores para conversa/template; remover UUID e referência manual.
- [ ] Envio com idempotência, status de entrega, erro e auditoria.

### Etapa 6.4 — Contact Policies

- [ ] Editor de escopo global/campanha/canal com cadência e regras tipadas.
- [ ] Simulador de elegibilidade para lead/conversa real.
- [ ] Explicação de precedência e motivo de bloqueio.
- [ ] Criar, editar, ativar, pausar e versionar sem JSON cru.

### Etapa 6.5 — Engagement Queue

- [ ] Kanban/lista por estado, prioridade, conta, ação, campanha e idade.
- [ ] Abrir evidência, política, aprovação e trace sem depender de runbook para uso normal.
- [ ] Quotas com consumo real, não `used={0}`.
- [ ] Aprovar, rejeitar, cancelar e retry conforme permissão.
- [ ] SSE atualiza itens sem limpar a tela e informa reconexão real.

Critério de aceite: e-mail, WhatsApp, Instagram/Threads e Reddit exibem capacidade real e nunca simulam disponibilidade.

## Fase 7 — Administração, configuração e observabilidade

### Etapa 7.1 — Contas

- [ ] Estado real de collector/actor, token, permissões, health e última sincronização.
- [ ] OAuth com mensagens de erro específicas e retorno ao mesmo contexto.
- [ ] Políticas editáveis com limites diário/horário e confirmação.
- [ ] Concorrentes com validação cancelável, debounce, feedback, retry e atualização sem `location.reload()`.

### Etapa 7.2 — Configs

- [ ] Formulários tipados para thresholds, frescor, pesos, NBA, voz e demais configurações existentes.
- [ ] Valores efetivos versus defaults, validação de soma/faixa e histórico de mudanças.
- [ ] Preview do impacto antes de salvar quando aplicável.

### Etapa 7.3 — Source ROI

- [ ] KPIs e ranking por origem, campanha e janela.
- [ ] Volume mínimo, followback, retenção, conversão e score com explicação.
- [ ] Tendência temporal e drill-down para os leads atribuídos.

### Etapa 7.4 — Notificações & Erros

- [ ] Abas Triggers, Canais, Incidentes e Entregas controladas e refletidas na URL.
- [ ] Triggers editáveis, canais com configuração/saúde real e teste com feedback completo.
- [ ] Incidentes com payload formatado, timeline, reconhecimento, resolução e runbook válido.
- [ ] Entregas com filtros, tentativas e erro legível.

### Etapa 7.5 — Saúde do Sistema

- [ ] Score calculado e explicado por banco, filas, workers, webhooks e provedores.
- [ ] Heartbeats, backlog, latência, falhas e última execução por worker.
- [ ] Kill-switch com estado canônico, confirmação acessível, motivo, autor e auditoria.
- [ ] Links de runbook respeitando base path e existência do documento.

Critério de aceite: o operador identifica integração quebrada, impacto e próxima ação sem consultar terminal.

## Fase 8 — Integrações reais e ausência de credenciais

### Etapa 8.1 — Registro de capacidades

- [ ] Criar endpoint seguro de capacidades que reporte apenas presença/saúde, nunca valores secretos.
- [ ] Cobrir Meta/Instagram, Threads, Reddit, WhatsApp Cloud/Groups, Resend, banco, Redis/filas e embeddings.
- [ ] Exibir conta, escopos e validade quando o provedor permitir.

### Etapa 8.2 — Estados de setup

- [ ] Página/área de integrações com `Configurada`, `Ação necessária`, `Expirada`, `Parcial`, `Indisponível`.
- [ ] Lista exata de variáveis ausentes usando apenas seus nomes.
- [ ] CTA para OAuth ou documentação, sem enviar segredo pelo navegador.
- [ ] Ações dependentes desabilitadas com explicação; páginas de leitura continuam disponíveis.

### Etapa 8.3 — Testes de contrato

- [ ] Contract tests para cada provider usando servidor fake somente em teste.
- [ ] Smoke real opt-in no ambiente de staging quando as credenciais forem adicionadas.
- [ ] Nenhum smoke real envia mensagem/publicação sem destino de teste explicitamente configurado.

Critério de aceite: antes das credenciais, tudo fica pronto e honesto; depois de adicioná-las, a capacidade é detectada sem mudança de código.

## Fase 9 — Qualidade, acessibilidade e desempenho

### Etapa 9.1 — Testes

- [ ] Unitários para formatadores, schemas, reducers e hooks assíncronos.
- [ ] Integração para serviços e rotas com PostgreSQL real efêmero.
- [ ] Component tests para cheio/vazio/erro/loading/partial/not_configured.
- [ ] E2E dos fluxos críticos e de todas as abas.
- [ ] Testes de teclado, foco, dialogs e atalhos.

### Etapa 9.2 — Regressão visual

- [ ] Baselines desktop 1440, tablet 1024 e mobile 390.
- [ ] Cobrir tema, tabelas, três painéis, dialogs, toasts, estados vazios e erros.
- [ ] Falhar CI por screenshot ausente, teste pulado, console error ou request 4xx/5xx inesperado.

### Etapa 9.3 — Orçamentos

- [ ] CLS ≤ 0,05 nas rotas principais.
- [ ] LCP ≤ 2,5 s em perfil móvel de staging.
- [ ] Resposta visual a interação ≤ 100 ms.
- [ ] Navegação quente sem tela vazia e sem skeleton para respostas abaixo de 150 ms.
- [ ] Zero erro de hidratação, console, recurso 404 ou request não tratado.
- [ ] WCAG 2.2 AA para contraste, teclado, foco, nomes acessíveis e redução de movimento.

Critério de aceite: `workspace-quality`, `design-system-no-regression`, banco, E2E do Prospector, a11y e visual regression verdes.

## Fase 10 — Rollout e deploy

### Etapa 10.1 — Entrega segura

- [ ] Implementar em ondas pequenas protegidas por feature flags somente quando necessário.
- [ ] Migrar contratos sem quebrar workers existentes.
- [ ] Aplicar migrations compatíveis para frente e para trás antes do novo app.
- [ ] Fazer build exclusivamente no VPS/CI.

### Etapa 10.2 — Validação

- [ ] Smoke autenticado em staging para todas as rotas.
- [ ] Deploy canário e verificação de erros, latência e integrações.
- [ ] Smoke em produção para ambas as campanhas.
- [ ] Confirmar que credenciais ausentes geram `not_configured`, não 500.
- [ ] Confirmar que não há conteúdo mockado no bundle ou respostas.

### Etapa 10.3 — Encerramento

- [ ] Atualizar runbooks e documentação de operação.
- [ ] Registrar evidências de cada critério de aceite.
- [ ] Remover flags, componentes mortos e caminhos antigos após estabilização.

## 6. Matriz obrigatória de páginas e abas

| Área | Rota/aba | Dados reais | Ações obrigatórias |
|---|---|---|---|
| Visão | Overview `/` | campanha, funil, tendências, alertas, cobertura | filtrar período/campanha, drill-down |
| Prospecção | Leads `/leads` | score, prioridade, intenções, fontes, identidades, histórico | filtrar, selecionar, criar ação elegível |
| Prospecção | Review Inbox `/review-inbox` | pendências, contexto, histórico | aprovar, editar, rejeitar, bloquear, adiar |
| Prospecção | Timeline `/timeline` | eventos multicanal e referências | filtrar e abrir entidade relacionada |
| Prospecção | Identidades `/identities` | identidades, candidatos, evidências, histórico | aprovar, rejeitar, rollback |
| Conteúdo | Teses `/theses` | teses, evidências, impacto | criar, editar, ativar, pausar, arquivar |
| Conteúdo | Content Items `/content-items` | items e contadores por estado | filtrar e abrir detalhe |
| Conteúdo | Content Item `/:id` | variantes, timeline, publicação, desempenho | aprovar e criar fork |
| Inteligência | Radar `/radar` | posts, velocidade, leads, intenção | abrir post e criar oportunidade |
| Inteligência | Radar de Mercado `/market-radar` | sinais Reddit e evidências | criar watch/oportunidade |
| Inteligência | Competitive Intel `/competitive-intel` | temas, dores, perguntas, hooks | criar tese/oportunidade |
| Conteúdo | Content Opportunity `/content-opportunity` | pipeline e score explicado | editar, aprovar, rejeitar, enviar ao criativo |
| Conteúdo | Creative Bridge `/creative-bridge` | fila, renders e artefatos | abrir editor, renderizar, acompanhar |
| Conteúdo | Publicação `/publishing` | calendário, status e métricas | agendar, aprovar, cancelar, retry |
| Canais | Fluxos de E-mail `/email-flows` | versões, grafo, inscritos, métricas | criar, editar, testar, ativar, pausar |
| Inteligência | Community `/community` | clusters, membros e coesão | filtrar e abrir leads |
| Canais | Grupos WhatsApp `/communities` | disponibilidade e requisitos | verificar capacidade e configurar quando suportado |
| Canais | Conversations `/conversations` | threads, mensagens, opt-in e janela | responder, usar template, revisar |
| Governança | Contact Policies `/contact-policies` | regras efetivas e precedência | criar, editar, simular, ativar, pausar |
| Governança | Engagement Queue `/engagement-queue` | fila, quotas, política e trace | aprovar, rejeitar, cancelar, retry |
| Sistema | Contas `/accounts` | contas, OAuth, saúde, políticas, concorrentes | vincular, renovar, configurar e validar |
| Sistema | Configs `/configs` | configurações efetivas e histórico | editar, validar e salvar |
| Sistema | Source ROI `/source-roi` | métricas e tendências por origem | filtrar e abrir leads atribuídos |
| Sistema | Notificações — Triggers | regras e hits | criar, editar, ativar, testar |
| Sistema | Notificações — Canais | providers e saúde | configurar/testar |
| Sistema | Notificações — Incidentes | incidentes e timeline | reconhecer e resolver |
| Sistema | Notificações — Entregas | tentativas e erros | filtrar e retry quando seguro |
| Sistema | Saúde `/system-health` | componentes, workers, backlog e incidentes | kill-switch e diagnóstico |
| Acesso | Login `/login` | estado real de envio/autenticação | solicitar OTP, reenviar, entrar, tratar expiração |
| Global | error/not-found/loading | request ID e contexto seguro | retry, voltar e abrir suporte/runbook válido |

## 7. Sequência recomendada de implementação

1. Fases 0–3: fundação, campanha, carregamento e componentes.
2. Fase 4: Overview, Leads, Review Inbox, Timeline e Identidades.
3. Fase 5: inteligência, conteúdo, Creative Bridge e publicação.
4. Fase 6: canais, conversas, políticas e fila.
5. Fases 7–8: administração, observabilidade e capacidades de integração.
6. Fases 9–10: regressão completa, rollout e deploy.

Cada onda deve terminar com testes, evidência visual e CI verde antes de iniciar a seguinte.

## 8. Definition of Done global

O plano estará 100% concluído somente quando:

- [ ] todas as rotas e abas da matriz tiverem sido implementadas e testadas;
- [ ] não houver botão, aba, filtro, link ou atalho decorativo;
- [ ] não houver dado estático ou simulado em produção;
- [ ] a campanha selecionada escopar todas as telas aplicáveis;
- [ ] não houver flicker, sobreposição de linhas ou layout shift perceptível;
- [ ] todos os estados assíncronos e de integração forem honestos e recuperáveis;
- [ ] nenhum endpoint esperado retornar 404/500 em smoke normal;
- [ ] todas as ações gerarem feedback e auditoria;
- [ ] desktop, tablet e mobile passarem por regressão visual;
- [ ] acessibilidade WCAG 2.2 AA e orçamentos de desempenho estiverem verdes;
- [ ] CI completa e migrations passarem em checkout limpo;
- [ ] build e deploy ocorrerem no VPS/CI, seguidos de smoke de produção;
- [ ] Rota de Ataque e Gazeta Concursos funcionarem com isolamento correto;
- [ ] as únicas pendências permitidas forem credenciais externas ainda não fornecidas, claramente marcadas como `Não configurada`.

## 9. Resultado esperado

Uma UI menos “genérica de dashboard” e mais operacional: limpa, rápida e consistente, porém capaz de explicar o dado, conduzir a decisão, executar a ação e comprovar o resultado. Quando não houver dados ou credenciais, a tela deverá dizer exatamente por quê e o que fazer; quando houver, nenhum passo dependerá de UUID, JSON manual, terminal ou conhecimento interno do banco.
