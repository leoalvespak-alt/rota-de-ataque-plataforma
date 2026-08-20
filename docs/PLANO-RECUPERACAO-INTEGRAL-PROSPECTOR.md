# Plano de recuperação integral do Prospector

**Status:** implementação e rollout inicial concluídos; fechamento de UX, estados vazios e testes integrados em andamento  
**Data da auditoria:** 18/08/2026  
**Escopo:** frontend, APIs Next.js, PostgreSQL, Redis/BullMQ, workers, integrações externas, Design System, testes, migrations e deploy  
**Objetivo:** manter todas as abas atuais e torná-las úteis, operacionais, rastreáveis, responsivas e sem mocks ou erros silenciosos.

Este documento substitui, para o estado ainda não resolvido, os planos anteriores de correção do Prospector. Itens já existentes no código só serão considerados concluídos quando passarem pelos critérios de aceite deste plano e forem verificados na release publicada. Código, migrations, compose e scripts de deploy continuam sendo a fonte de verdade.

## 1. Resultado esperado

Ao final:

1. toda aba exibirá dados reais, um estado vazio orientado à ação ou um estado de erro recuperável;
2. nenhum botão informará sucesso sem ter persistido uma mudança, enfileirado um job válido ou navegado para um fluxo real;
3. o operador poderá ligar, pausar e executar workers pela interface, com confirmação por heartbeat e execução auditada;
4. radar, inteligência, oportunidades, teses, conteúdo, Creative Bridge, calendário e publicação formarão um único fluxo rastreável;
5. todas as configurações de IA presentes no ambiente aparecerão como metadados reconciliados, serão testáveis e controlarão o runtime que efetivamente usa IA;
6. o Design System receberá o briefing e devolverá o resultado real, incluindo asset e metadados da edição;
7. checkboxes, cards, formulários, tabelas, títulos e painéis responderão corretamente de 320 px até desktop;
8. 401, 403, 409, 422, 429 e 5xx terão contrato JSON consistente nas APIs e apresentação clara na interface;
9. não restarão fixtures, séries inventadas, números fixos, placeholders de funcionalidade ou ações apenas com toast em código de produção;
10. migrations e rollout serão ensaiados, observáveis e reversíveis.

“Zero erros” significa, de forma verificável: zero exceções não tratadas nos fluxos E2E, zero erro de console originado pelo Prospector nos cenários cobertos, zero resposta 5xx nos smokes, zero job inválido gerado pela UI e zero divergência entre estado desejado e heartbeat após o prazo operacional. Indisponibilidade de API externa deverá aparecer como estado degradado, não como tela vazia ou falso sucesso.

## 2. Fontes confrontadas

### Documentação canônica

- `Docs/README.md`
- `Docs/PROSPECTOR.md`
- `Docs/DESIGN-SYSTEM.md`
- `Docs/ARQUITETURA-UNIFICADA.md`
- `Docs/RUNBOOK-OPERACAO-ORGANICA.md`
- `plataforma/Docs/PLANO-CORRECOES-PROSPECTOR.md`
- `plataforma/Docs/PLANO-CORRECOES-IA-E-MOCKS-PROSPECTOR.md`

### Código e configuração executável

- shell, páginas e clientes em `apps/web/src/app` e `apps/web/src/components`;
- autenticação, autorização, erros e capacidades em `apps/web/src/lib`;
- componentes e CSS em `packages/ui-bridge` e `apps/web/src/app/globals.css`;
- filas e runtime em `packages/queue`;
- schemas e migrations `0001` a `0022` em `packages/db`;
- todos os pacotes em `workers`;
- compose, entrypoint e deploy em `docker` e `deploy`;
- receptor do Creative Bridge em `apps/design-system`.

### Estado operacional observado

- a migration `0022_ai_control_plane` está aplicada;
- os containers principais estão saudáveis, mas o estado desejado dos workers está zerado;
- o entrypoint mantém o container vivo sem iniciar o processo do worker quando a flag de ambiente está desligada;
- a UI pode renderizar como `viewer` sem uma sessão que autorize rotas de operador/admin, produzindo os 401 relatados;
- `worker-news-radar` existe no monorepo, porém não está declarado no compose;
- a página de automações existe, mas não está na navegação principal.

## 3. Diagnóstico sistêmico

Os 16 relatos não são defeitos isolados. Eles se concentram em seis causas.

### Causa A — autenticação visual e autorização de API divergem

`layout.tsx` fabrica uma sessão visual `viewer` quando não há sessão autenticada. Com `AUTH_BOOTSTRAP_VIEWER`, o middleware deixa páginas passarem, mas `requireRole('operator')` e `requireRole('admin')` continuam recusando as APIs. A navegação não filtra abas ou ações por papel. Assim, o usuário vê controles de administração e recebe 401 ao usá-los.

Além disso, o middleware pode responder a chamadas de API com redirecionamento/HTML, enquanto vários clientes executam `response.json()` sem validar o `content-type`. Esse é um caminho direto para `Unexpected end of JSON input`.

