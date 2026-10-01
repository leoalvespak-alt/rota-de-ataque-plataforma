# Manifesto do catálogo editorial de 50 composições

Preparação local da Etapa 7. IDs já existentes foram preservados como aliases; novas entradas são especificações de composição. As 24 propostas ainda não têm renderer. Este manifesto não declara layouts aprovados nem prontos para uso.

## Política de canvas

- Feed e carrossel: 1080 × 1350 px.
- Story: 1080 × 1920 px; texto essencial fora de 250 px no topo e 200 px na base.
- Sem barra editorial, paginação visível, redução automática de fonte ou substituição de texto por dado fictício.
- Cada composição é definida pela relação entre leitura, prova e mensagem. Troca isolada de cor, tipografia ou imagem não gera um layout novo.
- Texto principal parte de 67 CSS px no canvas de 1080 px; nenhum texto visível fica abaixo de 20 CSS px. A inspeção ocorre no PNG exportado e em leitura de telefone.

## 26 IDs já presentes no registry

| ID legado | Formato de destino | Função mantida | Estado |
|---|---|---|---|
| `sq-cover` | feed | Capa tipográfica | renderer legado; revisar canvas |
| `sq-text-image` | feed | Texto e imagem em relação lateral | renderer legado; revisar prova |
| `sq-content` | feed | Explicação editorial | renderer legado; revisar densidade |
| `sq-quote` | feed | Citação ou destaque | renderer legado; exigir fonte de citação |
| `sq-tip` | feed | Orientação aplicável | renderer legado; completar critério |
| `sq-two-images` | feed | Comparação entre duas provas | renderer legado; confirmar contexto |
| `sq-steps` | feed | Procedimento em sequência | renderer legado; revisar agrupamento |
| `sq-stats` | feed | Indicador numérico | renderer legado; evidência obrigatória |
| `sq-profile` | feed | Depoimento identificado | renderer legado; autorização e fonte obrigatórias |
| `sq-tweet` | feed | Mensagem em bloco tipográfico | renderer legado; sem aparência de captura falsa |
| `sq-table` | feed | Comparação tabular | renderer legado; leitura a 20 px |
| `sq-checklist` | feed | Critérios de conferência | renderer legado; manter itens acionáveis |
| `pt-cover` | Story | Abertura de sequência | renderer legado; revisar zona segura |
| `pt-content` | Story | Explicação em tela única | renderer legado; revisar zona segura |
| `pt-image` | Story | Foto com mensagem | renderer legado; imagem precisa ter função |
| `pt-quote` | Story | Citação | renderer legado; exigir fonte de citação |
| `pt-list` | Story | Tópicos | renderer legado; revisar leitura rápida |
| `pt-cta` | Story | Ação/link | renderer legado; destino precisa existir |
| `cr-cover` | carrossel | Capa tipográfica | renderer legado; remover campo `page` visível |
| `cr-cover-dark` | carrossel | Capa com prova escura | renderer legado; compor sem paginação |
| `cr-slide` | carrossel | Explicação aberta | renderer legado; revisar escala 4:5 |
| `cr-text-image` | carrossel | Prova e texto assimétricos | renderer legado; revisar crop |
| `cr-list` | carrossel | Lista desenvolvida | renderer legado; sem contagem decorativa |
| `cr-fact` | carrossel | Um fato em destaque | renderer legado; evidência obrigatória |
| `cr-comparison` | carrossel | Comparação em duas colunas | renderer legado; comparar bases equivalentes |
| `cr-cta` | carrossel | Aplicação e ação final | renderer legado; CTA não substitui conclusão |

## 24 novas composições propostas

