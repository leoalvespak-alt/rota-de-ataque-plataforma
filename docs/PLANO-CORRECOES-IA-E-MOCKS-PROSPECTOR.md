# Plano de correção integral — IA, modais e remoção de mocks do Prospector

> Elaborado em 18/08/2026 a partir da captura da tela de Modelos de IA, do
> código executável, dos contratos HTTP, das migrations e do deploy vigente.
> **Estado: em execução local.** A base do control plane de IA e o Dialog
> compartilhado foram alterados localmente em 18/08/2026; migration, testes de
> integração, inventário integral de realidade e publicação continuam pendentes
> de validação em PostgreSQL/Redis e ambiente de produção. Nada nesta seção
> autoriza habilitar provider pago ou worker externo.

## 1. Objetivo

Eliminar os erros de configuração de IA, tornar todos os modais utilizáveis em
qualquer viewport e remover da aplicação todo gráfico, número ou ação simulada.
Ao final, cada informação visível deverá vir de uma fonte operacional
rastreável e cada botão deverá executar uma ação real, navegar para um fluxo
real ou ser removido da interface.

O plano adota estas fontes de verdade:

- **segredos de provedores:** variáveis de ambiente do servidor, nunca banco,
  resposta HTTP, HTML, log ou navegador;
- **cadastro e operação:** PostgreSQL para provedor, URL, tipo, modelos,
  ativação, modelo padrão, prioridade, referência da variável de ambiente,
  estado da sincronização e auditoria;
- **métricas e gráficos:** PostgreSQL, Redis/BullMQ, heartbeats ou provider real,
  sempre com período, campanha e horário de geração explícitos;
- **estado de UI:** resposta confirmada da API; atualização otimista só quando
  houver rollback definido.

## 2. Evidências confirmadas

| Área | Evidência no estado atual | Consequência |
|---|---|---|
| Modal | `Dialog` usa posição central fixa, mas não possui `max-height`, região rolável, rodapé fixo nem tratamento de teclado virtual/safe area | Campos e botões ficam fora da viewport, como mostra a captura |
| Autorização | `POST /api/admin/ai` chama `requireRole('admin')` antes do `try/catch` | Falha de sessão/RBAC escapa como 500; probe sem sessão confirmou HTTP 500 |
| Cliente HTTP | A tela executa `response.json()` incondicionalmente | Resposta vazia ou HTML de erro vira `Unexpected end of JSON` e esconde a causa real |
| Estado do modal | `action()` captura o erro e resolve; o callback fecha o editor em `.then(...)` mesmo quando houve falha | O usuário perde o formulário sem confirmação de persistência |
| Modelo padrão | A API existe, mas depende de sessão admin; o botão não distingue 401/403/409/500 e só atualiza após novo GET | O clique aparenta não fazer nada |
| Fallback | As setas apenas reordenam o array React | A prioridade não é persistida nem consumida por worker algum |
| CRUD de provedores | Há salvar/testar, mas não há remoção, versionamento ou concorrência otimista | O painel não cumpre o ciclo administrativo completo |
| Ambiente versus banco | A página lê apenas `ai_providers`/`ai_models`; o runtime usa ambiente somente quando não encontra modelo padrão no banco | Um seed de banco sem chave pode ocultar uma chave válida do ambiente |
| Deploy de segredos | O fluxo do Prospector sincroniza `LLM_*`, mas não inclui todo o conjunto específico usado na configuração, inclusive a chave DeepSeek | Chaves presentes no ambiente local podem não chegar ao runtime do Prospector |
| Dados simulados | IA exibe workers fixos e `42 req/min`; Saúde contém gráfico marcado como mock; Radar usa série fixa; identidade, comunidade e ROI têm números ou ações apenas com toast | A interface afirma estados e sucessos que não ocorreram |
| Guardrail | O teste atual procura poucos nomes proibidos, mas não detecta handler que só mostra toast, série literal ou KPI operacional fixo | Novos mocks podem entrar sem falhar CI |

