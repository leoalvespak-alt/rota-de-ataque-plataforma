# Auditoria e plano de correção — carrossel, IA, APIs e VPS

**Data da auditoria:** 13 de agosto de 2026  
**Aplicação:** Design System — Rota de Ataque  
**Escopo:** wizard de criação de carrossel, configuração de IA, integrações com provedores, API editorial, nginx, deploy e PostgreSQL da VPS.

> Este documento registra o diagnóstico verificado e um plano de implementação. Ele não representa correções já aplicadas. Nenhuma chave, token, cookie, e-mail ou dado pessoal foi incluído.

## 1. Resumo executivo

O bloqueio da etapa 3 foi reproduzido na aplicação publicada. Ao clicar em **Avançar**, a interface permanece na etapa 3, não envia requisição, não registra erro e não apresenta feedback persistente.

A causa imediata está no fluxo do wizard:

1. o comando da etapa 3 chama a geração de roteiro;
2. o hook de IA encerra silenciosamente quando `scriptCards` está vazio;
3. `scriptCards` só é inicializado pelo componente da etapa 4;
4. a etapa 4 só monta depois que a geração da etapa 3 termina e chama `nextStep()`.

Isso forma uma dependência circular: a etapa 3 espera cards criados pela etapa 4, enquanto a etapa 4 depende da conclusão da etapa 3.

A auditoria também encontrou problemas sistêmicos que impedem uma correção isolada de ser suficiente:

- retornos silenciosos e ausência de estados explícitos de erro no wizard;
- contrato de campos incompatível com templates heterogêneos;
- seleção e persistência inconsistentes de modelos de IA;
- modelos configurados com identificadores antigos ou aposentados;
- duas implementações concorrentes para provedores de IA;
- chamadas de IA e chaves executadas/armazenadas no navegador;
- implementação incorreta do fluxo assíncrono da fila fal;
- cliente HTTP capaz de montar `/api/api/...`;
- nginx removendo o prefixo `/api` ao encaminhar requisições;
- API publicada desatualizada em relação ao código local;
- migrations recentes ausentes no PostgreSQL da VPS;
- ausência do ledger de migrations do Drizzle;
- API sem autenticação e rate limiting suficientes para exposição pública;
- deploy atual não publica de forma reproduzível a API e as migrations.

## 2. Evidências verificadas

### 2.1 Fluxo do wizard

| Evidência | Resultado | Impacto |
| --- | --- | --- |
| Reprodução em `design.rotadeataque.com.br` | Clique em Avançar permanece na etapa 3 | Falha confirmada em produção |
| Console do navegador | Sem erro relacionado | Retorno normal e silencioso |
| Network do navegador | Nenhuma chamada de geração | Bloqueio ocorre antes do transporte |
| `useWizardAI.ts` | Retorna se não houver template ou cards | Falha não chega ao usuário |
| `WizardStep4Script.tsx` | Inicializa os cards ao montar | Inicialização acontece tarde demais |
| `nextStep()` | Executado somente após geração bem-sucedida | Wizard nunca alcança a etapa que cria os cards |

#### Causa raiz primária

O hook de geração mistura três responsabilidades:

- validar o estado do wizard;
- criar/atualizar a estrutura dos cards;
- controlar navegação entre etapas.

Ao encontrar `scriptCards.length === 0`, ele simplesmente retorna. Como os cards são criados na etapa seguinte, o fluxo nunca consegue satisfazer a própria pré-condição.

#### Problemas relacionados

- O indicador de carregamento pode ser ligado e desligado no mesmo ciclo, sem tempo perceptível de renderização.
- Não existe erro de domínio como `TEMPLATE_AUSENTE`, `CARDS_NAO_INICIALIZADOS` ou `MODELO_NAO_CONFIGURADO`.
- O hook chama `nextStep()` internamente, acoplando geração a navegação.
- O uso de `getActiveModel()!` pode gerar exceção caso o modelo persistido tenha sido removido ou desabilitado.
- O toggle `generateCoverWithAI` está no estado e na interface, mas não participa de uma geração real de capa no wizard.
- Não há cancelamento, timeout ou proteção contra cliques duplicados.

