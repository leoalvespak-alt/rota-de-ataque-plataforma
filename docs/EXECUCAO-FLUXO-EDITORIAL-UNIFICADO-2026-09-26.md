# Registro de execução: fluxo editorial unificado

Data de início: 26/09/2026. Repositório operacional: `Sistema de Design/plataforma`, branch `main`, base `5a454df897a811885b1a3c0abf5055cf3c7b5698`. Este registro distingue o código local do estado implantado.

## Estado por etapa

| Etapa | Estado | Evidência e pendência |
|---|---|---|
| 0. Inventário e checkpoint | Parcialmente concluída | Checkouts, dados, containers, timers, browser, backup e restore foram conferidos. Domínio da Gazeta e capacidades de conta ainda aguardam confirmação/acesso. |
| 1. Destravar a operação | Implantada; reteste funcional concluído, evidência de dados não vazios pendente | SHA `659c131f7819559b042fe1039dec43907c9602ec`; CI e deploy passaram. Pulso, Radar, Decisões, Funil, Teses, Lote, Métricas e Saúde foram abertos sem erro de console. O banco atual não tem conteúdo nem jobs de geração, então as métricas retornaram qualidade `null` e contagens zero; o cálculo com valores numéricos segue coberto por teste local. |
| 2 | Corte compartilhado aplicado; aplicações em produção no banco prospector | Backup e ensaio restaurado passaram. As 53 tabelas/62 linhas de rota_design foram copiadas para prospector.design; migrations 0046–0048 prepararam schemas/grants e fizeram o corte, preservando a origem. Prospector e Design usam o banco e schemas compartilhados pela release local `0a90325fc16cf3ebc7a4c3bf`. O tracker de migrations Design está em design.design_schema_migrations, com o histórico conferido. |
| 3 | Parcial; executor e store persistentes exercitados | Migrations 0049–0053 estão aplicadas. Store PostgreSQL, supervisor, outbox, retries, health/retry UI e handler do Radar passaram nos ensaios locais/descartáveis. Dois jobs sintéticos no banco persistente falharam antes e depois de checkpoint e foram retomados por novos processos, concluindo na tentativa 2. O executor está ativo; as quatro schedules seguem desabilitadas e não há trabalho de domínio pendente. Falta validar handler de domínio no banco persistente e fechar critérios de concorrência e recuperação operacional. |
| 4 | Detalhes HTML e paginação persistidos; incompleta | O worker busca detalhes dos três portais HTML registrados, com origem HTTPS restrita, limites de redirects e corpo, validators, hash, versão do parser, texto e referências PDF. A migration 0052 guarda versões dos detalhes; a 0053 guarda o cursor e a conclusão da paginação. O PCI percorre até dez páginas por execução e retoma o cursor. A suíte do worker passou; o build e deploy local foram concluídos. Nenhuma coleta foi iniciada. Faltam resposta real do Querido Diário após handshake TLS, DOU/INLABS, Business Discovery, avaliação de PDF/OCR e aceite de cobertura. |
| 5–13 | Código e banco preparados; aceite por etapa pendente | A credencial rota_design_system passou no smoke sintético do DeepSeek V4 Flash. As 50 composições da Etapa 7 passaram pela revisão visual de catálogo; conteúdo real, ativos e exportações personalizadas seguem pendentes. A migration 0050 e a rota `/prospector/inbox` estão na release e no banco ativo. A sessão Edge seguia com papel viewer na checagem anterior; a revisão visual desta rodada ficou pendente porque a automação não ativou a janela. DeepSeek V4 Flash passou smoke em produção; o código prevê GLM-5.3-Flash como alternativa, ainda sem chave para smoke live. JEV, evidência factual, fontes, migração Gazeta, canais com receipts, atendimento real, fluxo completo, continuidade e sete dias de observação seguem sem aceite. |

## Etapa 0: backups e estado observado