## 3. Critérios globais de conclusão

O trabalho só estará concluído quando:

1. nenhum modal perder campos ou ações entre 320 px de largura e desktop;
2. toda rota de IA responder JSON tipado e status correto, inclusive 401/403;
3. CRUD, teste, ativação, remoção, prioridade e modelo padrão persistirem após
   reload e forem efetivamente consumidos pelos workers;
4. chaves permanecerem exclusivamente no ambiente, exibidas no painel apenas
   como presença/ausência e nome de referência não secreto;
5. o reconciliador ambiente→banco for idempotente e não ressuscitar um provedor
   removido intencionalmente;
6. não houver gráfico, métrica, status ou ação operacional simulada no bundle;
7. testes, migrations, build, deploy completo e smoke tests de produção passarem
   sem habilitar automaticamente provider pago ou worker externo.

---

## Etapa 1 — Corrigir contratos HTTP, sessão e feedback da tela de IA

**Prioridade:** crítica. **Dependências:** nenhuma.

### Passos

1. Reproduzir GET/POST com sessão `viewer`, `operator`, `admin`, sem sessão,
   payload inválido, banco indisponível e conflito de versão; registrar status,
   `content-type`, corpo público e trace ID sem dados sensíveis.
2. Mover autenticação e parsing para dentro do boundary padrão de API ou aplicar
   `apiErrorResponse` a toda a rota de IA. Padronizar 400, 401, 403, 404, 409,
   422, 502 e 500; erro interno nunca pode retornar stack ou texto bruto.
3. Manter mutações restritas a `admin`. Validar o fluxo OTP/NextAuth e a lista
   `AUTH_ADMIN_EMAILS`; o modo bootstrap permanece somente leitura e jamais
   ganha elevação implícita.
4. Criar um cliente HTTP compartilhado que leia texto uma única vez, valide
   `content-type`, aceite corpo vazio e converta envelopes de erro sem lançar
   erro de JSON secundário.
5. Fazer `action()` retornar união explícita `{ ok: true, state } | { ok: false,
   error }`. Fechar modal apenas em sucesso confirmado; preservar valores,
   foco e mensagem em falha.
6. Retornar o estado atualizado na própria mutação para evitar sequência
   POST→GET sujeita a corrida. Usar `router.refresh()` apenas como reconciliação,
   não como prova de persistência.
7. Adicionar estados distintos por registro/ação (`saving-provider:{id}`,
   `testing:{id}`, `default:{id}`, `deleting:{id}`), impedir duplo clique e
   anunciar resultado por `aria-live`.
8. Cobrir os casos com testes de rota e componente, inclusive a regressão
   exata “POST sem sessão retorna 401 JSON, nunca 500/HTML”.

### Aceite

- Definir modelo padrão, salvar e testar mostram resultado inequívoco.
- Falha não fecha o modal nem apaga o formulário.
- O console não contém 500 nem erro de parsing para falhas esperadas de acesso.

---

## Etapa 2 — Tornar Dialog, ConfirmDialog e formulários responsivos

**Prioridade:** crítica. **Dependências:** Etapa 1 apenas para validar os
formulários de IA de ponta a ponta.

### Passos

1. Refatorar o `Dialog` do `ui-bridge` em overlay, painel, cabeçalho, corpo
   rolável e rodapé de ações. Remover o layout monolítico com estilos inline.
2. Limitar o painel a `calc(100dvh - 2 * margem-segura)`, aplicar
   `overflow: hidden` ao painel e `overflow-y: auto; overscroll-behavior:
   contain` ao corpo.
3. Manter título/fechar visíveis e permitir rodapé `sticky`; os formulários de
   IA devem colocar Cancelar/Salvar no rodapé, acessíveis sem rolar de volta.
