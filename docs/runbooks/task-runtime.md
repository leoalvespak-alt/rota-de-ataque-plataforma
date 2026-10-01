# Runtime de tarefas editoriais

## Estado de implantação

O runtime inclui store PostgreSQL, leases, heartbeat, checkpoints, tentativas, recuperação após lease vencido, outbox transacional e supervisor por lanes. Em 28/09/2026, as migrations 0046 a 0053 foram aplicadas no database prospector do PostgreSQL no WSL2, com backup anterior à migration 0053 e ensaio em database descartável. As migrations do Design foram aplicadas no schema design, e 53 tabelas com 62 linhas foram transferidas de rota_design. A release local `0a90325fc16cc3ee15670c4d` está ativa; Design e Prospector usam o banco compartilhado. O unit `rota-editorial-executor.service` está habilitado e ativo, com heartbeat recente. Após o deploy, `NRestarts=0`; os quatro endpoints públicos de saúde responderam 200. O ensaio persistente deixou dois jobs sintéticos concluídos, zero jobs em execução ou na fila, outbox ativa vazia, quatro agendas desativadas e 262 notícias preservadas. A migration 0051 concede ao prospector_app os privilégios do runtime; a 0052 registra versões de detalhes em editorial.news_item_versions e concede grants ao prospector_app e ao prospector_reader; a 0053 guarda o cursor e a conclusão da paginação.

O Compose mantém EDITORIAL_EXECUTOR_ENABLED=false por padrão. A unidade systemd inicia deploy/run-editorial-executor.sh, que ativa essa variável só para o processo supervisionado. O código registra news-radar.daily, inbox.message e inbox.retention.cleanup; cada handler só deve receber jobs depois do aceite funcional do respectivo fluxo. As quatro schedules ficam desativadas e a fila permanece vazia até esses gates. O overlay Compose mantém o executor no perfil editorial-runtime, com TLS verificado pelo certificado público do PgBouncer montado em modo somente leitura e migration esperada `0053_news_source_pagination`.

## Ensaio PostgreSQL descartável no WSL2

Na raiz de `plataforma`, execute:

```powershell
rtk powershell -NoProfile -File .\scripts\test-task-runtime-disposable.ps1
```

O script cria um database e uma role com nomes aleatórios sob o prefixo `codex_task_runtime_test_`, conecta ao IP atual da distribuição WSL2 e os remove no `finally`. A conexão usa o IP da distribuição porque `localhost:5432` no Windows chega a outro serviço PostgreSQL. O ensaio não usa `prospector`, `rota_design`, `rota_ataque` ou qualquer database persistente.

Os testes cobrem idempotência de publicação, recuperação de lease e checkpoint, retry, separação de lanes, agenda, singleton/kill-switch, shutdown, outbox e um job do Radar com RSS local. As chamadas ao classificador externo ficam desligadas nesse fixture.

## Ensaio persistente controlado

Em 28/09/2026, a `PostgresTaskRunStore` e a `EditorialTaskSupervisor` da imagem ativa foram exercitadas no database persistente com handler sintético isolado para `editorial-batch.15day`. O teste não chama o handler de domínio, fontes, Inbox, retenção ou provider externo. Deixou duas linhas concluídas para auditoria: `6ffcdff8-0576-47a4-8586-5c4adf4723d0` falhou antes do checkpoint e retomou sem checkpoint; `45fb8fad-eaa2-445b-b973-1ec94ceecd28` falhou após salvar checkpoint e retomou com o mesmo valor. Ambos concluíram na tentativa 2 após a troca de processo. Nenhuma schedule foi habilitada e a outbox permaneceu vazia.

## Operação do supervisor

- A inicialização exige a migration configurada em EXPECTED_DB_MIGRATION, por padrão `0053_news_source_pagination`.
- A conexão com o PgBouncer usa sslmode=verify-full e sslrootcert apontando ao certificado público montado em /run/pgbouncer/server.crt. Não definir NODE_TLS_REJECT_UNAUTHORIZED.
- A liderança é mantida por advisory lock PostgreSQL; apenas o processo líder reivindica jobs.
- A fila ordena por prioridade, vencimento e criação. `heavy`, `publishing`, `inbound` e `default` têm limites separados.
- Cada claim aumenta a tentativa e define lease. O heartbeat estende o lease; checkpoints só são aceitos pelo proprietário atual.
- Conclusão da tarefa e gravação dos eventos da outbox ocorrem na mesma transação. Entregas devem ser idempotentes por `event_key`, pois uma falha depois do envio externo pode exigir repetição.
- O encerramento aguarda o tick e os handlers em curso. Ao exceder a tolerância, cancela o sinal dos handlers; o handler do Radar propaga esse sinal à coleta e ao classificador.

## Kill-switch e repetição manual

O kill-switch global do executor impede materialização de agendas, claims de novas tarefas e claims da outbox. Não cancela trabalho em curso. O controle não encerra o consumidor legado; mantenha o procedimento operacional próprio desse consumidor até a troca comprovada.

`POST /api/task-runs/[id]/retry` é restrito a admin, aceita apenas UUID de job falho, conserva o checkpoint, registra auditoria e acrescenta uma tentativa ao limite. Repetir um job não aprova nem autoriza publicação. Confirme a revisão editorial, o estado de aprovação e a idempotência antes de qualquer ação externa.

## Operação após o corte

O corte da Etapa 2 foi aplicado em 28/09/2026, com backup/restauração, marcador de transferência, migrations e validação do banco compartilhado registrados no relatório de execução. O executor exige a migration `0053_news_source_pagination`, que sucede a `0052_news_item_versions`.

Confira estado e heartbeat antes de qualquer restart. Só reinicie com `task_runs` sem itens em processamento; mantenha as agendas desligadas enquanto os handlers, fontes e canais não tiverem aceite funcional. Os comandos de operação no Ubuntu/WSL2 são:

```bash
sudo systemctl status rota-editorial-executor.service --no-pager
sudo journalctl -u rota-editorial-executor.service -n 50 --no-pager
sudo systemctl restart rota-editorial-executor.service
sudo systemctl stop rota-editorial-executor.service
```

O wrapper usa `docker compose run --rm --no-deps editorial-executor`; `compose run` não aceita `--no-build`. Antes de desativar qualquer consumidor legado, compare estado, receipts, retry e exclusividade de execução.

## Observabilidade

A tela de Saúde apresenta status, tentativa, lane, prioridade, checkpoint e presença de erro, sem expor payload ou texto integral de erro. `p95_latency_ms` fica nulo até que exista uma medição real. Falhas repetíveis voltam a `retry_scheduled`; ao atingir `max_attempts`, ficam `failed` e emitem evento de falha na outbox.
