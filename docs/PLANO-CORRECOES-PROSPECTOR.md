# Plano de correções e conclusão — Prospector

> Plano produzido em 15/08/2026 a partir da confrontação entre
> `PLANO-MELHORIAS-PROSPECTOR.md`, o código executável e os testes locais.
> Este documento substitui o plano histórico como roteiro de implementação das
> pendências ainda abertas; não afirma que as etapas abaixo já foram executadas.

## 1. Objetivo e escopo

Concluir as implementações ausentes ou parciais do Prospector, corrigir os
bloqueadores de build, migrations e testes, fortalecer os contratos de API e
finalizar a experiência de operação orgânica. O escopo inclui as correções
necessárias e as melhorias recomendadas identificadas na auditoria de
15/08/2026.

O trabalho abrange:

- monorepo, dependências e verificação de runtime;
- migrations e schema de orçamento orgânico;
- APIs de curadoria, autenticação, publicação e dashboard;
- Review Inbox, páginas de dados, calendário e acessibilidade;
- workers, incluindo o enriquecimento ainda sem lógica de negócio;
- mocks, testes unitários, integração, acessibilidade, E2E e smoke tests;
- deploy gradual, observabilidade, rollback e documentação canônica.

## 2. Evidências de partida

| Área | Estado verificado | Consequência |
|---|---|---|
| Build do `apps/web` | `tsc --noEmit` passou | O app web isolado não é o bloqueador atual |
| Build do monorepo | Falha em `@plataforma/shared` | `pg` e seus tipos não estão declarados no pacote que importa `Pool` |
| Migrations 0010/0015 | Incompatíveis em sequência | A 0015 tenta indexar `provider` numa tabela criada pela 0010 sem essa coluna |
| Publisher | 3 testes falham | Mock não fornece `preflight.migrationsCurrent` |
| Threads publisher | 3 testes falham | Mesmo defeito de mock/fixture |
| Store do Design System | 4 testes passaram isoladamente | A falha anterior era do modo de execução, não do store |
| Guardrails da UI web | 7 testes passaram | Devem permanecer como regressão obrigatória |
| OTP | Teste funcional passou | O limitador em memória continua inadequado para múltiplas instâncias |
| Acessibilidade estática | Teste atual passou | A cobertura não alcança tabs, dialogs e teclado do calendário |
| Migração em banco descartável | Não executada | Docker não estava instalado no ambiente auditado |
| Worker `enrichment` | Estrutura genérica, sem domínio | O pipeline não entrega enriquecimento real |

## 3. Regras de execução

1. Executar as etapas na ordem indicada, respeitando os gates de saída.
2. Não editar migration que conste como aplicada em qualquer ambiente persistente
   antes de capturar ledger, checksum e schema efetivo desse ambiente.
3. Toda mutação que combine leitura, validação e escrita deve usar uma única
   transação e um único client de banco.
4. Toda ação repetível por retry deve possuir chave ou condição de idempotência.
5. Nenhum teste deve usar `as any` para ocultar campos obrigatórios do contrato.
6. Logs devem conter correlação e códigos estáveis, nunca secrets, tokens, e-mails
   completos ou stack traces enviados ao cliente.
7. Cada etapa só termina com testes proporcionais ao risco e documentação ajustada.
8. Produção só recebe migrations depois de ensaio local e em staging, backup
   verificado e rollback testado.

## 4. Definição global de pronto

O plano estará concluído quando:

- `pnpm install --frozen-lockfile`, lint, typecheck, build e testes do monorepo
  passarem sem exceções ou pacotes silenciosamente ignorados;
- uma base PostgreSQL vazia aceitar todas as migrations `up`, os testes de schema
  passarem e o rollback previsto for validado;
- publisher e threads-publisher passarem com fixtures tipadas completas;
- as ações do Review Inbox forem atômicas, idempotentes, auditadas e cobertas por
  testes concorrentes;
- OTP usar limitação distribuída e observável;
- páginas de inteligência exibirem dados reais com campanha, paginação, estados de
  erro/vazio e tipos explícitos;
- dialogs, tabs e calendário atenderem teclado, foco e ARIA;
- o worker de enriquecimento executar uma regra de negócio definida, persistir
  proveniência e respeitar orçamento/retry;
- smoke tests pós-deploy confirmarem web, migrations, workers, filas e kill-switch;
- `Docs/PROSPECTOR.md`, runbooks e este documento refletirem o estado final.

---

## Etapa 0 — Baseline reproduzível e rede de segurança

**Prioridade:** obrigatória. **Dependências:** nenhuma.

### Passos

- **0.1 — Registrar o baseline.** Capturar versões de Node, pnpm, PostgreSQL,
  lockfile, branch/commit, variáveis apenas por nome e resultados integrais de
  `check:runtime-deps`, lint, typecheck, build e testes.
- **0.2 — Separar falha de produto de falha do executor.** Padronizar Vitest com
  limite de workers adequado ao host e registrar a variante usada na CI. Não
  alterar código para “corrigir” timeout de infraestrutura sem reprodução
  isolada.
- **0.3 — Inventariar ambientes de banco.** Para local, staging e produção,
  capturar de forma somente leitura: `schema_migrations`, checksums das migrations
  0010 e 0015, definição de `organic_budget_reservations`, constraints, índices e
  volume de linhas.
- **0.4 — Preparar backup e restauração.** Gerar dump antes da mudança, validar o
  arquivo e restaurá-lo num banco descartável. Medir o tempo de recuperação.
- **0.5 — Criar matriz de rastreabilidade.** Relacionar cada achado deste plano a
  arquivos, testes, responsável, evidência de conclusão e documento afetado.

### Gate de saída

- Baseline e inventário armazenados sem dados sensíveis.
- Restore de ensaio concluído.
- Estado real das migrations conhecido em todos os ambientes persistentes.

---

## Etapa 1 — Desbloquear dependências, typecheck e build

**Prioridade:** crítica. **Dependências:** Etapa 0.

### Passos

- **1.1 — Corrigir `@plataforma/shared`.** Declarar `pg` em `dependencies` e
  `@types/pg` em `devDependencies` do próprio pacote, atualizar o lockfile e manter
  o import de `Pool` tipado.
- **1.2 — Testar o pacote isolado.** Executar build, lint, typecheck e testes de
  `@plataforma/shared` antes do pipeline completo.
- **1.3 — Ampliar `check:runtime-deps`.** Fazer o script percorrer apps, packages e
  workers do workspace, respeitar exports/subpaths, distinguir dependência de
  runtime de dev/teste e falhar indicando pacote importador e dependência ausente.
