# Inventário executável do Prospector

Atualizado em 2026-08-12. Este documento mapeia todas as ~28 rotas da aplicação Prospector (Next.js), documentando dependências de banco, chamadas de API, mutações, componentes de controle visual e o suporte aos 10 estados assíncronos fundamentais.

*Status Assíncronos Mapeados:* `initial_loading`, `refreshing`, `success`, `empty`, `filtered_empty`, `not_configured`, `partial`, `blocked`, `error`, `offline/reconnecting`.

---

## 1. Rotas de Dashboards (Componente `DashboardPage`)
Estas rotas utilizam o componente base de Dashboard que encapsula sua própria lógica de apresentação.

- `/` (Overview): Aquisição, funil, relacionamento e saúde da campanha ativa.
- `/community` (Mapa de comunidades): Clusters e relações entre leads.
- `/competitive-intel` (Inteligência competitiva): Temas, dores, perguntas e hooks.
- `/radar` (Radar): Posts em ascensão e oportunidades quase em tempo real.
- `/source-roi` (ROI por origem): Qualidade, retenção e conversão por origem.
- `/timeline` (Timeline): Histórico unificado.

---

## 2. `/accounts` (Contas Meta)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT accounts, action_policies, competitors, campaigns, account_health` |
| **Endpoints/APIs** | GET `/prospector/api/admin/competitors/validate`, PATCH `/prospector/api/admin/accounts/:id/policies`, POST/PATCH `/prospector/api/admin/competitors`, GET `/prospector/api/meta/oauth/start` |
| **Mutações** | Toggle de política, Adição/Edição de concorrente |
| **Tabelas** | `accounts`, `action_policies`, `competitors`, `campaign_competitors`, `campaigns`, `account_health` |
| **Papéis** | `collector`, `actor` |

**Controles Visíveis:**
- **Checkbox (Política):** Handler: `togglePolicy`. Efeito: PATCH API. Erro: Tratamento nativo invisível. Auditoria: Indireta.
- **Form (Novo Concorrente):** Handler: `addCompetitor`. Efeito: POST API e `location.reload()`. Erro: Tratamento nativo.
- **Select/Range (Status/Peso):** Handler: `updateCompetitor`. Efeito: PATCH API. Atualiza UI state.
- **Input (Username):** Efeito: Debounced GET para validação Meta. Trata erro/indisponibilidade (exibe mensagem).
- **Link (Vincular Meta):** Redireciona para início do fluxo OAuth.

**Estados Assíncronos:**
- **Implementados:** `initial_loading` (Next SSR), `success`, `error` (parâmetro de erro na URL e mensagem), `empty` (conta não vinculada), `blocked` (Conta interrompida/Danger banner), `partial` (Validação Meta indisponível).
- **Faltam:** `offline/reconnecting`, `filtered_empty`.

---

## 3. `/ai-settings` (Modelos de IA)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT ai_providers`, `SELECT ai_models` |
| **Endpoints/APIs** | POST/GET `/api/admin/ai` (save-provider, save-model, test, set-default) |
| **Mutações** | Adicionar/Editar/Testar Provedor e Modelo |
| **Tabelas** | `ai_providers`, `ai_models` |

**Controles Visíveis:**
- **Botões Adicionar/Editar:** Abrem modal/formulario `ProviderEditor` / `ModelEditor`.
- **Botões de Testar/Padrão:** Handler: `action(payload, label)`. Efeito: POST API. Status: feedback em mensagem UI. Erro: Tratado na UI. Auditoria: Registrada no backend.
- **Formulários:** Handler: `onSave`. Efeito: POST API + GET refresh. Erro: Tratado no try/catch e exibido na UI.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing` (loading indicators no busy state), `success`, `error` (mensagens de falha de conexão/validação), `partial` (StatusBadge "Parcial" se faltar chave).
- **Faltam:** `offline/reconnecting`.

---

## 4. `/communities` (Grupos de WhatsApp)
**Dependência indisponível:** WhatsApp Groups API (`status: unavailable`).
- A rota apenas exibe um componente estático `EmptyState` com a mensagem de bloqueio por Compliance/Meta.
- **Estados:** `blocked`, `not_configured`.

---

## 5. `/configs` (Scoring e Prioridade)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT campaign_scoring_config, campaigns` |
| **Endpoints/APIs** | POST `/api/admin/configs` |
| **Mutações** | Cálculo de prévia de impacto e Salvamento de thresholds |
| **Tabelas** | `campaign_scoring_config`, `campaigns` |

