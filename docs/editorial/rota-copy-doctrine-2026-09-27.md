# Doutrina de copy da Rota de Ataque

Snapshot local registrado em 27/09/2026. A fonte versionada está em [`skill-snapshot/rota-social-criativos`](skill-snapshot/rota-social-criativos/SKILL.md); `skill-snapshot/manifest.json` registra SHA-256 e tamanho de cada arquivo. A impressão digital da árvore é `db63969140f529b8036fcff21217fa1a871284c634afd7067fb854253c7c89ce`.

## Precedência editorial

1. Fatos atuais do produto, oferta e fontes verificáveis limitam as alegações.
2. O pedido e as decisões aprovadas para a peça definem público, escopo e objetivo.
3. Esta versão congelada da skill e as fontes de marca orientam a redação e a arte.
4. Convenções gerais de persuasão e formato entram por último.

Copy conduz atenção e decisão. Conteúdo entrega compreensão. Uma peça educativa pode usar uma abertura persuasiva e ainda desenvolver procedimento, motivo, exemplo e limite. A capa curta não define a extensão do corpo.

## Regras que valem para todas as peças

- Trabalhar em português brasileiro e nomear o público pela situação que o briefing confirma.
- Escrever o argumento antes de dividi-lo em cards, telas ou cenas.
- Distinguir fato confirmado, interpretação, recomendação didática, exemplo hipotético e lacuna de fonte.
- Não inventar capacidade do produto, resultado, depoimento, estatística, data, valor, citação ou experiência.
- Quando faltar base factual, retirar a alegação ou registrar a lacuna fora do texto publicável.
- Evitar o vocabulário, as construções retóricas e os sinais gráficos listados na skill congelada. Em copy final de post, carrossel e Story, não usar travessão.
- Cada peça factual continua em revisão humana até existir validação por alegação e política aprovada.
- Uma pontuação automática de estilo nunca representa confirmação factual.

## Contrato por formato

| Formato | Entrega editorial | Condições de qualidade |
|---|---|---|
| Post | Uma orientação, descoberta, comparação ou convite completo em uma imagem. | Contexto reconhecível; instrução aplicável; motivo ou critério quando educativo; a legenda não completa a mensagem principal. |
| Carrossel | Um argumento ou procedimento desenvolvido em sequência. | A capa promete uma entrega real; cada card acrescenta um passo ou demonstração; o fechamento permite aplicar; sem numeração visível. |
| Story | Uma situação, passo ou dúvida em telas rápidas. | Uma contribuição por tela; sequência progressiva; contexto suficiente para quem entrar no meio; interação nativa não é desenhada como se fosse controle real. |
| Slide | Uma ideia por tela numa apresentação. | Título informativo; explicação ligada à fonte; ordem lógica; sem coleção de slogans. |
| Documento | Resposta de consulta com contexto, passos, demonstração e limites. | Resposta central cedo; seções por decisão; exemplos identificados; fonte próxima de alegações factuais. |

Blog, legenda e roteiro de Reel têm contratos próprios na skill. O formato de dados atual do Design ainda não os representa como variantes independentes por canal; essa parte da Etapa 6 segue aberta.

## Contrato no código

`apps/design-system/src/server/editorial/copy-contracts.ts` fornece os cinco contratos que o runtime atual conhece e compõe as instruções de geração. Carrossel e Story pedem delimitadores próprios; o parser usa parágrafos como recuperação quando o provedor os omite. Formato sem contrato é recusado.

`generateCopy` marca todo resultado como pendente de aprovação humana. `evaluateQuality` deixa factual grounding nulo até uma verificação por alegação fornecer evidência; o campo não entra na média geral enquanto não tiver nota. `rewriteIfNeeded` guarda o motivo como metadado de revisão e preserva o texto, sem inserir nota editorial na copy.

Essas barreiras são locais. Ainda faltam o gateway editorial final, variantes vinculadas a canal, registro de proveniência por alegação, QA por versão/hash e exemplos reais aprovados. Não existe geração aprovada ou publicação autorizada por este snapshot.

## Fontes congeladas

O manifesto lista todos os arquivos capturados e seus hashes. Os documentos centrais incluem `SKILL.md`, `references/copy-por-formato.md`, `references/rota-brand-and-evidence.md`, `references/guia-escrita-natural-ptbr.md` e `references/aprofundamento-copy.md`. A origem era o skill local `rota-social-criativos` em 27/09/2026; alterações futuras na skill exigem novo snapshot e revisão desta doutrina.

## Estado dos gates

- A Etapa 6 está codificada em parte, sem aceite de produção.
- O usuário informou que adicionará a credencial JEV depois. Nenhuma credencial JEV foi recebida ou testada.
- A escolha e configuração do provedor primário e da contingência ficam para a última frente do trabalho, conforme a orientação do usuário.
- A revisão humana permanece obrigatória; nenhuma peça pode seguir para publicação a partir da pontuação local.