- **1.4 — Adicionar fixtures do verificador.** Cobrir pacote externo ausente,
  workspace ausente, builtin `node:*`, import apenas de tipo, teste/story e
  dependência válida.
- **1.5 — Rodar o monorepo.** Executar install congelado, typecheck, lint e build
  por Turbo, sem filtros que escondam falhas.

### Gate de saída

- `@plataforma/shared` compila isoladamente.
- O verificador cobre todo o workspace e possui testes.
- Typecheck, lint e build completos passam.

---

## Etapa 2 — Reconciliar schema e migrations de orçamento

**Prioridade:** crítica. **Dependências:** Etapas 0 e 1.

### Decisão de schema

O código atual de `budget-gate.ts` e `/organic-budgets` usa o modelo por
`provider`, com estados `reserved`, `reconciled` e `released`. Esse é o candidato
canônico. Antes da implementação, confirmar se algum consumidor real ainda exige
`budget_id`, `research_run_id`, `refunded` ou `expired`. Se exigir, publicar um
modelo unificado explícito em vez de remover dados.

### Passos

- **2.1 — Escolher a estratégia pelo ledger.** Aplicar exatamente um dos caminhos:
  - se 0015 nunca foi aplicada em ambiente persistente, corrigi-la para transformar
    com segurança a tabela criada pela 0010, atualizar hashes controlados e manter
    `up`/`down` simétricos;
  - se 0015 já foi aplicada, preservar seus bytes, criar uma migration aditiva de
    reconciliação e definir uma estratégia de baseline/snapshot para instalações
    novas que não dependa da sequência quebrada.
- **2.2 — Preservar dados.** Mapear provider a partir do orçamento/run quando
  possível; colocar linhas ambíguas em relatório de quarentena, nunca descartá-las
  silenciosamente.
- **2.3 — Corrigir constraints e índices.** Garantir coluna `provider`, precisão
  monetária, estados canônicos, índices por provider/status e created_at, e
  constraints compatíveis com `reserveBudget`, `reconcileBudget` e
  `releaseBudget`.
- **2.4 — Corrigir rollback.** O `down` da correção não pode remover uma tabela
  pertencente à 0010. Deve desfazer apenas colunas, índices ou transformações
  introduzidas pela própria migration, ou declarar rollback restaurativo quando
  reversão sem perda não for possível.
- **2.5 — Testar cadeia limpa.** Subir PostgreSQL descartável, aplicar todas as
  migrations desde zero, validar schema, executar operações de reserva,
  reconciliação e liberação, e testar rollback até o ponto suportado.
- **2.6 — Testar upgrade.** Restaurar cópias representativas dos formatos
  pré-0015 e pós-0015, aplicar a correção e comparar contagens, totais e constraints.
- **2.7 — Testar concorrência monetária.** Duas reservas simultâneas não podem
  ultrapassar o teto; reconciliação e liberação repetidas devem ser idempotentes.

### Gate de saída

- Cadeia limpa e upgrades dos dois formatos passam num PostgreSQL real.
- Nenhuma linha ou valor monetário se perde no ensaio.
- Rollback e condição de abortar estão documentados.

---

## Etapa 3 — Corrigir mocks e contratos dos publishers

**Prioridade:** crítica. **Dependências:** Etapa 1.

### Passos

- **3.1 — Criar factory tipada de job.** Centralizar uma fixture que satisfaça o
  contrato completo de worker, incluindo `preflight.migrationsCurrent`, trace,
  evento, tentativas e demais campos obrigatórios.
- **3.2 — Remover casts perigosos.** Eliminar `as any` dos seis testes em publisher
  e threads-publisher; usar `satisfies` para detectar evolução do contrato.
- **3.3 — Cobrir preflight.** Testar migration atual, migration desatualizada,
  kill-switch, retry, erro permanente e payload inválido.
- **3.4 — Validar efeitos.** Asserir publicação única, auditoria, correlação,
  atualização de status e ausência de chamada externa quando o preflight bloquear.
- **3.5 — Executar testes isolados e em conjunto.** Confirmar que as duas suítes
  passam separadamente e no Turbo, sem dependência de ordem.

### Gate de saída

- Os seis testes antes falhos passam.
- Fixtures não ocultam campos obrigatórios e possuem reuso explícito.

---

## Etapa 4 — Tornar ações orgânicas atômicas e idempotentes

**Prioridade:** crítica. **Dependências:** Etapa 2.

### Passos

- **4.1 — Definir comandos e transições.** Formalizar estados permitidos para
  radar findings, competitor insights, content suggestions e publicações; rejeitar
  transição inválida com `409` e código estável.
- **4.2 — Usar transação real.** Obter `pool.connect()`, executar `BEGIN`, fazer
  `SELECT ... FOR UPDATE`, validar, gravar entidade derivada, atualizar origem,
  inserir audit log e `COMMIT` no mesmo client; rollback no catch e release no
  finally.
- **4.3 — Implementar idempotência.** Adicionar chave lógica/constraint única para
  impedir duas publicações ou sugestões derivadas da mesma origem. Repetição da
  mesma ação deve retornar o recurso já criado ou um `409` determinístico.
- **4.4 — Auditar todos os desfechos.** Registrar aceitar, editar/aceitar, rejeitar,
  descartar e marcar como visto; a rejeição não pode retornar antes do audit log.
- **4.5 — Validar input.** Aplicar Zod a params e body, limites de tamanho, enums e
  strings normalizadas. Não usar casts diretos do JSON.
- **4.6 — Testar concorrência.** Disparar ações paralelas sobre a mesma origem e
  comprovar uma única publicação/sugestão, status consistente e uma trilha de
  auditoria coerente.
- **4.7 — Testar falhas intermediárias.** Simular falha após insert e antes do
  update/audit para comprovar rollback integral.

### Gate de saída

- Endpoints possuem testes de sucesso, replay, concorrência, autorização,
  validação e rollback.
- Não há `FOR UPDATE` fora de transação nas ações auditadas.

---

## Etapa 5 — Corrigir autenticação, erros e contratos administrativos

**Prioridade:** alta. **Dependências:** Etapa 1.

### Passos

- **5.1 — Preservar 401/403 do dashboard.** Executar `requireRole('viewer')` fora
  do catch genérico ou relançar erros HTTP conhecidos, impedindo sua conversão em
  `500 internal_error`.
