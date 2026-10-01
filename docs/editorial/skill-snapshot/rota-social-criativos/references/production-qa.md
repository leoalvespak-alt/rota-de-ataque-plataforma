# Produção e QA dos PNGs

Leia ao criar, alterar ou exportar peças. Preserve arquivos do usuário e mantenha versão recuperável do conjunto anterior antes de substituir saídas. O processo é **HTML/CSS → render → pre-flight automático → inspeção visual → correção → novo render → novas checagens**.

## Antes de renderizar

Confira a [revisão de substância](aprofundamento-copy.md) e o destino em [copy por formato](copy-por-formato.md). Registre qualquer corte de critério, exemplo ou ressalva que altere a compreensão e corrija a composição. Texto apenas redigido não recebe status de QA visual; esta referência se aplica à produção de imagens.

1. Verifique arquivo de marca, plano/edição, missão, tela e oferta atuais; mantenha o registro `peça → afirmação → origem` descrito em [marca e evidência](rota-brand-and-evidence.md).
2. Confirme que a direção aprovada atende à estratégia e que o canvas foi desenhado no tamanho final. Diferencie captura autêntica de ilustração adaptada.
3. Carregue fontes, logo, brasão e capturas locais; evite links remotos frágeis na exportação. Não use SVG/HTML simulando depoimento, questão, progresso ou tela real inexistente.
4. Renderize o PNG nativo com o mesmo DOM/CSS do preview. Registre quantidade, nomes e dimensões. Faça folha de contato se houver lote, mas confira também cada arquivo.

## Pre-flight automático, quando houver navegador automatizado

Depois do render e **antes** de julgar a arte visualmente, use Playwright/Puppeteer ou a infraestrutura existente; não adicione framework só para esta etapa. Para cada canvas/peça:

1. Confirme viewport esperado, `getBoundingClientRect()` do canvas, `clientWidth/clientHeight` e dimensões reais do PNG. O arquivo exportado precisa corresponder ao canvas esperado (feed/carrossel `1080×1350`, Story `1080×1920`, salvo briefing diferente).
2. Meça `scrollWidth` e `scrollHeight` do canvas e, quando a página exportada inteira for o canvas, também do documento. Sinalize overflow horizontal/vertical não intencional; não trate crop decorativo aprovado como erro.
3. Aguarde `document.fonts.ready`, confira fontes esperadas com `document.fonts.check(...)` e identifique assets que falharam (`requestfailed`/erro de carregamento). Para cada `<img>` relevante, exija `complete` e `naturalWidth > 0`.
4. Confira elementos essenciais presentes por seus retângulos: gancho, prova exibida, CTA e marca não devem sair do canvas. Em Story, elementos essenciais também respeitam a zona segura definida para a peça.
5. Confira quantidade esperada de peças, existência de todos os PNGs, tamanho não nulo dos arquivos e correspondência entre dimensão esperada, canvas medido e PNG gravado.
6. Para assets destinados a flutuar, quando a ferramenta permitir, confira canal alfa nos pixels de margem; extensão `.png`/`.webp` sozinha não garante transparência. Sinalize proporção exibida incompatível com a natural, salvo crop deliberado. Essas checagens são alertas, não substituem inspeção das bordas no fundo final.
7. Meça a tipografia visível no DOM: títulos principais, incluindo os internos, têm piso de **67 CSS px (50 pt)**; todo outro texto tem piso de **20 CSS px (15 pt)** no canvas final de 1080 px de largura. Explicações centrais normalmente partem de 30 a 38 px. Considere a escala efetiva aplicada aos elementos, não só `font-size`: `transform`, `zoom` ou grupos SVG podem reduzir o resultado. Liste o título e o menor texto de cada peça, ajuste copy/layout e respeite pedido atual que fixe outra escala. Não aprove por esconder, cortar ou reduzir texto. Texto rasterizado nas capturas exige inspeção no PNG.
8. Conte as aplicações visíveis da logo Rota por criativo: máximo **uma**. Brasão do concurso e marca que faça parte da interface real da captura não contam como aplicação gráfica da logo. Se header e rodapé repetirem a Rota, remova uma das aplicações.
9. Procure cabeçalhos e rodapés repetidos com assunto, concurso/cargo, edição e número/total de cards. Remova-os; não use numeração em carrossel nem Stories.
10. Leia o escopo da copy ao lado do escopo do CTA. Se o tema é geral, retire nomes de concurso/cargo também das legendas das provas e do convite final. A pasta ou o print de origem não torna o conteúdo específico.
11. Compare as pessoas visíveis entre todas as capas do lote. Pose e roupa não contam como identidades diferentes. Troque fotos repetidas por pessoas distintas ou por uma composição sem rosto; aceite repetição só como exceção registrada.
12. Pesquise o texto extraído do HTML por `—`. O resultado deve ser zero na copy editável de títulos, apoio, rótulos e CTAs.
13. Compare a distribuição do lote com o mapa de estilos. Fundos de imagem em tela cheia devem ocupar aproximadamente 15% das telas em lotes com várias peças; não replique a mesma estrutura em três cards consecutivos.
14. Se houver imagem ou recorte contínuo entre cards, inspecione cada peça separada e o par lado a lado. As emendas coincidem e nenhum texto, controle ou parte necessária da captura cruza o corte?
15. Se houver sombra, gradiente, brilho ou contorno no texto, confirme contraste, leitura das formas e piso de 15 pt no PNG final. Rejeite acúmulo de efeitos ou brilho que concorra com a mensagem.