### Causa B — o control plane de workers não controla o processo real

Há três fontes de estado concorrentes:

1. flags `WORKER_*_ENABLED` no ambiente;
2. `worker_settings.enabled` no banco;
3. processo/heartbeat real do worker.

O entrypoint consulta somente a flag de ambiente e entra em `sleep` infinito quando ela é `false`. Nessa situação, alterar `worker_settings` pela UI nunca chega a iniciar o runtime Node. Quando o processo inicia, `runWorker` consulta o estado uma única vez. Portanto, os botões atuais podem alterar o banco sem alterar o consumidor BullMQ.

O comando genérico “Executar” também enfileira `{ manual: true, triggeredBy }` para qualquer fila. Vários workers exigem payloads tipados, como `campaignId`, `watchId`, `contentItemId`, `publicationId` ou `accountId`; logo, “run now” não tem contrato funcional comum.

### Causa C — os produtores de dados não fecham a cadeia

- `news-radar` tem scheduler e implementação, mas não tem serviço no compose;
- `content-opportunity` tem worker, mas não tem scheduler nem produtor regular que envie `campaignId`;
- o radar de Reddit aceita criar watch e enfileira coleta, mas o consumidor permanece desligado;
- inteligência competitiva depende de posts/comentários coletados anteriormente e de IA ativa;
- as materialized views do Overview são atualizadas pelo `data-quality`, que também está desligado;
- todos os `worker_settings` foram semeados como desativados e o deploy mantém as flags desligadas por padrão.

Por isso as abas podem estar tecnicamente conectadas a tabelas reais e ainda assim permanecer vazias indefinidamente.

### Causa D — a interface confunde vazio, sem permissão, erro e carregamento

As páginas normalmente recebem `[]` e exibem zero. Elas não mostram:

- pré-requisitos ausentes;
- worker desligado;
- última execução e próximo agendamento;
- fonte sem credencial;
- fila parada;
- erro da última execução;
- ação recomendada para sair do estado vazio.

Em publicação, a falha ao consultar o kill-switch mantém `killSwitchActive === null`, portanto “Verificando kill-switch…” nunca termina. No Radar de mercado, a seção Saúde afirma “Operacional” mesmo sem validar heartbeat, atraso ou erro.

### Causa E — funcionalidades aparentes são mocks ou implementações locais

Foram confirmados em produção/source:

- merge de identidades com scores fixos 45, 20 e 65 e confirmação apenas por toast;
- aprovação/ignorar oportunidade do dashboard apenas por toast;
- sincronização de comunidade apenas por toast;
- exportação de ROI apenas por toast;
- série fixa `[10, 15, 13, 20, 25, 40, 55]` no Radar;
- gráfico “Falhas Operacionais” explicitamente marcado como mock;
- Saúde do Radar de mercado sempre positiva;
- programação em lote adicionada somente ao estado React, sem persistência;
- abas Frescor, NBA, Histórico e Assets compostas apenas por placeholders;
- ajuda da Ponte criativa descrevendo ações que não existem na tela atual.

O teste `production-ui-guardrails.test.ts` detecta palavras proibidas e botões sem handler, mas não detecta handler que só exibe toast, números operacionais fixos ou mutação somente local.

### Causa F — contratos editoriais e de IA são parciais

- a API de tese aceita `PATCH`, mas a UI só pausa/ativa; a versão não é incrementada na edição;
- conteúdos não possuem CRUD completo na UI/API e a aba Assets é placeholder;
- aprovação de oportunidade cria uma copy-base simples e variantes iniciais, mas não há um gerador completo para Instagram nem preview por formato;
- o orquestrador de conteúdo não despacha Instagram e os workers ficam desligados;
- a agenda guarda legenda/hashtags/CTA, porém os cards ocultam a copy e não há recomendação de hashtags;
- o Creative Bridge apenas entrega contexto ao Design System; o Design System não devolve asset/copy editados. “Concluir” marca a variante como pronta sem comprovar o retorno real;
- a página de IA cataloga apenas DeepSeek, Anthropic, OpenRouter e local, embora o ambiente também declare Z.ai, NVIDIA, Mistral, OpenCode Go, Wafer, Kimi e Cerebras;
- alguns workers usam `loadLlmRuntimeConfig`, mas outros instanciam o cliente diretamente com `LLM_*`, ignorando a escolha feita no banco;
- a capacidade de IA ainda consulta `api_key_encrypted`, enquanto o control plane novo usa referência a segredo no ambiente;
- a URL de OpenRouter do catálogo não coincide com a URL `/api/v1` declarada no ambiente.

## 4. Matriz dos 16 relatos