- **5.2 — Padronizar erros.** Criar helper para códigos e status públicos, log
  server-side com traceId e sanitização de detalhes internos.
- **5.3 — Validar publicação administrativa.** Adicionar schemas Zod aos bodies de
  cancelamento, confirmação manual e kill-switch, incluindo UUIDs, external ID,
  motivo e ação.
- **5.4 — Revisar autorização e auditoria.** Manter `requireRole('operator')`, usar
  identidade real da sessão e cobrir viewer, operator, sessão ausente e sessão
  inválida.
- **5.5 — Testar contratos.** Cobrir status HTTP, body estável e ausência de stack,
  SQL ou PII nas respostas.

### Gate de saída

- Dashboard devolve 401/403 corretamente.
- Rotas administrativas rejeitam payload inválido antes de acessar o banco.

---

## Etapa 6 — Substituir rate limit OTP em memória

**Prioridade:** alta. **Dependências:** Etapa 1.

### Passos

- **6.1 — Definir política.** Limites por IP e identificador normalizado, janela,
  cooldown, TTL, resposta `429`, `Retry-After` e comportamento fail-closed/fail-open
  documentado.
- **6.2 — Implementar storage distribuído.** Usar Redis já operacional na
  plataforma com operação atômica e chaves com hash; não armazenar e-mail puro.
- **6.3 — Limitar memória e logs.** Remover `Map` global, garantir expiração e não
  registrar OTP ou identificador pessoal completo.
- **6.4 — Cobrir cenários.** Testar limite por IP, por conta, expiração, múltiplas
  instâncias, indisponibilidade do Redis, e-mail inválido e erro do provider.
- **6.5 — Instrumentar.** Métricas de permitido/bloqueado/erro sem cardinalidade por
  usuário e alerta para aumento anormal.

### Gate de saída

- Reinício ou escala horizontal não reinicia o limite.
- Testes demonstram atomicidade e TTL.

---

## Etapa 7 — Concluir o Review Inbox

**Prioridade:** alta. **Dependências:** Etapas 4 e 5.

### Passos

- **7.1 — Criar slot com edição.** “Criar slot” deve abrir editor pré-preenchido
  com conteúdo, canal, campanha e sugestão de horário; persistir apenas após
  confirmação do operador.
- **7.2 — Coletar motivo estruturado.** Descartar radar e rejeitar sugestão devem
  usar dialog com motivo obrigatório/opcional conforme regra de negócio, limites e
  validação.
- **7.3 — Substituir prompts.** Migrar editar/aprovar e rejeitar de
  `window.prompt` para forms do design system com erro inline e estado busy.
- **7.4 — Implementar desfazer real.** Criar endpoint/comando compensatório dentro
  de uma janela explícita, verificar versão/estado atual e atualizar a toast action;
  remover o `console.log` placeholder.
- **7.5 — Atualização otimista segura.** Reverter UI em falha, evitar double click,
  revalidar dados depois da mutação e anunciar resultado em região `aria-live`.
- **7.6 — Testar fluxo completo.** Cobrir teclado, cancelamento do dialog, falha de
  API, replay, undo válido/expirado e preservação do filtro atual.

### Gate de saída

- Nenhum botão do Review Inbox é decorativo ou usa prompt nativo.
- Toda ação tem feedback, auditoria e recuperação de erro.

---

## Etapa 8 — Completar páginas de dados reais

**Prioridade:** alta. **Dependências:** Etapas 2 e 5.

### Passos

- **8.1 — Competitive intelligence.** Combinar `competitor_insights` e
  `content_suggestions`, com origem, estado de curadoria, filtros e links de
  evidência.
- **8.2 — Radar.** Exibir findings e news items com fonte, relevância, fase,
  processamento e paginação.
- **8.3 — Comunidade.** Usar as tabelas reais `communities` e relações existentes;
  não reintroduzir nomes históricos inexistentes.
- **8.4 — Source ROI.** Usar `source_metrics`, aplicar campanha e período, e definir
  denominadores/ausência de conversão sem divisão inválida.
- **8.5 — Timeline.** Construir feed cronológico tipado, agrupado por data, com
  origem, ator, correlação e campanha.
- **8.6 — Contexto e paginação.** Todas as consultas devem respeitar campanha ativa,
  intervalo temporal, ordenação determinística e limites de página.
- **8.7 — Remover `any[]`.** Criar tipos de row e definições de colunas específicas;
  serializar datas/números na fronteira server/client.
- **8.8 — Testar consultas e estados.** Cobrir campanha A/B, banco vazio, erro,
  paginação, timezone e conteúdo sem sugestão associada.

### Gate de saída

- Nenhuma das cinco páginas usa dados falsos ou tabela genérica sem semântica.
- Campanhas não vazam dados entre si.

---

## Etapa 9 — Consolidar design system e acessibilidade

**Prioridade:** alta para dialogs/foco; recomendada para tokens. **Dependências:**
Etapa 7.

### Passos

- **9.1 — Auditar componentes disponíveis.** Confirmar contratos de `Tabs`,
  `Dialog`, `ConfirmDialog`, `InputField`, `TextareaField` e `SelectField`; completar
  o ui-bridge antes de migrar consumidores se algum contrato estiver ausente.
- **9.2 — Migrar tabs manuais.** Review Inbox, Accounts e Notifications devem usar
  tablist/tab/tabpanel, roving tabindex, seleção por teclado e associação ARIA.
- **9.3 — Migrar dialogs.** Publishing, AI Settings e Accounts devem ter focus
  trap, `aria-modal`, título/descrição, Escape, clique externo conforme risco e
  retorno de foco ao gatilho.
- **9.4 — Migrar forms.** Usar labels, hints, erros associados e componentes de
  campo em vez de inputs ad hoc.
- **9.5 — Remover confirmação nativa.** Substituir `window.prompt`/`confirm` por
  dialogs tipados.
- **9.6 — Normalizar tokens.** Substituir pixels repetidos por tokens sem perseguir
  abstração artificial; adicionar somente tokens semânticos realmente necessários.
- **9.7 — Testar acessibilidade interativa.** Cobrir axe, teclado, ordem de foco,
  retorno de foco, leitor de tela e zoom/reflow nos fluxos principais.

### Gate de saída

- Tabs e dialogs não possuem implementações paralelas frágeis.
- Não há prompts nativos nos fluxos de administração auditados.

---

## Etapa 10 — Finalizar calendário e operação de publicação

**Prioridade:** alta. **Dependências:** Etapas 4, 5 e 9.

### Passos

