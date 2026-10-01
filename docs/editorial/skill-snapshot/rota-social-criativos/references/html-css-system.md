# Sistema HTML/CSS → PNG

Use quando a tarefa incluir produção. Prefira HTML/CSS simples e editável; Playwright/Puppeteer para screenshot se já disponível ou fácil de usar. Não migre para Next.js/React nem instale framework grande só para exportar.

## Camadas separadas

```text
CONTEÚDO e origem da prova
  ↓
DIREÇÃO visual e hierarquia
  ↓
LAYOUT / primitivas de informação
  ↓
HTML/CSS editável
  ↓
RENDER no canvas nativo
  ↓
PRE-FLIGHT estrutural + QA visual e factual
  ↓
PNG final
```

Mantenha copy e dados por peça (concurso, formato, papel, hook, apoio, CTA, `proofSource`, tipo `captura|ilustração`, assets) separados dos tokens visuais e do código de exportação. Pode ser um objeto JS simples ou HTML organizado; não crie um motor abstrato maior que a campanha. Não misture texto factual em dezenas de seletores CSS, nem uma única função gigante com copy, layout e screenshot.

## Canvas e tokens

- Autorize cada peça em canvas fixo do **destino**, não em layout desktop “responsivo” posteriormente fotografado. Feed/carrossel `1080×1350`; Story `1080×1920`; mudanças só por briefing.
- Story: reserve a zona essencial `y=250…1720`. Marca decorativa pode tocar áreas externas, mas gancho, prova e ação não.
- Defina poucos tokens semânticos (superfície, texto, texto secundário, cor Rota, cor do concurso, margem, grade-base, famílias tipográficas e escala de sombras/bordas). A campanha escolhe valores. Evite uma lista de centenas de presets combináveis que permita peça fora da marca.
- Fontes reais devem carregar antes da captura (`document.fonts.ready`). Use fallback conhecido e cheque o render; fonte substituída muda quebras e pode cobrir a prova.
- `text-wrap: balance` ajuda em headlines curtas, quando suportado; confira quebra no navegador real. Defina largura e `line-height` intencional. Não dependa de autoajuste que encolha até a mensagem ficar ilegível. Ajuste largura, agrupamento, decoração e distribuição; reescreva redundâncias conservando a promessa e o raciocínio aprovado. Para blocos de leitura, prefira fluxo natural.
- Em canvas 1080 px, trate **20 CSS px (15 pt)** como menor tamanho permitido para qualquer texto visível. A régua inclui etiqueta, legenda de imagem, rodapé e CTA, além de headline/corpo. Layout cede à explicação: retire metadados/ornamento, amplie o bloco e redistribua unidades antes de cortar. Preserve procedimento, critério e condição de aplicação; não encolha fonte. Faça uma checagem computada dos textos DOM e uma leitura do texto rasterizado nas capturas no PNG final.
- Títulos principais, inclusive em cards internos, têm piso de **67 CSS px (50 pt)**. Para corpo central, parta normalmente de 30–38 px e ajuste largura/entrelinha pela leitura. Use tokens semânticos de título, corpo e texto secundário; um piso global de 20 px não assegura essa hierarquia. Evite `scale`, `zoom`, `clamp` ou autoajuste que reduzam texto abaixo do tamanho efetivo; escala da galeria de preview não muda o canvas de exportação. Outras escalas exigem pedido atual ou outro destino explicitado.
- Limite a uma aplicação visível da logo Rota por criativo. Use o componente de marca no cabeçalho ou no rodapé, sem repetir ambos; conte as aplicações efetivamente visíveis após estilos responsivos/variantes. O brasão tem função distinta.

## Primitivas de informação, não moldes visuais

Um componente pode comunicar `hook`, `body`, `list`, `stats`, `quote`, `checklist`, `process`, `comparison`, `CTA`, `image/prova`, `number` ou `highlight`. Use apenas o tipo apropriado ao conteúdo. `stats` exige fonte; `quote`, autor e autorização; `number`, significado contextual. A composição de cada tipo pode variar. Não deixe o sistema gerar automaticamente badge, linha, sombra, número de fundo e CTA em todos os cards.

Dentro de um componente, mantenha partes que explicam a mesma ideia agrupadas. Não use `space-between`, alturas artificiais ou margens automáticas para prender título num extremo e explicação/prova no outro. Comparações usam painéis preenchidos do tamanho do conteúdo e aproximam rótulo e explicação; sequências dão largura consistente a cada etapa e alinham setas em células próprias do mesmo eixo. Inspecione o card individualmente para encontrar vazios internos e desalinhamentos que a folha de contato esconde.