| # | Confirmação no estado atual | Correção-alvo | Fase |
|---|---|---|---|
| 1 | Overview lê `mv_campaign_performance`; refresh depende de worker desligado e exibe apenas contagem de recomendações | resumo vivo, frescor, readiness e recomendações reais com ação/evidência | F3, F4 |
| 2 | regra global força checkbox/radio a `44x44`, sobrepondo o componente de 20 px | caixa visual 18–20 px com label/touch target de 44 px | F10 |
| 3 | control plane altera banco, mas entrypoint bloqueia o processo; automações não está no menu | supervisor dinâmico, comandos tipados, navegação e feedback por heartbeat | F2 |
| 4 | Radar/competitivo são leitura; `news-radar` falta no compose; upstreams estão desligados | fontes, concorrentes, executar agora, saúde, scheduler e cadeia completa | F3 |
| 5 | PATCH existe, porém não há edição na tela nem versionamento real | editor, nova versão, diff, ativar/arquivar e auditoria | F5 |
| 6 | KPI tem `min-height:132px`, padding 18 px e título `nowrap/ellipsis` | densidade compacta, wrap e grids responsivos | F10 |
| 7 | worker de oportunidade não recebe execução regular com campanha | trigger após inteligência e agendamento por campanha, além de criação manual | F3, F5 |
| 8 | lista não tem criar/editar/excluir; Assets é placeholder; calendário é outro fluxo | CRUD editorial, variantes/assets e ações diretas de agendar/publicar | F5, F7 |
| 9 | API exige operador; cliente presume JSON; bridge não retorna arte real | erros JSON, handshake idempotente e retorno persistido de asset/copy | F1, F6 |
| 10 | campos existem no editor, mas cards não mostram copy; carrossel/story/reel não têm estrutura completa nem recomendador | preview integral por formato, copy/frames/slides/thread, CTA e hashtags recomendadas/editáveis | F5, F7 |
| 11 | 401 no kill-switch deixa estado `null`; calendário concentra cards/KPIs grandes | estados `loading/error/forbidden/ready`, retry e calendário compacto | F1, F7, F10 |
| 12 | `KpiCard` é grande por padrão em todas as telas | variantes `compact/standard`, limites de uso e auditoria visual | F10 |
| 13 | regras são técnicas e a simulação apenas enfileira decisão futura | onboarding, exemplos, precedência e simulador síncrono explicável | F8 |
| 14 | layout sempre reserva Kanban + lateral de cotas, mesmo vazio | lista principal compacta, filtros, detalhes sob demanda e vazio útil | F8, F10 |
| 15 | checkboxes herdam 44 px; duas colunas e KPI dentro do card cortam conteúdo; há abas placeholder | reconstrução responsiva, formulários padronizados e abas funcionais | F8, F10 |
| 16 | catálogo incompleto, RBAC gera 401 e workers não usam todos o mesmo resolver | reconciliação de todos os providers, testes reais e runtime único | F1, F9 |

## 5. Arquitetura funcional de destino

```text
Sessão real + papel
        |
        v
Página/ação permitida ---- estado proibido explícito
        |
        v
API tipada -> transação PostgreSQL -> comando/outbox -> fila BullMQ
        |                                      |
        |                                      v
        +------------------------------ supervisor/worker
                                               |
                                               v
                               API externa / IA / Design System
                                               |
                                               v
                                 resultado + evento + auditoria
                                               |
                                               v
                                  UI atualizada por consulta/poll
```

Regras obrigatórias:

- PostgreSQL será a fonte canônica do estado desejado e do lifecycle editorial.
- Redis/BullMQ transportará comandos; não será a única evidência de conclusão.
- todo comando terá `commandId`, ator, escopo, payload validado, timestamps e resultado.
- todo dado exibido terá origem e frescor; dados ausentes nunca serão substituídos por números inventados.
- toda automação criará rascunho/recomendação; aprovação humana continuará obrigatória para saída externa.
- Prospector e Design System continuarão produtos separados. A integração ocorrerá somente pelo contrato versionado do Creative Bridge.

## 6. Plano de implementação

### F0 — baseline reproduzível e inventário de contratos

1. Criar um inventário gerado de rotas com método, papel mínimo, schema de entrada, respostas e tabelas tocadas.
2. Classificar explicitamente as rotas públicas: auth, health, confirmação de e-mail e webhooks assinados. Todas as demais devem exigir papel.
3. Registrar baseline por campanha: contagem das tabelas principais, estado das integrações, `worker_settings`, heartbeats, filas, schedulers, migrations e release.
4. Adicionar testes de caracterização para os 16 relatos antes de alterar comportamento.
5. Capturar screenshots em 320, 375, 768, 1024 e 1440 px para as abas afetadas.

**Gate F0:** falhas atuais reproduzíveis localmente com PostgreSQL e Redis reais; nenhuma credencial ou dado pessoal entra nos artefatos.

### F1 — sessão, RBAC e contrato HTTP

Arquivos principais: `middleware.ts`, `layout.tsx`, `permissions.ts`, `role-access.ts`, `api-errors.ts`, `SessionProvider.tsx`, `AppShell.tsx` e clientes que usam `fetch`.

1. Separar comportamento de página e API no middleware:
   - página sem sessão redireciona para login;
   - API sem sessão responde JSON 401;
   - papel insuficiente responde JSON 403;
   - nunca devolver HTML para cliente que espera JSON.