### 2.2 Configuração e provedores de IA

#### Modelos

- A interface apresenta um nome moderno de Claude, mas usa internamente um identificador antigo.
- O modelo padrão do DeepSeek está fixado em `deepseek-chat`, cuja disponibilidade e comportamento precisam ser migrados conforme a documentação atual do provedor.
- A tela de configuração não deixa clara uma seleção persistente e separada para modelo de texto e modelo de imagem.
- O modelo ativo também é alterado por controles do editor, criando mais de uma fonte de verdade.

Referências oficiais consultadas:

- Anthropic — IDs e versões de modelos: <https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions>
- Anthropic — depreciações: <https://platform.claude.com/docs/en/about-claude/model-deprecations>
- DeepSeek — modelos e preços: <https://api-docs.deepseek.com/quick_start/pricing/>
- DeepSeek — JSON mode: <https://api-docs.deepseek.com/guides/json_mode/>

#### Duplicação de providers

Há lógica paralela em arquivos como:

- `src/lib/ai/generateCopy.ts`;
- `src/lib/ai/generateImage.ts`;
- implementações dentro de `src/lib/ai/providers/`.

Essa duplicação faz com que teste de conexão, geração real, tratamento de erros e normalização de respostas possam seguir contratos diferentes.

#### Teste de conexão

- O teste reduz falhas a um booleano e perde código HTTP, mensagem sanitizada e contexto do provedor.
- O teste da fal procura configuração por uma referência de chave associada a modelo de texto, o que pode impedir a validação correta do provedor de imagem.
- A tela não diferencia chave ausente, modelo inválido, quota, timeout, erro de rede e indisponibilidade do provedor.

#### Contrato dos cards

A geração atual tende a normalizar somente campos como `title`, `body` e `eyebrow`. Templates podem exigir `subtitle`, CTA, listas, destaques e outros campos. Dados gerados podem ser descartados ou deixar campos vazios.

#### Segurança das chaves

Chamadas diretas do navegador expõem as credenciais a XSS, extensões, inspeção do runtime e código de terceiros. A fal recomenda proxy/server-side para impedir exposição da chave no cliente:

- fal — execução server-side: <https://fal.ai/docs/documentation/model-apis/inference/server-side>

#### Fila assíncrona da fal

O contrato oficial retorna URLs diferentes para status e resultado. A implementação atual consulta endpoints ou propriedades incompatíveis com esse contrato:

- fal — queue: <https://fal.ai/docs/documentation/model-apis/inference/queue>

### 2.3 API, cliente HTTP e nginx

#### Matriz observada

| Destino | Resultado | Diagnóstico |
| --- | --- | --- |
| Público `/health` | HTML da SPA | fallback do frontend |
| Público `/api/health` | JSON 200 | nginx remove `/api` antes do upstream |
| Público `/api/theses` | 404 | prefixo encaminhado não coincide com a rota real |
| Público `/api/projects` | 404 | rota ausente na imagem publicada e/ou prefixo incorreto |
| Upstream `/health` | 200 | health da API existe sem prefixo |
| Upstream `/api/health` | 404 | health registrado fora de `/api` |
| Upstream `/api/theses` | 200 com lista vazia | rota editorial existe na API |
| Upstream `/theses` | 404 | confirma registro com `/api` |
| Upstream `/api/projects` | 404 | container publicado não contém rota nova |
| Upstream `/api/profiles` | 404 | container publicado não contém rota nova |
| Upstream `/api/token-logs/summary` | 404 | container publicado não contém rota nova |

#### Duplo prefixo no frontend

O cliente compartilhado usa, por padrão, uma base `/api`. Alguns consumidores passam caminhos que já começam com `/api`, produzindo `/api/api/theses` e equivalentes.