Não use `border-top`/`border-left`, pseudo-elementos ou segmentos de progresso coloridos como acento automático repetido. Destaque com texto, superfície inteira de tom discreto, contorno neutro e setas com função clara. Barra colorida só permanece quando codifica estado/dado real ou está dentro de UI autêntica; se competir com a mensagem, mude o recorte ou componha uma transcrição atribuída, sem reconstruir a interface.

Capturas do produto e assets ficam em caminhos previsíveis junto à peça ou são incorporados de modo portátil quando necessário. Mantenha resolução suficiente para o recorte; não estique captura pequena. Ao publicar HTML de preview, garanta que os recursos também carreguem fora da máquina local. O PNG final deve funcionar independentemente desses caminhos.

## Composição de assets e crop

Classifique cada asset antes do CSS:

- **Flutuante** (logo, brasão, ícone ou recorte isolado): use arquivo com canal alfa real quando o fundo do canvas deve aparecer. Se o original vier com fundo branco/preto, prepare uma versão transparente fiel antes de compor e examine contorno/halo em fundo claro **e** escuro. Não simule transparência cobrindo o retângulo com a cor do canvas, `mix-blend-mode` ou máscara imprecisa.
- **Screenshot/interface:** mantenha as superfícies reais da UI, inclusive branco autêntico. Recorte uma região de interesse com limites deliberados; use um painel/frame somente se ele tornar a transição para o canvas intencional. Não remova o branco da interface como se fosse fundo externo nem redesenhe botões ou números para consertar o crop.

Defina área útil, proporção e posição do crop antes de aplicar `object-fit`, `object-position`, `overflow: hidden` ou transformações. Verifique que palavras, controles, bordas e sombras relevantes não ficam amputados, que não sobra cabeçalho/rodapé acidental da captura e que o conteúdo principal não fica pequeno dentro de um grande retângulo vazio. Não estique imagem nem amplie além da resolução que sustenta o PNG nativo. Um zoom que corta a prova é pior que um recorte menor e legível.

Preview e exportação devem usar o mesmo asset e enquadramento. Depois de renderizar, inspecione o PNG **isolado** e em conjunto, sobre o fundo real da peça; a página de preview pode esconder emendas, faixas brancas ou colisões quando vista apenas como mosaico no navegador.

### Fluxo Pexels (somente quando fotografia contextual fizer falta)

1. Defina query, formato/orientação e função narrativa antes da busca. Use a API de busca oficial para obter 5–10 opções e monte uma folha de contato local para avaliação visual — não escolha automaticamente pelo primeiro resultado.
2. Julgue a foto na composição final em baixa fidelidade: sujeito/gesto coerentes, espaço para copy, crop do canvas, luz e textura compatíveis com a direção da campanha. Se nenhuma sustentar a ideia, não force a foto.
3. Baixe apenas os candidatos aprovados para `assets/`; guarde ID, autor, URL da foto, URL/perfil do autor, dimensões, data de aquisição, uso e requisitos de atribuição em um manifesto. Atribua Pexels/fotógrafo conforme a orientação vigente da API.
4. A chave fica em variável de ambiente local usada pelo script de aquisição; não embuta segredo em HTML/JS, PNG, querystring, logs ou controle de versão. Imagens finais são carregadas localmente para preview/exportação.
5. Se não houver foto adequada, verifique outro banco licenciado disponível; considere geração por IA apenas como último recurso. Fundos gerados nunca substituem logo, brasão, UI, captura ou prova real.

Use um script pequeno, se útil, para automatizar busca, folha de contato, download e registro; não adicione pacote/framework só para a API. Verifique documentação, limites/atribuição e licenças atuais antes de uso comercial; a busca não transfere automaticamente direitos de marcas, pessoas identificáveis ou conteúdo de terceiros presentes na imagem.

## Preview e exportação

Use **o mesmo DOM, CSS, fontes e assets** para preview e PNG. No navegador automatizado, espere fontes e imagens terminarem de carregar; defina viewport e escala de dispositivo para produzir dimensões exatas; capture o elemento do canvas ou página sem barras/toolbar de edição. Se usar CSS de preview, ele só deve posicionar ou escalar o canvas na tela, nunca alterar seu layout interno.

Após exportar, execute o pre-flight estrutural e a inspeção visual descritos em [produção e QA](production-qa.md). Preview nativo e PNG precisam corresponder visualmente; medidas de DOM não substituem ver a imagem.

Ao ajustar conteúdo, altere primeiro a camada de dados/copy; ao ajustar hierarquia, altere a composição; ao ajustar repetição de campanha, altere tokens/componentes. Depois renderize novamente e aplique [produção e QA](production-qa.md).