2. Remover a sessão visual fictícia fora de ambiente local/teste. `AUTH_BOOTSTRAP_VIEWER` não poderá abrir controles de operador/admin.
3. Criar wrappers `withApiRole` e `apiClient` para unificar autenticação, `content-type`, timeout, parse seguro, trace ID e mensagens públicas.
4. Filtrar navegação e ações por papel. `viewer` consulta; `operator` opera fluxos; `admin` gerencia IA, integrações sensíveis e operação global.
5. Proteger também server pages administrativas, evitando renderizar formulário que inevitavelmente retornará 401.
6. Corrigir primeiro as rotas relatadas: `/api/creative-bridge`, `/api/admin/publishing/kill-switch`, `/api/admin/ai` e `/api/admin/publications`.
7. Auditar rotas sem `requireRole`, em especial engagement e testes administrativos, sem bloquear webhooks públicos legítimos.
8. Toda tela assíncrona terá estados discriminados `idle/loading/ready/empty/forbidden/error` e botão de retry quando aplicável.

**Gate F1:** suíte E2E com sessão ausente, viewer, operator e admin; zero `Unexpected end of JSON input`; nenhuma chamada periódica gera 401 no console quando a ação não é permitida.

### F2 — control plane real de workers

Arquivos principais: `docker/worker-entrypoint.sh`, `packages/queue/src/runtime.ts`, `packages/queue/src/index.ts`, `packages/queue/src/scheduler.ts`, compose, deploy, `/api/admin/automations` e `/automations`.

1. Criar migration `0023_operational_control_plane` com:
   - `desired_state` (`running`, `paused`, `disabled`);
   - versão otimista, motivo, solicitante e data da transição;
   - `worker_commands` para execução manual tipada;
   - `worker_runs` para início, fim, status, contagens, erro sanitizado e correlação;
   - índices por worker/status/data e política de retenção.
2. Remover o gate de `sleep` do entrypoint. O processo supervisor deve sempre iniciar e continuar saudável.
3. Fazer o supervisor reconciliar periodicamente `desired_state`, abrindo/fechando o consumidor BullMQ sem reiniciar container.
4. Definir precedência única:
   - banco controla operação normal;
   - `WORKERS_GLOBAL_KILL=true` é trava emergencial superior;
   - flags individuais antigas serão somente bootstrap de migration e depois removidas.
5. Substituir `run_now` genérico por registry de comandos tipados. Cada worker declara schema, pré-requisitos e construtor do payload.
6. Para jobs por campanha, a UI exige campanha ativa; para jobs por conta/watch/publicação, exige o identificador correspondente.
7. Declarar `worker-news-radar` no compose e criar teste que compara automaticamente pacotes de `workers` com serviços do compose e `QUEUE_NAMES`.
8. Instalar scheduler para `content-opportunity` por campanha ou dispará-lo idempotentemente ao final de inteligência competitiva/orgânica.
9. Adicionar Automações à navegação de admin/operator e incluir estado desejado, processo, heartbeat, fila, scheduler, última execução, próximo run e erro.
10. “Ligar” só conclui na UI após heartbeat `running`; “Executar” só conclui após criar `worker_run`; divergência expirada vira alerta.

**Gate F2:** ligar um worker gera heartbeat em até 30 s; pausar encerra consumo sem matar o supervisor; executar agora usa payload válido; news-radar está presente no compose; nenhuma divergência persiste além do SLO.

### F3 — cadeia de aquisição, radares e inteligência

1. **Radar de notícias:** criar gestão de fontes, ativar/pausar, validar feed, executar agora, exibir última coleta/erro/falhas e link para evidência.
2. **Radar de mercado:** completar CRUD de watches, pausar, excluir, executar agora e exibir job/run real. Saúde será calculada de integração + worker + atraso de `next_run_at` + último erro.
3. **Inteligência competitiva:** exibir pré-requisitos (concorrente, conta coletora, posts/comentários, IA), permitir run por concorrente/campanha, curar insight e abrir evidência.
4. **Radar orgânico/providers:** ligar Exa/Apify/Bright Data somente por canário, com budget e status explícitos; API key configurada não implica provider automaticamente habilitado.
5. **Oportunidades:** executar `content-opportunity` depois que sinais elegíveis forem persistidos e também em cadência por campanha, com deduplicação e explicação do score.
6. Propagar correlação `research_run -> observation/post -> insight/signal -> opportunity` e disponibilizar drill-down na UI.
7. Exibir em todas essas abas: fonte, frescor, cobertura, última execução, próximo run, itens processados, falhas e ação recomendada.

**Gate F3:** com uma fonte RSS e um watch válidos, o fluxo produz achado/sinal; com concorrente e IA válidos, produz insight; um sinal elegível produz oportunidade sem inserção manual no banco.

### F4 — Overview útil e recomendações reais