Outros módulos chamam `fetch('/api/...')` diretamente. O comportamento não é uniforme.

#### Reescrita acidental no nginx

A configuração equivalente a:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/;
}
```

remove o prefixo `/api` por causa da barra final em `proxy_pass`. Entretanto, as rotas Hono editoriais estão registradas como `/api/...`.

O duplo prefixo do frontend e a remoção feita pelo nginx podem se compensar acidentalmente em alguns fluxos. Corrigir apenas um lado quebra os fluxos que hoje funcionam por coincidência.

#### Guard de disponibilidade

O guard `isApiAvailable()` considera a API indisponível quando `VITE_API_URL` não foi definido, mesmo que uma API same-origin esteja saudável. Ele foi usado para suprimir 404, mas também pode impedir chamadas depois da correção do proxy.

#### Exposição sem autenticação

A API observada possui CORS, mas não uma camada suficiente de autenticação, autorização, rate limiting e auditoria. Corrigir o nginx antes disso pode publicar operações de leitura e mutação sem proteção.

### 2.4 Container e deploy

- O container da API publicado é anterior às rotas locais de projetos, perfis e logs de tokens.
- O fluxo principal de deploy publica o frontend estático, mas não garante build, publicação, health check e rollback da API.
- Scripts antigos aplicavam apenas parte das migrations.
- O `Dockerfile.api` usa `npm ci` e espera `package-lock.json`, enquanto o repositório atual é um workspace pnpm.
- O compose atual cobre serviços de infraestrutura, mas não define de forma completa API, migration job e dependências de saúde.
- Não existe gate que compare o commit/hash da API publicada ao commit do frontend.

### 2.5 PostgreSQL da VPS

O banco foi inspecionado somente em modo leitura.

Estado encontrado:

- PostgreSQL 16 com extensão vetorial disponível;
- tabelas editoriais/base existentes;
- `creative_projects`, `brand_profiles` e `ai_token_logs` ausentes;
- tabela `drizzle.__drizzle_migrations` ausente;
- tabelas centrais consultadas estavam sem registros relevantes;
- migrations iniciais aparentam ter sido aplicadas manualmente, sem ledger.

Não é seguro executar todas as migrations automaticamente. As primeiras migrations podem tentar recriar objetos que já existem. É necessário comparar DDL, estabelecer um baseline e somente então aplicar as alterações faltantes.

### 2.6 Qualidade e documentação

- O build de produção foi concluído com sucesso.
- O hash do bundle principal gerado localmente coincidiu com o bundle publicado durante a auditoria, confirmando que o comportamento reproduzido corresponde ao código analisado.
- Dois arquivos de testes de domínio/adapters passaram: 6 testes aprovados.
- Não há cobertura suficiente para wizard, providers, gateway e integração nginx/API.
- O lint contém dois erros existentes relacionados a atualização de estado dentro de effects, em `DashboardView.tsx` e `WizardStep3Content.tsx`, além de avisos.
- A documentação de IA afirma que alguns fluxos estão implementados, mas o runtime mostra que o fluxo não está operacional.
- O `Docs/README.md` exigido pelas instruções do repositório não existe. O índice encontrado durante a auditoria era `apps/design-system/docs/architecture/README.md`.

## 3. Priorização dos problemas

| Prioridade | Problema | Risco |
| --- | --- | --- |
| P0 | Dependência circular entre etapas 3 e 4 | Wizard inutilizável |
| P0 | Retornos silenciosos e ausência de feedback | Falha invisível e difícil de diagnosticar |
| P0 | API pública sem autenticação suficiente | Exposição de dados e custos de IA |
| P0 | Chaves de IA no navegador | Vazamento de credenciais |
| P0 | Divergência entre schema real e migrations | Perda/indisponibilidade de dados |
| P1 | `/api/api` versus rewrite do nginx | Rotas instáveis |
| P1 | Imagem da API desatualizada | Recursos locais ausentes em produção |
| P1 | Modelos antigos e seleção inconsistente | Falhas de provedor |
| P1 | Contrato incorreto da fila fal | Geração de imagem não conclui |
| P1 | Contrato fixo de campos | Conteúdo incompleto em templates |
| P2 | Provider logic duplicada | Manutenção e erros divergentes |
| P2 | Falta de timeout, abort e idempotência | Requisições presas ou duplicadas |
| P2 | Cobertura insuficiente | Regressões silenciosas |

## 4. Arquitetura-alvo

```text
Wizard/UI
  -> serviço de domínio do wizard
     -> cria estrutura dos cards a partir do template
     -> valida conteúdo e configuração
     -> chama gateway de IA
     -> aplica resposta tipada aos campos
     -> navega apenas após sucesso