- **10.1 — Teclado do calendário.** Implementar navegação nas duas dimensões com
  setas, Home/End quando aplicável, Enter para abrir, Escape para cancelar e
  alternativa explícita para mover/reagendar sem drag-and-drop.
- **10.2 — Confirmação manual.** Exibir botão e dialog com external ID validado,
  estado de envio, resultado e trilha de auditoria.
- **10.3 — Kill-switch explícito.** Mostrar estado e origem do kill-switch em
  Publishing e Automations; diferenciar worker indisponível de publicação
  bloqueada.
- **10.4 — Janela de cancelamento coerente.** Definir uma única regra entre UI e
  endpoint. Se o limite for 10 minutos, a API deve aplicá-lo; se qualquer publicação
  futura for cancelável, ajustar rótulo e badge da UI.
- **10.5 — Confirmar runbook web.** Manter o slug indexado e adicionar links
  contextuais aos estados de bloqueio e erro.
- **10.6 — E2E operacional.** Criar slot, reagendar por teclado, cancelar, confirmar
  manualmente, ativar/desativar kill-switch e verificar auditoria.

### Gate de saída

- UI e API aplicam a mesma política de cancelamento.
- O fluxo principal é operável sem mouse.

---

## Etapa 11 — Implementar o worker de enriquecimento

**Prioridade:** alta. **Dependências:** Etapas 1, 2 e decisão funcional documentada.

### Passos

- **11.1 — Definir responsabilidade.** Especificar inputs, outputs, fontes,
  proveniência, campos enriquecidos, critérios de confiança e o que permanece com
  classification/scoring.
- **11.2 — Definir contrato de job.** Schema versionado, chave de idempotência,
  correlationId, retry/backoff, timeout e reason codes.
- **11.3 — Integrar budget gate.** Verificar provider habilitado, reservar custo,
  reconciliar custo real e liberar reserva em falha/cancelamento.
- **11.4 — Implementar pipeline.** Carregar entidade, rejeitar input obsoleto,
  consultar provider permitido, normalizar resposta, persistir observação e
  proveniência numa transação e enfileirar o próximo estágio uma única vez.
- **11.5 — Tratar falhas.** Separar temporária, permanente, orçamento bloqueado,
  configuração ausente e conteúdo insuficiente.
- **11.6 — Testar sem chamada real.** Usar adapters falsos determinísticos para
  sucesso, timeout, retry, payload parcial, duplicata, budget exceeded e
  reconciliação.
- **11.7 — Teste de contrato opcional.** Executar contra sandbox do provider apenas
  por gate explícito, sem integrar secrets à suíte padrão.

### Gate de saída

- O worker deixa de ser stub e produz efeito de domínio observável e idempotente.
- Custos e proveniência são rastreáveis.

---

## Etapa 12 — Loading, error boundaries e resiliência de interface

**Prioridade:** recomendada. **Dependências:** Etapas 8 a 10.

### Passos

- **12.1 — Manter os dez loading states.** Validar visualmente os arquivos já
  criados, evitando layout shift e skeleton incompatível com o conteúdo final.
- **12.2 — Completar boundaries.** `system-health` e `automations` devem receber e
  usar `reset`, oferecer tentar novamente, preservar navegação e apontar runbook
  quando houver ação operacional.
- **12.3 — Padronizar vazio/erro.** Distinguir ausência real de dados, ausência de
  campanha, permissão insuficiente e falha de provider.
- **12.4 — Testar recovery.** Simular falha inicial seguida de sucesso e comprovar
  que `reset` refaz a renderização.

### Gate de saída

- Boundaries permitem recuperação real.
- Loading, vazio e erro têm mensagens e ações distintas.

---

## Etapa 13 — Higiene de dependências e workers

**Prioridade:** recomendada. **Dependências:** Etapa 1.

### Passos

- **13.1 — Confirmar correções já feitas.** Preservar `ok: true` no news-radar,
  declaração de `@plataforma/meta-api` e dependências de teste do scoring em
  `devDependencies`.
- **13.2 — Auditar imports reais.** Rodar o verificador ampliado em cada worker e
  pacote; remover apenas dependências comprovadamente não usadas e declarar toda
  importação de runtime no pacote consumidor.
- **13.3 — Validar imagens de produção.** Instalar com dependências de produção e
  iniciar cada entrypoint para detectar pacote disponível apenas por hoisting.
- **13.4 — Guardrail de CI.** Tornar `check:runtime-deps` obrigatório antes do
  build Docker.

### Gate de saída

- Nenhum worker depende de hoisting acidental.
- A imagem de produção inicia todos os entrypoints configurados.

---

## Etapa 14 — Suite de qualidade completa

**Prioridade:** crítica para release. **Dependências:** Etapas 1 a 13.

### Passos

- **14.1 — Unitários.** Rodar todas as suítes com reporter detalhado e seed fixa;
  não aceitar `.skip`, `.only` ou snapshot atualizado sem revisão.
- **14.2 — Integração com PostgreSQL e Redis reais.** Cobrir migrations, budget
  gate, OTP distribuído, transações de curadoria e publishers.
- **14.3 — Acessibilidade.** Expandir além dos seis empty states para Review Inbox,
  dialogs, tabs, calendário, publishing e automations.
- **14.4 — E2E.** Exercitar login/OTP com provider fake, autorização, curadoria,
  calendário, publicação manual, kill-switch e páginas de inteligência.
- **14.5 — Falhas e concorrência.** Incluir replays, dois operadores, Redis
  indisponível, banco interrompido e provider lento.
- **14.6 — Pipeline final.** Executar install congelado, hashes, runtime deps, lint,
  typecheck, build, testes, E2E e build das imagens.

### Gate de saída

- Zero testes falhando e zero falhas silencenciadas.
- Relatório registra duração, flakiness e cobertura dos fluxos críticos.

---

## Etapa 15 — Execução controlada das migrations e rollout

**Prioridade:** crítica. **Dependências:** Etapas 0 a 14.

### Passos

- **15.1 — Ensaio local.** Aplicar a cadeia numa base vazia e upgrades sobre dumps
  representativos; salvar logs, checksums, contagens e consultas de invariantes.
- **15.2 — Staging.** Fazer backup, colocar consumidores afetados em modo seguro,
  executar migration, validar ledger/schema/dados, subir web/workers e rodar smoke
  tests.
- **15.3 — Testar rollback em staging.** Exercitar o procedimento documentado e
  restaurar o estado atualizado antes de avançar.