1. Remover a dependência exclusiva de materialized view desatualizada. O serviço de Overview combinará agregados diretos para métricas críticas com views para séries pesadas.
2. Registrar `refreshed_at` das views e executar refresh concorrente pelo `data-quality`; atraso vira badge, não zero silencioso.
3. Criar recomendações operacionais determinísticas e explicáveis, por exemplo:
   - integração obrigatória ausente;
   - worker desejado sem heartbeat;
   - watch/fonte sem primeira coleta;
   - oportunidade aguardando revisão;
   - conteúdo pronto sem variante;
   - publicação próxima sem asset/conta aprovada;
   - erro recorrente ou budget bloqueado.
4. Persistir lifecycle da recomendação (`open`, `acknowledged`, `resolved`, `dismissed`) com evidência, prioridade e destino.
5. Mostrar “Próximas ações” com botão que leva ao registro exato. IA pode resumir contexto, mas não inventar recomendação sem regra/evidência.
6. Quando a campanha estiver realmente vazia, mostrar checklist de ativação em vez de quatro zeros e gráficos vazios.

**Gate F4:** campanha vazia recebe checklist acionável; campanha com atividade recebe métricas com frescor e recomendações navegáveis; nenhuma recomendação é apenas uma contagem.

### F5 — teses, oportunidades e conteúdos completos

#### Teses

1. Implementar criar, visualizar, editar, versionar, ativar, pausar e arquivar.
2. Edição cria nova versão auditável, preserva histórico e não muda silenciosamente o significado de conteúdos já aprovados.
3. Exibir impacto antes de desativar tese usada por conteúdo/agendamento.
4. Aplicar RBAC e mensagens específicas para limite de sete teses ativas e conflito de versão.

#### Oportunidades

1. Manter geração automática e adicionar criação manual com evidência/origem declarada.
2. Implementar atualizar, aprovar, rejeitar, reabrir e converter idempotentemente em conteúdo.
3. Mostrar decomposição real do score e URLs/evidências seguras.
4. Remover o fluxo duplicado e falso de `OperationalInteractive`.

#### Conteúdos

1. Criar endpoints e UI para criar, editar, duplicar/forkar, arquivar/restaurar e excluir somente rascunho sem dependências.
2. Fazer soft delete/arquivo para conteúdo com versões, review, bridge ou publicação.
3. Implementar briefing canônico, argumentos, CTA, tese(s), funil, público, fontes e brand voice.
4. Implementar variantes completas:
   - Instagram estático: headline, body, legenda, CTA e hashtags;
   - carrossel: copy de cada slide, capa e CTA final;
   - stories: frames, stickers/CTA e sequência;
   - reels: hook, roteiro, cenas, texto na tela e legenda;
   - Threads: sequência integral;
   - e-mail/WhatsApp quando habilitados.
5. Criar geração/regeneração real via IA, com prompt/model version, custo, evidência e revisão humana.
6. Implementar Assets com upload/seleção, metadados, preview, vínculo à variante e estado de aprovação.
7. Inserir ações “Abrir no calendário” e “Agendar” usando a fonte canônica de publicação.

**Gate F5:** tese editada conserva histórico; oportunidade aprovada cria conteúdo idempotente; conteúdo manual ou gerado pode ser editado, versionado, receber asset e chegar à revisão sem SQL manual.

### F6 — Creative Bridge bidirecional e confiável

1. Definir `DESIGN_SYSTEM_URL` e origem permitida explicitamente; não codificar `/design-system` nem inferir por acaso o mesmo host.
2. Abrir o Design System com ID opaco/correlação, nunca com conteúdo sensível na query string.
3. Implementar handshake versionado com nonce de uso único, expiração, timeout, retry e idempotência.
4. Garantir JSON em qualquer falha da API e parse defensivo no cliente.
5. O Design System deve devolver um resultado validado contendo, conforme o formato:
   - projeto/versão do editor;
   - asset exportado ou referência de storage;
   - dimensões, MIME e checksum;
   - copy/estrutura efetivamente editada;
   - template e metadados de geração.
6. Persistir estados `created -> opened -> accepted -> returned -> review_pending -> completed`, além de `failed/expired/cancelled` com erro sanitizado.
7. Só marcar variante como `ready` depois de validar e persistir o retorno real. O botão manual “Marcar retorno concluído” não poderá simular essa confirmação.
8. Permitir reabrir, reenviar, cancelar e visualizar histórico da entrega.
9. Criar fallback para popup bloqueado: link seguro na mesma aba e retomada da entrega.

**Gate F6:** uma entrega atravessa Prospector → Design System → Prospector, retorna asset/copy real, cria review e mantém correlação; cancelamento, timeout, popup bloqueado e resposta inválida possuem recuperação testada.

### F7 — publicação e calendário completos