4. Em telas estreitas, usar largura disponível, margem segura, padding reduzido,
   ações empilháveis e campos sem overflow horizontal. Considerar `safe-area-*`
   e teclado virtual móvel.
5. Bloquear scroll do documento enquanto o modal estiver aberto, restaurando-o
   no fechamento; preservar trap de foco, Escape, retorno de foco e clique no
   backdrop conforme o risco da operação.
6. Impedir fechamento acidental durante salvamento e, quando o formulário tiver
   alterações, solicitar confirmação antes de descartar.
7. Aplicar o contrato compartilhado a AI Settings, Publishing, Review Inbox,
   Accounts e demais consumidores; eliminar exceções locais que reintroduzam
   clipping.
8. Criar testes de acessibilidade e visuais em 320×568, 375×667, 768×1024 e
   desktop, com zoom 200%, conteúdo longo e navegação somente por teclado.

### Aceite

- Todos os campos e botões são alcançáveis por rolagem interna e teclado.
- A página atrás do modal não rola; foco nunca escapa do diálogo.
- Não há corte com viewport móvel, zoom ou mensagem de erro multilinha.

---

## Etapa 3 — Completar o control plane de provedores e modelos

**Prioridade:** crítica. **Dependências:** Etapa 1.

### Passos

1. Criar migration para evoluir `ai_providers` com origem gerenciada,
   `secret_env_name`, estado de sincronização, versão e remoção lógica; evoluir
   `ai_models` com `priority`, versão e índices que preservem um único padrão.
2. Implementar CRUD completo e transacional para provedores/modelos, incluindo
   remoção segura. Bloquear exclusão quando houver uso/referência ou oferecer
   desativação com motivo; nunca apagar histórico de auditoria/uso.
3. Adicionar concorrência otimista (`version`/`updated_at`) para que duas telas
   não sobrescrevam alterações silenciosamente.
4. Persistir a ordem das setas com endpoint específico de reorder, sequência
   densa e transação. A ordem exibida deve vir sempre do banco.
5. Tornar “modelo padrão” atômico: validar provedor ativo, segredo disponível,
   modelo habilitado e teste de conectividade conforme política; desmarcar o
   anterior e marcar o novo na mesma transação.
6. Implementar fallback real no runtime: consultar modelos ativos por
   `is_default DESC, priority ASC`, aplicar timeout/retry classificável e só
   avançar em falhas elegíveis. Registrar modelo escolhido, latência, resultado
   e reason code sem prompt, resposta ou chave.
7. Trocar o teste genérico de provider por teste de modelo selecionado, com
   adapters corretos para OpenAI-compatible e Anthropic e mensagens públicas
   seguras.
8. Substituir a tabela fixa “Workers atrelados” por consulta real de
   heartbeats, jobs e eventos de uso de IA; throughput e falhas devem carregar
   janela temporal e estado vazio.
9. Incluir trilha de auditoria para criar, editar, ativar, desativar, remover,
   reordenar, testar e trocar padrão, sem registrar segredo.

### Aceite

- Reload preserva cadastro, remoção, ativação, prioridade e padrão.
- Um job real usa o padrão novo; falha elegível usa o próximo modelo na ordem.
- O painel mostra somente workers e métricas observados, nunca linhas fixas.

---

## Etapa 4 — Sincronizar ambiente e painel sem retirar segredos do ambiente

**Prioridade:** crítica de segurança. **Dependências:** Etapa 3.

### Contrato obrigatório

O painel **não escreve arquivos `.env` e não recebe o valor da chave**. Ele
administra metadados e uma referência allowlisted, por exemplo
`DEEPSEEK_API_KEY`. O servidor resolve `process.env[secret_env_name]` somente no
momento da chamada. A UI recebe apenas `configured: true/false`.

### Passos

1. Definir catálogo tipado de providers suportados com tipo, URL/modelo padrão,
   variáveis aceitas e capacidades. Não aceitar nome arbitrário de variável do
   navegador sem allowlist server-side.
