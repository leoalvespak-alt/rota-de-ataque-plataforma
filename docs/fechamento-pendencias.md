# Fechamento — Pendências Finais

> **Data:** 2026-08-11 · **Base:** re-auditoria após a execução dos Blocos A–D de `auditoria-multicanal-e-correcoes.md`.
>
> **Estado geral:** os 4 blocos foram executados. Git versionado (468 arquivos, hooks ativos), `.env.example` limpo, Fase 20 (humanização por canal) implementada com regras dos 5 canais e comparação cross-channel, Fase 21 (feedback loop) com tabela + view + EMA em dry-run, e os 11 patterns do Apêndice L criados. Migrations chegaram a 0007.
>
> Restam **4 itens pequenos e localizados**. Nenhum bloqueia operação; 2 afetam qualidade de dados e resiliência.

---

## Correções de auditorias anteriores

Duas afirmações minhas anteriores estavam erradas e são retificadas aqui:

1. **"Nada popula `content_performance`"** — incorreto. `email-events-consumer`, `threads-publisher` e `whatsapp-inbound` gravam na tabela com `ON CONFLICT` adequado. Falha do meu comando de verificação, não do código.
2. **"`conversation-agent` aplica regra de Instagram em conversas de WhatsApp"** — incorreto. O worker consulta `own_dm_threads` / `own_dm_messages`, ou seja, é **exclusivo de Instagram DM**. O default `channel:'instagram'` está correto. O WhatsApp segue um caminho próprio (ver Pendência 1).

---

## Pendência 1 — WhatsApp não gera resposta candidata (decisão de escopo)

**Situação atual:** `whatsapp-inbound` grava a mensagem, cria `lead`/`identity`/`timeline_events` e abre item em `review_inbox` — mas **não gera texto candidato**. A resposta é escrita por humano via `/api/whatsapp/messages` e depois validada por `validateChannelText('whatsapp_dm', ...)` dentro de `whatsapp-outbound`.

**Versus a especificação:** o Passo 16.4.4 previa que a mensagem inbound passasse pelo `conversation-agent` para classificação + geração de resposta candidata, com aprovação humana.

**Avaliação:** isto é uma **simplificação, não um defeito**. O desenho atual é mais conservador — humano escreve, máquina valida contra as regras do canal. Dado que WhatsApp é o canal de maior risco de ban (D12), há argumento sólido para mantê-lo assim.

**Decisão necessária (sua):**

- **Opção A — manter como está.** Zero trabalho. Atualizar o Passo 16.4.4 do prompt para refletir "resposta humana validada por regra de canal" e registrar no CHANGELOG como desvio consciente.
- **Opção B — implementar o copiloto.** Estender `whatsapp-inbound` para chamar `humanize({ channel:'whatsapp_dm', purpose:'whatsapp_reply', ... })` e anexar o candidato ao item de `review_inbox`, preservando a aprovação humana obrigatória.

**Recomendação:** Opção A por ora. Reavaliar quando o volume de conversas justificar — copiloto só compensa quando o operador estiver gastando tempo real digitando.

**DoD (qualquer opção):** prompt e CHANGELOG refletem a escolha; nenhum dos dois pode divergir do código.

---

## Pendência 2 — Instagram fora do `content_performance` 🟠

**Situação:** três canais alimentam a tabela (`email`, `threads`, `whatsapp_dm`). O **Instagram não** — `workers/meta-sync/src/main.ts` grava em `own_media` (com `insights`) mas nunca em `content_performance`.

**Consequência real:** o job de EMA da Etapa C.3 calibra pesos de `campaign_scoring_config` a partir de `mv_content_performance_by_thesis`. Como o Instagram é o canal de maior volume de distribuição, a calibração roda sobre uma amostra enviesada — o canal principal simplesmente não vota.

**Ação:**

- **Passo 2.1** — Em `workers/meta-sync/src/main.ts`, no ponto em que os insights de `own_media` são persistidos, adicionar upsert em `content_performance` para as mídias que tenham vínculo com uma variant. O vínculo existe via `content_publications (variant_id, channel='instagram', external_id = ig_media_id)`:
  ```sql
  INSERT INTO content_performance(variant_id, channel, impressions, reach, engagements, saves, shares)
  SELECT publication.variant_id, 'instagram', $2, $3, $4, $5, $6
  FROM content_publications publication
  WHERE publication.channel = 'instagram' AND publication.external_id = $1
  ON CONFLICT (variant_id) DO UPDATE SET
    impressions = GREATEST(content_performance.impressions, EXCLUDED.impressions),
    reach       = GREATEST(content_performance.reach,       EXCLUDED.reach),
    engagements = GREATEST(content_performance.engagements, EXCLUDED.engagements),
    saves       = GREATEST(content_performance.saves,       EXCLUDED.saves),
    shares      = GREATEST(content_performance.shares,      EXCLUDED.shares),
    computed_at = now();
  ```
  Use `GREATEST` (não soma) porque insights da Meta são cumulativos — somar a cada sync inflaria os números.