1. Manter `scheduled_publications` como fonte única do Kanban, calendário e publishers.
2. Exibir no card/detalhe a copy integral apropriada ao formato, não apenas título e metadados.
3. Mostrar legenda, CTA, hashtags e origem da recomendação. Hashtags serão calculadas por tese, tema, histórico e canal; sempre editáveis e nunca autopublicadas sem review.
4. Persistir programação em lote numa transação; remover UUIDs e itens apenas locais no React.
5. Substituir pesos hardcoded por `content_pillars`/`format_playbook` configurados no banco.
6. Implementar criar, editar, duplicar, cancelar, arquivar e excluir com regras por status.
7. Separar aprovação editorial de aprovação de publicação.
8. Validar antes de agendar: variante aprovada, copy requerida, asset quando necessário, conta ator saudável, janela, budget/política e kill-switch.
9. Corrigir o kill-switch para estados `loading/forbidden/error/active/paused`, com retry e sem loading infinito.
10. Fazer publisher e Threads publisher usarem o mesmo lifecycle, idempotência, recibo externo e fallback manual auditado.
11. Compactar mês/semana e oferecer drawer/detalhe para copy extensa.

**Gate F7:** criação unitária e em lote sobrevivem a reload; cards mostram a peça completa; agendamento inválido é bloqueado com motivo; canário publica somente após aprovação explícita e produz recibo.

### F8 — políticas, engagement, contas e integrações

#### Políticas de contato

1. Incluir onboarding “o que é / quando bloqueia / exemplos”.
2. Exibir precedência entre global, campanha e canal.
3. Criar simulador síncrono, read-only e explicável, retornando política aplicada, decisão, motivo, consentimento, cadência e próxima janela. Enfileirar ação será um passo separado.
4. Implementar versionamento, desativação, histórico e teste de regressão das regras.

#### Fila de engagement

1. Usar tabela/lista compacta como padrão; Kanban será opcional quando houver volume.
2. Remover a lateral permanente. Cotas e saúde irão para drawer ou resumo expansível.
3. Implementar vazio útil, filtros, busca, seleção em lote, detalhes, motivo de bloqueio e retry real.
4. Proteger a API de polling e preservar o último estado válido quando a rede falhar.

#### Contas e integrações

1. Redesenhar cards com status, última validação, escopo, ação principal e erro sem cortar texto.
2. Padronizar formulários, alinhamento, feedback e checkboxes.
3. Implementar de fato as abas Frescor, NBA e Histórico ou removê-las temporariamente da tablist até estarem prontas; como o requisito é manter todas as abas, a entrega final deve implementá-las.
4. Substituir integrações “Em breve” por estado `não suportada` sem CTA falso.
5. Adicionar teste de conexão/renovação, auditoria e readiness por integração.

**Gate F8:** o usuário entende a consequência de uma política antes de salvar; o simulador explica a decisão imediatamente; fila vazia não mostra dashboards inúteis; todas as abas de Contas têm conteúdo funcional.

### F9 — control plane unificado de IA

1. Extrair catálogo allowlisted compartilhado com adapters para:
   - DeepSeek;
   - Anthropic;
   - OpenRouter;
   - Z.ai;
   - NVIDIA NIM;
   - Mistral;
   - OpenCode Go;
   - Wafer;
   - Kimi/Moonshot;
   - Cerebras;
   - local/OpenAI-compatible customizado quando explicitamente permitido.
2. Reconciliar ambiente → metadados de banco no boot/deploy, sem copiar o valor do segredo. Mostrar `configurado`, `ausente`, `inválido`, `não testado`, `saudável` ou `degradado`.
3. Corrigir base URLs e montagem de endpoints por adapter; não concatenar `/v1` duas vezes nem omiti-lo.
4. Fazer todos os workers usarem `ConfigurableLlmClient`/`loadLlmRuntimeConfig`; remover acessos diretos a `LLM_*` nos workers remanescentes.
5. Corrigir `integration-capabilities` para o modelo de segredo atual.
6. Tornar mudança de padrão atômica e validar provider ativo, segredo presente, teste recente e modelo habilitado.
7. Teste de modelo deve validar autenticação, latência, resposta mínima, JSON quando requerido e limite de timeout, registrando resultado sem conteúdo sensível.
8. Persistir health recente e mostrar qual worker/model realmente executou cada geração.
9. Separar claramente “IA do Prospector” e “IA do Design System”. Os produtos podem compartilhar catálogo/adapters, mas não banco, sessão ou segredo. O Bridge carrega apenas provenance e resultado permitido.
10. Manter fallback ordenado, budget e circuit breaker; falha do padrão não pode produzir loop nem mutação silenciosa.

**Gate F9:** todos os providers configurados aparecem; um admin consegue ativar, testar e tornar padrão; uma execução de worker comprova o modelo selecionado; viewer/operator não geram 401 repetitivo nem veem segredo.

### F10 — densidade visual, responsividade e acessibilidade

Arquivos principais: `packages/ui-bridge/src/styles.css`, primitives/fields e `apps/web/src/app/globals.css`.

1. Remover `input[type=checkbox], input[type=radio]` da regra visual global de 44 px. O label/wrapper terá área clicável mínima; o controle visual terá 18–20 px.
2. Criar variantes de densidade para KPI:
   - `compact`: cabeçalho + valor, altura natural;
   - `standard`: tendência/período quando existem;
   - proibir quatro KPIs grandes quando não houver decisão associada.