2. Criar reconciliador idempotente ambiente→banco, executado em migration/deploy
   ou comando administrativo explícito. Ele cadastra/atualiza metadados e
   presença do segredo, sem persistir o valor.
3. Tratar remoção com tombstone: provedor removido no painel não reaparece no
   próximo restart apenas porque a chave continua no ambiente. Reativação exige
   ação explícita.
4. Para provedor adicionado no painel, permitir selecionar a referência de
   segredo. Enquanto a variável não existir no runtime, mostrar “aguardando
   configuração no ambiente” e impedir ativação/teste.
5. Migrar chaves cifradas legadas com procedimento seguro: priorizar env,
   verificar presença, retirar o ciphertext após confirmação e manter rollback
   por backup — nunca exportar a chave via aplicação.
6. Corrigir `.env.example`, schema de ambiente e `deploy-all.ps1` para sincronizar
   todas as variáveis consumidas pelo Prospector, incluindo providers
   específicos. Validar apenas presença/formato e jamais imprimir valores.
7. Atualizar `loadLlmRuntimeConfig`: registro de banco sem segredo resolvível não
   pode ocultar configuração válida nem ser escolhido como ativo. Fonte e
   fallback devem ser determinísticos e observáveis.
8. Expor endpoint admin de estado da sincronização com referência, origem,
   presença, último reconcile e erro sanitizado; nunca retornar chave,
   ciphertext ou fingerprint reversível.
9. Documentar rotação: editar ambiente protegido, executar deploy/restart,
   reconciliar, testar e revogar a chave anterior no provider.

### Aceite

- Provedores/chaves presentes no ambiente aparecem como configurados no painel.
- Nenhuma resposta, log, audit row ou bundle contém o valor de uma chave.
- Adição/remoção no painel e restart produzem estado determinístico.

---

## Etapa 5 — Remover todos os mocks e ligar cada visual/ação a dados reais

**Prioridade:** alta e transversal. **Dependências:** Etapa 3 para a área de IA.

### Passos

1. Gerar inventário por rota com quatro colunas: elemento visível, origem atual,
   fonte real necessária e decisão `implementar | remover`. Cobrir páginas,
   drawers, modais, menus, gráficos, KPIs, tabelas, exports e ações secundárias.
2. Corrigir ocorrências já confirmadas:
   - remover workers, throughput e falhas fixos de AI Settings;
   - substituir o gráfico mock de Saúde por série temporal de falhas/alertas;
   - substituir a curva fixa de sete dias do Radar por snapshots agregados;
   - calcular preview de merge de identidade no servidor e conectar confirmar/
     rejeitar às APIs auditadas;
   - conectar aprovação/ignorar do Radar às rotas reais;
   - conectar sincronização de comunidade a job idempotente com status real;
   - implementar drill-down e export CSV reais de Source ROI;
   - remover textos e percentuais inventados de comunidade;
   - remover controles “Em breve” ou implementar a integração inteira antes de
     exibi-los.
3. Auditar `OperationalInteractive` e separar componentes por domínio. O
   componente genérico não pode inferir semântica nem inventar detalhes para
   preencher espaço.
4. Para cada gráfico, definir query, período, timezone, campanha, granularidade,
   unidade, estado vazio, atraso esperado e timestamp de atualização. Série
   literal operacional fica proibida.
5. Para cada botão, exigir uma destas provas: mutação HTTP persistida e auditada,
   navegação válida, download realmente gerado ou ação local explicitamente não
   operacional. Toast sozinho não constitui implementação.
6. Implementar endpoints/jobs faltantes com idempotência, RBAC, validação,
   auditoria, estados de loading/erro/vazio e correlação. Não ativar coleta paga
   sem budget e feature flag.
7. Remover da interface funções fora do escopo que ainda não tenham backend. É
   preferível não renderizar um recurso a simular sucesso.