| ID | Formato | Estrutura dominante | Conteúdo exigido | Estado |
|---|---|---|---|---|
| `feed-editorial-column` | feed | Coluna tipográfica assimétrica com margens amplas | Tese curta e explicação completa | proposta |
| `feed-proof-macro` | feed | Crop de prova ocupa a maior área; legenda acompanha o detalhe | Captura ou documento autêntico e atribuição | proposta |
| `feed-method-map` | feed | Fluxo em zigue-zague com blocos abertos conectados | Passos causais com verbos e critério | proposta |
| `feed-decision-tree` | feed | Ramificações visuais com saída legível | Condições e resultado sustentados | proposta |
| `feed-side-by-side` | feed | Duas massas de texto de mesma escala, sem cartões repetidos | Comparação com bases equivalentes | proposta |
| `feed-open-sequence` | feed | Uma faixa contínua conduz o olho de contexto a aplicação | Contexto, mudança e consequência confirmados | proposta |
| `feed-exam-anatomy` | feed | Questão real ampliada com anotação externa | Fonte, trecho e explicação conferíveis | proposta |
| `feed-date-line` | feed | Linha temporal horizontal, sem cabeçalho de seção | Datas e eventos com fonte primária | proposta |
| `feed-mistake-diagnosis` | feed | Sintoma e critério de correção em planos distintos | Erro didático identificado e correção aplicável | proposta |
| `feed-principle-rule` | feed | Regra em tipografia dominante, condição em margem lateral | Regra, exceção e limite | proposta |
| `feed-annotated-example` | feed | Exemplo grande com chamadas ligadas ao trecho | Exemplo marcado como didático ou fonte real | proposta |
| `feed-single-cta` | feed | Mensagem e ação com grande área de respiro | Ação real e destino confirmado | proposta |
| `story-entry-any-frame` | Story | Contexto e título repetem o referente em qualquer tela | Uma dúvida ou situação por tela | proposta |
| `story-scenario-branch` | Story | Escolha visual entre dois casos com saída por tela seguinte | Condições claras, sem simular enquete | proposta |
| `story-step-rail` | Story | Trilho vertical de procedimento com blocos espaçados | Uma etapa completa em cada tela | proposta |
| `story-source-focus` | Story | Crop da fonte ocupa o centro, explicação em área segura | Fonte legível e contexto mínimo | proposta |
| `story-answer-ladder` | Story | Pergunta real, critério, resposta e aplicação em telas distintas | Dúvida legítima e resposta verificada | proposta |
| `story-action-safe-zone` | Story | Mensagem e CTA na faixa central, margens seguras livres | Ação e destino confirmados | proposta |
| `carousel-case-walkthrough` | carrossel | Situação hipotética identificada, seguida por análise progressiva | Premissas explícitas, decisão e limite | proposta |
| `carousel-evidence-led` | carrossel | Prova aparece cedo e muda de escala ao longo da explicação | Documento autêntico, contexto e alegação sustentada | proposta |
| `carousel-decision-path` | carrossel | Caminho ramificado convertido em sequência de escolhas | Condições completas e saídas verdadeiras | proposta |
| `carousel-misconception-check` | carrossel | Afirmação, teste da fonte e correção em composições diferentes | Mito identificado e correção documentada | proposta |
| `carousel-comparison-matrix` | carrossel | Atributos comparados por linhas abertas entre cards | Critérios comparáveis e dados citáveis | proposta |
| `carousel-application-lab` | carrossel | Regra, exemplo didático, tentativa e aplicação final | Exemplo rotulado e solução explicada | proposta |

## Gate para trocar proposta por aprovada

Cada entrada precisa de renderer e controles funcionais, campos definidos, variante por densidade, conteúdo de demonstração com origem, exportação no canvas de destino e PNG inspecionado em escala integral e de telefone. A aprovação visual também confere piso tipográfico, crop, alinhamento, consistência preview/export e ausência de moldura ou conteúdo inventado.

O registry atual continua em 26 renderers. Os 24 IDs novos são nomes de trabalho, sem implementação visual ou aceite. A seleção atual ainda escolhe principalmente por formato, extensão e uso recente; função narrativa e densidade precisam entrar na próxima mudança do selector.