- **15.4 — Go/no-go.** Exigir backup verificado, janela, responsável, comunicação,
  consultas de validação, limite de duração, gatilhos de abortar e imagem anterior
  identificada.
- **15.5 — Produção.** Suspender apenas os writers necessários, gerar backup
  imediato, executar migrations pelo runner canônico, conferir última versão e
  checksums, iniciar serviços gradualmente.
- **15.6 — Ativação gradual.** Web e leitura primeiro; depois scheduler/workers não
  publicadores; news-radar; competitive-intel; threads-publisher; publisher. Usar
  kill-switch até os smoke tests de cada fase passarem.
- **15.7 — Verificação pós-deploy.** Conferir health, backlog, retries, dead letter,
  logs, orçamento, duplicatas, auditoria, OTP, ações de curadoria e publicação
  manual.
- **15.8 — Observação.** Manter janela mínima monitorada e registrar qualquer
  rollback ou limitação ainda ativa.

### Condições de abortar

- checksum ou ledger divergente do inventário aprovado;
- migration fora do tempo máximo definido;
- perda de contagem, soma monetária divergente ou constraint inesperada;
- erro sustentado de web/worker, duplicata de publicação ou orçamento ultrapassado;
- rollback/restore não disponível.

### Gate de saída

- Migrations executadas e verificadas em produção.
- Web, workers, filas, orçamento e publicação permanecem saudáveis durante a janela
  de observação.

---

## Etapa 16 — Documentação e encerramento

**Prioridade:** obrigatória. **Dependências:** Etapa 15.

### Passos

- **16.1 — Atualizar `Docs/PROSPECTOR.md`.** Registrar schema final, contratos das
  ações, OTP distribuído, enrichment, testes e estado efetivamente verificado.
- **16.2 — Atualizar arquitetura e runbooks.** Ajustar
  `Docs/ARQUITETURA-UNIFICADA.md`, runbook orgânico, deploy, rollback e incidentes
  somente onde o comportamento mudou.
- **16.3 — Fechar este plano.** Marcar cada passo com evidência (commit, teste,
  migration/ledger e smoke test), listar limitações remanescentes e data da
  verificação em produção.
- **16.4 — Revisar segurança documental.** Remover e-mails, hosts privados,
  credenciais, tokens, cookies e dumps de exemplos.
- **16.5 — Conferir índice.** Manter `Docs/README.md` apontando para os documentos
  canônicos atuais e identificar planos históricos como históricos.

### Gate de saída

- Código, configuração executável e documentação descrevem o mesmo estado.
- Não há pendência deste plano sem decisão e justificativa registradas.

---

## 5. Ordem resumida de execução

| Ordem | Etapa | Natureza | Bloqueia release? |
|---:|---|---|---|
| 1 | 0 — Baseline e backups | Segurança operacional | Sim |
| 2 | 1 — Dependências/build | Correção crítica | Sim |
| 3 | 2 — Migrations/orçamento | Correção crítica | Sim |
| 4 | 3 — Mocks publishers | Correção crítica | Sim |
| 5 | 4 — Atomicidade/idempotência | Correção crítica | Sim |
| 6 | 5 — Auth/erros/validação | Segurança | Sim |
| 7 | 6 — OTP distribuído | Segurança | Sim |
| 8 | 7 — Review Inbox | Produto | Sim para operação completa |
| 9 | 8 — Páginas de dados | Produto | Sim para escopo do plano |
| 10 | 9 — Design system/a11y | Qualidade | Sim para fluxos críticos |
| 11 | 10 — Calendário/publicação | Produto | Sim |
| 12 | 11 — Enrichment | Worker | Sim para escopo do plano |
| 13 | 12 — Loading/errors | Melhoria recomendada | Não isoladamente |
| 14 | 13 — Higiene de deps | Prevenção | Sim |
| 15 | 14 — Qualidade completa | Validação | Sim |
| 16 | 15 — Migration/rollout | Produção | Sim |
| 17 | 16 — Documentação | Encerramento | Sim |

## 6. Comandos mínimos de verificação

Executar a partir de `plataforma`, adaptando apenas a forma de provisionar os
serviços de teste:

