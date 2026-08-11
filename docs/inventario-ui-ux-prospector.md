# Inventário executável do Prospector

Atualizado em 2026-08-11. Toda rota abaixo usa a campanha persistida no cookie `prospector_campaign`, respeita a sessão e apresenta estado vazio real quando não há registros.

| Domínio | Rotas | Leituras reais | Mutações visíveis |
| --- | --- | --- | --- |
| Visão e inteligência | `/`, `/radar`, `/competitive-intel`, `/community`, `/source-roi`, `/timeline` | banco PostgreSQL via camada `dashboard-data` | atualizar preservando o último dado válido |
| Prospecção | `/leads`, `/review-inbox`, `/identities` | scores, fontes, interações, evidências e snapshots | preparar follow, aprovar/editar/rejeitar/bloquear/adiar, merge e rollback |
| Conteúdo | `/theses`, `/content-opportunity`, `/content-items`, `/content-items/[id]`, `/creative-bridge`, `/publishing` | teses, oportunidades, variantes, performance e publicações | criar/ativar tese, editar/aprovar/rejeitar oportunidade, aprovar/arquivar/forkar conteúdo, abrir editor |
| Mercado | `/market-radar` | sinais, evidências e watches Reddit | criar watch quando a integração estiver configurada |
| Relacionamento | `/conversations`, `/email-flows`, `/contact-policies`, `/engagement-queue` | conversas, mensagens, templates, inscritos, políticas, fila e quotas | preparar mensagem, criar/ativar fluxo, salvar/simular política, aprovar/rejeitar/reprocessar ação |
| Administração | `/accounts`, `/configs`, `/notifications`, `/system-health` | contas, capacidades, scoring, alertas, entregas, heartbeats e canários | OAuth/sync/concorrente, prévia e gravação de scoring, toggle/teste de notificação, kill-switch |
| Acesso e ajuda | `/login`, `/docs/runbooks/[slug]` | estado de autenticação e runbooks versionados | solicitar OTP, autenticar e seguir recuperação operacional |

## Estados obrigatórios

Cada lista cobre cheio, vazio e filtrado. As rotas dinâmicas usam skeleton com geometria estável; as atualizações mantêm o último resultado; falhas exibem mensagem acionável, identificador e runbook. Integrações sem variáveis aparecem como **Não configuradas**, sem sucesso simulado e sem revelar valores secretos.

## Contrato de controles

Controles decorativos foram removidos. Botões de mutação usam handler, endpoint, estado ocupado e resposta de sucesso/erro. Controles indisponíveis ficam desabilitados com explicação próxima. O teste `production-ui-guardrails.test.ts` impede o retorno de formulários por UUID/JSON, fixtures ou componentes genéricos de demonstração.