8. Fortalecer o guardrail com análise de AST/contratos: detectar handlers só com
   toast, métricas operacionais literais, séries de gráfico hardcoded, labels
   `mock/demo/em breve`, fixtures importadas pelo bundle e botões sem efeito.
9. Criar testes de contrato tela→rota→persistência e tela→query para cada item do
   inventário. Fechar o inventário somente com evidência automatizada ou smoke
   test registrado.

### Aceite

- Busca automatizada e revisão manual não encontram mocks em código de produção.
- Todos os gráficos mudam somente quando a fonte real muda e mostram vazio sem
  inventar dados.
- Todos os botões visíveis executam efeito comprovável ou navegação válida.

---

## Etapa 6 — Validar, migrar e publicar com gates de produção

**Prioridade:** bloqueadora para conclusão. **Dependências:** Etapas 1–5.

### Passos

1. Executar typecheck, lint, runtime-deps e todas as suítes afetadas; adicionar
   testes de API/RBAC, reconciliador, migrations, fallback, UI, acessibilidade,
   gráficos e ações reais.
2. Ensaiar migrations `up/down/up` em banco vazio e clone sanitizado; validar
   single-default, prioridade, tombstones, remoção segura e migração das chaves
   cifradas sem exposição.
3. Executar integração com PostgreSQL/Redis reais e adapters de provider fake
   locais; usar sandbox real somente com autorização, budget e chave própria.
4. Executar Playwright em desktop/móvel para todos os modais e fluxos de IA;
   verificar console, requests, persistência após reload e ausência de segredos.
5. Rodar o inventário de realidade como gate de CI. Qualquer mock, botão sem
   efeito ou série literal reprova o build.
6. Fazer backup pré-migration e deploy canário do Prospector com workers de IA
   desligados. Reconciliar env, validar painel admin e testar um modelo sem
   promover tráfego automático.
7. Executar `deploy/deploy-all.ps1` sem filtros para publicar Design System e
   Prospector completos, aplicar migrations pelo runner e manter rollback
   atômico. Não registrar valores de env na saída.
8. Confirmar em produção: 401/403 JSON sem sessão, CRUD admin, prioridade/padrão
   após reload, presença de providers do env, modal responsivo, zero erros no
   console, gráficos reais/estados vazios e 40 workers na imagem esperada.
9. Atualizar `Docs/PROSPECTOR.md`, arquitetura, runbook/deploy, changelog e este
   plano com implementado, verificado, pendente e rollback. Remover afirmações
   antigas de ausência de mocks somente após o gate passar.

### Aceite

- Build/deploy/migrations/health/smoke tests passam na mesma release.
- Nenhum provider pago ou worker externo é habilitado implicitamente.
- O plano contém evidências finais e nenhuma pendência é marcada como concluída
  com base apenas em mock ou teste isolado.

## 4. Ordem e paralelismo recomendados

- Etapa 1 começa imediatamente e desbloqueia diagnóstico confiável.
- Etapa 2 pode avançar em paralelo com a modelagem da Etapa 3.
- Etapa 4 depende do schema e dos contratos definidos na Etapa 3.
- O inventário da Etapa 5 começa junto da Etapa 1, mas as implementações fecham
  depois das fontes reais de cada domínio.
- Etapa 6 só inicia o rollout quando todos os critérios das etapas anteriores
  estiverem demonstrados.

## 5. Pendências deliberadas antes da execução

- Confirmar quais providers serão oficialmente suportados no primeiro catálogo;
  o código atual menciona Anthropic, DeepSeek e vários OpenAI-compatible.
- Definir retenção e granularidade das novas séries temporais para evitar
  crescimento desnecessário do banco.
- Definir se integrações sem backend, como Salesforce, serão implementadas em
  projeto próprio ou removidas desta interface.

Essas decisões não impedem iniciar as Etapas 1 e 2, mas devem estar fechadas
antes das Etapas 3–5.