Frontend
  -> /api/* no mesmo domínio

nginx
  -> preserva /api/*

API autenticada
  -> rotas de domínio
  -> gateway de IA
     -> registry único de providers/modelos
     -> OpenAI/Anthropic/DeepSeek/fal
  -> PostgreSQL para projetos, perfis e logs não secretos
  -> secret manager/env para credenciais
```

Princípios:

- uma única fonte de verdade para modelos e providers;
- nenhuma chave real no bundle ou `localStorage`;
- contratos de entrada e saída validados;
- navegação controlada pela tela, não por hooks de infraestrutura;
- migrations reproduzíveis e auditáveis;
- erros sempre visíveis ao usuário e observáveis no backend.

## 5. Plano de execução

### Etapa 0 — Congelar baseline e preparar rollback

1. Criar branch de correção sem remover as alterações locais existentes.
2. Registrar commit/hash atualmente publicado de frontend e API.
3. Exportar a configuração atual de nginx e dos containers.
4. Realizar backup lógico do PostgreSQL.
5. Testar restauração do backup em banco temporário.
6. Registrar contagem de tabelas e hashes de DDL antes das migrations.
7. Definir rollback independente para frontend, API, nginx e banco.

**Gate:** não iniciar alterações de schema sem backup restaurável e DDL inventariado.

### Etapa 1 — Corrigir o domínio do wizard

1. Extrair uma função pura `buildCardSkeletons(template, cardCount)`.
2. Criar os cards imediatamente após seleção do template/quantidade ou no início controlado da etapa 3.
3. Remover a inicialização estrutural do `useEffect` da etapa 4.
4. Fazer `useWizardAI` receber cards válidos ou criá-los por meio da função de domínio.
5. Substituir retornos silenciosos por resultados discriminados:

```ts
type GenerationResult =
  | { ok: true; cards: ScriptCard[] }
  | { ok: false; code: GenerationErrorCode; message: string; retryable: boolean }
```

6. Retirar `nextStep()` do hook de IA.
7. Na tela da etapa 3:
   - validar;
   - definir `generating`;
   - aguardar a geração;
   - persistir cards;
   - navegar somente no sucesso;
   - exibir erro acionável no fracasso.
8. Tratar separadamente texto livre, tese e Markdown importado.
9. Implementar timeout e `AbortController`.
10. Bloquear submissões concorrentes e permitir tentativa novamente.
11. Persistir somente estado não sensível necessário para recuperação do wizard.
12. Conectar ou remover temporariamente o toggle de capa com IA até existir implementação funcional.

**Critério de aceite:** um clique válido na etapa 3 sempre gera uma chamada observável ou retorna erro visível; nunca termina silenciosamente.

### Etapa 2 — Corrigir contratos de campos e resposta de IA

1. Derivar os campos esperados do template selecionado.
2. Criar schema Zod por geração contendo quantidade de cards, IDs e campos obrigatórios.
3. Incluir no prompt o contrato exato do template.
4. Exigir resposta estruturada quando o provider oferecer suporte.
5. Normalizar a saída em um adapter único.
6. Validar quantidade, ordem, tipos e limites de caracteres.
7. Rejeitar respostas incompletas com mensagem clara ou executar reparo limitado e observável.
8. Mapear `subtitle`, CTA, lista, destaque e campos customizados sem descarte silencioso.
9. Preservar edição manual mesmo quando a IA falhar.

**Critério de aceite:** todos os campos exigidos pelo template são preenchidos ou identificados explicitamente como pendentes.

### Etapa 3 — Recuperar e versionar a configuração de IA

1. Criar catálogo tipado de providers e capacidades:
   - texto;
   - imagem;
   - JSON estruturado;
   - streaming;
   - custo e limites conhecidos.
2. Separar `activeCopyModelId` e `activeImageModelId`.
3. Tornar a seleção explícita na página de IA.
4. Validar se o modelo ativo existe, está habilitado e possui provider configurado.
5. Criar fallback somente quando habilitado pelo administrador e sempre registrá-lo.
6. Migrar IDs aposentados para modelos atuais após teste de compatibilidade.
7. Exibir status de configuração: sem chave, não testado, saudável, degradado ou inválido.
8. Fazer o teste de conexão retornar diagnóstico sanitizado, latência e timestamp.
9. Remover suposições que ligam provider de imagem a modelos de texto.
10. Versionar prompts e parâmetros de geração.

**Critério de aceite:** a tela mostra exatamente qual modelo será usado para texto e imagem, e o teste usa o mesmo adapter da geração real.

### Etapa 4 — Implantar gateway de IA seguro no backend

1. Criar rotas autenticadas, por exemplo:
   - `POST /api/ai/copy/generate`;
   - `POST /api/ai/image/submit`;
   - `GET /api/ai/jobs/:id`;
   - `POST /api/ai/providers/:provider/test`.
2. Mover todas as chamadas com credenciais para o backend.
3. Armazenar no banco apenas configuração não secreta e referências de segredo.
4. Usar env/secret manager; para BYOK multiusuário, usar criptografia de envelope e rotação.
5. Implementar autenticação, autorização por recurso e rate limiting antes de publicar rotas.
6. Criar allowlist fixa de hosts/providers para impedir SSRF.
7. Aplicar timeout, retry com backoff apenas em erros transitórios e circuit breaker.
8. Usar chave de idempotência por operação do wizard.
9. Implementar corretamente `status_url` e `response_url` da fila fal.
10. Registrar custos/tokens em `ai_token_logs` sem salvar chave ou conteúdo pessoal.
11. Padronizar erros públicos e preservar detalhes somente nos logs internos.
12. Remover código de provider duplicado após migração.

**Critério de aceite:** nenhuma credencial de produção aparece no navegador, bundle, storage ou resposta HTTP.

### Etapa 5 — Unificar o contrato HTTP e corrigir nginx

1. Definir contrato único: frontend chama `/api/...`; backend registra `/api/...`; nginx preserva a URI.
2. Fazer o cliente receber caminhos relativos ao prefixo, como `/theses`, ou receber URLs completas de forma consistente — nunca misturar ambos.
3. Migrar chamadas diretas para um cliente compartilhado.
4. Remover construções `/api/api/...`.
5. Atualizar `isApiAvailable()` para testar health same-origin ou remover o guard quando não for necessário.
6. Depois do frontend normalizado, alterar o nginx para preservar `/api`, por exemplo:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
}
```

7. Definir timeout e limites apropriados para IA, upload e respostas normais.
8. Impedir fallback da SPA em caminhos `/api/*`.
9. Adicionar headers seguros e request ID.
10. Executar testes de contrato antes do reload e validar configuração com `nginx -t`.

**Ordem obrigatória:** corrigir o cliente antes do proxy. Corrigir somente nginx fará rotas compensadas acidentalmente pararem de funcionar.

### Etapa 6 — Tornar API e migrations parte do deploy

1. Corrigir `Dockerfile.api` para o workspace pnpm e lockfile real.
2. Criar build multi-stage reproduzível.
3. Incluir a API no compose ou em unidade de serviço versionada.
4. Criar migration job separado, executado uma vez e com falha bloqueante.
5. Adicionar health/readiness checks.
6. Publicar imagem com tag imutável de commit.
7. Registrar no deploy os hashes de frontend, API e schema.
8. Fazer rollout da API antes de ativar consumidores incompatíveis.
9. Implementar rollback para a imagem anterior.
10. Remover scripts antigos ou atualizar a documentação para uma única rotina canônica.

**Critério de aceite:** uma instalação limpa e um upgrade podem ser repetidos sem passos manuais ocultos.

### Etapa 7 — Reconciliar o PostgreSQL com segurança

1. Gerar dump de schema e dados essenciais.
2. Comparar o DDL real com cada migration existente.
3. Identificar quais objetos das migrations iniciais já foram aplicados manualmente.
4. Definir baseline formal no ledger Drizzle sem reexecutar DDL conflitante.
5. Validar o baseline em clone/restauração, nunca primeiro em produção.
6. Aplicar migrations faltantes ou versões reconciliadas para:
   - `creative_projects`;
   - `brand_profiles`;
   - `ai_token_logs`;
   - índices, constraints e políticas associadas.
7. Criar constraints de integridade e índices para consultas reais.
8. Definir retenção e minimização de logs de IA.
9. Executar smoke tests de leitura/escrita em transação controlada.
10. Confirmar rollback ou estratégia forward-fix para cada migration.

**Proibição:** não executar `drizzle-kit migrate` cegamente antes de baseline e teste de restauração.

### Etapa 8 — Completar UX e observabilidade

1. Exibir estados: validando, preparando cards, gerando texto, gerando imagem e finalizando.
2. Exibir erro com código de correlação e ações: tentar novamente, editar configuração ou continuar manualmente.
3. Manter o botão bloqueado somente durante operação ativa.
4. Permitir cancelar geração longa.
5. Preservar conteúdo digitado em qualquer falha.
6. Criar logs estruturados com request ID, usuário, provider, modelo, duração e resultado.
7. Criar métricas para taxa de sucesso, latência, custo, timeout e falhas por etapa/provider.
8. Adicionar alertas para aumento de erros, fila parada, API indisponível e migration divergente.
9. Não registrar prompts completos, respostas sensíveis ou segredos por padrão.

### Etapa 9 — Testes obrigatórios

#### Unitários

1. criação de skeletons para cada template e quantidade;
2. validação de todos os modos de fonte;
3. mapeamento de campos heterogêneos;
4. resposta inválida/incompleta do provider;
5. modelo ausente, removido ou desabilitado;
6. reducers/estado do wizard;
7. adapters de erro e resultado.

#### Integração

1. gateway com mocks contratuais de cada provider;
2. testes do fluxo submit/status/result da fal;
3. rotas autenticadas, rate limit e autorização;
4. cliente HTTP sem duplo prefixo;
5. migrations em banco vazio e em snapshot reconciliado;
6. persistência de projetos, perfis e token logs.

#### E2E

1. texto livre avança da etapa 3 à 4;
2. tese selecionada avança e usa o conteúdo correto;
3. Markdown importado avança;
4. modelo inválido mostra erro e mantém os dados;
5. falha de rede permite retry;
6. clique duplo cria uma única geração;
7. cancelar encerra a chamada e libera a UI;
8. capa com IA, quando habilitada, conclui ou falha visivelmente;
9. refresh recupera apenas estado não secreto permitido;
10. fluxo completo chega ao canvas e exporta.

#### Infraestrutura

1. `/api/health` retorna JSON, nunca HTML;
2. rota desconhecida em `/api` retorna 404 JSON;
3. frontend e API publicados exibem o mesmo release ID;
4. container reinicia e volta saudável;
5. migration job é idempotente;
6. restauração do backup é comprovada.

### Etapa 10 — Atualizar documentação canônica

Depois que as correções forem implementadas:

1. restaurar/criar o índice canônico `Docs/README.md` ou alinhar as instruções do repositório ao índice real;
2. atualizar `docs/architecture/ai.md` com gateway, modelos e gestão de segredos;
3. atualizar `docs/architecture/data-and-jobs.md` com API, migrations, jobs e token logs;
4. atualizar `docs/architecture/projects.md` com persistência e contratos;
5. atualizar `docs/architecture/overview.md` com o fluxo real do wizard;
6. atualizar `deploy/DEPLOY.md` com API, migration job, health checks e rollback;
7. remover afirmações que descrevam recursos ainda não operacionais;
8. registrar limitações e gates pendentes sem expor dados sensíveis.

## 6. Ordem recomendada de entrega

1. Preparar backup, baseline e rollback.
2. Corrigir inicialização/navegação do wizard com testes.
3. Tipar o contrato dos templates e respostas.
4. Normalizar catálogo e seleção de modelos.
5. Implementar autenticação e gateway de IA no backend.
6. Normalizar o cliente HTTP.
7. Corrigir nginx sem expor rotas desprotegidas.
8. Tornar build/deploy da API reproduzível.
9. Reconciliar e aplicar migrations faltantes.
10. Completar observabilidade, E2E e documentação.

Mudanças de nginx, API e banco devem ser liberadas em janelas separadas ou com gates independentes para permitir rollback seguro.

## 7. Arquivos prioritários para implementação

- `src/features/wizard/hooks/useWizardAI.ts`
- `src/features/wizard/steps/WizardStep3Content.tsx`
- `src/features/wizard/steps/WizardStep4Script.tsx`
- `src/features/wizard/WizardView.tsx`
- `src/stores/useWizardStore.ts`
- `src/lib/ai/generateCopy.ts`
- `src/lib/ai/generateImage.ts`
- `src/lib/ai/providers/*`
- `src/lib/ai/testConnection.ts`
- `src/features/ai/AIConfigView.tsx`
- `src/lib/api/client.ts`
- `src/lib/api/guards.ts`
- rotas e bootstrap do servidor Hono
- configuração nginx da VPS
- `Dockerfile.api`
- `docker-compose.yml`
- migrations Drizzle e configuração de deploy
- documentação canônica listada na etapa 10

## 8. Definição de pronto

O trabalho estará concluído somente quando:

- a etapa 3 avança com todas as fontes de conteúdo suportadas;
- qualquer falha aparece na tela com ação de recuperação;
- nenhuma geração termina silenciosamente;
- cards são criados antes da chamada de IA;
- o contrato respeita todos os campos do template;
- modelos de texto e imagem são selecionados explicitamente e estão ativos;
- testes de conexão usam os mesmos adapters da geração;
- nenhuma chave de IA chega ao navegador;
- a fila fal segue o contrato oficial;
- todas as chamadas usam uma única convenção `/api`;
- nginx preserva a URI e não entrega SPA para erros de API;
- rotas públicas estão autenticadas, autorizadas e limitadas;
- API publicada corresponde ao commit do frontend;
- banco possui schema esperado e ledger reconciliado;
- migrations funcionam em banco novo e em upgrade;
- build, lint, testes unitários, integração e E2E passam;
- logs e métricas permitem localizar cada falha;
- documentação canônica descreve exatamente o estado implementado.

## 9. Alertas para a execução

- Não corrigir o nginx antes de remover o duplo prefixo do frontend.
- Não expor as rotas corrigidas antes de autenticação e rate limiting.
- Não executar migrations em produção antes de baseline, backup e teste de restauração.
- Não manter credenciais de produção no navegador durante a transição.
- Não considerar o fluxo corrigido apenas porque a etapa muda visualmente; a geração, persistência, retry e observabilidade também devem ser validados.
- Não apagar ou sobrescrever alterações locais existentes sem revisão do responsável.