**Controles Visíveis:**
- **Botão (Calcular prévia):** Handler: `submit(..., preview=true)`. Efeito: Retorna total e mudanças, exibe aviso visual de impacto. Erro: Exibido na tela.
- **Botão (Salvar configuração):** Handler: `submit(..., preview=false)`. Efeito: Atualiza tabela via API. Auditoria: Confirmada na UI.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing` (busy string), `success`, `error`, `empty` (Selecione uma campanha).
- **Faltam:** `offline/reconnecting`.

---

## 6. `/contact-policies` (Políticas de Contato)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT contact_policies, campaigns`, `SELECT leads` (para simulação) |
| **Endpoints/APIs** | POST `/api/contact-policies`, POST `/api/contact-policies/evaluate` |
| **Mutações** | Criação/Edição de Política, Simulação de elegibilidade |
| **Tabelas** | `contact_policies`, `leads`, `lead_scores`, `campaigns` |

**Controles Visíveis:**
- **Form (Política):** Handler: `save`. Efeito: POST API, atualiza lista local. Auditoria: Confirmada via mensagem.
- **Form (Simular):** Handler: `simulate`. Efeito: POST API, exibe decisão da simulação na tela. Erro: Exibido na UI.
- **Botões Editar/Cancelar:** Atualizam estado local de UI.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty` (Nenhuma política/leads).
- **Faltam:** `offline/reconnecting`.

---

## 7. `/content-items` (Lista de Conteúdos)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT content_items, theses, content_variants, content_performance` |
| **Tabelas** | `content_items`, `theses`, `content_variants`, `content_performance` |

**Controles Visíveis:**
- **Tabs (SavedViewTabs):** Efeito: Router replace via query param.
- **Input (Buscar):** Filtro local `search`.
- **Link (Item):** Navega para `/content-items/[id]`.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `success`, `empty` (Nenhum conteúdo ainda), `filtered_empty` (Nenhum conteúdo corresponde aos filtros).

---

## 8. `/content-items/[id]` (Detalhe do Conteúdo)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT content_items, content_variants, content_performance, timeline_events` |
| **Tabelas** | `content_items`, `content_variants`, `content_performance`, `timeline_events` |

**Controles Visíveis:**
- Exibe estaticamente canônicos, previews e timeline (via Server Components).
- As ações (Aprovar/Rejeitar) estariam em `ContentItemActions` (não detalhado).

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `success`, `empty` (Content item não encontrado).

---

## 9. `/content-opportunity` (Oportunidades de Conteúdo)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT content_opportunities` |
| **Endpoints/APIs** | POST `/api/content-opportunities/:id` |
| **Mutações** | Aprovar, Rejeitar, Atualizar oportunidade |
| **Tabelas** | `content_opportunities` |

**Controles Visíveis:**
- **Botões de Decisão (Aprovar/Rejeitar/Salvar):** Handler: `decide()`. Efeito: POST API. Atualiza estado e notifica criação de conteúdo (se aprovado).
- **Botão (Abrir editor):** Efeito: Window popup para ponte criativa.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `filtered_empty`.
- **Faltam:** `offline/reconnecting`.

---

## 10. `/conversations` (Caixa Unificada)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT own_dm_threads, conversation_state, whatsapp_conversations, leads, identities`, `SELECT whatsapp_messages, whatsapp_templates` |
| **Endpoints/APIs** | POST `/api/whatsapp/messages` |
| **Mutações** | Envio de mensagens e templates |
| **Tabelas** | Várias tabelas de mensageria (Meta/WhatsApp) e templates |

