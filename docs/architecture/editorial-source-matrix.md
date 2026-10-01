# Matriz atual de fontes editoriais

Snapshot do database local em 27/09/2026; probes HTTP em 28/09/2026. Os horários de coleta abaixo vieram de leitura sem escrita ao database `prospector` do WSL2. Eles descrevem esse database local, não a produção.

## Cadastro encontrado no PostgreSQL local

| Fonte | Protocolo/cadastro | Ativa | Última coleta local | Cobertura que o código comprova hoje |
|---|---|---:|---|---|
| PCI Concursos | HTML | sim | 01/09/2026 18:38 -03 | Lista títulos e links, coleta detalhes e persiste versões; percorre até dez páginas por execução com cursor retomável. A nova coleta ainda não foi iniciada. |
| Ache Concursos | HTML | sim | 01/09/2026 18:38 -03 | Parser de links restrito a notícias; o worker coleta detalhes e persiste corpo/hash/parser e referências PDF. A coleta produtiva ainda não foi iniciada. |
| Folha Dirigida por Qconcursos | HTML | sim | 01/09/2026 18:38 -03 | Parser de links restrito ao formato /n/slug; o worker coleta detalhes e persiste corpo/hash/parser e referências PDF. A coleta produtiva ainda não foi iniciada. |
| DOU - Imprensa Nacional | API | não | nunca | Ainda não há adapter registrado. Uma fonte `api` sem adapter agora gera falha explícita no Radar. O adapter INLABS do outro checkout contém conteúdo de exemplo. |
| Direção Concursos | RSS | não | nunca | Não há coleta agendada nem ensaio de feed real no Radar. |
| Folha Dirigida | RSS | não | nunca | Não há coleta agendada nem ensaio de feed real no Radar. |
| Gran Cursos Online | RSS | não | nunca | Não há coleta agendada nem ensaio de feed real no Radar. |
| JC Concursos | RSS | não | nunca | Não há coleta agendada nem ensaio de feed real no Radar. |
| PCI Concursos | RSS | não | nunca | A linha HTML ativa é separada desta linha RSS inativa. |
| Qconcursos | HTML | não | nunca | Sem fixture nem coleta no estado observado. |

## Auditoria dos adapters da Gazeta

O checkout `C:\Users\Lenovo\Documents\GazetaConcuros - Projeto` está em outro repositório/branch e já continha arquivos locais não rastreados. Foi consultado sem alteração.

- `OfficialRssAdapter` e `OfficialHtmlAdapter` fazem requisições HTTP e extração com parser, mas ainda precisam de fixtures por fonte, datas publicadas verificáveis, paginação, limites de corpo e políticas de anexos antes de entrarem em produção.
- O `OfficialHtmlAdapter` atribui `new Date()` como data oficial quando descobre uma página. Isso inventa uma data de publicação e deve ser removido antes de portar esse adapter.
- O relatório anterior citou adapters de exemplo e um piloto em `adapters/doe/pilots/QueridoDiarioAdapter`, mas esses arquivos não foram encontrados no checkout WSL2 atual da Gazeta (`C:\Users\Lenovo\Documents\GazetaConcuros - Projeto`). Não contar esse piloto como código presente ou ligado ao runtime até localizar a cópia correta.
- A auditoria histórica `Docs/automation/audit/13-source-validation.md` diz `PASS`, mas esse resultado não é reproduzido pelos adapters com conteúdo de exemplo. Trate a afirmação antiga como não verificada até haver respostas reais e fixtures independentes.

## Runtime do Radar neste checkout