- Snapshot SQLite online em `Rota Criativos e automacao/automacao_instagram/data/backups/instagram-unified-checkpoint-20260926.sqlite3`; integridade `ok`, 94.208 bytes, SHA-256 `7619bba1d488e1269a5ce4b7cf981ef172e80f4e6b2aee9ae69b9d2ecda13c48`. Snapshot tardio também foi verificado e teve o mesmo hash.
- PostgreSQL: dumps de `prospector`, `rota_design` e roles globais foram enviados com nomes exclusivos ao prefixo R2 `backups-postgres/editorial-unified/20260927T003712Z`. Cada objeto foi baixado, restaurado em database descartável, conferido e removido do banco descartável. O restore conferiu `pgvector`, grants e contagens: Prospector `news_items=262`, `radar_findings=0`, `task_runs=0`, `task_schedules=3`, migration `0045_task_runtime`; Design `unified_creatives=0`, `editorial_theses=1`. Nenhuma migration ou escrita foi feita nos bancos de produção.
- O bucket R2 usado não teve a configuração de acesso público auditada nesta etapa. A documentação do serviço informa TLS no trânsito e criptografia AES-256 em repouso ([segurança do R2](https://developers.cloudflare.com/r2/reference/data-security/)). A criptografia BitLocker do volume Windows não pôde ser consultada sem elevação administrativa.
- Há uma tarefa agendada do Windows chamada `RotaInstagram30Carrosseis` em execução, com 27 posts pendentes e quatro publicados no snapshot. Ela foi mantida ativa; a troca exige um consumidor substituto testado e confirmação de exclusividade.
- Os três horários editoriais de PostgreSQL estavam desativados. Não houve restart, publicação, envio, disparo de tarefa ou deploy.
- Os domínios `gazetadosconcursos.com.br` e `gazetaconcursos.com.br` falharam em DNS no navegador. A identificação do domínio oficial segue pendente.
- A leitura visual do Prospector autenticado reproduziu no Radar o erro `Unexpected end of JSON input`, com estado `Indisponível`. Não havia conector Playwright ou Chrome DevTools disponível para capturar Console/Network; a correlação foi feita com o handler e o pool cacheado no código.

## Etapa 1: mudanças, deploy e reteste

- Removido `pool.end()` dos Server Components e do endpoint `/api/dashboard/today`. `createDatabase()` devolve um pool singleton por processo; um handler não deve encerrar conexões que outras requisições usam.
- Radar agora atualiza `news_items.classified` e insere `radar_findings` na mesma transação. O `ON CONFLICT` declara a condição `fingerprint IS NOT NULL` exigida pelo índice único parcial. Falha no insert faz rollback da classificação.
- Métrica de qualidade só agrega valores JSONB numéricos entre 0 e 1. Ausência ou tipo inválido não vira zero nem derruba `avg(text)`. A interface apresenta estados de carregamento, erro com nova tentativa, dados e ausência de qualidade válida.
- Health usa por padrão a migration `0045_task_runtime`, consulta estados reais de `task_runs` e `task_schedules` e informa backlog vencido/execução parada. A tela de saúde deixou de mostrar filas e falhas como zeros fixos e lista as agendas do banco.
- Arquitetura do Design foi documentada em `apps/design-system/docs/architecture/`; os documentos canônicos agora registram o banco compartilhado e o executor supervisionado no WSL2.
- O commit inicial `21d3a73` falhou no CI por `setState` síncrono dentro do efeito de métricas. A transição para `loading` foi movida ao botão de retry em `659c131`; o CI completo e o deploy desse SHA passaram. [CI](https://github.com/leoalvespak-alt/rota-de-ataque-plataforma/actions/runs/36286570333) · [deploy](https://github.com/leoalvespak-alt/rota-de-ataque-plataforma/actions/runs/36286570435).

### Verificação local

- Testes direcionados passaram após os últimos ajustes: Prospector web, 4; Radar, 7; Design System, 5.
- Build de produção do Design System passou. Typecheck do worker Radar passou.
- Typechecks do Prospector web e do worker Radar passaram após tornar opcional a nova prop usada pela tela de saúde. Build de produção do Design System passou.
- Lint local do Design System passou, com dois avisos preexistentes de Fast Refresh em `apps/design-system/src/app/router.tsx`; build de produção passou depois da correção do retry.
- CI final passou em migrações de teste, testes unitários, E2E, lint, typecheck e builds. O hook de push também passou: 35 arquivos de teste, 135 testes.
- `git diff --check` passou.
- `docs:architecture:check` passou depois que os oito documentos faltantes de arquitetura foram criados. O `context:check` sinalizou CodeGraph; a raiz não contém `.codegraph/` e, pelas instruções locais, o índice não foi inicializado.

### Verificação em produção

- O workflow ativou o SHA `659c131f7819559b042fe1039dec43907c9602ec`. O endpoint de saúde respondeu `200`/`operational` e incluiu `taskRuntime`: 0 execuções, 0 tentativas pendentes, 0 falhas recentes, 0 atrasadas e 0 execuções paradas; 3 agendas persistidas, todas desativadas.
- Sem restart entre as navegações, Pulso exibiu 50 sugestões; Radar exibiu estado vazio; Decisões mostrou 20 pendências; Planejamento/Funil mostrou 20 sugestões, 50 oportunidades e zero conteúdos, variantes e publicações; Teses exibiu 7/7 ativas; Lote abriu sem ID informado; Métricas retornou `200` com `total=0`, `averageQuality=null` e custo zero. Saúde mostrou zero workers ativos, zero tarefas pendentes/falhas e as três agendas pausadas.
- A primeira abertura do Funil ficou em carregamento e reconexão; após reload, `/prospector/api/content/funnel` respondeu `200` e a tela mostrou os dados persistidos. Esse comportamento inicial fica registrado para nova observação.
- O endpoint `/api/metrics` e a tela de métricas trataram corretamente o banco sem conteúdo. Como não existem linhas com notas de qualidade no banco atual, não há amostra positiva para conferir a média em produção; a média numérica e os tipos inválidos/ausentes foram exercitados nos testes locais.

## Etapa 2: preparação e ensaio em bancos descartáveis (27/09/2026)

- Criadas as migrations novas `0046_shared_editorial_schemas`, `0047_editorial_schema_prep` e `0048_unified_editorial_cutover`; o histórico anterior permaneceu intacto. O CI comum foi limitado a `0045_task_runtime`, pois o corte exige dados transferidos e conexão administrativa.
- A migration Design foi ensaiada no schema `design`. O runner fixa `pgcrypto` e `vector` em `public`; sem isso, `vector` seria criado em `design` e a verificação de assinatura de `knowledge_embeddings.embedding` interromperia a cópia.
- `apps/design-system/scripts/transfer-design-data.ts` copiou 53 tabelas para banco descartável e comparou assinatura, contagem e hash. O marcador de transferência e a cópia completa foram conferidos. No Prospector clonado, o corte mapeou as 37 publicações antigas para 37 linhas canônicas, conservando referências, campanhas, estruturas e mídias.
- Views de compatibilidade foram exercitadas com atualizações de item, tese e agenda; triggers registraram as revisões do item e o incremento de versão. O resultado do corte teve zero referências estrangeiras inválidas.
- A migration `0048` transfere ownership das sete cópias de arquivo, remove os privilégios efetivos de `prospector_app` e `prospector_reader` e salva os donos e privilégios anteriores. O down restaura dono/grants e valida ambos antes de concluir.
- Em teste de rollback sem edições posteriores, o comparador [verify-editorial-cutover.mjs](../packages/db/scripts/verify-editorial-cutover.mjs) confirmou os dados de 10 tabelas Prospector e 53 tabelas Design sem diferenças. Em outro ensaio, uma edição depois do corte fez o down parar com `Rollback blocked because editorial.unified_creatives changed after cutover`; o estado permaneceu no corte.
- Encerrado o ensaio, os nove bancos descartáveis, a role superuser temporária e os dois dumps de teste foram removidos. Os bancos locais `prospector` e `rota_design` usados como origem não foram alterados.
- A conexão usada nos ensaios foi de banco local restaurado e descartável. Nenhum DDL, cópia, escrita, deploy ou push foi feito em produção. A migração exige uma URL temporária superuser para `prospector`; a URL não está disponível no checkout.
- Criados o overlay [docker-compose.editorial-shared.yml](../docker/docker-compose.editorial-shared.yml) e o [runbook do corte](runbooks/editorial-database-cutover.md). O overlay foi validado por `docker compose config --quiet`; o arquivo de produção padrão não foi ativado.

### Verificações locais da Etapa 2

- `@plataforma/db` — 4 arquivos de teste, 22 testes aprovados; migrações até `0045_task_runtime` passaram em banco vazio, down e nova aplicação também passaram.
- Contrato de revisão do Prospector — 1 arquivo, 2 testes aprovados.
- TypeScript estrito dos scripts Design de migration e transferência passou. Build do Design e do pacote de banco passaram.
- O build do Prospector identificou uma importação `.js` sem arquivo correspondente para `editorial-schema`; a função foi movida ao entrypoint do pacote. O segundo build passou. Os typechecks direcionados do Prospector, Design, pacote de banco e scripts Design passaram; a verificação global de `pnpm typecheck` foi interrompida após execução sem progresso visível.
- `git diff --check` foi repetido no fechamento e passou.

## Gates que seguem abertos

- Obter o domínio público oficial da Gazeta e acesso DNS/admin; revisar os endereços candidatos que não resolveram.
- Repetir o primeiro acesso ao Funil e validar a média de qualidade com registros reais quando houver conteúdo avaliado; até lá, a evidência de produção cobre o estado vazio e a cobertura numérica é local.
- Não habilitar schedules nem desativar o publicador legado antes de instalar e testar o executor substituto, seus retries e recovery. Os três schedules editoriais seguem pausados, nenhum worker editorial está ativo e a tarefa legada de Instagram continua em execução.
- Obter/validar credenciais e permissões de provedores e contas; aprovar as versões exatas de conteúdo não noticioso antes de publicar.
- Migrar Design e Gazeta com mapeamento completo e rollback; ligar canais por receipt real; executar os ensaios de continuidade e a campanha natural de sete dias.
- O corte da Etapa 2 em produção segue pendente de URL administrativa superuser, janela de corte, backup/restore recente e smoke test das duas aplicações no banco compartilhado. Não usar o deploy padrão sem o overlay e sem o corte `0048` aplicado.

O código da Etapa 1 está em `main` nos commits `21d3a73` e `659c131`. Não houve publicação social, ativação de agenda, troca do consumidor legado, nem habilitação de workers.
# Atualização de execução em 27/09/2026

Etapa 1: configuração da migration corrigida no commit `0a90325fc16ca5f45c101d75e3299b20d32037db`; CI `36288182678` e deploy `36288182660` aprovados. `/prospector/api/health/ready` respondeu `200` com banco e migrations `ok`; a API operacional confirmou zero execuções e três agendas desativadas.

Etapa 2, auditoria inicial: as entidades foram conferidas em leitura, antes do ensaio descrito acima. No banco `rota_design`, 54 tabelas físicas, seis tabelas de aplicação com dados e ledger com nove migrations. Dados: `editorial_angles=26`, `editorial_depth_levels=8`, `editorial_intents=15`, `editorial_theses=1`, `prompt_templates=11`, `users=1`; as demais estavam vazias. `unified_creatives=0` nesse banco.

No banco `prospector`, há sete teses, 37 `scheduled_publications` e 37 `unified_creatives`. O pareamento por título, legenda, canal, formato e horário encontrou 37 pares, sem UUID compartilhado. `campaign_id` diverge em todos os pares; tese, lote, status, curadoria, publicação, aprovador e origem coincidem. Os 37 `copy_data` estão vazios, enquanto `content_structure` existe nas linhas antigas; 30 linhas têm referências de mídia. Não há `ig_media_id` nem erro nessas linhas.

As FKs de publicação cobrem oportunidades, contas, variantes, campanhas e `superseded_by`; `content_suggestions.promoted_publication_id` e `radar_findings.promoted_publication_id` também apontam para a tabela antiga. A única tese do Design tem `prospector_thesis_id` para uma das sete teses do Prospector. Nenhum DDL ou dado foi alterado naquela auditoria. O ensaio posterior da Etapa 2 está registrado acima; a implantação, a conexão administrativa e o smoke test autenticado seguem pendentes.

## Etapa 3: fila, executor e observabilidade (27/09/2026)

- `0049_durable_task_executor` acrescenta `available_at`, prioridade, lane, lease, heartbeat, checkpoint, identidade por item/revisão/conta, outbox transacional e auditoria de retry. As agendas existentes migram para destino local e permanecem desativadas. Um primeiro ensaio encontrou a constraint de destino antes da conversão de valores antigos; a migration foi reordenada e passou na reaplicação descartável.
- `PostgresTaskRunStore` faz claim com `SKIP LOCKED`, recuperação de lease, materialização de agendas, retry e outbox. `EditorialTaskSupervisor` usa um advisory lock e limites separados por lane. O executor só registra `news-radar.daily`; lote, publicação e inbox ficam sem claim enquanto não houver handlers reais.
- O Radar passou a rodar como job durável e a salvar checkpoints por fonte/item. Fetches não 2xx não contam como coleta vazia bem-sucedida; 304 atualiza a hora da coleta; cancelamento por encerramento não vira falha da fonte. O ensaio do handler real usou um servidor RSS local e deixou chamadas externas de IA desligadas.
- A tela de Saúde exibe jobs recentes com campos limitados, mensagem do executor desligado antes de `0049` e ação admin de retry com auditoria. O kill-switch pausa materialização de agendas e claims novos de tarefas/outbox, sem cancelar trabalho em andamento.
- A base temporária de runtime foi criada por `scripts/test-task-runtime-disposable.ps1` no PostgreSQL do WSL2, recebeu migration 0045/0049 e foi removida com sua role ao final. O script aponta o cliente Windows ao IP da distribuição, pois `localhost:5432` atinge um PostgreSQL Windows diferente. Resultado final no último ensaio: PostgreSQL executor 7/7; contratos de migration 8/8; unit tests task-runtime 5/5; Radar 21/21; typechecks de runtime, executor, Radar e web passaram; `git diff --check` passou.
- A execução permanece local. O corte de produção da Etapa 2 aguarda URL superuser, backup/restore na janela, transfer marker do Design e smoke test autenticado. Não aplicar `0049`, ativar schedules ou trocar consumidor legado antes desses gates.

## Etapa 4: coletor e fontes (27/09/2026)

- `workers/news-radar/src/index.ts` agora diferencia status HTTP, atualiza validators/última coleta em 304 e propaga cancelamento do supervisor. Os testes de regressão cobrem 403, 304 e cancelamento.
- O cadastro local `prospector` tinha três fontes HTML ativas com última coleta em 01/09/2026: PCI Concursos, Ache Concursos e Folha Dirigida por Qconcursos. DOU API e demais feeds observados estavam inativos ou nunca coletados. Esse snapshot não representa produção; veja a [matriz de fontes](architecture/editorial-source-matrix.md).
- O relatório anterior citou adapters da Gazeta, uma classe base QD, um adapter INLABS e um piloto que chamava a API e baixava TXT. Esses caminhos não foram encontrados no checkout WSL2 atual de `GazetaConcuros - Projeto`; manter essas referências como histórico não reproduzido até localizar a cópia correta. O adapter QD descrito aqui foi criado neste monorepo durante esta execução.
- O código-fonte oficial atual confirma `GET /gazettes`, filtros `territory_ids`, `querystring`, `scraped_since`/`scraped_until` e também `published_since`/`published_until`, paginação `size`/`offset` e ordenação `sort_by`. O adapter exige território e consulta explícitos, usa cursor temporal por `scraped_at` com 24h de sobreposição (janela inicial de sete dias), percorre todas as páginas observadas e falha se o total mudar; também limita a 60 páginas/5 MiB por resposta e tenta novamente 429/500/502/503/504 até duas vezes, respeitando `Retry-After`. Mapeia data, metadados e `excerpts`, sem baixar `txt_url` nem preencher corpo integral.
- Uma consulta pública de leitura foi tentada em 27/09/2026 pelo Windows, WSL2, Edge e serviço de navegação; não houve resposta HTTP por falha TLS/acesso ao host. O database local ainda não tem território/palavras-chave aprovados para essa fonte. Antes de baixar `txt_url`, falta definir e validar allowlist dos hosts oficiais de arquivo, limites de tamanho/MIME/redirects, persistência do bruto imutável e versão do parser. INLABS exige conta para acesso ao portal XML; Business Discovery ainda não tem preflight de conta/token.
- Fontes `api` sem adapter continuam gerando falha explícita; `querido-diario` é encaminhado ao novo adapter. O teste do worker Radar passou 33/33 e o typecheck passou. Etapa 4 segue incompleta: sem resposta real, corpo/anexos, PDFs/OCR, versionamento/proveniência documental e confirmação de cobertura. Nenhuma agenda de fonte foi ligada.

## Triagem local das Etapas 5–13

Esta triagem não altera credenciais nem publica. A única chamada externa foi um smoke sintético autorizado ao DeepSeek; recebeu HTTP 401 antes de retornar uso/tokens. O ID de requisição foi `ebffe0c0-e2f0-409b-a06c-30f0b302ba3f`.

| Etapa | Evidência local | O que falta para o aceite |
|---|---|---|
| 5. JEV, fatos, embedding e seleção | O catálogo admin permite configurar provedores. O adapter do Radar deixa itens pendentes sem classificador e achados em revisão, sem liberação automática baseada em confiança declarada pelo próprio classificador. A variável DeepSeek preexistente do ambiente recebeu HTTP 401; outra credencial, identificada como `rota_design_system`, passou no smoke sintético do alias `deepseek-v4-flash` com HTTP 200, 43 tokens de entrada e 8 de saída. A API informou `deepseek-flash`; request ID registrado no adendo. O endpoint OpenAI configurado em `localhost:20128` excedeu 5 s. | JEV ainda não tem credencial; o usuário informou que a adicionará depois. Faltam rubricas por notícia/interação, chamada com perguntas distintas, custos/request IDs/cache persistidos, fatos e alegações avaliados, embedding semântico real (o hash local não o substitui), vínculo de retificação, avaliação rotulada e recovery com expiração. |
| 6. Doutrina e redação | Review Inbox existente registra `decision_version`, trava a linha durante ações e admite undo. | Snapshot da skill, contratos por marca/formato, geração e validação GLM com contingência registrada, variantes completas e aprovação ligada ao hash da revisão exata. |
| 7. Templates e render | O registry atual contabiliza 26 composições. Existem canvas, biblioteca, editor e renderer. | Manifesto e 50 composições distintas, conteúdo validado, render de cada peça e inspeção visual; preview/export iguais, dimensões conferidas e composição livre sem preenchimento inventado. |
| 8. Gazeta | O checkout ainda contém uso de Supabase em páginas públicas, área admin, autenticação e uploads. Os candidatos de domínio consultados não resolveram no checkpoint. | Migração validada de dados, Auth, storage e RPCs; domínio/DNS confirmado; deploy e corte de escrita com rollback; smoke test público e admin autorizado. |
| 9. Instagram e canais | O consumer Windows `RotaInstagram30Carrosseis` permanece ativo. O snapshot SQLite da Etapa 0 tinha 27 itens pendentes e quatro publicados. | Portar e ensaiar o consumer substituto; confirmar exclusividade; validar permissões/tokens e envio autorizado por canal com permalink/receipt. Nenhum envio foi feito. |
| 10. Atendimento | O webhook local valida HMAC-SHA256 nos bytes originais e recusa assinatura ou segredo ausente. O fluxo exige IDs reais para Direct e resposta pública; receipts ausentes e resultados ambíguos seguem para revisão sem retry automático. Cinco testes direcionados passaram. Uma leitura à Meta do receipt público de um registro antigo `delivered` retornou HTTP 400, código 100/subcódigo 33, e não confirmou o estado histórico. | JEV, triagem geral, webhook real, janela, paginação/dedup ponta a ponta e receipt verificável; validar envio real autorizado, material R2 e confirmação separada de Direct/resposta pública. |
| 11. Operação completa | Telas de Funil, Review Inbox, Conteúdos, Métricas e Saúde existem. O reteste anterior cobriu estado vazio e páginas administrativas, não a cadeia com dados reais. | Uma fila comum que apresente fontes, conteúdo, revisão, publicação e comprovantes; ações concorrentes por versão; smoke test autenticado com basePath, refresh e retorno de navegação. |
| 12. Insights e continuidade | O checkpoint da Etapa 0 restaurou dumps em bancos descartáveis. | Rotina recorrente de backup, restore e RPO/RTO medidos, coleta real de métricas/UTMs/leads, ensaio de reboot e retorno do túnel/executor, sem perda nem replay. |
| 13. Aceite final | Não iniciado. | Todas as etapas anteriores aceitas e sete dias seguidos de observação com trilhas reais, sem conteúdo artificial para completar amostra. |

As Etapas 5–13 permanecem em estado de preparação ou dependência. A Etapa 4 ainda é o bloqueio sequencial; a Etapa 5 também precisa de credencial válida, conteúdo-fonte integral e avaliação JEV antes de autorizar qualquer classificação automática. Os demais gates externos estão listados na seção anterior e no plano.

## Etapa 6, base local de doutrina e contratos (27/09/2026)

- O skill `rota-social-criativos` foi congelado em `docs/editorial/skill-snapshot/rota-social-criativos/`; o manifesto registra 81 arquivos, 542.634 bytes e hash de árvore `db63969140f529b8036fcff21217fa1a871284c634afd7067fb854253c7c89ce`.
- `apps/design-system/src/server/editorial/copy-contracts.ts` agora descreve os formatos post, carrossel, Story, slide e documento; inclui limites factuais e exige aprovação humana. Os delimitadores de card/tela têm recuperação por parágrafo se o provedor os omitir.
- A nota factual automática em `quality.ts` deixou de receber o valor fixo `0,75`; agora fica nula e não entra na média sem verificação por alegação. `rewriteIfNeeded` mantém o comentário no campo de revisão e não o acrescenta ao texto publicável.
- `docs/editorial/rota-copy-doctrine-2026-09-27.md` resume a versão congelada, precedência de fontes, contratos de formato e gates que seguem abertos.
- A etapa 6 segue parcial: ainda faltam variáveis por canal, vínculos e hashes da revisão exata, geração validada com casos editoriais reais e QA visual. Nada foi aprovado para publicação.
- Verificação local: os dois arquivos novos passaram, 6/6 testes. O build de produção do Design passou. `git diff --check` passou; o Git só informou conversão de LF para CRLF em arquivos editados.

## Etapa 7, manifesto do catálogo (27/09/2026)

- `docs/editorial/template-catalog-50.md` lista os 26 IDs reais do registry e 24 propostas com estruturas e funções próprias. Conferência do manifesto: 50 IDs únicos; os 26 legados foram encontrados.
- O manifesto registra feed/carrossel em 1080 × 1350 px e Story em 1080 × 1920 px, sem paginação visível, barra decorativa ou redução automática de texto.
- Atualização: o registry contém agora 50 composições renderizáveis, incluindo 24 novas. As 50 foram abertas no preview headless; a execução teve zero erros JavaScript. Feed/carrossel medem 1080 × 1350 px; Story mede 1080 × 1920 px.
- Seis composições foram inspecionadas visualmente. As demais ainda precisam de inspeção por peça; também faltam conteúdo editorial validado, equivalência preview/export e aprovação. A Etapa 7 segue parcial.

### Registro de credenciais e chamadas sintéticas

Uma chamada sintética autorizada com a chave identificada como `rota_design_system`, lida em memória do arquivo de credenciais informado, recebeu HTTP 200 no modelo `deepseek-flash`; a resposta JSON foi válida, com 46 tokens de entrada e 5 de saída. Request ID: `42d83d6d-8f6e-4d3d-894b-d892e7dd2461`. A chave não foi copiada para arquivos nem impressa. A variável DeepSeek que já estava no processo retornou 401, por isso os dois resultados não representam a mesma credencial.

O teste sintético do endpoint Z.AI configurado para GLM retornou HTTP 429, código 1305, sem usage ou request ID. Ainda não há evidência de contingência operacional. O código de roteamento primário/contingência fica para a última frente, conforme orientação do usuário.

O usuário informou que adicionará a credencial JEV depois. Ela não foi recebida nem testada, e não foi iniciada chamada JEV. Nenhuma classificação automática, publicação externa, migration persistente ou ativação de agenda foi feita.

## Atualização de execução em 27/09/2026: Etapas 7–9

- Os testes anteriores do editor preservavam expectativas antigas de formato quadrado e texto de demonstração. Foram atualizados para `feed` e para os placeholders atuais. Os cinco arquivos focados passaram, 18/18. Na repetição completa, 39 arquivos e 147 testes passaram. O runner manteve o processo aberto após imprimir o resumo verde; foi interrompido depois da conclusão reportada. O build de produção do Design passou novamente depois dos ajustes de modelo e custo.
- Na Gazeta, a branch local `codex/gazeta-fail-closed-runtime` falha de forma explícita quando Supabase não tem configuração válida; os clientes browser/server não usam URL fictícia e o cliente lazy não simula respostas vazias. Cinco testes Node, typecheck e lint direcionado passaram. Não há URL de banco no checkout nem inventário real dos dados remotos; não houve migração, deploy ou corte. Domínio e DNS continuam sem validação.
- O adapter social classifica timeout, HTTP 408/429/5xx e receipt ausente depois de `media_publish`/`threads_publish` como resultado desconhecido, guarda o ID do container para reconciliação e não repete esse POST. Rejeição 4xx explícita continua como falha. Os testes do pacote passaram, 6/6. O consumer antigo continua ativo; o adapter ainda não está conectado ao executor/ledger. Foi confirmada leitura dos seis IDs históricos; os demais canais e permissões de escrita continuam sem validação, e nenhum novo post foi publicado.
- Nova conferência somente de leitura da SQLite ativa em 27/09: integridade `ok`; 32 posts, 26 `pending` e seis `published`; todos os seis têm ID externo e os seis retornaram HTTP 200 com permalink em consulta à Meta. Há 214 referências de imagens nos 32 posts e um comentário `delivered`. Os 214 arquivos-fonte locais existem; no R2, as 42 derivações usadas pelos seis posts publicados estão presentes e 172 chaves relacionadas a itens pendentes estão ausentes. Nenhum arquivo foi enviado, ID/permalink/legenda/token foi registrado, e não houve mudança no consumer. A leitura confirma os posts históricos, sem autorizar novos envios.
- O padrão local do Design agora usa o alias solicitado `deepseek-v4-flash`. A chave em `Docs/CREDENCIAIS_ROTA.txt` passou por smoke sintético autorizado: HTTP 200, resposta válida, 43 tokens de entrada, 8 de saída, request ID `f9a92159-2b10-419a-bae2-9a95bf683c65`. A API respondeu com o nome do serviço `deepseek-flash`. A chave está no `.env.local` ignorado do Design, com ACL limitada à conta do usuário, Administradores e Sistema; nenhum segredo entrou no Git.
- A [tabela oficial de modelos e preços](https://api-docs.deepseek.com/quick_start/pricing/) informa que os nomes legados `deepseek-v4-flash` e `deepseek-v4-pro` são aceitos por compatibilidade, mas atualmente atendem por V4.1-Flash. O padrão do Design usa tarifa conservadora de pico sem cache: US$ 0,30 por milhão de tokens de entrada e US$ 1,20 por milhão de saída. A estimativa não substitui a cobrança exata por janela/cache.
- A chamada foi somente sintética. Geração editorial com evidências reais e integração JEV continuam pendentes; a credencial JEV ainda será adicionada. A contingência GLM fica para a frente final, conforme orientação do usuário.

## Atualização de execução em 27/09/2026: Etapa 10

- `webhook.py` valida HMAC-SHA256 com os bytes originais do corpo, comparação constante e recusa assinatura ausente/malformada ou segredo de aplicação ausente. A rota mantém o limite de corpo e o desafio GET existentes.
- `automation.py` exige receipts reais para a mensagem privada e a resposta pública. Resposta sem ID, placeholder, JSON inválido com HTTP 200, timeout, falha de conexão e HTTP 408/429/5xx vão para `needs_review`, sem retry automático da operação de resultado desconhecido. A resposta pública só ocorre depois de um receipt válido do Direct.
- Os cinco testes direcionados passaram em Python 3.13 do Windows. A tentativa de repetir no WSL2 falhou antes dos testes porque o ambiente não tem `boto3`; não alterei dependências do ambiente.
- A única linha histórica `delivered` da SQLite teve seu `public_reply_id` e a lista de respostas do comentário consultados na Meta em modo somente leitura; ambas as rotas retornaram HTTP 400, código 100/subcódigo 33. O receipt histórico permanece sem confirmação independente.
- JEV, triagem geral, paginação/dedup completa, janela, ensaio real de webhook e validação de receipt em entrega nova continuam pendentes. Nenhuma mensagem foi enviada, nenhum serviço reiniciado e nenhum estado remoto ou registro SQLite foi alterado.

## Atualização de execução em 27/09/2026: Etapas 11–13

- O pacote `@plataforma/web` passou em 15 arquivos/42 testes no WSL2. O typecheck passou depois de compilar `@plataforma/shared` no checkout descartável; os exports do pacote apontam para `dist`, que não existia nessa cópia inicial.
- Os containers Prospector, Design API, Design web e Caddy estão saudáveis. Em leitura HTTP, os endpoints locais `health/live`, `health/ready` e `/api/health` responderam 200; o endpoint público de readiness também respondeu 200 com validação TLS ativa. As páginas internas de revisão, conteúdo e saúde redirecionaram a sessão anônima para login; `/prospector/login` respondeu 200.
- A tela de login foi aberta e inspecionada visualmente no Edge. O formulário exibiu a mensagem “Credenciais inválidas.” após tentativa com a credencial já salva no navegador. O smoke autenticado das telas, navegação basePath e fluxo com registros reais segue pendente de uma credencial válida.
- O `rota-backup-postgres.timer` do systemd está ativo diariamente às 03:00, `Persistent=true`, atraso aleatório de até cinco minutos. O serviço informa `Result=success` na execução de 27/09 às 03:03:59 e sua unidade é descrita como backup do banco legado `rota_ataque` para R2. Não há evidência nesta etapa de cobertura ou restore do banco editorial, RPO/RTO medidos, métricas reais/UTMs ou recuperação de reboot/rede. `rota-monitor.timer` executa a cada cinco minutos.
- A campanha de sete dias da Etapa 13 ainda não começou. Gates editoriais, JEV, banco compartilhado, fontes, aprovação visual, conta autenticada e canais seguem abertos. Não houve publicação, migration persistente, backup iniciado, restart ou corte de consumer nesta atualização.

## Atualização em 27/09/2026: autenticação local e inbox social

- O usuário esclareceu que as senhas do Prospector e do Design são distintas. No WSL2, encontrei as variáveis de ambiente próprias de cada serviço (`AUTH_PASSWORD` e `DESIGN_API_PASSWORD`). As duas autenticações internas e consultas a rotas protegidas de ambos responderam HTTP 200. Nenhum valor de segredo foi exibido, gravado no relatório ou enviado ao Git. A tela do Edge ainda não passou pelo smoke visual com essas credenciais.
- A migration `0050_meta_inbox_events` cria a tabela `editorial.social_inbox_events`, com deduplicação por conta, tipo, ID e hash da revisão. A agenda `inbox.retention.cleanup` nasce desligada.
- O webhook `/prospector/api/webhooks/meta` responde ao desafio, valida HMAC-SHA256 usando o corpo original e limita o corpo a 1 MiB. Comentários e Direct entram como evento durável e tarefa `inbox.message` dentro da mesma transação. O parser ignora eco e saída, não armazena URLs temporárias e limita o conteúdo persistido.
- A página `/prospector/inbox` exige operador, oferece filtros e paginação e declara que não envia respostas. O executor transfere eventos novos a revisão humana com `jev_credential_pending`, pois a credencial JEV será adicionada mais tarde.
- A retenção apaga texto e identificadores pessoais após 30 dias e remove a linha de deduplicação após 180 dias. O runbook [meta-social-inbox.md](runbooks/meta-social-inbox.md) documenta variáveis, sequência de ativação e recuperação.
- Confirmei que `0048_unified_editorial_cutover` move as tabelas físicas de fila para `editorial` e deixa views de compatibilidade em `public`. Ajustei `0049`, `0050`, store, retry e webhook para gravar e consultar as tabelas físicas no schema correto.
- Alinhei a fixture do Radar ao comportamento atual: com o classificador externo desligado, a notícia fica pendente (`classified=0`) e o último checkpoint representa a coleta. A fixture anterior esperava classificação sem provedor.
- Verificações: migration contracts 9/9; task-runtime 3/3; executor unitário 3/3; executor PostgreSQL descartável 12/12; webhook e middleware 16/16. Typechecks de `@plataforma/db`, `@plataforma/task-runtime`, `@plataforma/worker-editorial-executor` e `@plataforma/web` passaram; `@plataforma/shared` compilou. O script confirmou a remoção do banco e da role de teste.
- A migration 0050 ainda não foi aplicada em banco persistente. Nenhum segredo foi alterado, webhook inscrito, agenda ativada, mensagem enviada ou serviço reiniciado. A tela Inbox autenticada passou no build isolado; o endpoint de eventos ainda falha pela ausência dessa migration. Permanecem pendentes JEV, evento real e receipt, corte do banco compartilhado, backup/restore editorial, aceite das fontes, troca controlada do consumidor e sete dias de observação. A contingência GLM fica para a frente final, conforme solicitado.

## Atualização de execução em 28/09/2026: revisão visual e rota Inbox

- O catálogo completo da Etapa 7 teve 50/50 composições renderizadas e inspecionadas visualmente por folhas de contato. Resultado: feed/carrossel 1080 × 1350, Story 1080 × 1920, texto visível mínimo 20 px, títulos principais detectados a partir de 68 px, sem overflow, erro JavaScript ou travessão. A evidência e os limites estão em [`README.md`](../apps/design-system/docs/qa/template-catalog-2026-09-27/README.md). Conteúdo editorial real, ativos, equivalência de exportação com perfis personalizados e aceite seguem pendentes.
- As senhas distintas foram obtidas dos ambientes dos serviços, sem impressão ou gravação dos valores: `AUTH_PASSWORD` do Prospector e `DESIGN_API_PASSWORD` do Design. O Edge headless autenticou no QA do Prospector, com sessão HTTP 200 e `/prospector/api/theses` HTTP 200.
- A imagem ativa `ghcr.io/leoalvespak-alt/prospector-platform-web:0a90325`, gerada do commit `0a90325`, não inclui `apps/web/src/app/inbox/page.tsx`; o manifesto contém `/review-inbox`, mas não `/inbox`. Esse arquivo existe na árvore local sem commit. Essa diferença entre o código local e a imagem em execução explica o 404 no serviço ativo.
- A partir da árvore atual, compilei uma imagem temporária de QA, sem substituir o serviço ativo. O manifesto e a navegação autenticada confirmaram `/prospector/inbox` em HTTP 200, com título `Inbox social` e zero erros JavaScript. A captura visual está em [`inbox-social.png`](../apps/web/docs/qa/inbox-smoke-2026-09-28/inbox-social.png).
- O endpoint chamado pela tela, `GET /prospector/api/inbox`, respondeu HTTP 500. O log sanitizado registra `relation "editorial.social_inbox_events" does not exist`; a migration `0050_meta_inbox_events` não está aplicada no banco persistente. A captura mostra a falha de consulta, não um total real de eventos. A Etapa 11 segue parcial até a rota entrar no release aprovado e a migration ser aplicada após os gates de banco.
- O alias `host.docker.internal` foi configurado somente no contêiner descartável para alcançar o PostgreSQL durante o smoke. Nenhuma migration persistente, deploy, resposta de mensagem, troca de segredo ou ativação de agenda foi feita. O JEV continua pendente; a validação de contingência GLM permanece para a última frente.

## Atualização de execução em 28/09/2026: consulta de leitura ao Querido Diário

- Usei o endpoint oficial `/gazettes`, com o exemplo de documentação `territory_ids=2700706`, busca `orçamento`, janela recente e uma página pequena. A [documentação da API pública do Querido Diário](https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html) descreve esse endpoint e os dados de gazette/excerto.
- A chamada não chegou a uma resposta HTTP. O Node 24 e Node 22 retornaram alertas de handshake TLS; no Edge, a navegação falhou com `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`. Sem corpo recebido, nenhum item foi gravado.
- A falha descreve o handshake nesta máquina e neste momento; não concluo que o serviço esteja indisponível para outros clientes nem que o parser esteja errado. A validação da Etapa 4 com dados reais continua pendente.

## Atualização de execução em 28/09/2026: migrations no PostgreSQL do WSL2

- O destino foi identificado como PostgreSQL 18.6 da distro Ubuntu no WSL2, database `prospector`, com ledger em `0045_task_runtime`. A conexão de administração usou o socket local como role `postgres`; nenhum valor de senha foi exibido.
- Antes de alterar o banco, criei backup dos databases `prospector` e `rota_design` e das roles globais em `/var/backups/rota-editorial/pre-migrations-20260928T040100Z/`. O diretório pertence a `postgres`, modo 700; os três arquivos estão em modo 600. SHA-256: `prospector.dump` `3d58e4d7d8fe9c0d99e9d39ee17bf2517e0c0b4ac0b093c31cd0c08c02ddd4d3`; `rota_design.dump` `82f6ca10024b5e11ab912f55a37e8085c41b97945d45f849a16fb6305a85e4ee`; `globals.sql` `79dec17e62df2c59e6b503524290c929508cf6f1298ec17032644ef2f8c8947e`. Os dois arquivos custom passaram por `pg_restore --list` e foram restaurados em databases descartáveis.
- Repeti no clone restaurado a sequência completa: migrations Design `0000–0007`, `0032` e `0033` no schema `design`; transferência em modo de ensaio e aplicação; depois migrations do núcleo `0046–0050`. O ensaio completo chegou ao ledger `0050` e criou `editorial.social_inbox_events`. Os clones de teste foram removidos.
- No banco ativo, o runner aplicou `0000–0007`, `0032` e `0033` para preparar o schema `design`. O script de transferência confirmou 53 tabelas e 62 linhas, com hashes/contagens iguais à origem: 26 `editorial_angles`, 8 `editorial_depth_levels`, 15 `editorial_intents`, 1 `editorial_theses`, 11 `prompt_templates` e 1 `users`. O database fonte `rota_design` não foi apagado nem alterado.
- O runner aplicou `0046_shared_editorial_schemas`, `0047_editorial_schema_prep`, `0048_unified_editorial_cutover`, `0049_durable_task_executor` e `0050_meta_inbox_events` em `prospector`. Verificação posterior: todas as cinco versões constam no ledger; `editorial.theses=7`, `editorial.content_items=0`, `editorial.unified_creatives=37`, `editorial.task_runs=0`, `editorial.task_schedules=4`, `editorial.social_inbox_events=0`; a migration de transferência tem um marcador.
- As relações públicas `theses`, `content_items`, `unified_creatives`, `task_runs` e `task_schedules` são views de compatibilidade. `prospector_app` tem `SELECT`/`INSERT` em `social_inbox_events` e `prospector_reader` tem `SELECT`. `inbox.retention.cleanup` está em `destination=local`, `enabled=false`.
- O código do Prospector (`apps/web/src/lib/auth.ts`) compara a senha com `AUTH_PASSWORD`; o Design (`apps/design-system/src/server/api/auth.ts`) compara com `DESIGN_API_PASSWORD`. O Compose fornece valores distintos aos serviços. Usei cada valor do serviço correspondente; os smokes autenticados passaram e nenhum segredo foi registrado. As senhas não foram buscadas no Edge nem reproduzidas aqui.
- Não reiniciei serviços nem publiquei a imagem. A migration remove a causa de banco do HTTP 500 anterior, mas o release ativo ainda não contém a rota `/prospector/inbox`; o reteste autenticado da jornada após migration depende da imagem aprovada. Não houve evento Meta, envio, ativação de agenda ou mudança de credencial. JEV segue para ser acrescentada pelo usuário; o teste de contingência GLM continua reservado para a frente final.

## Atualização de execução em 28/09/2026: executor editorial, TLS e permissões

- O smoke inicial encontrou três bloqueios concretos: Node 22 não executava as exportações TypeScript do workspace no modo strip-only; o certificado autoassinado do PgBouncer era recusado; e o papel prospector_app não tinha acesso às tabelas do executor.
- O pacote do executor agora inicia com tsx como dependência de runtime, com importer correspondente no pnpm-lock.yaml. O Dockerfile instalou com frozen lockfile e compilou o executor. O contexto de build foi temporário e excluiu arquivos .env*.
- O certificado público do PgBouncer em /etc/pgbouncer/tls/server.crt tem SAN para host.docker.internal. Os Compose de produção e editorial agora montam o certificado em modo somente leitura, usam sslmode=verify-full com sslrootcert e removem NODE_TLS_REJECT_UNAUTHORIZED=0. A configuração combinada passou em docker compose config --quiet.
- Antes da mudança de grants, fiz backup de prospector em /var/backups/rota-editorial/pre-0051-task-runtime-20260928/prospector.dump, 682329 bytes, modo 600. SHA-256: d8c1184124fe2646b8f967ec367ebf5439d6f1ee230830cca03c3b86dfddf248.
- A migration 0051_task_runtime_permissions foi aplicada e registrada no ledger. prospector_app recebeu SELECT/INSERT/UPDATE em task_runs, task_schedules e task_outbox; SELECT/INSERT em task_run_audit; SELECT/UPDATE em task_runtime_meta. A verificação confirmou os privilégios, task_runs=0 e enabled_schedules=0.
- Com imagem temporária, CA montada e migration 0051, o executor registrou evento de início, permaneceu ativo e reiniciou com sucesso, registrando um segundo evento. O container foi removido após o smoke. Nenhum job foi enfileirado ou processado, e nenhuma aplicação ativa foi reiniciada.
- A Etapa 3 segue parcial: o smoke de processo e reinício passou, mas a versão atual ainda não está publicada como serviço persistente, a jornada UI/API da imagem ativa permanece pendente e o aceite de job real continua sustentado pelo ensaio anterior com RSS local no banco descartável, sem coleta externa habilitada.

## Atualização de execução em 28/09/2026: nova tentativa da Etapa 4

- A consulta GET de leitura ao endpoint público do Querido Diário foi novamente aberta no Edge usando o filtro documentado, território 2700706, termo orçamento e página limitada. O navegador retornou ERR_SSL_VERSION_OR_CIPHER_MISMATCH em api.queridodiario.ok.org.br.
- O handshake falhou antes da resposta HTTP. Nenhum conteúdo foi salvo, nenhum cursor avançou e nenhum retry de fonte foi agendado. A validação com resposta real permanece pendente.
## Atualização de execução em 28/09/2026: parser real da Etapa 4

- Consultei as três listagens HTTP no Windows com TLS validado. PCI: 200, 100.240 bytes; Ache: 200, 53.091 bytes; Folha: 200, 607.972 bytes. Os hashes, cabeçalhos, rotas e limites constam na matriz de fontes.
- Os três robots.txt permitem as listagens; o PCI desautoriza caminhos de PDF. As fontes publicam sitemaps: PCI (1.005 URLs), Ache (200 URLs com datas de publicação) e Folha (sitemap diário gzip ainda não decodificado pelo worker).
- A execução real revelou categorias falsas do PCI e da Folha no parser. Ajustei o filtro para rotas de notícia /noticias/[slug] no PCI/Ache e /n/[slug] na Folha, com heading isolado quando o link contém heading e chamada. A nova leitura identificou 173, 17 e 44 itens; datas e corpo ainda ficam nulos no Radar.
- Examinei uma página de notícia por fonte, todas HTTP 200: PCI expõe data estruturada e itemprop=articleBody; Ache usa time datetime e post-content; Folha expõe datas estruturadas e article id=article-content. Isso orienta o adapter de detalhes, mas não prova coleta integral.
- Fixtures do parser passaram; a suíte do worker passou 36/36 testes em sete arquivos. A migration 0051 e o smoke temporário de início/restart do executor estão registrados acima.
- A Etapa 4 segue parcial. O runtime não coleta nem persiste corpo, versões, anexos ou paginação/sitemaps. Querido Diário ainda falha no handshake TLS; DOU/INLABS e Business Discovery aguardam resposta real. Nenhuma agenda ou fonte foi ativada.


## Atualização de execução em 28/09/2026: parser e validação da Etapa 4

- A checagem pelo `fetchRssFeed` real retornou PCI 173/0 com data, Ache 200/200 e Folha 95/95. Ache e Folha usam sitemaps; o sitemap diário da Folha foi aberto como gzip. A resposta da Folha trouxe ETag e Last-Modified.
- As páginas de artigo amostradas responderam HTTP 200 com TLS padrão. O parser por portal lê título quando a página fornece um, data, corpo e links PDF do mesmo host. No PCI, o título veio de `og:title`; no Ache e na Folha, veio do detalhe. Os corpos tinham 1.410, 4.406 e 35.118 caracteres. Nenhuma página examinada apontou PDF.
- Os testes do worker passaram: sete arquivos, 41/41 testes. O typecheck e `git diff --check` passaram. A primeira repetição mostrou uma expectativa incorreta do fixture para o texto de um link; a correção passou na repetição seguinte.
- Este parser ainda não é chamado pelo worker e os detalhes não são persistidos. Continuam pendentes histórico/versionamento de respostas, paginação total, evidência de PDFs e contratos reais de Querido Diário, DOU/INLABS e Business Discovery. A Etapa 4 não recebe aceite nesta atualização.
- Após o retorno do WSL2, fazer build local, deploy pela distro e reteste dos fluxos afetados. O usuário autorizou essa sequência para contornar a cota esgotada do GitHub Actions.

## Atualização de execução em 28/09/2026: build local, deploy e reteste

- A release local `0a90325fc16c54bf2eb00f5a` foi gerada no WSL2/Ubuntu, sem GitHub Actions. O `Dockerfile.api` concluiu `pnpm install --frozen-lockfile`; as demais imagens sem alteração funcional receberam a nova tag local. O script de deploy retornou código 0.
- As migrations Prospector e Design concluíram. Prospector web, Design API e Design web foram recriados e ficaram saudáveis; Caddy continuou saudável. O Compose de produção com o overlay editorial passou em `config --quiet`.
- Reteste público: `/prospector/api/health/live`, `/prospector/api/health/ready`, `/api/health` e `/api/ready` responderam HTTP 200.
- A API autenticada listou `deepseek-v4-flash` como configurado e `glm-5.3-flash` como não configurado. O endpoint oficial de teste do provider DeepSeek respondeu HTTP 200, `success=true`, em 1.571 ms. A requisição foi sintética e não continha material editorial de usuário.
- A suíte completa do Design passou, 40 arquivos e 151 testes, incluindo os quatro testes de seleção da contingência. Também passaram o TypeScript estrito de `apps/design-system/src`, o ESLint dos três arquivos da API e `git diff --check`. O Edge recarregou `/prospector/inbox` após o deploy e mostrou a mensagem de acesso para perfil viewer. Os dois erros ainda visíveis no buffer do console têm horário anterior ao deploy; nenhum erro novo foi registrado depois dele. Nenhuma permissão foi ampliada.
- A variável `ZAI_API_KEY_DESIGN_SYSTEM` segue vazia nos ambientes consultados e o arquivo de credenciais indicado não contém título GLM/Z.AI; não houve tentativa de chamada ao GLM. A alternativa GLM-5.3-Flash está no código, mas o smoke real aguarda essa chave. JEV também segue pendente de credencial e integração.
- Nenhuma agenda editorial foi ativada nem houve envio social. As demais pendências e gates descritos acima continuam sem aceite.

## Atualização de execução em 28/09/2026: executor persistente no WSL2

- A release local `0a90325fc16c14f7e61a9c48` foi implantada pelo Ubuntu/WSL2, sem GitHub Actions. Migrations Prospector e Design concluíram; as quatro aplicações públicas responderam HTTP 200 em `/prospector/api/health/live`, `/prospector/api/health/ready`, `/api/health` e `/api/ready`. Prospector web, Design API, Design web e Caddy ficaram saudáveis.
- Para respeitar os artefatos já validados, as imagens de Design sem alteração de fonte receberam a nova tag; migrations, Prospector web e executor foram gerados localmente. O executor usa a CA pública do PgBouncer e exige `0051_task_runtime_permissions`.
- O build inicial falhou porque a dependência `@plataforma/shared` exporta `dist` ainda não gerado. O Dockerfile passou a compilar esse pacote antes do worker; a segunda compilação TypeScript do executor passou.
- A primeira inicialização do unit repetiu falhas porque `docker compose run` rejeita `--no-build`. O serviço foi parado, o wrapper perdeu a opção inválida e o deploy foi repetido com a tag final. Após restart controlado, o unit ficou ativo, `NRestarts=0`, o heartbeat novo está `running` e o anterior está `stopped`. `docker ps` mostrou uma instância do executor.
- Verificação do banco após o deploy: `task_runs=0`, outbox vazia, schedules habilitadas `0/4` e três fontes ativas. Nenhuma coleta, mensagem, publicação ou evento de Inbox foi disparado. O restart ocorreu com fila e outbox vazias.
- A sessão Edge não pôde ser inspecionada nesta rodada: `sky.activate_window` falhou duas vezes com `failed to activate captured window`, inclusive após atualizar a lista. O build do Prospector contém a rota `/inbox`; o smoke visual autenticado segue pendente.
- A Etapa 3 continua parcial: o executor persistente e o restart estão demonstrados, mas não houve job real no banco persistente com falha, checkpoint, retry e recuperação. As etapas e gates externos restantes permanecem como descritos na tabela.

## Atualização de execução em 28/09/2026: detalhes do Radar e deploy local

- Liguei `parseArticleDetails` ao fluxo do `news-radar`. A captura fica restrita às três fontes HTML cadastradas, exige HTTPS e a origem exata da fonte, segue no máximo três redirects da mesma origem, aceita apenas HTML e limita a resposta a 4 MiB. O texto persistido fica limitado a 60.000 caracteres; anexos PDF são guardados como referências e não são baixados.
- A migration `0052_news_item_versions` adiciona estado/horário da busca em `public.news_items` e a tabela `editorial.news_item_versions`, com hash SHA-256 do conteúdo normalizado, parser, título, data, corpo, anexos e validators. Reconsultas usam ETag/Last-Modified; sucesso tem janela de 30 dias, 304 mantém a versão atual e os erros são retentados conforme status. Até dez detalhes são tentados por portal em cada execução. Mudança de conteúdo recoloca o item na classificação; findings ainda em revisão humana recebem os campos de título e URL atualizados.
- Validação local: news-radar 31/31; executor e integração PostgreSQL descartável 12/12; suíte DB 26/26 e teste específico de migrations 9/9; builds TypeScript do worker Radar e executor passaram. A primeira integração falhou por fixture sem `radar_findings`; incluí a estrutura usada pelo fluxo e a repetição passou. O script confirmou a remoção da role e database temporários.
- Antes da migration no database ativo, gerei `/var/backups/rota-editorial/pre-0052-news-details-20260928T134131Z/prospector.dump`, 685.238 bytes, modo 600, owner `postgres`. `pg_restore --list` reconheceu o arquivo. SHA-256: `c3b4d339ed8c72853c65d0502d1b1afb4eba28664368693bc3d3c6d6b0f75581`.
- A release local `0a90325fc16cf3ebc7a4c3bf` foi construída e publicada no Ubuntu/WSL2, sem GitHub Actions. Migration 0052 foi registrada; Prospector web e executor foram compilados localmente. Design API/web não tiveram mudança de fonte desde as imagens previamente verificadas e receberam a tag atual por retag local; os rótulos OCI `version` ainda mostram a release original dessas duas imagens.
- O deploy recriou Prospector web, Design API e Design web, deixou os três saudáveis e reativou o executor no systemd. Os quatro endpoints `/prospector/api/health/live`, `/prospector/api/health/ready`, `/api/health` e `/api/ready` responderam HTTP 200. `rota-editorial-executor.service` está active/running, `Result=success`, `NRestarts=0`.
- Smoke HTTP sem sessão: `/prospector/inbox` respondeu 307 para o login com `callbackUrl` preservado; `/prospector/api/inbox` respondeu 401, conforme a proteção por papel. Isso confirma a barreira de autenticação, não substitui o teste visual com uma conta de operador.
- Verificação no banco: migration 0052 presente; tabela de versões e grants confirmados; 262 notícias preservadas, zero versões criadas por coleta, zero `task_runs`, outbox vazia e schedules habilitadas `0/4`. Nenhuma coleta, publicação ou mensagem foi disparada.
- O teste de UI visual autenticado do Edge segue pendente: a ativação da janela falhou duas vezes na sessão anterior e não foi repetida. Os HTTP checks cobrem readiness e serviço; não substituem a inspeção visual. Também seguem pendentes paginação total, resposta real do Querido Diário, DOU/INLABS, Business Discovery, coleta de PDF/OCR, handler de domínio persistente da Etapa 3, JEV, smoke GLM, eventos reais/receipts e a observação de sete dias.

## Atualização de execução em 28/09/2026: aceite persistente controlado da Etapa 3

- O preflight no PostgreSQL persistente confirmou zero jobs em execução ou na fila, zero eventos ativos na outbox e `0/4` agendas habilitadas. O executor foi parado apenas durante o ensaio e iniciado novamente em seguida.
- A `PostgresTaskRunStore` e a `EditorialTaskSupervisor` da imagem local foram exercitadas com um handler sintético isolado para `editorial-batch.15day`, sem executar coleta, envio, limpeza de retenção ou chamada de provider externo.
- Job `6ffcdff8-0576-47a4-8586-5c4adf4723d0`: falha deliberada antes do checkpoint na tentativa 1; processo encerrado; novo processo retomou sem checkpoint e concluiu na tentativa 2.
- Job `45fb8fad-eaa2-445b-b973-1ec94ceecd28`: checkpoint persistido antes da falha na tentativa 1; processo encerrado; novo processo recuperou o checkpoint e concluiu na tentativa 2.
- A consulta final confirmou ambos `completed`, `attempt=2`, com resultado sintético verificado; migration 0052 presente, outbox ativa zero e agendas `0/4`. O unit voltou `active/running`, `Result=success`, `NRestarts=0`; os quatro endpoints públicos de saúde responderam 200.
- O ensaio cobre recuperação técnica do store/supervisor; handlers de domínio e os demais critérios operacionais da Etapa 3 seguem pendentes. Nenhuma agenda foi habilitada.

## Atualização de execução em 28/09/2026: migration 0053, deploy e validação

- A migration 0053_news_source_pagination passou pelos testes de contrato e pelo ensaio em banco descartável. Antes da aplicação no database ativo, foi criado /var/backups/rota-editorial/pre-0053-news-pagination-20260928T1515Z/prospector.dump, com 690.320 bytes, owner postgres, modo 600; pg_restore --list reconheceu o dump. SHA-256: a71343d9816313ddb94474c141c1b839467929e8062ff4b39578f759d0f6ee76.
- O script deploy/build-and-deploy-editorial-local.sh gerou e publicou localmente a release 0a90325fc16cc3ee15670c4d no WSL2, sem GitHub Actions. As imagens de migrations, Prospector web, Design API, Design web e executor foram geradas localmente. As migrations terminaram, Prospector/Design foram recriados e o executor systemd permaneceu ativo.
- Os endpoints /prospector/api/health/live, /prospector/api/health/ready, /api/health e /api/ready responderam HTTP 200. rota-editorial-executor.service ficou active, Result=success, NRestarts=0.
- O banco confirmou 0053_news_source_pagination, as colunas pagination_cursor e pagination_complete, 262 notícias preservadas, duas tarefas sintéticas concluídas, outbox vazia e schedules habilitadas 0/4. Três fontes seguem ativas. O PCI está com paginação incompleta no estado inicial; nenhuma coleta de fonte foi disparada.
- Validação local após o deploy: workers/news-radar passou 36/36 testes; o Design System passou 40 arquivos e 151 testes com vitest run --maxWorkers=2; o typecheck direto de apps/web passou; os builds TypeScript do Radar e do executor passaram; git diff --check passou.
- Na suíte ampla, os pacotes fora do Design System passaram. Três arquivos do Design System tiveram timeout ao iniciar workers enquanto typecheck/build rodavam junto. A repetição isolada, limitada a dois workers, passou nos 40 arquivos e 151 testes, sem falhas de assertions; considero o primeiro resultado timeout transitório de inicialização. O typecheck direto do Prospector terminou com código 0 e nenhuma mensagem de erro.
- Durante esta verificação, o usuário informou que um deploy separado da plataforma principal está quase concluído na mesma distro WSL2. Nenhum novo build, restart ou migration foi iniciado no WSL2 depois desse aviso.
- JEV segue sem credencial, conforme previsão do usuário. GLM, fontes reais do Querido Diário e DOU/INLABS, Business Discovery, PDF/OCR, handlers de domínio persistentes, receipts reais, inspeção visual autenticada e observação de sete dias continuam como gates. Nenhuma agenda, coleta, mensagem ou publicação foi ativada.

## Checkpoint de pausa e pendências para aceite total (28/09/2026)

O usuário pediu para suspender o trabalho até inserir as credenciais pendentes e avisar que podemos retomar. Estado registrado no plano principal, seção 31. Não iniciar build, deploy, migration, coleta, envio ou chamada autenticada antes desse aviso.

Concluído e conferido: migrations 0046–0053 no PostgreSQL compartilhado; release local 0a90325fc16cc3ee15670c4d saudável; quatro health checks HTTP 200; executor ativo com NRestarts=0; migrations 0052/0053, detalhes e paginação persistidos; dois ensaios sintéticos persistentes concluídos na tentativa 2; DeepSeek V4 Flash passou smoke; Design System 40 arquivos/151 testes; Radar 36/36; testes DB 26/26, integração executor 12/12 e contratos de migrations 9/9; typecheck do Prospector web e builds TypeScript do Radar/executor passaram. A revisão visual do catálogo de 50 composições também está registrada.

Estado de dados: 262 notícias históricas, duas tarefas sintéticas, outbox vazia, três fontes ativas, agendas 0/4; nenhuma coleta ou publicação produtiva. A automação Edge não permitiu revisar a sessão autenticada nesta rodada. Um deploy separado da plataforma principal está ocorrendo na mesma distro WSL2, e nenhum comando nosso foi iniciado ali após o aviso.

Pendências de aceite: acesso/domínio/DNS/Supabase da Gazeta; handler e recuperação de domínio persistentes da Etapa 3; validação de fonte real QD/DOU/INLABS/Business Discovery e decisões PDF/OCR; JEV, GLM, rubricagem de ao menos 200 casos e embeddings; conteúdo/ativos/exportação real; canais Meta com webhook e receipts; demonstração visual autenticada; backup/restore, RPO/RTO e métricas com dados; sete dias de observação.

Credenciais a inserir em ambiente seguro: OPENROUTER_API_KEY para JEV; ZAI_API_KEY_DESIGN_SYSTEM para GLM; conta INLABS; acessos ao domínio/DNS e Supabase da Gazeta; variáveis Meta listadas na seção 31 se os canais fizerem parte do aceite. FAL_API_KEY, PEXELS_API_KEY, RESEND_API_KEY, BREVO_API_KEY e credenciais WhatsApp são condicionais ao uso desses canais. A chave DeepSeek já está configurada. O usuário não deve enviar valores secretos por chat nem gravá-los no Git.

## Retomada e checkpoint editorial (28/09/2026)

O usuário retomou o trabalho e confirmou credenciais nos arquivos protegidos. Este registro substitui a pausa descrita acima. A Gazeta usará PostgreSQL no WSL2, database `prospector`, schema `gazeta`; dados Supabase de teste podem ser descartados. DeepSeek V4 Flash fica como modelo principal e OpenRouter/GLM 5.3 Flash como fallback. FAL, Meta, R2 e Pexels foram lidos das fontes indicadas pelo usuário, sem copiar valores secretos para este arquivo.

### Alterações prontas no checkout

- Arquivo recuperável com as 50 oportunidades antigas: `/home/deploy/rota-editorial-backups/content-opportunities-legacy-20260928.json`, modo 0600. A validação do banco confirmou 50 IDs únicos, 50 registros ativos com status `new`, 30 criativos `ready` ligados por `content_opportunity_id` e 30 publicações agendadas.
- Migrations `0054_archive_legacy_content_opportunities` e `0055_editorial_news_automation` preparadas. A primeira permite `archived`; a segunda agenda a coleta incremental às 12:00 e 20:00 de `America/Sao_Paulo`. Ambas seguem pendentes de aplicação até o build editorial completar.
- A tela de oportunidades exclui registros arquivados. Após as migrations, arquivar somente os 50 IDs do backup, mantendo os criativos e os agendamentos associados.
- O Radar agora cria uma oportunidade para cada sinal novo em uma transação idempotente. Classificação mantém revisão humana e não autoriza publicação automática.
- Modelo Prospector: DeepSeek V4 Flash principal e GLM via OpenRouter como contingência. O Design API está configurado para DeepSeek e GLM via a mesma credencial OpenRouter indicada pelo usuário.
- Design System recebeu diretrizes novas da skill `rota-social-criativos`: texto concreto e aplicável; escolha entre entrada direta e narrativa; cena hipotética marcada como didática; veto a depoimento inventado; legenda com contribuição própria; CTA com ação e destino confirmados. O formulário de calendário agora gera legenda com campos separados para copy da mídia, fatos/fontes e ação confirmada. O modelo inicial passou a DeepSeek.

### Verificações concluídas

- `workers/news-radar`: 38 testes passaram; typecheck passou.
- `packages/db`: 30 testes passaram. `packages/task-runtime`: 9 testes passaram e typecheck passou.
- Teste PostgreSQL descartável: 12 testes do executor e 12 contratos de migration passaram; o banco e a role aleatórios foram removidos.
- Design System: 6 testes de contrato de copy e 4 testes de domínio passaram; `tsc -p tsconfig.json --noEmit` passou; build Vite gerou 2.578 módulos.
- Compose editorial validado com tag temporária; banco de teste conferiu a relação direta dos 30 criativos prontos e 30 agendamentos legados.

### Deploy e aceite ainda pendentes

- O primeiro build local foi interrompido antes de migrations ou promoção porque uma regra de copy mudou após o cálculo da tag. Na segunda tentativa, foi detectado um build da plataforma principal no mesmo WSL2. O script editorial foi cancelado antes de iniciar qualquer migration; somente o build principal `rota-frontend` permaneceu ativo. Containers e dados não foram alterados por essas tentativas.
- Aguardar o fim do build da plataforma principal; depois refazer o build local completo, aplicar 0054/0055, arquivar os 50 IDs, conferir que os 30 criativos e 30 agendamentos continuam, testar quatro endpoints de saúde e rever Sistema/Oportunidades no Edge.
- O agendador está pronto para duas coletas diárias. Não há push/WebSub configurado para fontes RSS/API; até isso existir, RSS, APIs e páginas seguem o mesmo limite de 12h/20h.
- O executor durável ainda registra Radar e Inbox. Os antigos `content-opportunity` e `content-item-orchestrator` não têm handlers atuais; não marcar flags como habilitadas sem consumidores reais.
- Geração de legenda/copy no Design System está conectada à skill, mas o Radar não produz arte visual, não há upload de mídia pública nem handler Meta para carrossel com receipt. O JEV ainda não valida afirmações por trecho de fonte. Portanto, publicação automática de notícias permanece pendente de verificação factual, render/carrossel, mídia pública e confirmação de publicação.
- A próxima janela do Radar será 20h local, depois que a migration estiver ativa. Nenhuma coleta produtiva ou publicação foi disparada nesta retomada.

### Atualização de deploy e workers (28/09/2026)

- A revisão do script de build encontrou `EDITORIAL_EXECUTOR_ENABLED` ausente do ambiente local. O helper de build agora solicita explicitamente ao deploy a ativação do executor durável, que executa os handlers atuais de Radar e Inbox por systemd. Os workers legados `content-opportunity` e `content-item-orchestrator` continuam sem handlers compatíveis e não serão apresentados como ativos.
- O build da plataforma principal foi visto no WSL2 como processo Docker ainda ativo após 44 minutos. Uma invocação curta de `ps` ficou retida pelo serviço WSL; ela foi interrompida sem sinalizar nem alterar o processo Docker. A distro continua listada como Running, mas outra execução retorna `Wsl/Service/0x8007274c`.
- Não iniciamos build editorial, migrations, promoção de containers, coleta ou alteração no banco. Assim que o build principal terminar e o WSL responder, refazer o build com o script atualizado, promover, arquivar exatamente os 50 IDs e validar a preservação dos 30 criativos e 30 agendamentos.
- Nova tentativa: o processo Docker ainda constava ativo aos 48 minutos; a consulta seguinte travou e foi cancelada sem alcançar o processo. `wsl.exe --list --verbose` continuou mostrando Ubuntu como Running. `git diff --check` passou depois das alterações.

## Atualização de execução em 28/09/2026: release implantada, arquivo legado e reteste do sistema

- O build local no Ubuntu/WSL2 e a promoção foram concluídos na release `0a90325fc16c3618187a568d`, sem GitHub Actions. Os serviços Prospector web, Design API e Design web ficaram saudáveis; `rota-editorial-executor.service` está `active/running`, `Result=success`, `NRestarts=0`.
- Os quatro endpoints `/prospector/api/health/live`, `/prospector/api/health/ready`, `/api/health` e `/api/ready` responderam HTTP 200 após a promoção.
- Arquivei somente os 50 IDs do lote legado. Backup recuperável: `/home/deploy/rota-editorial-backups/content-opportunities-legacy-20260928.json`, modo 0600. Verificação no PostgreSQL: 50 arquivadas, zero ativas entre os IDs; 30 criativos e 30 publicações relacionadas continuam `ready`.
- A migration 0055 deixou `news-radar.daily` ativa em `America/Sao_Paulo`, às 12:00 e 20:00, no modo incremental. A busca não passou de duas janelas previstas por dia. Nenhuma coleta produtiva, mensagem ou publicação foi disparada durante o reteste.
- `/prospector/sistema/saude` ficou em estado OK, score 100, zero tarefas atrasadas/pendentes/falhas e um executor ativo. A tela de oportunidades mostrou 0 oportunidades ativas e o estado vazio. As telas foram vistas no Edge após o deploy.
- Corrigi a query da tela de saúde para ler `editorial.task_runs`, pois a view de compatibilidade `public.task_runs` não apresentava as colunas adicionadas nas migrations posteriores. O cálculo de workers ignora heartbeats históricos em estado `stopped` e considera o executor persistente ativo. Suíte específica: 3 testes passaram; typecheck direcionado dos arquivos alterados passou.
- O executor durável registra `news-radar.daily`, `inbox.message` e `inbox.retention.cleanup`. Os workers antigos `content-opportunity` e `content-item-orchestrator` continuam desativados: ainda não têm handlers no executor durável, e o segundo apenas sugere despacho para uma fila de publicação não conectada. Não alterei suas flags para parecerem ativos.
- As novas diretrizes da skill de criativos estão na geração de copy/legendas do Design System: texto concreto; opção direta ou narrativa; cena didática sem testemunho inventado; legenda que acrescenta informação; CTA ligado a ação e destino reais. DeepSeek V4 Flash é o principal e OpenRouter/GLM-5.3-Flash é o fallback configurado. Falta smoke dedicado do fallback.
- O build Next de produção concluiu, porém registrou que omitiu validação de tipos e lint. O typecheck completo de `apps/web` ultrapassou o limite de recurso/tempo e foi interrompido; os checks direcionados passaram. Portanto, o typecheck integral do Prospector web não está atestado por esta release.
- Pendências para 100%: handlers duráveis e produtores para os dois workers antigos; fluxo JEV com calibração e evidência por afirmação; coleta real de Querido Diário, DOU-INLABS e Business Discovery; decisões e testes de PDF/OCR; geração/renderização real de carrossel, upload R2, publicação Meta e receipts; Inbox com perfil operador e webhook real; backup/restore/RPO/RTO; integração da Gazeta com domínio confirmado; sete dias de observação.
- A antiga pendência de gerar uma chave Z.ai foi substituída pela decisão registrada do usuário: GLM usa a credencial OpenRouter existente. JEV ainda precisa ser conectado e calibrado como verificador. Nenhum valor secreto foi inserido neste relatório.