Registre falhas por peça; corrija e refaça render/pre-flight. Essas verificações podem ser executadas diretamente no navegador automatizado, sem scripts próprios da skill. **Pre-flight encontra erros estruturais; QA visual encontra legibilidade, hierarquia, sobreposição, artificialidade e sentido.** Passar no pre-flight não aprova o design.

## Inspeção visual obrigatória

- **Tamanho integral:** examine alinhamentos, corte, sombras, pixelização, artefatos, textos encobertos, qualidade de assets e bordas. Elementos dentro do canvas ainda podem se sobrepor.
- **Escala de celular:** ~25% da largura original para feed/carrossel e visualização de telefone para Story. Na capa, reconheça a situação delimitada pelo pedido e o motivo para continuar; na demonstração, entenda a prova; no fechamento, perceba a ação. Texto essencial que vira textura é falha.
- **Piso e conforto de leitura:** confira títulos principais de pelo menos 67 CSS px e todo outro texto de pelo menos 20 px no canvas 1080, salvo pedido atual diferente. Examine também em escala de telefone: cumprir o piso nominal não basta se a explicação fica pequena. Leia texto embutido em prints; amplie/re-enquadre a prova para que as palavras necessárias tenham tamanho confortável. Recomponha colunas, reduza decoração ou redistribua explicações antes de cortar raciocínio ou reduzir fonte.
- **Marca e tom social:** procure aplicações repetidas da logo e remova até haver no máximo uma por arte. A peça deve ser lida como conteúdo de feed, com hook/benefício e linguagem direta; micro-rótulos, espaçamento excessivo e hierarquia de documento são sinais para recompor.
- **Faixas cromáticas:** passe por posts, cada card e todos os Stories procurando filetes saturados sob títulos, nas laterais de caixas, no topo de etapas ou como progresso decorativo. Remova barras sem significado; substitua por hierarquia tipográfica, painéis completos e discretos, contornos neutros ou setas alinhadas. Mantenha apenas uma barra que comunique dado/estado funcional ou pertença a uma captura autêntica; não altere a captura para esconder o detalhe. Se ele comprometer a composição, escolha outro recorte real ou apresente uma transcrição atribuída, sem simular a interface.
- **Prova focal, quando exibida:** no tamanho de feed/mobile, o detalhe central ainda pode ser compreendido sem zoom manual? Se não, recorte mais, amplie, retire informação secundária ou mude o enquadramento. Em peça demonstrativa, oculte mentalmente o parágrafo explicativo: a captura ainda comunica parte relevante do argumento? Se não, a direção da prova está fraca.
- **Segurança do recorte:** examine cada borda da captura dentro da arte. Nenhuma letra, palavra, botão, tempo, ícone ou linha pode ser amputado ou tocar a borda por acidente; preserve respiro interno/frame e use o tamanho necessário para manter legível o conteúdo focal. Essa revisão vale para posts, cada card e cada Story.
- **Recortes e transparência:** examine o PNG final, não só o mosaico de preview. Logo/brasão que deveriam flutuar têm alfa real, sem retângulo opaco ou halo? Screenshot branco mantém o branco autêntico da UI, mas está enquadrado intencionalmente em vez de parecer uma folha colada? Há palavras, botões, contornos ou sombras cortados, sobras acidentais de print ou imagem esticada?
- **Story:** confira se gancho, prova quando exibida, CTA e qualquer sticker reservado cabem em `250 ≤ y ≤ 1720`, salvo especificação atual diferente.
- **Integridade:** confirme missão, disciplina, assunto, ação e botões mostrados; norma/artigo, vídeo, questão, tempo, contagem, preço e progresso têm origem. Número histórico do plano de redesign não basta. Uma captura recortada não pode inverter o sentido da interface.
- **Ritmo do conjunto:** compare peças vizinhas; se forem o mesmo Canva com título trocado, recomponha. Se uma peça tem metade vazia sem dar foco, amplie o elemento principal daquela função (gancho, contexto ou prova) ou reordene. Se está congestionada, distribua a informação. Confira também alinhamento e distância do rodapé/CTA; nenhum bloco pode parecer colidido ou abandonado numa área vazia.
- **Agrupamento interno:** dentro de cada cartão, título e descrição formam um grupo próximo e legível. Evite `justify-content:space-between`, alturas mínimas exageradas ou `margin:auto` que abram um vazio entre nome e explicação ou afastem prova/tarefa do título. Em fluxos, cada etapa e sua explicação ficam juntas; setas ocupam elementos/colunas próprias e alinham no mesmo eixo.