3. Permitir wrap de label/título e remover `white-space: nowrap` onde causa ocultação.
4. Aplicar grids responsivos: 4/2/1 colunas para KPI, 2/1 para formulários e card/lista que nunca impõe largura superior ao viewport.
5. Remover `height:100vh` aninhado no shell; usar altura disponível e scroll previsível.
6. Padronizar toolbar, estados vazios, notices, badges, botões, inputs, dialogs e drawers no `ui-bridge`.
7. Substituir estilos inline repetidos por componentes/tokens e estabelecer limite de padding/altura para cards operacionais.
8. Verificar foco, teclado, contraste, zoom 200%, textos longos em português, loading e erro.
9. Adicionar regressão visual e teste de overflow horizontal para cada aba.

**Gate F10:** checkbox proporcional em todas as páginas; nenhum título cortado; nenhuma tela tem scroll horizontal involuntário em 320–1440 px; KPIs não dominam a tarefa principal.

### F11 — remoção comprovável de mocks e parcialidades

1. Decompor `OperationalInteractive` em componentes de domínio com APIs reais; remover todas as ações apenas com toast.
2. Trocar série fixa do Radar por histórico persistido ou estado “histórico indisponível”.
3. Trocar gráfico mock de Saúde por agregação real de falhas/alertas/runs ou remover o bloco até haver dados.
4. Remover scores fixos do preview de merge e usar endpoint de preview real.
5. Implementar export CSV real no servidor/cliente ou desabilitar a ação com motivo até a fase correspondente.
6. Remover placeholders de Assets, Frescor, NBA e Histórico após as implementações das fases anteriores.
7. Corrigir `help-registry` para refletir exatamente ações, dados, cadência e limites existentes.
8. Fortalecer guardrails com AST/lint:
   - handler mutável deve chamar API/server action, alterar rota real ou estar explicitamente desabilitado;
   - proibir séries operacionais literais em produção;
   - proibir sucesso antes de confirmação do servidor;
   - proibir estado “operacional” sem fonte de health;
   - permitir dados fixos apenas em testes/stories/fixtures identificados.

**Gate F11:** busca estática e testes não encontram `mock`, ações toast-only, números operacionais fixos ou placeholders funcionais no bundle de produção.

### F12 — migrations, backfills e consistência de dados

Não alterar migrations já aplicadas. Criar, no mínimo:

- `0023_operational_control_plane`: desired state, comandos e runs;
- `0024_editorial_versions_and_assets`: revisões de tese/conteúdo, assets e vínculos;
- `0025_creative_bridge_and_publication_contracts`: lifecycle, retorno do editor, idempotência e campos de formato;
- `0026_recommendations_and_provider_health`: recomendações do Overview e health/testes de IA.

Para cada migration:

1. fornecer `up` e `down` compatível com os dados existentes;
2. ensaiar banco vazio e clone sanitizado da produção;
3. backfill determinístico e idempotente;
4. índices para consultas reais das páginas;
5. constraints de status, versão e unicidade;
6. nenhuma exclusão automática de conteúdo, publicação, asset, auditoria ou segredo;
7. refresh das materialized views após backfill;
8. validação pós-migration com contagens e invariantes.

**Gate F12:** migration sobe e desce no ensaio, sobe no clone sem perda, e todas as invariantes têm query de verificação automatizada.

### F13 — testes, observabilidade e deploy progressivo

#### Testes obrigatórios

- unitários para schemas, estados, recomendador, adapters e transições;
- integração com PostgreSQL/Redis reais para APIs, outbox, workers e migrations;
- contratos de payload por worker e por Creative Bridge;
- E2E para viewer/operator/admin e para os 16 relatos;
- E2E editorial: sinal → oportunidade → conteúdo → review → Design System → asset → agenda → canário → métricas;
- testes responsivos e a11y nos cinco viewports definidos;
- smoke sem erro de console e sem resposta 5xx;
- provider externo: teste mínimo, explícito e com budget para cada provider configurado.

#### Observabilidade

- métricas de transição do worker, run, backlog, idade do job e divergência;
- frescor por fonte/tabela/view;
- taxa de erro por rota/status/trace ID;
- funil editorial por status e tempo parado;
- bridge por estado/latência/erro;
- publicação por canal, fallback e recibo;
- IA por provider/model, latência, custo, erro e fallback.

#### Ordem de rollout

1. backup e ensaio de restore;
2. migrations com workers pausados;
3. web/API e supervisor com todos os workers ainda pausados;
4. smoke de sessão/RBAC/health;
5. ativar `data-quality` e `alerts`;
6. ativar `news-radar` com uma fonte canário;
7. ativar Reddit com um watch canário;
8. ativar coleta/competitivo e depois `content-opportunity` para uma campanha;
9. ativar geração editorial com budget e revisão;
10. validar Creative Bridge;
11. ativar publishers somente em canário e com kill-switch testado;
12. ampliar gradualmente por worker, provider, conta e campanha.

