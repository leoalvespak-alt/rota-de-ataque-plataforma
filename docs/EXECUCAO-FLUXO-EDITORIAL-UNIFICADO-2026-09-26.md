# Registro de execução: fluxo editorial unificado

Data de início: 26/09/2026. Repositório operacional: `Sistema de Design/plataforma`, branch `main`, base `5a454df897a811885b1a3c0abf5055cf3c7b5698`. Este registro distingue o código local do estado implantado.

## Estado por etapa

| Etapa | Estado | Evidência e pendência |
|---|---|---|
| 0. Inventário e checkpoint | Parcialmente concluída | Checkouts, dados, containers, timers, browser, backup e restore foram conferidos. Domínio da Gazeta e capacidades de conta ainda aguardam confirmação/acesso. |
| 1. Destravar a operação | Codificada e testada localmente | Pool por processo, transação do Radar, SQL de métrica e health/ledger foram corrigidos. A validação de produção e a navegação após deploy continuam pendentes. |
| 2–13 | Ainda não iniciadas | Dependem da Etapa 1 implantada, auditoria detalhada por entidade e, nas etapas posteriores, executor, provedores, domínio, contas, aprovação editorial, publicações reais e observação de sete dias. |

## Etapa 0: backups e estado observado

- Snapshot SQLite online em `Rota Criativos e automacao/automacao_instagram/data/backups/instagram-unified-checkpoint-20260926.sqlite3`; integridade `ok`, 94.208 bytes, SHA-256 `7619bba1d488e1269a5ce4b7cf981ef172e80f4e6b2aee9ae69b9d2ecda13c48`. Snapshot tardio também foi verificado e teve o mesmo hash.
- PostgreSQL: dumps de `prospector`, `rota_design` e roles globais foram enviados com nomes exclusivos ao prefixo R2 `backups-postgres/editorial-unified/20260927T003712Z`. Cada objeto foi baixado, restaurado em database descartável, conferido e removido do banco descartável. O restore conferiu `pgvector`, grants e contagens: Prospector `news_items=262`, `radar_findings=0`, `task_runs=0`, `task_schedules=3`, migration `0045_task_runtime`; Design `unified_creatives=0`, `editorial_theses=1`. Nenhuma migration ou escrita foi feita nos bancos de produção.
- O bucket R2 usado não teve a configuração de acesso público auditada nesta etapa. A documentação do serviço informa TLS no trânsito e criptografia AES-256 em repouso ([segurança do R2](https://developers.cloudflare.com/r2/reference/data-security/)). A criptografia BitLocker do volume Windows não pôde ser consultada sem elevação administrativa.
- Há uma tarefa agendada do Windows chamada `RotaInstagram30Carrosseis` em execução, com 27 posts pendentes e quatro publicados no snapshot. Ela foi mantida ativa; a troca exige um consumidor substituto testado e confirmação de exclusividade.
- Os três horários editoriais de PostgreSQL estavam desativados. Não houve restart, publicação, envio, disparo de tarefa ou deploy.
- Os domínios `gazetadosconcursos.com.br` e `gazetaconcursos.com.br` falharam em DNS no navegador. A identificação do domínio oficial segue pendente.
- A leitura visual do Prospector autenticado reproduziu no Radar o erro `Unexpected end of JSON input`, com estado `Indisponível`. Não havia conector Playwright ou Chrome DevTools disponível para capturar Console/Network; a correlação foi feita com o handler e o pool cacheado no código.

## Etapa 1: mudanças locais

- Removido `pool.end()` dos Server Components e do endpoint `/api/dashboard/today`. `createDatabase()` devolve um pool singleton por processo; um handler não deve encerrar conexões que outras requisições usam.
- Radar agora atualiza `news_items.classified` e insere `radar_findings` na mesma transação. O `ON CONFLICT` declara a condição `fingerprint IS NOT NULL` exigida pelo índice único parcial. Falha no insert faz rollback da classificação.
- Métrica de qualidade só agrega valores JSONB numéricos entre 0 e 1. Ausência ou tipo inválido não vira zero nem derruba `avg(text)`. A interface apresenta estados de carregamento, erro com nova tentativa, dados e ausência de qualidade válida.
- Health usa por padrão a migration `0045_task_runtime`, consulta estados reais de `task_runs` e `task_schedules` e informa backlog vencido/execução parada. A tela de saúde deixou de mostrar filas e falhas como zeros fixos e lista as agendas do banco.
- Arquitetura do Design foi documentada em `apps/design-system/docs/architecture/`; o documento canônico atualiza o contrato local e a situação de produção sem declarar executor ativo.

### Verificação local

- Testes direcionados passaram após os últimos ajustes: Prospector web, 4; Radar, 7; Design System, 5.
- Build de produção do Design System passou. Typecheck do worker Radar passou.
- Typechecks do Prospector web e do worker Radar passaram após tornar opcional a nova prop usada pela tela de saúde. Build de produção do Design System passou.
- `git diff --check` passou.
- `docs:architecture:check` passou depois que os oito documentos faltantes de arquitetura foram criados. O `context:check` sinalizou CodeGraph; a raiz não contém `.codegraph/` e, pelas instruções locais, o índice não foi inicializado.

## Gates que seguem abertos

- Confirmar o domínio público oficial da Gazeta e receber acesso DNS/admin correspondente.
- Implantar a Etapa 1 numa janela controlada e retestar Pulso, Radar, Funil, Teses e Lotes em ordens diferentes, sem restart entre navegações.
- Não habilitar schedules nem desativar o publicador legado antes de instalar e testar o executor substituto, seus retries e recovery.
- Obter/validar credenciais e permissões de provedores e contas; aprovar as versões exatas de conteúdo não noticioso antes de publicar.
- Migrar Design e Gazeta com mapeamento completo e rollback; ligar canais por receipt real; executar os ensaios de continuidade e a campanha natural de sete dias.

O checkout está com alterações locais não commitadas. Nenhum push foi feito porque ele aciona deploy automático e os gates de produção acima não foram aceitos.