- O registry versionado contém três portais HTML especializados. Os testes cobrem parser RSS/Atom, filtragem de links HTML e o contrato da lista; a coleta real verificada nesta execução usou somente um RSS local de fixture.
- Respostas HTTP fora de 2xx, exceto `304`, agora contam como falha da fonte. O erro salvo guarda o status ou o tipo do erro, sem copiar URL, query ou token.
- Em `304`, validators retornados são atualizados e `last_fetched_at` avança sem descartar os validators anteriores quando a resposta não os repete.
- O sinal de encerramento cancela requisições de coleta e de classificação; cancelamento operacional não aumenta a falha da fonte.
- `api` sem adapter termina em falha registrada; o portal `querido-diario` usa o adapter dedicado em `workers/news-radar/src/querido-diario.ts`. Ele exige território/consulta explícitos, usa cursor `scraped_at` com 24h de sobreposição, percorre páginas até o total informado, falha diante de drift e limita páginas/resposta. Retentativas de 429/5xx são limitadas e respeitam `Retry-After`. Testes locais cobrem o contrato simulado, inclusive rate limit; não houve resposta real do deployment.
- A coleta HTML atual ainda é só listagem de títulos/links. O adapter QD mapeia `excerpts`, mas não baixa `txt_url`; corpo integral, anexos, PDF/OCR e versões imutáveis do documento ainda faltam. O worker passou 33/33 testes e typecheck nesta execução.

## Contratos públicos e gates