Rollback operacional pausa o estado desejado antes de reverter aplicação. Rollback de aplicação usa a release imutável anterior; rollback de migration só ocorre se o ensaio comprovar segurança. Conteúdo novo é preservado e marcado para reconciliação, nunca apagado pelo rollback.

**Gate F13:** backup restaurável, migrations validadas, smokes verdes, canários comprovados e dashboards sem divergência antes de ampliar tráfego.

## 7. Mapa tela → API → dados → produtor

| Área | API/consulta principal | Dados canônicos | Produtor/consumidor que deve funcionar |
|---|---|---|---|
| Overview | serviço de overview/recomendações | eventos, leads, ações, publicações, recommendations, views | data-quality + regras de readiness |
| Radar | radar sources/findings/runs | news_sources, news_items, radar_findings | news-radar |
| Radar de mercado | watches/signals/runs | reddit_watches, reddit_evidence, market_signals | reddit-intelligence |
| Competitivo | competitors/insights/suggestions | posts, comments, competitor_insights, content_suggestions | coleta + competitive-intel |
| Teses | CRUD/revisions | theses + revisões/audit | humano, geração assistida opcional |
| Oportunidades | commands/decisions | content_opportunities | content-opportunity |
| Conteúdos | CRUD/variants/assets/review | content_items, content_variants, assets, review_inbox | geração + content-item-orchestrator |
| Creative Bridge | deliveries/return | creative_bridge_deliveries + assets/variants | Prospector + Design System |
| Publicação | publications/kill-switch | scheduled_publications, content_publications | publisher + threads-publisher |
| Políticas | CRUD/evaluate | contact_policies + decisions | contact-policy-engine após simulação |
| Engagement | actions/decisions | engagement_actions, action_policies | engagement + canais |
| Contas | accounts/competitors/capabilities | accounts, policies, competitors, audit | OAuth, meta-sync, health |
| IA | provider/model/health/test | ai_providers, ai_models, provider health | todos os workers com resolver comum |
| Automações | commands/state/runs | worker_settings, worker_commands, worker_runs, heartbeats | supervisor + scheduler |

## 8. Critérios de aceite por tipo de estado

Toda aba deve satisfazer exatamente um destes estados:

- **Ready com dados:** origem e frescor visíveis; ações funcionais.
- **Ready sem dados:** motivo legítimo, quando ocorrerá a primeira coleta e CTA para configurar/executar.
- **Sem permissão:** papel necessário e nenhuma chamada repetitiva proibida.
- **Não configurado:** lista precisa de pré-requisitos, sem expor valor de segredo.
- **Pausado:** quem/o que pausou, desde quando e como retomar.
- **Degradado:** último sucesso, erro sanitizado, trace/run ID e retry seguro.
- **Carregando:** timeout finito que termina em ready ou erro.

Não são aceitos: zero silencioso, spinner infinito, falso “Operacional”, toast de sucesso antecipado, botão sem persistência, texto “será exibido aqui” ou erro bruto do provider.

## 9. Definition of Done global

Uma fase só pode ser marcada concluída quando:

1. código, migrations, testes e documentação do domínio estiverem no mesmo diff;
2. contratos HTTP e worker payloads estiverem versionados/testados;
3. RBAC estiver coberto por papel;
4. loading, empty, forbidden, error e retry estiverem implementados;
5. mudança persistir após reload e deixar auditoria quando mutável;
6. não houver segredo, PII ou payload sensível em logs/UI/docs;
7. desktop e mobile passarem sem overflow/corte;
8. observabilidade confirmar a execução real;
9. deploy e rollback tiverem runbook;
10. o comportamento estiver verificado na release publicada, não apenas no código local.

## 10. Documentação a atualizar durante a execução

- `Docs/PROSPECTOR.md`: estado real de APIs, workers, IA, dados, RBAC, operação e limitações;
- `Docs/DESIGN-SYSTEM.md`: retorno do Creative Bridge e provenance da IA;
- `Docs/ARQUITETURA-UNIFICADA.md`: contrato bidirecional e segurança da fronteira;
- `Docs/RUNBOOK-OPERACAO-ORGANICA.md`: ativação, canários, budgets, coleta e publicação;
- `plataforma/deploy/DEPLOY.md`: flags removidas, supervisor, migrations, rollout e rollback;
- `plataforma/docs/runbooks/automations.md`: desired state, comandos, divergência e incidentes;
- `.env.example`: somente nomes e descrições de variáveis, nunca valores reais;
- `Docs/README.md`: manter este plano indexado enquanto houver fases abertas.

## 11. Ordem crítica e paralelismo seguro

```text
F0 -> F1 -> F2 -> F3 -> F4
              \-> F5 -> F6 -> F7
              \-> F9 --------/
F1 -> F8
F10 acompanha F4–F9
F11 fecha F4–F10
F12 acompanha as fases com mudança de dados
F13 encerra cada incremento e o rollout final
```

F1 e F2 são bloqueadores: sem sessão/RBAC coerentes e sem worker controlável, qualquer melhoria nas abas continuaria aparentando falha. Publicação permanece pausada até F6 e F7 passarem pelos canários.