**Controles Visíveis:**
- **Sidebar (Conversas):** Seleção de contatos. Barra de busca.
- **Form (Composer):** Envio livre (text) ou via Template aprovado dependendo do `session_window_expires_at`. Handler: `send`. Efeito: POST API.
- Banner bloqueador para conversas de Instagram (indicando fluxo via fila de engajamento).

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `filtered_empty`, `blocked` (Janela fechada/Instagram - impede envio direto).

---

## 11. `/creative-bridge` (Ponte Criativa)

| Contexto | Descrição |
|---|---|
| **Endpoints/APIs** | GET `/api/content-opportunities/:id/creative` |
| **Integração Externa** | Comunicação via `window.postMessage` com o editor visual remoto |

**Controles Visíveis:**
- **Botão (Abrir no editor visual):** Abre o editor visual e gerencia as mensagens de iframe.

**Estados Assíncronos:**
- **Implementados:** `initial_loading` (Carregando...), `success`, `error` (Oportunidade indisponível), `blocked` (Navegador bloqueou popup).

---

## 12. `/docs/runbooks/[slug]` (Runbooks)
Rota estática exibindo objetos hardcoded para resposta a incidentes de infra/operações.

---

## 13. `/email-flows` (Fluxos de E-mail)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT email_flows, email_flow_state, email_subscribers` |
| **Endpoints/APIs** | POST `/api/email/flows`, PATCH `/api/email/flows` |
| **Mutações** | Criação de flow, toggle ativo/pausado |
| **Integração Externa** | Provedor de Email (ex: Resend) |

**Controles Visíveis:**
- **Form (Novo fluxo):** Handler: `create`. Efeito: POST API, atualiza lista local.
- **Botão (Ativar/Pausar):** Handler: `toggle`. Efeito: PATCH API.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `not_configured` (se integração email falhar).

---

## 14. `/engagement-queue` (Fila de Engajamento)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT engagement_actions, accounts, action_policies, account_health` |
| **Endpoints/APIs** | SSE via `/api/engagement/stream`, POST `/api/engagement/actions/:id` |
| **Mutações** | Aprovação, rejeição ou re-tentativa de ação |
| **Tabelas** | `engagement_actions`, `accounts`, `action_policies`, `account_health` |

**Controles Visíveis:**
- **Ações Kanban:** Botões `Aprovar`, `Rejeitar`, `Tentar novamente`. Handler: `decide`. Efeito: POST API.
- **Badge Live:** Indicador real-time do SSE.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing` (SSE Push), `success`, `error`, `blocked` (Ações bloqueadas).
- **Faltam:** Tratamento robusto para queda do `EventSource` (offline state implícito).

---

## 15. `/identities` (Identidades e Merges)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT identities, leads, identity_candidates, identity_merge_snapshots` |
| **Endpoints/APIs** | POST `/api/identities/candidates/:id/:action`, POST `/api/identities/rollback/:id` |
| **Mutações** | Aprovar/Rejeitar candidatos, Solicitar rollback de merges |

**Controles Visíveis:**
- **Botões (Decidir):** Handler: `decide`. POST API aprovação de merge.
- **Botão (Rollback):** Handler: `rollback`. Efeito: POST API reverte merge de leads.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `filtered_empty`.

---

## 16. `/leads` (Leads)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | Extensivo `SELECT` englobando `leads`, `lead_scores`, `lead_interactions`, `identities`, `nba_recommendations`, etc. |
| **Endpoints/APIs** | POST `/api/leads/actions` |
| **Mutações** | Bulk action "Preparar follow" |

**Controles Visíveis:**
- **Tabela/Rows:** Seleção individual (checkbox) para bulk action, clique na row abre painel detalhado.
- **Tabs & Search:** Atualiza URL params. Toggle "Somente público".
- **Botão Bulk (Preparar follow):** Handler: `prepare()`. POST API disparado em batch para fila operacional.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `filtered_empty`.