## QA da mensagem, antes de aprovar a arte

- **Regra do Um:** há uma ideia, tensão, benefício e ação dominantes, com alegações sustentáveis? Elementos secundários apoiam ou competem? Prova visual só precisa dominar quando a peça/card é demonstrativo.
- **Teste de 5 segundos:** na capa, a pessoa qualificada reconhece que isto é para ela e por que deve deslizar? No card demonstrativo, entende o que a prova mostra? No post/fechamento, percebe benefício e próximo passo? Não exija que a capa explique toda a interface.
- **Leitura por varredura:** ignore parágrafos menores e leia headline, contexto, destaques, prova quando exibida e CTA. Formam uma mensagem persuasiva coerente ou uma lista desconexa de funções?
- **Adequação:** abertura e CTA combinam com consciência/objetivo da peça? O recurso foi traduzido em benefício relevante, sem prometer resultado além da prova? Hook, diferencial e prova cumprem funções distintas?
- **Escopo:** o concurso/cargo está no pedido ou na copy fornecida? Tema e CTA gerais permanecem gerais mesmo quando a prova vem de um plano específico?
- **Persuasão:** além de mostrar que o recurso existe, a peça deixa claro por que ele importa para aquele aluno? Se parece ficha técnica ou documentação de produto, reescreva contexto/benefício e reequilibre o visual.
- **Interesse:** a pessoa qualificada encontra uma pergunta, tensão ou possibilidade relevante — ou vê apenas números, nomes de assunto e componentes do produto? Para carrossel, aprove a capa separadamente como convite; não aceite que identificação técnica faça sozinha o trabalho do hook.
- **Sequência e valor:** capa atrai público qualificado; a primeira tela de conteúdo já acrescenta orientação útil. Os cards dão contexto, critério, exemplo e prova na medida necessária, cumprem a promessa e mudam a compreensão. Rejeite slogans, explicação que só repete o título, uma frase fragmentada em vários slides e listas que exigem adivinhar a aplicação. Nenhum card existe só para atingir contagem ou repetir print. No Story, cada frame funciona isoladamente e a sequência mantém uma ação principal.
- **Clareza por peça:** leia headline, destaque e apoio como uma frase/argumento. Retire palavra isolada sem função, pergunta sem referente e benefício vago; em sequência, cada card precisa fechar seu ponto e conduzir com clareza ao seguinte. Faça essa leitura em posts, carrosséis e Stories, sem depender da legenda.
- **Ética:** fato não foi tratado como interpretação universal; urgência, preço, prova social, autoridade e benefício possuem fonte? Se uma afirmação factual falhar, troque o ângulo ou registre a evidência faltante conforme [marca e evidência](rota-brand-and-evidence.md).