- **Passo 2.2** — Garantir que o `publisher` (Instagram) grave `content_publications` com `external_id = ig_media_id` na publicação, para o join acima existir. Verificar; se não gravar, corrigir junto.
- **Passo 2.3** — Teste de integração: publicar variant Instagram mock → rodar meta-sync com insights mock → `content_performance` tem 1 linha com `channel='instagram'`; rodar meta-sync de novo com os mesmos insights → valores **não** dobram.
- **DoD:** 4 canais alimentando a tabela; `mv_content_performance_by_thesis` retorna linhas de Instagram; EMA passa a considerar o canal principal.

---

## Pendência 3 — Repositório sem remote 🟡

**Situação:** `git remote -v` vazio. O repositório é local: há histórico e hooks, mas nenhum backup fora da máquina e o CI não roda em pull request (o `ci.yml` existe, mas sem remote não há PR para disparar).

**Ação:**

- **Passo 3.1** — Criar repositório **privado** (GitHub) — ex.: `rota-de-ataque-plataforma`. Privado não é opcional: o repo contém runbooks de operação, políticas de contato e estrutura de dados de leads.
- **Passo 3.2** — Antes do primeiro push, revarrer o histórico inteiro (não só o working tree):
  ```bash
  git log -p --all | grep -inE "(secret|token|password|api[_-]?key)\s*[=:]\s*[A-Za-z0-9_\-]{16,}" | head
  ```
  Se houver qualquer hit em commit antigo, **não faça push** — reescreva o histórico antes (`git filter-repo`) ou recrie o repositório a partir de um commit inicial limpo.
- **Passo 3.3** — `git remote add origin ...` + `git push -u origin main`.
- **Passo 3.4** — Ativar branch protection em `main`: exigir PR, exigir `design-system-no-regression` e `workspace-quality` verdes.
- **Passo 3.5** — Abrir 1 PR de teste (qualquer alteração trivial) e confirmar que o CI executa de verdade — essa é a primeira vez que ele roda.
- **DoD:** remote configurado, push feito, CI verde num PR real, branch protection ativa.

---

## Pendência 4 — Rota `/communities` ausente 🟡

**Situação:** existe `/community` (mapa de grafo de leads, Fase 6.7 do plano-mestre) — outra coisa. A rota `/communities` (grupos de WhatsApp, Fase 17) não existe, e o Passo D.2.3 pedia um placeholder explícito para não deixar link quebrado.

**Ação:**

- **Passo 4.1** — Criar `apps/web/src/app/communities/page.tsx` com `EmptyState` honesto:
  > "Grupos de WhatsApp aguardando liberação da Groups API para esta conta Meta. Consulte `docs/compliance/whatsapp-groups-availability.md`."
  Incluir botão "Verificar disponibilidade" chamando `scripts/whatsapp-groups-availability-check.mjs` (ou rota admin equivalente) e exibindo o resultado com data da checagem.
- **Passo 4.2** — Adicionar o item no menu lateral com badge "Indisponível" em `text.tertiary` — visível mas claramente inativo, para não sugerir funcionalidade que não existe.
- **Passo 4.3** — Quando a Groups API for liberada, esta rota vira a tela da Etapa 17.5 sem mudar de caminho.
- **DoD:** rota navegável, sem 404, comunicando o motivo real.

---

## Itens menores (opcionais)

- **`dm-copilot` e `private-reply`** chamam `humanize()` sem `channel`, dependendo do default `'instagram'`. Está correto hoje, mas é acoplamento implícito: se o default mudar, os dois quebram silenciosamente. Passar `channel:'instagram'` explicitamente custa uma linha em cada.
- **4 páginas ainda genéricas** onde a especificação pedia layout próprio: `page.tsx` (overview → `DashboardGrid`, Etapa 6.2), `configs` (→ `FormPanel2Pane`, Etapa 6.10.3), `contact-policies` e `content-opportunity`. As outras 5 genéricas (`radar`, `competitive-intel`, `source-roi`, `timeline`, `conversations`) foram explicitamente autorizadas no Passo D.4 — só especializar quando houver uso real.

---

## Ordem recomendada

| # | Item | Esforço | Por quê nessa ordem |
|---|------|---------|---------------------|
| 1 | Pendência 3 (remote + CI) | ~30 min | Sem backup offsite, todo o resto está em risco. E o CI precisa rodar antes dos próximos commits. |
| 2 | Pendência 2 (Instagram) | ~1 h | Afeta qualidade dos dados que vão calibrar o scoring. Quanto antes, menos histórico enviesado. |
| 3 | Pendência 4 (`/communities`) | ~15 min | Cosmético, mas elimina link quebrado. |
| 4 | Pendência 1 (decisão) | decisão | Pode ficar como está; só precisa alinhar prompt e código. |
| 5 | Menores | ~1 h | Sem pressa. |

---

## Verificação final

```bash
cd plataforma
git remote -v                                            # P3
grep -c content_performance workers/meta-sync/src/main.ts   # P2: > 0
ls apps/web/src/app/communities                          # P4
pnpm typecheck && pnpm test && pnpm check:hashes
```

Depois disso, a expansão multicanal está fechada e o que resta é **Bloco E**: credenciais reais, deploy e ativação por canal na ordem do Passo 22 — que não deixa rastro no repositório e precisa ser confirmado no VPS (`/api/health` + estado das feature flags).