---

## 17. `/login` (Autenticação)

| Contexto | Descrição |
|---|---|
| **Endpoints/APIs** | POST `/api/auth/otp`, NextAuth `signIn('credentials')` |
| **Mutações** | Envio de e-mail OTP, Validação de token |

**Controles Visíveis:**
- **Forms (Email/Code):** Alternância entre estados, disable automático.
- Exibição de timeouts e tratamento de falhas.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `blocked` (expiração de 5 min).

---

## 18. `/market-radar` (Radar de Mercado)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT market_signals, reddit_watches` |
| **Endpoints/APIs** | POST `/api/reddit/watches` |
| **Integração Externa** | Reddit |

**Controles Visíveis:**
- **Form (Novo watch):** Desabilitado caso integração Reddit não esteja pronta. Handler: `create`.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `not_configured` (Dependência externa).

---

## 19. `/notifications` (Notificações e Erros)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT error_triggers, alerts, notification_deliveries` |
| **Endpoints/APIs** | PUT `/api/admin/notifications/triggers`, POST `/api/admin/notifications/test` |

**Controles Visíveis:**
- **Botões (Triggers):** Toggle ativo/inativo via PUT API.
- **Botão (Testar Canais):** Handler: `test()`. Efeito: Dispara POST API para teste de e-mail/alertas.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`, `not_configured`.

---

## 20. `/publishing` (Publicação Multicanal)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT content_publications`, `content_variants`, `scheduled_publications` |
| **Tabelas** | Várias de tracking de conteúdos agendados/publicados |

**Controles Visíveis:**
- Kanban board passivo e calendário de visualização dos próximos 42 dias. (Ações executadas via endpoints não mapeadas nesta interface diretamente).

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `success`, `empty`, `error` (status `failed` das colunas do Kanban).

---

## 21. `/review-inbox` (Review Inbox)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT review_inbox` |
| **Endpoints/APIs** | POST `/api/review-inbox/:id/:action` |
| **Mutações** | Triagem (Aprovar, Editar, Rejeitar, Bloquear, Adiar) |

**Controles Visíveis:**
- **Interface Mista (Mouse/Teclado):** Uso de atalhos A, E, R, B, . (ponto), J, K.
- **Editor Textarea:** Permite edição inline da suggestion da IA antes da aprovação.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty` (Fila limpa).

---

## 22. `/system-health` (Saúde do Sistema)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | Tabelas de health e canaries (`worker_heartbeats`, `alerts`, `canary_runs`) |
| **Redis** | `kill-switch:global` (Leitura SSR e Escrita API) |
| **Endpoints/APIs** | POST `/api/kill-switch` |

**Controles Visíveis:**
- **Botão (Kill-switch):** Pede confirmação visual (dialog). Handler: `toggleKillSwitch`. Efeito: Altera chave Redis via POST API.
- Relógios live de heartbeats.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `success`, `error`, `blocked` (Sistema pausado).

---

## 23. `/theses` (Teses Editoriais)

| Contexto | Descrição |
|---|---|
| **SQL Queries** | `SELECT theses, content_items, ...` (Estatísticas agregadas) |
| **Endpoints/APIs** | POST `/api/theses`, PATCH `/api/theses` |

**Controles Visíveis:**
- **Form (Criar Tese):** POST API. Validação de regras (Max 7 teses ativas).
- **Botão (Toggle):** PATCH API. Pausa ou Ativa.

**Estados Assíncronos:**
- **Implementados:** `initial_loading`, `refreshing`, `success`, `error`, `empty`.
- **Faltam:** `offline/reconnecting`.

---

## Contrato de controles

Controles decorativos foram removidos. Botões de mutação usam handler, endpoint, estado ocupado e resposta de sucesso/erro. Controles indisponíveis ficam desabilitados com explicação próxima. O teste `production-ui-guardrails.test.ts` impede o retorno de formulários por UUID/JSON, fixtures ou componentes genéricos de demonstração.