- O código-fonte oficial atual confirma `GET /gazettes` com `territory_ids`, `published_since`, `published_until`, `scraped_since`, `scraped_until`, `querystring`, `size`, `offset` e `sort_by` (`relevance`, `descending_date`, `ascending_date`). A resposta contém `total_gazettes` e `gazettes`, com metadados, `excerpts` e `txt_url` opcional. Isso confirma o contrato no código versionado, sem confirmar o deployment ao vivo. [Código oficial do endpoint](https://github.com/okfn-brasil/querido-diario-api/blob/main/api/api.py) · [Documentação oficial](https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html)
- Uma consulta pública de leitura foi tentada em 27/09/2026 pelo Windows, WSL2, Edge e serviço de navegação; o handshake TLS ou acesso ao host falhou antes de haver resposta HTTP. O contrato do deployment segue sem validação ao vivo. Não repetir com validação TLS desativada.
- O INLABS pede cadastro de conta; a Imprensa Nacional informa XML diário após 10h. Não há coleta ativa dessa linha no database local nem credencial conferida para o runtime comum. [Portal oficial INLABS](https://inlabs.in.gov.br/acessar.php) · [serviço de dados do DOU](https://www.gov.br/imprensanacional/pt-br/arquivos/arquivos-acoes-e-programas/carta_de_servico_v2_edicao_-2020.pdf)
- Business Discovery permanece sem adapter verificado, conta/token preflight ou resposta de contrato. Não usar scraping de perfil como substituto silencioso.
- A etapa só poderá ser marcada como aceita depois de testar respostas reais por fonte, guardar proveniência/versão, cobrir 304/403 e paginação e demonstrar o tratamento de PDFs. Nenhuma schedule destas fontes foi habilitada.

## Probes HTTP e parser em 28/09/2026

As requisições foram GET somente leitura no Windows/Node 24, com validação TLS padrão, User-Agent identificado e sem guardar HTML no repositório ou no banco. Os hashes abaixo cobrem o corpo que o Node Fetch entregou ao parser; são evidência de integridade do probe, não cópias recuperáveis da resposta.

| Fonte/URL | HTTP e corpo | SHA-256 | Parser atual | Resultado observado |
|---|---|---|---:|---|
| PCI `/noticias` | 200, `text/html; charset=UTF-8`, 100.240 bytes | `0a9e04296dada89b178324de8835fbdf42d143ae2b51ef82ee1a8c2bb87c72b7` | 173 links | Rotas `/noticias/<slug>`; datas e corpo ainda nulos. |
| Ache `/noticias` | 200, `text/html; charset=UTF-8`, 53.091 bytes | `ab30dda118a62178352e6f199855a8d3fea2911125857073803a769c38d12590` | 17 links | Rotas `/noticias/<slug>`; datas e corpo ainda nulos. |
| Folha `/` | 200, `text/html; charset=utf-8`, 607.972 bytes | `59d40b2215ffb84167871a276d2ce452232ad19f16babc31d29639c7d36c57df` | 44 links | Rotas `/n/<slug>`; o parser extrai o heading quando presente, sem concatenar o teaser. Datas e corpo ainda nulos. |

Os três `robots.txt` responderam 200 e permitem as listagens consultadas. O PCI proíbe caminhos de PDF; não baixei anexos desse portal. Os sitemaps responderam 200: PCI publicou 1.005 `<loc>` com `<lastmod>`, Ache publicou 200 itens no sitemap de notícias com `news:publication_date`, e o sitemap diário da Folha veio em gzip (5.722 bytes) e ainda não é decodificado pelo coletor.

Um artigo por portal também respondeu 200. O PCI expõe `datePublished` e `itemprop="articleBody"`; Ache expõe `<time datetime>` e `.post-content`; Folha expõe datas estruturadas e `<article id="article-content">`. Os três probes de artigo mostraram os seletores que faltam no coletor, sem links PDF na página examinada. Isso prova disponibilidade e estrutura de amostras, não cobertura de todas as páginas.

A primeira passagem do parser retornou 174 itens do PCI e 73 da Folha, incluindo uma página geral de concursos do PCI e categorias `/e/` da Folha. `workers/news-radar/src/sources.ts` agora restringe PCI/Ache a uma rota `/noticias/<slug>` e Folha a `/n/<slug>`; fixtures executáveis passaram e a nova passagem ao vivo retornou 173, 17 e 44 links, respectivamente. O total filtrado continua sendo descoberta de listagem, sem paginação, busca de corpo, persistência de versão ou prova de anexos.

A consulta à API do Querido Diário repetiu a falha de handshake no Schannel (`SEC_E_ILLEGAL_MESSAGE`), antes de status HTTP ou corpo. Nenhuma validação TLS foi desativada e nenhuma requisição foi inserida no Radar. DOU/INLABS e Business Discovery seguem sem resposta real no runtime. A Etapa 4 permanece parcial.

## Atualização do runtime em 28/09/2026

A checagem ao vivo agora chamou `fetchRssFeed`, o mesmo caminho usado pelo worker, com GETs e validação TLS padrão. O PCI retornou 173 itens via HTML, sem datas publicadas. O Ache retornou 200 itens do sitemap de notícias, todos com data. A Folha retornou 95 itens do sitemap diário gzip, todos com data; a resposta também forneceu ETag e Last-Modified. A contagem HTML anterior da tabela acima é um diagnóstico direto das listagens e foi superada para o runtime do Ache e da Folha.

Uma página por portal respondeu HTTP 200. O novo `parseArticleDetails` reconhece datas e corpo nos três layouts, lê links PDF apenas como metadados e descarta datas inválidas. Ache e Folha forneceram título na página de detalhe; no exemplo PCI, o título vem da listagem, pois a página consultada não expôs um H1 nem um campo de título reconhecido. Os probes encontraram corpo de 1.410, 4.406 e 35.118 caracteres no PCI, Ache e Folha, respectivamente, e nenhum PDF nessas três páginas. Isso valida o parser em amostras públicas; não houve download de anexos, inclusive porque o robots.txt do PCI proíbe caminhos PDF.

## Atualização de persistência em 28/09/2026

O parser de detalhes agora é chamado pelo worker para os três portais HTML registrados. A migration `0052_news_item_versions` guarda `details_checked_at` e o estado HTTP em `public.news_items`, e cria `editorial.news_item_versions` com hash SHA-256, versão do parser, título, data, corpo, referências PDF e validators. A captura exige HTTPS e origem exata, aceita até três redirects da mesma origem e limita o HTML a 4 MiB e o texto persistido a 60.000 caracteres. O worker tenta até dez detalhes por portal em cada execução; respostas 304 atualizam o último visto e os erros por item não contam como falha da listagem. Arquivos PDF não são baixados.

Os testes cobrem parser, sucesso, 304, limite de origem/redirect e persistência contra PostgreSQL descartável. A integração simulou as respostas de listagem e detalhe, sem consultar portais durante o teste. A Etapa 4 segue parcial: paginação integral, resposta real do Querido Diário, fontes DOU/INLABS e Business Discovery, coleta/aprovação de PDFs e OCR ainda precisam de validação própria.

## Estado após migration 0053 (28/09/2026)

A paginação do PCI usa cursor persistido, até dez páginas por execução e validação de host HTTPS e caminhos aceitos. A migration foi aplicada e o código está no deploy local. O cursor segue no estado inicial porque nenhuma coleta foi disparada. A consulta real ao Querido Diário falhou antes de receber status HTTP por erro de handshake TLS; DOU/INLABS e Business Discovery seguem sem adapter pronto para uso no runtime comum. Nenhuma schedule está ativa.
