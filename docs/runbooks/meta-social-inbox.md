# Inbox social da Meta

Status: código e ensaio em banco descartável concluídos. A migration `0050_meta_inbox_events`, a inscrição do webhook, a agenda de retenção e qualquer resposta externa continuam desligadas.

## Comportamento atual

- A rota fica em `/prospector/api/webhooks/meta`.
- `GET` responde ao desafio de verificação da Meta com `META_WEBHOOK_VERIFY_TOKEN`.
- `POST` valida `X-Hub-Signature-256` sobre os bytes originais, limita o corpo a 1 MiB e grava cada revisão do evento junto da tarefa `inbox.message` na mesma transação.
- Comentários e mensagens recebidos entram em `/prospector/inbox`, acessível a operadores. O inbox não envia respostas.
- Como a credencial JEV ainda será adicionada, o handler coloca cada evento em `needs_human_review` com o motivo `jev_credential_pending`.
- A rotina `inbox.retention.cleanup` remove texto e identificadores pessoais após 30 dias e apaga a linha de deduplicação após 180 dias. A agenda é criada desativada.
- URLs temporárias de anexos não são armazenadas nem escritas em logs.

## Configuração

Defina os segredos no ambiente protegido do Prospector, nunca no Git ou nos logs:

- `META_APP_SECRET`: segredo da aplicação Meta usado para conferir assinaturas.
- `META_WEBHOOK_VERIFY_TOKEN`: token aleatório definido também no painel Meta para o desafio `GET`.
- `DATABASE_URL`: conexão da aplicação ao banco editorial depois do corte aprovado.

O endpoint deve estar disponível por HTTPS no domínio confirmado. O caminho externo esperado é `/prospector/api/webhooks/meta`.

## Sequência para ativação futura

1. Concluir o corte compartilhado do banco e confirmar backup e restore recentes.
2. Aplicar `0049_durable_task_executor` e `0050_meta_inbox_events` na ordem, mantendo agendas desativadas.
3. Publicar o Prospector e o executor que registra `inbox.message` e `inbox.retention.cleanup`; conferir que há apenas um consumidor ativo para essas tarefas.
4. Configurar os dois segredos da Meta, validar HTTPS e concluir o desafio `GET` sem registrar o token.
5. Configurar no painel Meta apenas os campos de webhook aprovados para a conta conectada. Confirmar o recebimento assinado de um evento de ensaio, sua revisão, a tarefa única e a linha correspondente na tela.
6. Reenviar o mesmo evento e confirmar que a combinação conta, tipo, ID e hash de revisão evita duplicação; uma revisão editada deve gerar outra linha.
7. Ligar a agenda diária de retenção somente depois de confirmar o executor e verificar os limites de 30 e 180 dias.
8. Quando a credencial JEV estiver disponível, validar a rubrica e a triagem com exemplos rotulados. Manter respostas automáticas desligadas até existir validação editorial, janela vigente e receipt verificável.

## Operação e falhas

- `503 webhook_not_configured`: conferir presença dos segredos e da conexão, sem imprimir seus valores.
- `403 invalid_signature`: conferir o segredo configurado e a preservação do corpo original pelo proxy.
- `503 webhook_persistence_unavailable` ou `503 webhook_persistence_failed`: conferir a saúde do banco e repetir a entrega pelo mecanismo da Meta; a deduplicação protege uma repetição aceita.
- Eventos que aguardam decisão aparecem como revisão humana. Não marcar como respondidos: este fluxo não contém envio de Direct ou resposta pública.
- A tela apresenta a janela de resposta registrada para comentários. Ela não substitui a confirmação das regras e permissões vigentes no painel da conta.

## Verificações locais

Os testes unitários cobrem assinatura, desafio, limite de corpo, parsing, eco e deduplicação. O ensaio PostgreSQL descartável aplica `0050`, confere a agenda desativada, aceita revisões, remove dados pessoais e apaga registros vencidos. Nenhuma migration persistente ou inscrição externa foi feita nesta execução.