```powershell
pnpm install --frozen-lockfile
pnpm check:hashes
pnpm check:runtime-deps
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

Além desses comandos, a Etapa 2 exige testes de migration em PostgreSQL real e as
Etapas 6 e 14 exigem Redis real ou container equivalente. Um typecheck isolado do
web ou testes com adapters falsos não substituem esses gates de integração.

## 7. Riscos que não podem ser aceitos como dívida residual

- cadeia de migrations que não funciona desde uma base vazia;
- alteração silenciosa de checksum aplicado;
- perda de reservas ou divergência de totais monetários;
- ação de curadoria sem transação, idempotência ou audit log;
- publisher executando com preflight incompleto;
- rate limit OTP restrito a uma instância;
- autorização convertida em erro 500;
- fluxo administrativo dependente de prompt nativo ou inacessível por teclado;
- worker declarado como ativo sem lógica de domínio;
- pipeline verde porque pacotes, testes ou dependências foram ignorados.
## 8. Registro de execução — etapas 1 e 2 (15/08/2026)

### Etapa 1 — concluída no código local

- **1.1:** `@plataforma/shared` já continha `pg`/`@types/pg`; a revisão confirmou
  o manifest e o lockfile. O checker também levou `pg`/`@types/pg` aos dois
  workers que importavam `Pool` para tipos.
- **1.2:** `shared` passou build, typecheck, lint e testes isolados.
- **1.3:** `check-runtime-deps` passou a percorrer `apps`, `packages` e `workers`,
  validar `exports`/subpaths do workspace e produzir mensagens com importador,
  arquivo e dependência.
- **1.4:** `scripts/check-runtime-deps.test.mjs` cobre dependência externa ausente,
  workspace ausente, builtin, import somente de tipo, teste/story e subpaths.
- **1.5:** install congelado offline, typecheck completo (61 pacotes/81 tarefas),
  lint completo (61 pacotes/81 tarefas) e build completo (61 pacotes/61 tarefas)
  passaram. O Turbo foi executado com concorrência controlada por causa do host.

### Etapa 2 — reconciliação implementada; gate PostgreSQL pendente

- **2.1:** com base no estado canônico documentado de produção (0010 aplicada e
  0015 ainda não aplicada), 0015 foi corrigida in-place; não houve alteração dos
  bytes da 0010.
- **2.2:** provider é inferido somente quando há exatamente um provider no
  `provider_plan`; linhas sem provider ou ambíguas permanecem na tabela e entram
  em `organic_budget_reservation_quarantine`.
- **2.3:** a reconciliação adiciona provider, estados compatíveis com os dois
  consumidores, precisão `numeric(18,4)`, checks de valor, índices por provider/
  status e created_at. O `budget-gate` passou a usar `reserved_usd`.
- **2.4:** `0015.down.sql` desfaz apenas seus objetos/transformações, preserva a
  tabela da 0010 e aborta se o downgrade puder perder uma reserva provider-only
  ou o estado `released`.
- **2.5–2.7:** testes estáticos de migration e testes de contratos passaram, mas
  ensaio em PostgreSQL vazio, upgrade sobre cópias, rollback real e concorrência
  ainda não foram executados porque o host não possui Docker nem `psql`. Esse é
  o gate obrigatório antes de staging/produção; não está marcado como concluído.

Evidências locais: `scripts/check-runtime-deps.test.mjs`,
`packages/db/src/migrations.test.ts`, testes de `shared`, `db`, `queue` e
`organic-intelligence`, além dos gates completos do Turbo. Nenhuma credencial,
URL privada ou dado pessoal foi incluído neste registro.

## 9. Registro de execução — etapas 3 a 5 e pendências (15/08/2026)

### Estado concluído

- **Etapa 0:** baseline local de hashes, lockfile e gates executáveis foi
  registrado; inventário remoto de `schema_migrations`, dump/restore e matriz
  completa entre ambientes persistentes não foram possíveis neste host.
- **Etapa 1:** concluída no código local. Dependências, checker de runtime,
  fixtures e gates completos do Turbo foram validados.
- **Etapa 2:** implementação concluída no código local, incluindo a
  reconciliação da 0015, quarentena, `reserved_usd` e rollback seguro. O gate
  PostgreSQL real continua aberto conforme a seção anterior.
- **Etapa 3:** concluída no código local. Foi criada a factory tipada
  `makeWorkerJob`, removido `as any` dos testes dos dois publishers, adicionada
  validação de payload e cobertos preflight stale, kill-switch, aprovação,
  fallback, retry/falha permanente e ausência de chamada externa. Suites:
  publisher 8/8 e threads-publisher 7/7.
- **Etapa 4:** concluída no código local. A migration 0016 formaliza estados e
  unicidade por origem; radar, competitor insights, content suggestions,
  review inbox e publicações usam transação real, `FOR UPDATE`, auditoria e
  respostas determinísticas para replay/estado inválido. Schemas Zod validam
  params e bodies administrativos.
- **Etapa 5:** concluída no código local. Auth separado da captura genérica
  preserva 401/403, erros públicos usam helper com `traceId`, e cancelamento,
  confirmação manual e kill-switch usam contratos Zod estritos, autorização de
  operator e identidade real da sessão na auditoria.

### Pendências e gates não fingidos como concluídos

- **Etapa 0.3–0.4:** inventário somente leitura de ambientes persistentes,
  dump validado e restore descartável ainda dependem de acesso ao PostgreSQL
  correspondente.
- **Etapa 2.5–2.7:** cadeia limpa, upgrade sobre formatos reais, rollback em
  PostgreSQL e concorrência monetária ainda não executados; o host não possui
  `Docker`, `psql` ou `pg_isready`.
- **Etapa 4.6–4.7:** os endpoints estão protegidos por lock, transação,
  constraint/idempotência e testes de contrato locais, mas concorrência real e
  falha entre insert/update/audit precisam ser ensaiadas em PostgreSQL
  descartável/staging.
- **Etapa 5.5:** contratos puros de auth/erros e schemas passaram localmente;
  teste HTTP integrado com Next, sessão real e banco permanece gate de staging.
- **Etapas 6–12:** executadas no código local e registradas na seção seguinte;
  os gates que dependem de Redis/PostgreSQL, browser E2E, canário e validação
  visual continuam explicitamente abertos.
- **Etapas 13–16:** ainda não executadas nesta sequência e permanecem pendentes
  conforme a ordem resumida do plano.

### Evidências das etapas 3–5

`packages/shared/src/worker.ts`, testes dos publishers, migration
`packages/db/migrations/0016_organic_action_state.*`, rotas de ações orgânicas
e publicação administrativa, `apps/web/src/lib/api-errors.ts`, schemas,
testes de contratos e autorização. Nenhum segredo, token ou dado pessoal foi
incluído neste registro.

## 10. Registro de execução — etapas 6 a 12 e pendências (15/08/2026)

### Estado concluído no código local

- **Etapa 6 — OTP distribuído:** `apps/web/src/lib/otp-rate-limit.ts` usa Redis
  com chaves derivadas por hash, janela de 15 minutos, limite por identificador
  e IP, cooldown, script Lua atômico, `Retry-After`, fail-closed quando Redis
  está indisponível e métricas agregadas sem e-mail/IP. A rota não mantém mapa
  de processo nem registra valores pessoais.
- **Etapa 7 — Review Inbox:** migration `0017_review_inbox_undo` adiciona versão,
  token e janela de undo; decisões usam lock/transação/auditoria e replay
  determinístico. Review Inbox, radar e sugestões usam Dialog/Input/Textarea,
  tabs ARIA e edição de slot com título, legenda, canal, campanha e horário.
- **Etapa 8 — páginas de dados:** radar, inteligência competitiva, comunidade,
  source ROI e timeline usam consultas tipadas, campanha ativa, filtros de data,
  ordenação determinística, paginação de 50 e estado vazio real. A migration
  `0018_data_page_context` adiciona contexto de campanha e campos de página;
  linhas legadas sem campanha continuam tratadas como globais.
- **Etapa 9 — design system/a11y:** `Dialog` e `ConfirmDialog` têm foco inicial,
  trap de Tab, Escape, click-outside, `aria-modal`, IDs de título/descrição e
  retorno de foco; Tabs têm roving focus e ARIA. Review Inbox, Accounts e
  Notifications têm `tablist`/`tab`/`tabpanel`; formulários críticos usam os
  campos do bridge e não há `window.prompt`/`window.confirm` nos fluxos web.
- **Etapa 10 — calendário/publicação:** calendário oferece setas, Home/End,
  Enter, Escape e botão explícito de reagendamento sem drag-and-drop. Confirmação
  manual exige external ID, cancelamento exige motivo e a API aplica uma única
  janela de dez minutos. Kill-switch exibe estado, motivo e recuperação por
  Dialog. Foi criado o runbook de automações.
- **Etapa 11 — enrichment:** o antigo stub foi substituído por payload
  versionado, correlation/idempotency key, classificação de fronteira,
  normalização, timeout/abort, reason codes, reserva/reconciliação/liberação
  de orçamento, persistência transacional de entidade/perfil/proveniência,
  `provider_usage` e enqueue determinístico da próxima fila. A migration
  `0019_enrichment_jobs` registra tentativas e estado. Adapters falsos cobrem
  sucesso, deduplicação, stale input, payload parcial, budget block e timeout.
- **Etapa 12 — loading/errors:** boundaries de Automações e Saúde do sistema
  chamam `reset` real e apontam para runbooks; `page-state.ts` separa loading,
  vazio, sem campanha, sem permissão, provider indisponível e erro recuperável,
  com testes do contrato. O runbook `automations.md` foi indexado em
  `Docs/README.md`.

### Pendências reais e gates não fingidos como concluídos

- **Etapas 0.3–0.4, 2.5–2.7, 4.6–4.7 e 5.5:** inventário/dump/restore,
  migrations limpas, upgrade/rollback/concorrência monetária, concorrência
  real das ações e HTTP integrado com sessão/banco ainda dependem de ambiente
  descartável ou staging com PostgreSQL.
- **Etapa 6:** falta validar Redis real, TTL/cooldown em múltiplas instâncias,
  failover e métricas sob carga. O host local não possui Docker/Redis.
- **Etapas 7–8:** falta E2E HTTP/PostgreSQL real, locks concorrentes, queries
  com dados volumosos e timezone/paginação em staging. O backfill de campanha
  das linhas legadas não foi executado; elas permanecem globais por decisão
  explícita.
- **Etapas 9–10:** falta executar Playwright com browser real, validar foco
  visual nos dez estados de carregamento e exercitar kill-switch, confirmação,
  cancelamento e calendário contra APIs implantadas. A tela agora exibe a
  origem do estado do kill-switch (`worker_settings`/`operator`).
- **Etapa 11:** falta sandbox/credencial real do provider, PostgreSQL/Redis
  real, outbox/reprocessamento observado e canário operacional. O teste local
  usa adapter falso e não autoriza consumo pago.
- **Etapa 12:** o contrato de estados e boundaries está testado, mas a validação
  visual dos loading states e a recuperação em browser continuam gate de E2E.
- **Etapas 13–16:** higiene final de dependências, qualidade completa,
  rollout/migration em ambiente persistente e encerramento operacional ainda
  não foram executados.
- **Gate global:** `check:runtime-deps`, `check:hashes`, typechecks isolados,
  testes web/db/enrichment e build web passaram. O `turbo run typecheck` dos
  61 pacotes foi tentado com concorrência reduzida, mas ficou sem saída por
  tempo excessivo e foi interrompido; não é reportado como aprovado. O host
  continua sem Docker, PostgreSQL/Redis descartáveis e browser E2E.

### Evidências e documentação

Arquivos centrais: `apps/web/src/lib/otp-rate-limit.ts`, componentes/rotas de
Review Inbox, páginas de dados, `packages/ui-bridge/src/dialogs.tsx`,
`apps/web/src/app/publishing/PublishingClient.tsx`,
`workers/enrichment/src/index.ts` e testes, migrations `0017`–`0019`,
`apps/web/src/lib/page-state.ts`, `apps/web/src/error-boundaries.test.tsx`,
`packages/ui-bridge/src/dialogs.test.tsx` e `docs/runbooks/automations.md`.
Foram atualizados `Docs/PROSPECTOR.md`, `Docs/README.md` e
`plataforma/docs/runbooks/restore.md`. Nenhum segredo, token, cookie, e-mail,
URL privada ou dado pessoal foi incluído.

## 11. Registro de execução — etapas 13 a 16, correções de rollout e produção (16/08/2026)

### Etapa 13 — concluída com verificação remota

- **13.1:** `news-radar` mantém `ok: true`; `@plataforma/meta-api` está
  declarado nos consumidores de runtime; e o scoring mantém as dependências de
  teste em `devDependencies`.
- **13.2:** `pnpm check:runtime-deps` e `pnpm test:runtime-deps` passaram para
  `apps`, `packages` e `workers` (5/5 fixtures). Nenhum pacote foi removido sem
  prova de uso ausente; não há hoisting acidental observado.
- **13.3:** build remoto com `pnpm install --frozen-lockfile` passou; a imagem
  única iniciou os 40 workers e o scheduler. A amostra do discovery confirmou o
  gate de flag antes do carregamento do módulo.
- **13.4:** `docker/worker.Dockerfile` e `apps/web/Dockerfile` executam o
  checker antes da instalação/compilação; o build remoto confirmou o guardrail.

### Etapa 14 — parcialmente concluída; testes manuais restantes registrados

- Suítes focadas passaram: web 25/25, DB 17/17, UI bridge 6/6, enrichment 7/7,
  publisher 8/8, threads-publisher 7/7 e checker 5/5. Não há `.skip()`/`.only()`
  nos fontes auditados.
- O Turbo completo de testes dos 61 pacotes ficou sem progresso no executor
  local e foi interrompido. Playwright/E2E, concorrência real de Redis/Postgres,
  provider sandbox e validação visual ficam para os testes manuais do usuário;
  não são marcados como aprovados.
- O build remoto das imagens passou; o build web gerou as 40 páginas. Warnings
  existentes de autoprefixer/webpack não impediram a imagem e não foram
  convertidos em erro de produto.

### Etapa 15 — migrations e rollout verificados em produção

- O primeiro deploy falhou de forma transacional em `0011` por referência a
  `design.editorial_theses`; a correção cria view real quando a tabela existe e
  view vazia tipada quando o banco é Prospector-only. O segundo ensaio revelou
  o drift de colunas de `candidate_sources` em `0014`; a migration passou a
  adicionar `platform`, `handle` e `display_name` antes do seed. Os testes de
  migrations passaram 17/17 antes da reaplicação.
- `deploy/deploy-all.ps1 -Only prospector` aplicou 0011–0019 e confirmou
  `Migrations OK: 0019_enrichment_jobs`; a inspeção remota confirmou o ledger
  com 0019, web saudável, PostgreSQL/Redis/embeddings saudáveis, 40 workers em
  uma imagem e scheduler ativo.
- O script foi ajustado para criar e validar backup custom-format em
  `shared/backups/` imediatamente antes do runner. A repetição com
  `-ReuseWorkerImage` passou esse gate e terminou com código 0. A Gazeta foi
  preservada. Não houve marcação manual de migration.
- Ensaio de base vazia, upgrade sobre dump representativo, rollback em staging,
  observação prolongada e canário de providers não foram executados neste
  trabalho; ficam como gates operacionais/manuais antes de ativar workers.

### Etapa 16 — concluída na documentação do estado real

- Atualizados `Docs/PROSPECTOR.md`, `Docs/ARQUITETURA-UNIFICADA.md`,
  `Docs/README.md`, `plataforma/docs/runbooks/restore.md`,
  `plataforma/deploy/DEPLOY.md` e `plataforma/CHANGELOG.md`.
- O índice continua apontando para documentos canônicos e o plano preserva as
  limitações sem expor credenciais, hosts privados, tokens, cookies, e-mails ou
  dumps.

### Estado final e pendências explícitas

Código, Docker, migrations, deploy e documentação estão alinhados no estado
implantado até `0019`. A única pendência desta execução é a validação manual
solicitada pelo usuário: E2E/Playwright, cenários de concorrência/falha e
canários de provider. As flags de workers seguem desligadas por segurança.

## 12. Correção visual e deploy integral (17/08/2026)

### Causa confirmada

- Os componentes de `@plataforma/ui-bridge` emitiam classes `bridge-*`, mas o
  pacote não exportava nem o Prospector importava uma folha visual comum para
  essas classes. O navegador aplicava estilos nativos a botões e superfícies.
- O tema do Prospector não fornecia todos os aliases de tokens consumidos pela
  bridge (`--space-*`, raios, borda e superfícies), o que degradava os fallbacks.
- O ECharts recebia strings `var(--token)` em um canvas, onde variáveis CSS não
  são resolvidas automaticamente; por isso os gráficos podiam existir sem
  desenho visível.

### Correções concluídas

- A bridge passou a exportar e o Prospector a importar `styles.css`, cobrindo
  botões (incluindo aliases `ghost` e `outline`), KPIs, cards, grids, campos,
  drawers, estados, checkboxes e switches com bordas sutis, raios consistentes,
  sombras e responsividade.
- Os tokens semânticos ganharam aliases, escala de espaçamento, raios e sombras
  usados pelos componentes compartilhados.
- O tema e as opções do ECharts passam a resolver cores CSS para valores
  concretos antes de desenhar no canvas.
- A Overview usa dados reais em três painéis analíticos: funil, comparação por
  campanha e mix operacional. Quando não há atividade, exibe estados vazios
  honestos em vez de séries inventadas.
- Typecheck de web e UI bridge passou sem erros; a UI bridge passou 10/10 testes.
  O build web gerou as 40 páginas e o build integral do Design System passou.

### Deploy e verificação concluídos

- `deploy/deploy-all.ps1` foi executado sem `-Only`, `-SkipBuild` ou reutilização
  de imagem: reconstruiu e publicou SPA/API do Design System, Prospector web,
  scheduler e os 40 workers.
- Houve backup validado antes das migrations. O Prospector confirmou
  `0019_enrichment_jobs`; o Design System confirmou as migrations `0000`–`0004`.
- A inspeção pós-deploy confirmou HTTP 200 e dependências saudáveis no Prospector,
  web na imagem publicada, 40 workers em uma única imagem, scheduler instalado e
  Design API saudável na release integral.
- A inspeção visual em produção confirmou CSS novo, botões com raio de 10 px,
  KPIs em grid com raio de 18 px, três painéis analíticos e ausência de erros no
  console das duas aplicações.

### Pendências mantidas explícitas

- Permanecem somente os testes manuais assumidos pelo usuário: fluxos E2E,
  cenários de concorrência/falha, canários de providers e avaliação visual com
  dados operacionais não vazios. O ambiente atual não possui atividade para
  preencher os gráficos, portanto os três estados vazios em produção são o
  comportamento esperado, não uma falha visual.

## 13. Correção de notificações e baseline editorial manual (18/08/2026)

### Problemas confirmados

- O layout enviava ao cliente uma sessão fixa com papel `actor`, enquanto o
  modo bootstrap de produção apenas liberava visualização. O AppShell consultava
  o contador administrativo para qualquer papel e a rota não convertia a falha
  de autorização, produzindo `500` no console.
- A migration `0014` continha pilares, formatos, regras, concorrentes,
  vocabulário e hooks, mas não materializava as seis teses, o calendário de sete
  dias e os vinte temas prioritários do documento de crescimento.
- O editor de publicação usava URLs sem o `basePath`, chamava a rota de
  agendamento de variante com contrato incorreto e a consulta descartava slots
  manuais sem oportunidade associada.

### Concluído no código

- Sessão real propagada pelo layout; fallback sem sessão com papel `viewer`;
  sino e polling de notificações restritos a `admin`; resposta pública 401/403
  na rota protegida.
- Rota transacional e auditável para criar/editar publicações manuais, URLs com
  `appPath` e consulta de calendário compatível com slots autônomos.
- Rota de Ataque passou a ser a campanha inicial quando não existe preferência
  salva; o seletor e o cookie continuam permitindo alternar para a Gazeta.
- Migration `0020_growth_organic_manual_baseline` com 6 teses, 7 ideias e 20
  sugestões manuais; migration `0021_scope_growth_baseline_to_rota` restringe o
  material à campanha correta. Automação não pode sobrescrever os registros,
  mas operador humano pode editá-los.
- O script de inspeção passou a conferir contagens editoriais por campanha e o
  contrato HTTP do contador de notificações.

### Verificação e rollout

- Typecheck e build do web passaram; build de produção gerou 41 páginas.
- Web: 11 arquivos/27 testes; DB: 4 arquivos/19 testes; guardrail de
  dependências de runtime aprovado.
- `deploy/deploy-all.ps1` foi executado sem filtros após a revisão final. A
  release `20260818020821-2d1806e7` reconstruiu e publicou SPA/API do Design
  System, web do Prospector, scheduler e 40 workers, com backup pré-migration.
- Produção confirmou migration `0021`, web e dependências saudáveis, Design API
  em `0004`, uma imagem única para workers, ausência de novos erros no log web,
  `notifications_count_http=401`, Rota de Ataque com `6/7/20` e Gazeta com
  `0/0/0` para esse baseline.

### Pendências

Permanecem somente os testes manuais já assumidos pelo usuário: fluxos E2E,
concorrência/falha, canários de provider e avaliação visual com dados
operacionais. Nenhuma flag de worker ou provider pago foi habilitada e nenhuma
ideia do calendário foi autorizada para publicação.