## Revisão anti-genérico

Pergunte explicitamente e corrija quando a resposta revelar problema:

1. Trocando logo e cor, esta arte serviria para qualquer empresa?
2. Ela repete sem motivo a composição de outros cards ou peças?
3. A abertura cria identificação e interesse ou começa despejando dados técnicos?
4. Se há captura, ela prova algo ou apenas preenche espaço?
5. Na demonstração, qual detalhe da captura importa e está grande o bastante?
6. Informação secundária ocupa mais espaço que o argumento principal?
7. O layout nasceu da ideia ou de um template `headline → print → CTA`?
8. A peça funciona em mobile na função que lhe cabe: atrair, contextualizar, demonstrar ou converter?
9. A interface inteira aparece por necessidade ou por hábito, quando aparece?
10. Crop, escala ou enquadramento tornariam a evidência exibida mais forte sem alterar seu sentido?

Procure também ornamento sem função, fundo competindo com a prova, título inflado para preencher espaço, caixas dispensáveis, tipografia automática, visual de dashboard/SaaS ou slide corporativo, gradiente/glow genérico, cantos arredondados repetidos, três colunas por automatismo, sombra idêntica em tudo, simetria/centralização excessivas, número gigante sem função e decoração com “cara de IA”. **São alertas, não proibições absolutas**: um briefing explícito ou uma prova real pode justificá-los. Se as respostas indicarem genericidade ou prova fraca, recomponha antes de aprovar/exportar o PNG final.

Quando um print foi usado, pergunte ainda: **o recorte parece escolhido ou acidental?** A interface ocupa a área prometida pela composição ou virou uma ilha de texto num retângulo branco? Os assets isolados respeitam de fato a cor/fundo da peça? Se falhar, volte ao asset/crop/CSS e renderize novamente; não trate o defeito apenas com uma legenda explicativa.

## Critério de saída

Os arquivos esperados existem, abrem, têm dimensões corretas e correspondem ao HTML/CSS editável. No canvas de 1080 px de largura, títulos principais têm ao menos 67 CSS px/50 pt e nenhum outro texto visível fica abaixo de 20 CSS px/15 pt, salvo pedido atual diferente. Cada PNG passou por inspeção integral e leitura em telefone, e cada criativo mostra no máximo uma aplicação da logo Rota. A mensagem funciona sem legenda; o conteúdo entrega explicação aplicável, e a prova exibida é legível e fiel. Não há overflow, sobreposição indevida, recorte truncado, caixa branca acidental, halo em asset flutuante, desequilíbrio grosseiro de espaço, baixa legibilidade, afirmação sem fonte ou aspecto de screenshot falso. Registre o resultado por peça e a cobertura de componentes corrigidos. Toda correção visual exige novo PNG e nova inspeção da peça afetada; não declare pronto com validação só por código ou bounding box.
