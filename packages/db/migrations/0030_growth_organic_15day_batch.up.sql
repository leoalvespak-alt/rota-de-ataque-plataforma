-- 0030 — Ciclo orgânico de 15 dias (21/08/2026 a 04/09/2026)
-- Fonte: Docs/PLANO-DE-PUBLICACAO-15-DIAS-CICLO-2.md e CRESCIMENTO-ORGANICO-ROTA-DE-ATAQUE.md
--
-- O que este seed faz:
--  1. Cria a 7a tese editorial (T7 — Escolha a farda certa), completando o limite de 7 ativas.
--  2. Cria 15 content_opportunities (1 por post de feed) vinculadas às teses.
--  3. Agenda 15 posts de feed do Instagram com copy completa (capas, slides, legendas,
--     hashtags, CTA) e referência aos estilos de card existentes do Design System.
--  4. Cria 30 threads (2/dia) como content_items + content_variants + agendamentos.
--  5. Cria 30 blocos de stories (2/dia, 3 telas cada) com roteiro de sticker.
--
-- Regras respeitadas:
--  - Tudo nasce origin='manual', travado contra automação (locked_at preenchido),
--    curation_status='proposed' e status='ready' — a APROVAÇÃO é do operador no Prospector.
--  - Nenhum registro recebe approved_by nesta migration.
--  - Datas fixas para o ciclo 21/08–04/09. Reprogramar pelo calendário se o ciclo mudar.
--  - Idempotente por batch_id + escopo de cada seção.

BEGIN;

-- =====================================================================
-- 1. Tese T7 — Escolha a farda certa
-- =====================================================================
INSERT INTO theses(
  campaign_id, slug, title, description, tenets, forbidden_angles, tone_guidelines,
  example_hooks, version, active, origin, locked_at, locked_by
)
SELECT
  campaign.id,
  'escolha-a-farda-certa',
  'Escolha a farda certa',
  'A aprovação começa na escolha da corporação: rotina, escala, TAF e salário decidem se você aguenta 30 anos na farda.',
  jsonb_build_array(
    'Escolher pela vaga que abriu é a forma mais cara de errar de carreira.',
    'A pergunta certa não é qual corporação paga mais — é qual rotina você aguenta por 30 anos.',
    'Comparar PM, PP, PC e PRF com dados de prova, escala, TAF e dia a dia gera comentário e identificação.'
  ),
  '[]'::jsonb,
  'Direto, técnico e adulto; segunda pessoa; frases curtas; autoridade ancorada em dados; sem promessa de aprovação.',
  jsonb_build_array('PM, Polícia Penal, Polícia Civil ou PRF?', 'Não use a polícia como escada'),
  1, true, 'manual', now(), 'organic-15day-batch-v1'
FROM campaigns campaign
WHERE campaign.name = 'Rota de Ataque' AND campaign.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM theses existing
    WHERE existing.campaign_id = campaign.id AND existing.slug = 'escolha-a-farda-certa'
  )
ON CONFLICT (campaign_id, slug, version) DO NOTHING;

-- =====================================================================
-- 2. Agendamentos de feed (15 posts) + content_opportunities
-- =====================================================================
WITH batch AS (
  SELECT 'd15db4a0-2026-4a08-8a15-d00000000030'::uuid AS batch_id
),
seed AS (
  SELECT * FROM (VALUES
    (1,  DATE '2026-08-21', TIME '19:30', 'carousel', 'carrosseis', 'radar-policial', 'radar-policial-informacao-antes',
     'Radar Policial #1: o que se mexeu esta semana na área',
     E'Concurso policial não espera ninguém ficar pronto.\n\nEsta semana tem [X] movimentações: edital publicado, banca definida e autorização com prazo correndo.\n\nA parte que ninguém te conta: [X] desses [Y] concursos cobram quase a mesma base. Quem estuda com direção presta 3, 4 provas com o mesmo estudo. Quem espera "o concurso certo" estuda uma vez e torce.\n\nComenta RADAR que eu te mando o mapa completo em PDF — banca, datas, vagas e o que pesa em cada um.',
     'Comenta RADAR e recebe o mapa atualizado em PDF',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#policiapenal','#policiamilitar','#policiacivil','#prf','#policiafederal','#guardamunicipal','#radarpolicial'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL · SEX 21/08','texto','O que se mexeu nos concursos policiais esta semana — 3 movimentações + o que cada uma muda na sua preparação'),
         jsonb_build_object('ordem',2,'titulo','[Estado] — edital publicado','texto','[Cargo], [vagas] vagas, banca [banca]. Inscrições até [data]. Prazo curto = decisão rápida, não desespero.'),
         jsonb_build_object('ordem',3,'titulo','[Estado] — banca definida','texto','A banca muda o estilo da prova. Quem treina no perfil dela larga na frente — sem estudar uma linha a mais.'),
         jsonb_build_object('ordem',4,'titulo','[Estado] — autorização publicada','texto','Edital previsto para [mês]. É o melhor momento para entrar na base comum, antes da corrida.'),
         jsonb_build_object('ordem',5,'titulo','O que isso muda pra você','texto','A base comum (Português, Penal, Processo Penal, Constitucional, Administrativo) atende [X] desses [Y] certames. Começar agora não é adiantar — é chegar inteiro.'),
         jsonb_build_object('ordem',6,'titulo','Receba o mapa completo','texto','Comenta RADAR aqui embaixo e receba o PDF com banca, datas, vagas e peso por matéria. Atualizado toda semana.')
       ),
       'legenda_longa', 'Preencher [dados] com as movimentações reais do Radar no dia da publicação. Estrutura reutilizável para toda segunda-feira.',
       'observacoes', 'Capa escura (cr-cover-dark) + slides de lista (cr-list) + fecho CTA (cr-cta). Fonte de dados: radar de notícias do Prospector.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-curto | isca: RADAR'),

    (2,  DATE '2026-08-22', TIME '10:30', 'carousel', 'carrosseis', 'tecnico-aplicado', 'erro-e-dado-nao-fracasso',
     'Português: as 4 pegadinhas que eliminam em qualquer banca policial',
     E'Português é a matéria que mais elimina em concurso policial. E quase nunca é por conteúdo difícil — é por leitura incompleta.\n\nA banca não testa se você decorou a regra. Testa se você leu o enunciado até o fim.\n\nEssas 4 pegadinhas aparecem em prova atrás de prova, em banca atrás de banca.\n\nSalva pra revisar na véspera. E me conta nos comentários: qual dessas já te derrubou?',
     'Salva e comenta qual pegadinha já te derrubou',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca','#portuguesparaconcursos'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','PORTUGUÊS','texto','As 4 pegadinhas que eliminam candidato em toda banca policial. Não é conteúdo difícil — é leitura incompleta.'),
         jsonb_build_object('ordem',2,'titulo','Por que Português elimina mais que qualquer matéria','texto','É a única matéria presente em 100% dos editais policiais — e onde o candidato "quase passa". O corte costuma ser por 1 ou 2 pontos.'),
         jsonb_build_object('ordem',3,'titulo','1. A vírgula que muda o sujeito','texto','"O agente prendeu, o suspeito" não é "O agente prendeu o suspeito". A banca inverte o sentido do enunciado com uma vírgula.'),
         jsonb_build_object('ordem',4,'titulo','2. Crase antes de palavra masculina','texto','Crase é a + a. Antes de palavra masculina (a prazo, a jato) não existe crase. Pegadinha clássica de alternativa.'),
         jsonb_build_object('ordem',5,'titulo','3. Concordância com o núcleo do sujeito','texto','O verbo concorda com o núcleo, não com a palavra mais próxima. Leia a frase até o ponto final antes de marcar.'),
         jsonb_build_object('ordem',6,'titulo','4. A alternativa que "soa melhor" está errada','texto','Banca troca a ordem das palavras para a opção errada soar certa. Desconfie da fluência — confira a regra.'),
         jsonb_build_object('ordem',7,'titulo','RESUMO PRA PRINTAR','texto','Vírgula muda sentido · crase só antes de feminino · verbo concorda com o núcleo · "soar bem" não é regra.'),
         jsonb_build_object('ordem',8,'titulo','Salva e me conta','texto','Salva pra revisar na véspera da prova. E comenta: qual dessas já te derrubou?')
       ),
       'observacoes', 'Capa clara (cr-cover) + slides de conteúdo (cr-slide) + resumo printável + CTA final. Estilo educacional.'
     ),
     'cards: cr-cover + cr-slide + cr-fact + cr-cta | preset-educacional | isca: nenhuma (CTA puro)'),

    (3,  DATE '2026-08-23', TIME '19:00', 'carousel', 'carrosseis', 'metodo-rotina', 'escolha-a-farda-certa',
     'PM x Polícia Penal: escala, prova e TAF frente a frente',
     E'Todo dia chega gente no direct com a mesma dúvida: PM ou Polícia Penal?\n\nAs duas fardas são sérias. A diferença não está em "qual é melhor" — está em qual rotina você aguenta por 30 anos.\n\nEscala, prova, TAF e salário frente a frente nos slides.\n\nComenta FARDA que eu te mando o comparativo completo entre PM, PP, PC e PRF. E responde aqui: qual é a sua farda?',
     'Comenta FARDA e recebe o comparativo completo',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#policiapenal','#policiamilitar','#policiacivil','#prf','#policiafederal','#guardamunicipal'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','PM x POLÍCIA PENAL','texto','Escala, prova e TAF frente a frente. A escolha errada custa mais que um ano perdido.'),
         jsonb_build_object('ordem',2,'titulo','PM — o retrato','texto','Escala pesada, hierarquia rígida, contato direto com a rua. Concursos frequentes e muitas vagas. Nível médio.'),
         jsonb_build_object('ordem',3,'titulo','Polícia Penal — o retrato','texto','Escala geralmente melhor (24x72), ambiente fechado, desgaste psicológico alto. Boa porta de entrada, rotina pouco falada.'),
         jsonb_build_object('ordem',4,'titulo','A prova','texto','PM: volume alto de matérias, concorrência gigante. PP: prova enxuta, mas edital sai com menos aviso. As duas exigem a base comum.'),
         jsonb_build_object('ordem',5,'titulo','O TAF','texto','PM: corrida, flexões, abdominais, barra — índices variam por estado. PP: teste costuma ser mais curto, mas índices mudam a cada edital. Treine 20% acima.'),
         jsonb_build_object('ordem',6,'titulo','A pergunta certa','texto','Não é "qual paga mais". É: qual rotina você aguenta por 30 anos?'),
         jsonb_build_object('ordem',7,'titulo','Comente FARDA','texto','Receba o comparativo completo PM x PP x PC x PRF — prova, TAF, escala, salário e dia a dia. E me diz: qual é a sua farda?')
       ),
       'observacoes', 'Slide comparativo usa cr-comparison (PM vs PP). Capa escura para alternar com D2. Isca FARDA.'
     ),
     'cards: cr-cover-dark + cr-comparison + cr-cta | preset-misto | isca: FARDA'),

    (4,  DATE '2026-08-24', TIME '19:30', 'carousel', 'carrosseis', 'radar-policial', 'radar-policial-informacao-antes',
     'Radar Policial #2: banca definida vale mais que edital publicado',
     E'Banca definida é notícia mais importante que edital publicado.\n\nQuando sai a banca, você já sabe o estilo da questão, o peso das disciplinas e o nível de pegadinha que vem. Quem espera o edital pra descobrir isso perde as primeiras semanas se ajustando.\n\nRadar da semana nos slides. Comenta RADAR que eu te mando o mapa completo em PDF.',
     'Comenta RADAR e recebe o mapa completo',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#policiapenal','#policiamilitar','#policiacivil','#prf','#policiafederal','#guardamunicipal','#radarpolicial'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL #2','texto','Banca definida vale mais que edital publicado. O que mudou na semana e o que fazer agora.'),
         jsonb_build_object('ordem',2,'titulo','[Estado] — banca definida','texto','[Cargo]. A partir de agora, toda questão que você resolver deve ser no estilo [banca].'),
         jsonb_build_object('ordem',3,'titulo','[Estado] — edital publicado','texto','[Cargo], [vagas] vagas. Inscrições até [data]. Quem estudou a base comum só ajusta detalhe.'),
         jsonb_build_object('ordem',4,'titulo','[Estado] — retificação','texto','Mudança no edital de [cargo]. Leia o item alterado — prova não cobra o que foi retirado.'),
         jsonb_build_object('ordem',5,'titulo','Por que banca definida muda sua semana','texto','Você passa a estudar o que a banca cobra, não o que o material genérico prioriza. É a diferença entre estudar muito e estudar certo.'),
         jsonb_build_object('ordem',6,'titulo','Comente RADAR','texto','Receba o mapa completo em PDF, com banca, datas e peso por matéria.')
       ),
       'observacoes', 'Capa clara (cr-cover) para alternar com D1. Dados reais do radar no dia.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-curto | isca: RADAR'),

    (5,  DATE '2026-08-25', TIME '18:30', 'reels', 'reels', 'identificacao-bastidor', 'gente-comum-passa',
     'Estudar 2h com direção vale mais que 8h sem',
     E'Duas horas por dia parecem pouco até você comparar com oito horas sem critério.\n\nDuas horas com a matéria certa, no estilo da banca, com revisão do erro — valem mais que oito de PDF aleatório.\n\nMarca aqui alguém que estuda no cansaço e precisa ler isso hoje.',
     'Marca alguém que estuda assim',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca','#concurseiroquetrabalha'),
     jsonb_build_object(
       'roteiro', E'18s · texto na tela + b-roll sem rosto (relógio, caderno, ônibus)\n0-2s: "Duas horas."\n2-4s: "É o que muita gente tem por dia depois do trabalho."\n4-7s: "E ainda ouve que é pouco."\n7-10s: "Duas horas com critério: a matéria certa, no estilo da banca, com revisão do erro."\n10-13s: "Valem mais que oito horas de PDF aleatório."\n13-16s: "Não é sobre horas. É sobre direção."\n16-18s: "Marca alguém que precisa ouvir isso hoje."',
       'observacoes', 'Reel motion/texto 9:16, legenda queimada, corte a cada 3-4s, sem rosto, trilha em alta. Hook no frame 1.'
     ),
     'reel motion 9:16 | texto queimado | sem rosto | isca: nenhuma (share)'),

    (6,  DATE '2026-08-26', TIME '07:30', 'static', 'estatico', 'metodo-rotina', 'menos-material-mais-execucao',
     'Trocar de curso é recomeçar o mesmo filme com outro roteirista',
     E'A cada 2 meses, um material novo. A cada troca, a sensação boa de recomeçar.\n\nE o resultado é sempre o mesmo: ninguém aprova no capítulo 1.\n\nO problema raramente é o material. É trocar execução por escolha — porque escolher dá a ilusão de progresso sem dar trabalho.\n\nMe conta: quantos cursos você já começou e não terminou? Escreve o número nos comentários. Sem julgamento — quero ver o padrão.',
     'Comenta quantos cursos você já começou',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca'),
     jsonb_build_object(
       'arte', 'Frase única: "Trocar de curso é recomeçar o mesmo filme com outro roteirista."',
       'template_capa','sq-quote',
       'observacoes', 'Post estático de opinião às 07h30. Arte limpa, frase em 1 linha. A briga acontece na legenda.'
     ),
     'card: sq-quote | estático 1:1 | isca: nenhuma (comentário)'),

    (7,  DATE '2026-08-27', TIME '19:30', 'carousel', 'carrosseis', 'taf-etapas', 'concurso-policial-nao-acaba-na-objetiva',
     'Psicotécnico: o que reprova de verdade e o que é lenda',
     E'Passou na objetiva e agora o medo mudou de endereço: virou o psicotécnico.\n\nA verdade é menos assustadora que o boato: é um teste padronizado, com critérios objetivos, e o que mais reprova é chegar exausto — não "reprovar no desenho da árvore".\n\nOs slides separam o que reprova do que é lenda.\n\nMe conta: o psicotécnico te dá mais medo que a prova? Comenta. E salva pra quando chegar a sua vez.',
     'Comenta se o psicotécnico te dá medo',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#taf','#testedeaptidaofisica','#investigacaosocial','#psicotecnico'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','PSICOTÉCNICO','texto','O que reprova de verdade — e o que é lenda de grupo. A etapa que ninguém estuda e todo mundo teme.'),
         jsonb_build_object('ordem',2,'titulo','O que é','texto','Teste psicológico padronizado, aplicado após a objetiva. Avalia atenção, memória, personalidade e raciocínio — não existe "passar" estudando na véspera.'),
         jsonb_build_object('ordem',3,'titulo','O que reprova de verdade','texto','Laudo contrário ao perfil do cargo, inconsistência nos testes e alteração clínica incompatível com a função.'),
         jsonb_build_object('ordem',4,'titulo','O que é lenda','texto','"Só reprova quem é louco", "teste de desenho define tudo", "dá pra treinar na internet". Não dá — e o teste é só uma parte da avaliação.'),
         jsonb_build_object('ordem',5,'titulo','O erro mais caro','texto','Chegar exausto: virar a noite estudando antes da avaliação. Cansaço altera resultado de atenção e memória. Dormir bem na véspera é parte da preparação.'),
         jsonb_build_object('ordem',6,'titulo','O que fazer agora','texto','Checar os critérios do SEU edital e não negligenciar saúde básica durante a preparação. O resto é ansiedade.'),
         jsonb_build_object('ordem',7,'titulo','Me conta','texto','Essa etapa te dá mais medo que a prova? Comenta. E salva pra quando chegar a sua vez.')
       ),
       'observacoes', 'Tom de impacto com fatos (cr-fact). Capa escura. Pilar TAF/etapas — território de alta ansiedade.'
     ),
     'cards: cr-cover-dark + cr-fact + cr-cta | preset-impacto | isca: nenhuma (comentário)'),

    (8,  DATE '2026-08-28', TIME '18:30', 'reels', 'reels', 'identificacao-bastidor', 'gente-comum-passa',
     'Você não atrasou',
     E'A régua do concurseiro de 10h não serve pra quem trabalha, treina e ainda encontra 2h no fim do dia.\n\nConstância não é velocidade. É não parar.\n\nCompartilha com alguém que precisa lembrar disso hoje.',
     'Compartilha com quem precisa lembrar',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca','#concurseiroquetrabalha'),
     jsonb_build_object(
       'roteiro', E'18s · texto na tela + b-roll (madrugada, uniforme de trabalho, caderno)\n0-2s: "Você não atrasou."\n2-4s: "Começou aos 28. Ou aos 35."\n4-7s: "Trabalha 8h, treina TAF, estuda o que sobra."\n7-10s: "Enquanto outros postam 10h líquidas por dia."\n10-13s: "A régua dos outros não mede a sua rota."\n13-16s: "Quem continua caminhando chega."\n16-18s: "Compartilha com quem precisa lembrar disso."',
       'observacoes', 'Reel motion/texto 9:16, sem rosto, legenda queimada. Identificação com quem começou "tarde".'
     ),
     'reel motion 9:16 | texto queimado | sem rosto | isca: nenhuma (share)'),

    (9,  DATE '2026-08-29', TIME '10:30', 'carousel', 'carrosseis', 'tecnico-aplicado', 'erro-e-dado-nao-fracasso',
     'A banca troca UMA palavra e inverte a resposta',
     E'Acertou quantas? Comenta o número.\n\nEssas 3 têm algo em comum: quem errou sabia a lei. O que faltou foi o termo exato — "manifesta", "porte", "conjunto probatório".\n\nA banca policial não testa decoreba. Testa precisão.\n\nSalva pra refazer daqui 7 dias. E comenta 60 que eu te mando um bloco com 60 questões comentadas no mesmo estilo. Isso é 1% do que o Rota faz por você todo dia — teste grátis de 15 dias no link da bio.',
     'Comenta 60 e recebe 60 questões comentadas',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca','#legislacaoespecial'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','QUESTÕES COMENTADAS','texto','A banca troca UMA palavra e inverte a resposta. 3 questões clássicas de legislação especial — resolva antes de ver o gabarito.'),
         jsonb_build_object('ordem',2,'titulo','Q1 — Abuso de Autoridade','texto','Art. 9º da Lei 13.869/2019: "decretar medida de privação da liberdade em manifesta desconformidade com as hipóteses legais". A alternativa que troca "manifesta" por "qualquer" está errada — sem "manifesta", não é o tipo.'),
         jsonb_build_object('ordem',3,'titulo','Gabarito Q1 — e por que erram','texto','A palavra "manifesta" é o núcleo do tipo. Removê-la muda o crime. Quem lê rápido marca a alternativa "mais completa" — e cai.'),
         jsonb_build_object('ordem',4,'titulo','Q2 — Estatuto do Desarmamento','texto','Porte x posse: posse é manter arma em casa ou no local de trabalho; porte é carregar consigo fora desses limites. A banca inverte os dois conceitos na alternativa.'),
         jsonb_build_object('ordem',5,'titulo','Gabarito Q2 — e por que erram','texto','Decore o verbo: manter (posse) x carregar (porte). Se a alternativa define porte como "manter em casa", está trocado.'),
         jsonb_build_object('ordem',6,'titulo','Q3 — Lei de Drogas','texto','Art. 28 x art. 33: o critério não é só a quantidade — é o conjunto probatório (natureza, quantidade, local e conduta). Alternativa que crava "só quantidade define" está errada.'),
         jsonb_build_object('ordem',7,'titulo','Gabarito Q3 — e por que erram','texto','A banca adora colocar "a quantidade, isoladamente, define o tráfico". A lei exige análise do conjunto — e o STJ bate nisso há anos.'),
         jsonb_build_object('ordem',8,'titulo','O padrão das 3','texto','Quem errou sabia a lei. O que faltou foi o termo exato. Banca policial testa precisão, não decoreba.'),
         jsonb_build_object('ordem',9,'titulo','Comente 60','texto','Salva pra refazer daqui 7 dias. Comenta 60 que eu te mando 60 questões comentadas no mesmo estilo.')
       ),
       'observacoes', 'Questões didáticas e seguras (lei seca clássica, sem inventar jurisprudência). Isca 60. Único post com menção ao produto nesta semana.'
     ),
     'cards: cr-cover + cr-slide + cr-cta | preset-educacional | isca: 60'),

    (10, DATE '2026-08-30', TIME '19:00', 'carousel', 'carrosseis', 'metodo-rotina', 'escolha-a-farda-certa',
     'Antes de escolher o concurso, responda essas 4 perguntas',
     E'Escolher concurso pela vaga que abriu é como casar pela data do casamento.\n\nAntes de estudar um ano, responda 4 perguntas. Elas estão nos slides — e a primeira delas elimina metade dos arrependimentos.\n\nResponde nos comentários: você aguenta a escala da farda que quer vestir? E salva esse post pra decidir com calma.',
     'Comenta a resposta da pergunta 1',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#policiapenal','#policiamilitar','#policiacivil','#prf','#policiafederal','#guardamunicipal'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','ANTES DE ESCOLHER O CONCURSO','texto','Responda essas 4 perguntas. A maioria escolhe pela vaga que abriu — e descobre depois que escolheu uma rotina que não aguenta.'),
         jsonb_build_object('ordem',2,'titulo','1. Eu aguento a escala?','texto','PM e PP têm escalas completamente diferentes. Leia relatos reais de quem está dentro antes de decidir.'),
         jsonb_build_object('ordem',3,'titulo','2. Eu aceito a lotação?','texto','PRF lota longe de casa — é regra, não exceção. PC e PM lotam por estado/região. Isso muda sua vida, não só seu endereço.'),
         jsonb_build_object('ordem',4,'titulo','3. Meu corpo acompanha o TAF?','texto','Não é sobre ser atleta: é sobre começar o treino junto com o estudo, não depois da aprovação na objetiva.'),
         jsonb_build_object('ordem',5,'titulo','4. É farda ou só estabilidade?','texto','Usar a polícia como escada é a decisão mais cara do nicho. A instituição cobra corpo, cabeça e tempo.'),
         jsonb_build_object('ordem',6,'titulo','Responde a pergunta 1','texto','Você aguenta a escala da sua farda? Comenta. E salva pra decidir com calma.')
       ),
       'observacoes', 'Lista de perguntas (cr-list) com capa clara. CTA de comentário, sem isca de PDF.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-misto | isca: nenhuma (comentário)'),

    (11, DATE '2026-08-31', TIME '19:30', 'carousel', 'carrosseis', 'radar-policial', 'radar-policial-informacao-antes',
     'Radar Policial #3: a semana em movimentações',
     E'Terceira semana de Radar. Se você começou no primeiro, já são duas semanas de base comum — a diferença aparece na prova, não no feed.\n\nAs movimentações da semana estão nos slides.\n\nComenta RADAR que eu te mando o mapa completo atualizado em PDF.',
     'Comenta RADAR e recebe o mapa atualizado',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#policiapenal','#policiamilitar','#policiacivil','#prf','#policiafederal','#guardamunicipal','#radarpolicial'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL #3','texto','A semana em movimentações: editais, bancas e autorizações — e o que fazer com cada uma.'),
         jsonb_build_object('ordem',2,'titulo','[Estado] — movimentação 1','texto','[Preencher com a movimentação real da semana: edital/banca/autorização/retificação].'),
         jsonb_build_object('ordem',3,'titulo','[Estado] — movimentação 2','texto','[Preencher com a movimentação real da semana].'),
         jsonb_build_object('ordem',4,'titulo','[Estado] — movimentação 3','texto','[Preencher com a movimentação real da semana].'),
         jsonb_build_object('ordem',5,'titulo','Balanço da quinzena','texto','Quem começou no primeiro Radar já tem 2 semanas de base comum. Não é motivação — é aritmética.'),
         jsonb_build_object('ordem',6,'titulo','Comente RADAR','texto','Receba o mapa atualizado, com banca, datas e peso por matéria.')
       ),
       'observacoes', 'Fecho de quinzena. Capa escura alternando com D4. Dados reais do radar no dia.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-curto | isca: RADAR'),

    (12, DATE '2026-09-01', TIME '18:30', 'reels', 'reels', 'metodo-rotina', 'direcao-vence-esforco',
     'Você não precisa de mais horas. Precisa de um critério.',
     E'Mais horas resolvem pouco quando a direção está errada.\n\nO critério que decide o que estudar hoje: peso no edital, incidência na banca e o seu histórico de erro. Sem isso, estudar é apostar.\n\nComenta aqui a matéria que você estuda sem saber direito por quê. Vamos ver o padrão.',
     'Comenta a matéria que você estuda sem critério',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca'),
     jsonb_build_object(
       'roteiro', E'18s · texto na tela + b-roll (edital riscado, planilha, marcador)\n0-2s: "Você não precisa de mais horas."\n2-5s: "Precisa de um critério pra decidir o que estudar hoje."\n5-8s: "Peso da matéria no edital. Incidência na banca. Seu histórico de erro."\n8-11s: "Sem isso, toda hora de estudo é aposta."\n11-14s: "Com isso, 2 horas viram plano de ataque."\n14-16s: "Direção vence esforço."\n16-18s: "Comenta a matéria que você estuda sem saber por quê."',
       'observacoes', 'Reel de método (T1). Roteiro falado no hook, sem rosto, legenda queimada.'
     ),
     'reel motion 9:16 | texto queimado | sem rosto | isca: nenhuma (comentário)'),

    (13, DATE '2026-09-02', TIME '07:30', 'static', 'estatico', 'tecnico-aplicado', 'erro-e-dado-nao-fracasso',
     'Errar 40 questões em casa é mais barato que errar 5 na prova',
     E'Tem gente que evita questão porque errar incomoda. Entendeu o inverso: questão é onde o erro custa 0.\n\nNa prova, cada erro custa posição. Em casa, cada erro é um ponto cego iluminado.\n\nA conta é simples: quem erra mais em casa erra menos no dia.\n\nMe conta: quantas questões você fez na última semana? Número, sem justificar. Quero ver a média da galera.',
     'Comenta quantas questões você fez na semana',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca'),
     jsonb_build_object(
       'arte', 'Frase única: "Errar 40 questões em casa é mais barato que errar 5 na prova."',
       'template_capa','sq-tip',
       'observacoes', 'Post estático estilo dica (sq-tip). Alterna com o sq-quote de D6.'
     ),
     'card: sq-tip | estático 1:1 | isca: nenhuma (comentário)'),

    (14, DATE '2026-09-03', TIME '19:30', 'carousel', 'carrosseis', 'taf-etapas', 'concurso-policial-nao-acaba-na-objetiva',
     'TAF por corporação: os índices e onde o pessoal mais reprova',
     E'Reprovação no TAF quase nunca é falta de condicionamento. É treinar pelo edital errado.\n\nCada corporação tem índice próprio — e tem estado que muda a regra a cada certame. Treinar pelo boato é a forma mais cara de perder a vaga já conquistada.\n\nÍndices e pegadinhas nos slides.\n\nSalva esse post e comenta TAF que eu te mando o guia por corporação com plano de 8 semanas que cabe em quem estuda 2h por dia. Isso é 1% do que o Rota faz por você todo dia — teste grátis de 15 dias no link da bio.',
     'Comenta TAF e recebe o guia por corporação',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#taf','#testedeaptidaofisica','#investigacaosocial','#psicotecnico'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','TAF POR CORPORAÇÃO','texto','Os índices reais e onde o pessoal mais reprova. Passou na objetiva e caiu no físico? Isto é pra não acontecer com você.'),
         jsonb_build_object('ordem',2,'titulo','A regra que salva','texto','Treine sempre 20% acima do índice do edital. A adrenalina do dia tira, ela não dá.'),
         jsonb_build_object('ordem',3,'titulo','PM (varia por estado)','texto','Corrida, flexões, abdominais e barra. Confira o índice do SEU edital — estados mudam distância e repetições.'),
         jsonb_build_object('ordem',4,'titulo','Polícia Penal','texto','Teste costuma ser mais curto, mas os índices mudam a cada certame. Não treine pelo edital anterior.'),
         jsonb_build_object('ordem',5,'titulo','Polícia Civil','texto','PC-SP não tem TAF desde 2018 — e ainda circula vídeo falando o contrário. Confira antes de treinar pro teste que não existe.'),
         jsonb_build_object('ordem',6,'titulo','PRF','texto','Um dos TAFs mais exigentes do país. A preparação física começa junto com o estudo, não depois da objetiva.'),
         jsonb_build_object('ordem',7,'titulo','RESUMO PRA PRINTAR','texto','Treine 20% acima · confira o índice do seu edital · PC-SP não tem TAF · PRF = físico desde o dia 1.'),
         jsonb_build_object('ordem',8,'titulo','Comente TAF','texto','Salva. E comenta TAF que eu te mando o guia por corporação com plano de 8 semanas.')
       ),
       'observacoes', 'Lista por corporação (preset-lista). Fato da PC-SP combate desinformação factual. Isca TAF. Menção ao produto (2a da quinzena).'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-lista | isca: TAF'),

    (15, DATE '2026-09-04', TIME '18:30', 'reels', 'reels', 'identificacao-bastidor', 'gente-comum-passa',
     'Duas semanas de constância valem mais que um mês de surto',
     E'Fechamos 15 dias de conteúdo com a lição mais simples e mais ignorada do nicho:\n\nConstância vence intensidade. Todo dia um pouco, sem zerar segunda pra compensar domingo.\n\nCompartilha com quem está nessa rota com você. Semana que vem tem mais Radar, mais questão e mais verdade sobre as etapas.',
     'Compartilha com quem está na rota',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#rotinadeestudos','#planodeestudos','#questoescomentadas','#revisao','#leiseca','#constancia'),
     jsonb_build_object(
       'roteiro', E'20s · texto na tela + b-roll (calendário riscado, mesa de estudo, tênis)\n0-2s: "Duas semanas de constância."\n2-5s: "Valem mais que um mês de surto."\n5-8s: "Todo dia um pouco. Todo dia a mesma rota."\n8-11s: "Sem zerar segunda-feira pra compensar domingo."\n11-14s: "Constância é uma decisão repetida."\n14-17s: "E ela já é sua há 15 dias."\n17-20s: "Compartilha com quem está nessa rota com você."',
       'observacoes', 'Fechamento do ciclo. Identificação + share. Anuncia a continuidade (Radar, questões, etapas).'
     ),
     'reel motion 9:16 | texto queimado | sem rosto | isca: nenhuma (share)')
  ) AS v(ordinal, day, at, subtype, format, pillar, thesis_slug, title, caption, cta, tags, cs, media_ref)
),
campaign AS (
  SELECT id FROM campaigns WHERE name = 'Rota de Ataque' AND status = 'active'
),
thesis AS (
  SELECT seed.ordinal, item.id AS thesis_id
  FROM seed
  LEFT JOIN LATERAL (
    SELECT t.id FROM theses t
    WHERE t.slug = seed.thesis_slug
    ORDER BY t.version DESC LIMIT 1
  ) item ON true
),
opportunities AS (
  INSERT INTO content_opportunities(
    id, campaign_id, thesis, angle, hook, evidence, opportunity_score, score_version, confidence, source_references, status
  )
  SELECT
    ('aaaaaaaa-0000-4000-8000-' || lpad(seed.ordinal::text, 12, '0'))::uuid,
    campaign.id,
    seed.title,
    seed.title,
    left(seed.caption, 60),
    jsonb_build_object('seed','organic-15day-batch-v1','ordinal',seed.ordinal,'source','PLANO-DE-PUBLICACAO-15-DIAS-CICLO-2'),
    60, 'manual-v1', 0.8, '[]'::jsonb, 'new'
  FROM seed CROSS JOIN campaign
  WHERE NOT EXISTS (
    SELECT 1 FROM scheduled_publications existing
    WHERE existing.batch_id = (SELECT batch_id FROM batch)
      AND existing.channel = 'instagram' AND existing.subtype <> 'stories'
  )
)
INSERT INTO scheduled_publications(
  campaign_id, title, caption, channel, subtype, status, scheduled_for, origin, locked_at, locked_by,
  curation_status, thesis_id, pillar, format, hashtags, cta, content_structure,
  content_opportunity_id, account_id, batch_id, idempotency_key, media_ref, timezone
)
SELECT
  campaign.id,
  seed.title,
  seed.caption,
  'instagram',
  seed.subtype,
  'ready',
  (seed.day + seed.at) AT TIME ZONE 'America/Sao_Paulo',
  'manual', now(), 'organic-15day-batch-v1',
  'proposed',
  thesis.thesis_id,
  seed.pillar,
  seed.format,
  seed.tags,
  to_jsonb(seed.cta),
  seed.cs,
  ('aaaaaaaa-0000-4000-8000-' || lpad(seed.ordinal::text, 12, '0'))::uuid,
  (SELECT id FROM accounts WHERE role = 'actor' ORDER BY id LIMIT 1),
  (SELECT batch_id FROM batch),
  'organic-15d-feed-' || seed.ordinal,
  seed.media_ref,
  'America/Sao_Paulo'
FROM seed
JOIN campaign ON true
JOIN thesis ON thesis.ordinal = seed.ordinal
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_publications existing
  WHERE existing.batch_id = (SELECT batch_id FROM batch)
    AND existing.channel = 'instagram' AND existing.subtype <> 'stories'
);

-- =====================================================================
-- 3. Threads (2/dia) — content_items + content_variants + agendamentos
-- =====================================================================
WITH batch AS (
  SELECT 'd15db4a0-2026-4a08-8a15-d00000000030'::uuid AS batch_id
),
seed AS (
  SELECT * FROM (VALUES
    (1,  DATE '2026-08-21', TIME '07:00', 'radar-policial-informacao-antes',
     'Concurso policial não espera ninguém ficar pronto. Enquanto você decide, o edital anda.',
     'hook: concurso policial não espera ninguém ficar pronto'),
    (2,  DATE '2026-08-21', TIME '21:00', 'erro-e-dado-nao-fracasso',
     'Existe estudo que dá sensação boa e não move nada: revisar o que você já sabe. Acertar é conforto. Aprovar é atacar o ponto cego.',
     'hook: estudo que dá sensação boa e não move nada'),
    (3,  DATE '2026-08-22', TIME '07:00', 'direcao-vence-esforco',
     'Pergunta séria: quantas questões da SUA banca você resolveu este mês? Só o número.',
     'hook: quantas questões da sua banca você resolveu'),
    (4,  DATE '2026-08-22', TIME '21:00', 'gente-comum-passa',
     'Quem estuda 2h por dia com direção está na frente de quem estuda 8h no modo aleatório. E ainda dorme.',
     'hook: quem estuda 2h por dia com direção'),
    (5,  DATE '2026-08-23', TIME '07:00', 'escolha-a-farda-certa',
     'A pergunta errada: "qual concurso policial é mais fácil de passar?" A certa: "qual rotina eu aguento por 30 anos?"',
     'hook: a pergunta errada qual concurso é mais fácil'),
    (6,  DATE '2026-08-23', TIME '21:00', 'menos-material-mais-execucao',
     'Você não precisa de mais um PDF. Precisa terminar o que já abriu.',
     'hook: você não precisa de mais um pdf'),
    (7,  DATE '2026-08-24', TIME '07:00', 'radar-policial-informacao-antes',
     'Banca definida vale mais que edital publicado. Você já sabe o estilo da questão antes da prova existir.',
     'hook: banca definida vale mais que edital publicado'),
    (8,  DATE '2026-08-24', TIME '21:00', 'erro-e-dado-nao-fracasso',
     'Errar questão em casa é grátis. Errar na prova custa um ano. Erre mais em casa.',
     'hook: errar questão em casa é grátis'),
    (9,  DATE '2026-08-25', TIME '07:00', 'gente-comum-passa',
     'Quem estuda no horário de almoço: qual é o seu horário sagrado? Curioso pra ver o padrão.',
     'hook: quem estuda no horário de almoço'),
    (10, DATE '2026-08-25', TIME '21:00', 'concurso-policial-nao-acaba-na-objetiva',
     'Passou na objetiva e caiu no TAF por queixo que não passou da barra. Dói mais que reprovar na prova.',
     'hook: passou na objetiva e caiu no taf'),
    (11, DATE '2026-08-26', TIME '07:00', 'menos-material-mais-execucao',
     'Trocar de curso é recomeçar o mesmo filme com outro roteirista. Ninguém aprova no capítulo 1.',
     'hook: trocar de curso é recomeçar o mesmo filme'),
    (12, DATE '2026-08-26', TIME '21:00', 'direcao-vence-esforco',
     'Se o seu edital saísse amanhã, você saberia o que estudar na segunda-feira? Se não, o problema não é tempo.',
     'hook: se o seu edital saísse amanhã'),
    (13, DATE '2026-08-27', TIME '07:00', 'concurso-policial-nao-acaba-na-objetiva',
     'Psicotécnico não se estuda. Se prepara: dormir bem na véspera é parte da avaliação.',
     'hook: psicotécnico não se estuda se prepara'),
    (14, DATE '2026-08-27', TIME '21:00', 'gente-comum-passa',
     'Domingo à noite o concurseiro promete a semana perfeita. Promete 3 dias em vez de 7 e cumpre.',
     'hook: domingo à noite o concurseiro promete'),
    (15, DATE '2026-08-28', TIME '07:00', 'erro-e-dado-nao-fracasso',
     'Revisar não é reler. Reler é conforto. Revisar é tentar lembrar antes de olhar.',
     'hook: revisar não é reler'),
    (16, DATE '2026-08-28', TIME '21:00', 'gente-comum-passa',
     'Você não está atrasado. Quem desistiu é que saiu da rota.',
     'hook: você não está atrasado quem desistiu'),
    (17, DATE '2026-08-29', TIME '07:00', 'erro-e-dado-nao-fracasso',
     'A banca não quer saber se você sabe a lei. Quer saber se você leu o enunciado até o fim.',
     'hook: a banca não quer saber se você sabe a lei'),
    (18, DATE '2026-08-29', TIME '21:00', 'escolha-a-farda-certa',
     'Tem farda que é sonho. Tem farda que é escada. A instituição cobra as duas igual. Escolha com honestidade.',
     'hook: tem farda que é sonho tem farda que é escada'),
    (19, DATE '2026-08-30', TIME '07:00', 'direcao-vence-esforco',
     'Se você tivesse que cortar 2 das 7 matérias da base comum, quais cortaria? Não tem resposta certa — quero ver o raciocínio.',
     'hook: se você tivesse que cortar 2 das 7 matérias'),
    (20, DATE '2026-08-30', TIME '21:00', 'concurso-policial-nao-acaba-na-objetiva',
     'Investigação social: o que derruba não é o passado. É a mentira sobre ele no formulário.',
     'hook: investigação social o que derruba'),
    (21, DATE '2026-08-31', TIME '07:00', 'radar-policial-informacao-antes',
     'Quem começou no primeiro Radar já tem duas semanas de vantagem. Não é motivação — é aritmética.',
     'hook: quem começou no primeiro radar'),
    (22, DATE '2026-08-31', TIME '21:00', 'menos-material-mais-execucao',
     'A 30 dias da prova, a habilidade mais valiosa é cortar. Ansiedade manda adicionar. Aprovação vem de subtrair.',
     'hook: a 30 dias da prova a habilidade mais valiosa'),
    (23, DATE '2026-09-01', TIME '07:00', 'direcao-vence-esforco',
     'Peso no edital. Incidência na banca. Histórico de erro. É isso que decide o que você estuda hoje — não o feeling.',
     'hook: peso no edital incidência na banca'),
    (24, DATE '2026-09-01', TIME '21:00', 'concurso-policial-nao-acaba-na-objetiva',
     'Você treina TAF quantas vezes por semana? Responde com o número, sem justificar.',
     'hook: você treina taf quantas vezes por semana'),
    (25, DATE '2026-09-02', TIME '07:00', 'erro-e-dado-nao-fracasso',
     'Você não reprova por errar. Reprova por não medir o erro.',
     'hook: você não reprova por errar'),
    (26, DATE '2026-09-02', TIME '21:00', 'concurso-policial-nao-acaba-na-objetiva',
     'Tatuagem reprova? Reprova o conteúdo. A localização depende do SEU edital. Decidir pelo "meu amigo passou" é o erro.',
     'hook: tatuagem reprova reprova o conteúdo'),
    (27, DATE '2026-09-03', TIME '07:00', 'menos-material-mais-execucao',
     'Uma fonte por matéria. O resto é ruído que parece produtividade.',
     'hook: uma fonte por matéria o resto é ruído'),
    (28, DATE '2026-09-03', TIME '21:00', 'gente-comum-passa',
     'A pior mentira do nicho: "aprovação em 6 meses". A verdade: constância sem prazo de validade. Não vende curso, mas funciona.',
     'hook: a pior mentira do nicho aprovação em 6 meses'),
    (29, DATE '2026-09-04', TIME '07:00', 'gente-comum-passa',
     '15 dias. Todo dia um pouco. É assim que se constrói aprovação — bloco por bloco, sem surto.',
     'hook: 15 dias todo dia um pouco'),
    (30, DATE '2026-09-04', TIME '21:00', 'radar-policial-informacao-antes',
     'Segunda-feira tem Radar novo. Até lá: revise o que você errou essa semana. É o investimento de maior retorno.',
     'hook: segunda-feira tem radar novo')
  ) AS v(ordinal, day, at, thesis_slug, text, hook)
),
campaign AS (
  SELECT id FROM campaigns WHERE name = 'Rota de Ataque' AND status = 'active'
),
thesis AS (
  SELECT seed.ordinal, item.id AS thesis_id
  FROM seed
  LEFT JOIN LATERAL (
    SELECT t.id FROM theses t
    WHERE t.slug = seed.thesis_slug
    ORDER BY t.version DESC LIMIT 1
  ) item ON true
),
items AS (
  INSERT INTO content_items(
    id, campaign_id, thesis_id, audience_segment, funnel_stage, objective, angle, hook,
    arguments, cta, intelligence_sources, brand_voice_version, status,
    origin, locked_at, locked_by, curation_status
  )
  SELECT
    ('bbbbbbbb-0000-4000-8000-' || lpad(seed.ordinal::text, 12, '0'))::uuid,
    campaign.id, thesis.thesis_id, 'concurseiro-policial', 'awareness',
    'Comentário e descoberta', seed.text, seed.hook,
    '[]'::jsonb, '{}'::jsonb, '[]'::jsonb,
    'rota-growth-15d-v1', 'draft',
    'manual', now(), 'organic-15day-batch-v1', 'proposed'
  FROM seed
  JOIN campaign ON true
  JOIN thesis ON thesis.ordinal = seed.ordinal
  WHERE NOT EXISTS (
    SELECT 1 FROM scheduled_publications existing
    WHERE existing.batch_id = (SELECT batch_id FROM batch)
      AND existing.channel = 'threads'
  )
  RETURNING id
),
variants AS (
  INSERT INTO content_variants(
    id, content_item_id, channel, format, payload, status,
    origin, locked_at, locked_by, curation_status
  )
  SELECT
    ('cccccccc-0000-4000-8000-' || lpad(seed.ordinal::text, 12, '0'))::uuid,
    ('bbbbbbbb-0000-4000-8000-' || lpad(seed.ordinal::text, 12, '0'))::uuid,
    'threads', 'text', jsonb_build_object('text', seed.text), 'ready',
    'manual', now(), 'organic-15day-batch-v1', 'proposed'
  FROM seed
  WHERE NOT EXISTS (
    SELECT 1 FROM scheduled_publications existing
    WHERE existing.batch_id = (SELECT batch_id FROM batch)
      AND existing.channel = 'threads'
  )
  RETURNING id
)
INSERT INTO scheduled_publications(
  campaign_id, title, caption, channel, subtype, status, scheduled_for, origin, locked_at, locked_by,
  curation_status, thesis_id, pillar, format, variant_id,
  account_id, batch_id, idempotency_key, timezone
)
SELECT
  campaign.id,
  left(seed.text, 60),
  seed.text,
  'threads', 'threads', 'ready',
  (seed.day + seed.at) AT TIME ZONE 'America/Sao_Paulo',
  'manual', now(), 'organic-15day-batch-v1',
  'proposed',
  thesis.thesis_id,
  CASE seed.thesis_slug
    WHEN 'radar-policial-informacao-antes' THEN 'radar-policial'
    WHEN 'erro-e-dado-nao-fracasso' THEN 'tecnico-aplicado'
    WHEN 'concurso-policial-nao-acaba-na-objetiva' THEN 'taf-etapas'
    WHEN 'gente-comum-passa' THEN 'identificacao-bastidor'
    ELSE 'metodo-rotina'
  END,
  'threads',
  ('cccccccc-0000-4000-8000-' || lpad(seed.ordinal::text, 12, '0'))::uuid,
  (SELECT id FROM accounts WHERE role = 'actor' ORDER BY id LIMIT 1),
  (SELECT batch_id FROM batch),
  'organic-15d-threads-' || seed.ordinal,
  'America/Sao_Paulo'
FROM seed
JOIN campaign ON true
JOIN thesis ON thesis.ordinal = seed.ordinal
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_publications existing
  WHERE existing.batch_id = (SELECT batch_id FROM batch)
    AND existing.channel = 'threads'
);

-- =====================================================================
-- 4. Stories (2 blocos/dia, 3 telas cada) — grade semanal S1..S7
-- =====================================================================
WITH batch AS (
  SELECT 'd15db4a0-2026-4a08-8a15-d00000000030'::uuid AS batch_id
),
seed AS (
  SELECT * FROM (VALUES
    (1,  DATE '2026-08-21', TIME '07:30', 'identificacao-bastidor', 'Stories manhã — sex 21/08',
     '{"tela1":"Saiu o Radar da semana no feed — 3 movimentações pra você não perder prazo.","tela2":"ENQUETE: Qual desses você vai encarar? (a) o do edital publicado (b) o da banca definida (c) nenhum — sigo na base","tela3":"Post no feed com o mapa completo. Comenta RADAR pra receber o PDF."}'),
    (2,  DATE '2026-08-21', TIME '19:00', 'radar-policial', 'Stories noite — sex 21/08',
     '{"tela1":"Print de 1 slide do Radar: o que muda pra você.","tela2":"CAIXINHA: qual concurso policial você quer ver no próximo Radar?","tela3":"Link do post + convite: teste grátis de 15 dias do Rota."}'),
    (3,  DATE '2026-08-22', TIME '07:30', 'tecnico-aplicado', 'Stories manhã — sáb 22/08',
     '{"tela1":"QUIZ: \"O agente prendeu, o suspeito\" ou \"O agente prendeu o suspeito\"? Qual muda o sentido?","tela2":"Resposta: a primeira. A vírgula muda o sujeito — e a banca vive disso.","tela3":"Post do dia: as 4 pegadinhas de Português. Link no story."}'),
    (4,  DATE '2026-08-22', TIME '19:00', 'identificacao-bastidor', 'Stories noite — sáb 22/08',
     '{"tela1":"Print de 1 slide do carrossel de Português.","tela2":"ENQUETE: Português te derruba? (sim / ainda bem que não)","tela3":"Link do post + resposta pública ao melhor comentário do dia."}'),
    (5,  DATE '2026-08-23', TIME '07:30', 'metodo-rotina', 'Stories manhã — dom 23/08',
     '{"tela1":"PM ou Polícia Penal? A dúvida que mais chega no direct.","tela2":"ENQUETE: Qual é a SUA farda? (PM / PP / outra)","tela3":"Comparativo completo no feed. Comenta FARDA pro PDF."}'),
    (6,  DATE '2026-08-23', TIME '19:00', 'identificacao-bastidor', 'Stories noite — dom 23/08',
     '{"tela1":"Planeje a semana em 3 telas: 1) escolha 3 dias de estudo 2) 1 hora mínima 3) revisão do erro na sexta.","tela2":"ENQUETE: Vai estudar hoje? (sim / hoje não — e tudo bem)","tela3":"Link do post + trial."}'),
    (7,  DATE '2026-08-24', TIME '07:30', 'radar-policial', 'Stories manhã — seg 24/08',
     '{"tela1":"Banca definida vale mais que edital publicado. Entenda o porquê no Radar #2.","tela2":"ENQUETE: Você muda a preparação quando a banca é definida? (sim / nem sei como)","tela3":"Link do Radar #2. Comenta RADAR pro PDF."}'),
    (8,  DATE '2026-08-24', TIME '19:00', 'radar-policial', 'Stories noite — seg 24/08',
     '{"tela1":"Print de 1 slide do Radar #2.","tela2":"CAIXINHA: você quer que o Radar cubra quais estados?","tela3":"Link do post + trial."}'),
    (9,  DATE '2026-08-25', TIME '07:30', 'identificacao-bastidor', 'Stories manhã — ter 25/08',
     '{"tela1":"2h com direção valem mais que 8h sem. O Reel de hoje é sobre isso.","tela2":"SLIDER: Como foi seu estudo ontem? (péssimo → excelente)","tela3":"Link do Reel + marca alguém que estuda no cansaço."}'),
    (10, DATE '2026-08-25', TIME '19:00', 'identificacao-bastidor', 'Stories noite — ter 25/08',
     '{"tela1":"Pergunta que mais chega no direct: \"dá pra passar estudando 2h por dia?\"","tela2":"ENQUETE: Quantas horas líquidas você estuda por dia? (1-2 / 3-4 / 5+)","tela3":"Link do Reel + resposta pública a um comentário."}'),
    (11, DATE '2026-08-26', TIME '07:30', 'metodo-rotina', 'Stories manhã — qua 26/08',
     '{"tela1":"A frase do post de hoje: trocar de curso é recomeçar o mesmo filme.","tela2":"CAIXINHA: quantos cursos você já começou e não terminou?","tela3":"Link do post de opinião."}'),
    (12, DATE '2026-08-26', TIME '19:00', 'metodo-rotina', 'Stories noite — qua 26/08',
     '{"tela1":"Auditoria de 5 minutos: quantos PDFs abertos você tem agora?","tela2":"ENQUETE: Sua maior inimiga é a troca de material? (sim / não, é o tempo)","tela3":"Link do post + dica: 1 fonte por matéria."}'),
    (13, DATE '2026-08-27', TIME '07:30', 'taf-etapas', 'Stories manhã — qui 27/08',
     '{"tela1":"Psicotécnico: o que reprova de verdade? Carrossel novo no feed.","tela2":"ENQUETE: Essa etapa te dá mais medo que a prova? (sim / não)","tela3":"Link do carrossel."}'),
    (14, DATE '2026-08-27', TIME '19:00', 'taf-etapas', 'Stories noite — qui 27/08',
     '{"tela1":"Lenda do dia: \"dá pra treinar o psicotécnico na internet\". Não dá.","tela2":"CAIXINHA: manda sua dúvida sobre etapas pós-objetiva.","tela3":"Link do post + trial."}'),
    (15, DATE '2026-08-28', TIME '07:30', 'identificacao-bastidor', 'Stories manhã — sex 28/08',
     '{"tela1":"Bastidor: print de uma tela do Rota — o plano da semana montado sozinho.","tela2":"SLIDER: Como foi sua semana de estudo? (desisti → cumpri tudo)","tela3":"Trial de 15 dias no link."}'),
    (16, DATE '2026-08-28', TIME '19:00', 'identificacao-bastidor', 'Stories noite — sex 28/08',
     '{"tela1":"Você não atrasou. O Reel de hoje é pra quem começou \"tarde\".","tela2":"ENQUETE: Vai estudar no fim de semana? (sim / só revisão)","tela3":"Link do Reel."}'),
    (17, DATE '2026-08-29', TIME '07:30', 'tecnico-aplicado', 'Stories manhã — sáb 29/08',
     '{"tela1":"Repost do melhor comentário da semana (escolher no dia).","tela2":"CAIXINHA: qual matéria você quer ver em questões comentadas?","tela3":"Link do carrossel de questões."}'),
    (18, DATE '2026-08-29', TIME '19:00', 'tecnico-aplicado', 'Stories noite — sáb 29/08',
     '{"tela1":"Print de 1 questão do carrossel — sem gabarito.","tela2":"QUIZ: qual é a resposta certa?","tela3":"Gabarito + link do post. Comenta 60 pro bloco completo."}'),
    (19, DATE '2026-08-30', TIME '07:30', 'metodo-rotina', 'Stories manhã — dom 30/08',
     '{"tela1":"4 perguntas antes de escolher o concurso. A #1 elimina metade dos arrependimentos.","tela2":"ENQUETE: Você aguenta a escala da sua farda? (sim / não sei)","tela3":"Link do carrossel."}'),
    (20, DATE '2026-08-30', TIME '19:00', 'identificacao-bastidor', 'Stories noite — dom 30/08',
     '{"tela1":"Planeje a semana em 3 telas: escolha os 3 dias, a hora fixa e a revisão de sexta.","tela2":"ENQUETE: Vai estudar hoje? (sim / hoje descanso)","tela3":"Link + trial."}'),
    (21, DATE '2026-08-31', TIME '07:30', 'radar-policial', 'Stories manhã — seg 31/08',
     '{"tela1":"Radar #3 no ar — fechamento da quinzena.","tela2":"ENQUETE: Você acompanha o Radar toda semana? (sim / primeira vez)","tela3":"Link do Radar #3. Comenta RADAR pro PDF."}'),
    (22, DATE '2026-08-31', TIME '19:00', 'radar-policial', 'Stories noite — seg 31/08',
     '{"tela1":"Print de 1 slide do Radar #3.","tela2":"CAIXINHA: o que você quer ver na próxima quinzena de conteúdo?","tela3":"Link do post + trial."}'),
    (23, DATE '2026-09-01', TIME '07:30', 'metodo-rotina', 'Stories manhã — ter 01/09',
     '{"tela1":"Você não precisa de mais horas. Precisa de um critério. Reel novo.","tela2":"ENQUETE: Você estuda por plano ou por feeling? (plano / feeling)","tela3":"Link do Reel."}'),
    (24, DATE '2026-09-01', TIME '19:00', 'metodo-rotina', 'Stories noite — ter 01/09',
     '{"tela1":"Critério do dia: peso no edital → incidência na banca → seu histórico de erro.","tela2":"CAIXINHA: qual matéria você estuda sem saber por quê?","tela3":"Link do Reel + resposta pública."}'),
    (25, DATE '2026-09-02', TIME '07:30', 'metodo-rotina', 'Stories manhã — qua 02/09',
     '{"tela1":"A frase do dia: errar 40 questões em casa é mais barato que errar 5 na prova.","tela2":"CAIXINHA: quantas questões você fez na última semana? Só o número.","tela3":"Link do post."}'),
    (26, DATE '2026-09-02', TIME '19:00', 'metodo-rotina', 'Stories noite — qua 02/09',
     '{"tela1":"Resultado da caixinha da manhã — média de questões da galera.","tela2":"SLIDER: Sua meta de questões pra amanhã? (10 / 20 / 50)","tela3":"Link do post + trial."}'),
    (27, DATE '2026-09-03', TIME '07:30', 'taf-etapas', 'Stories manhã — qui 03/09',
     '{"tela1":"TAF por corporação: os índices e onde o pessoal mais reprova. Carrossel novo.","tela2":"ENQUETE: Você já treina alguma coisa pro TAF? (sim / nem sei o que cai)","tela3":"Link do carrossel."}'),
    (28, DATE '2026-09-03', TIME '19:00', 'taf-etapas', 'Stories noite — qui 03/09',
     '{"tela1":"Fato do dia: PC-SP não tem TAF desde 2018 — e ainda circula vídeo falando o contrário.","tela2":"CAIXINHA: manda sua dúvida de TAF da sua corporação.","tela3":"Link do post. Comenta TAF pro guia."}'),
    (29, DATE '2026-09-04', TIME '07:30', 'identificacao-bastidor', 'Stories manhã — sex 04/09',
     '{"tela1":"Bastidor: o que mudou na rotina de conteúdo em 15 dias — e o que vem por aí.","tela2":"SLIDER: Como foi a sua quinzena de estudo? (difícil → melhor que a anterior)","tela3":"Trial de 15 dias no link."}'),
    (30, DATE '2026-09-04', TIME '19:00', 'identificacao-bastidor', 'Stories noite — sex 04/09',
     '{"tela1":"Duas semanas de constância valem mais que um mês de surto.","tela2":"ENQUETE: Fim de semana: estuda ou descansa? (estuda / os dois)","tela3":"Link do Reel de fechamento + aviso: segunda tem Radar #4."}')
  ) AS v(ordinal, day, at, pillar, title, telas)
),
campaign AS (
  SELECT id FROM campaigns WHERE name = 'Rota de Ataque' AND status = 'active'
)
INSERT INTO scheduled_publications(
  campaign_id, title, caption, channel, subtype, status, scheduled_for, origin, locked_at, locked_by,
  curation_status, pillar, format, content_structure,
  account_id, batch_id, idempotency_key, timezone
)
SELECT
  campaign.id,
  seed.title,
  NULL,
  'instagram', 'stories', 'ready',
  (seed.day + seed.at) AT TIME ZONE 'America/Sao_Paulo',
  'manual', now(), 'organic-15day-batch-v1',
  'proposed',
  seed.pillar,
  'stories',
  jsonb_build_object(
    'roteiro', ((seed.telas::jsonb)->>'tela1') || ' | ' || ((seed.telas::jsonb)->>'tela2') || ' | ' || ((seed.telas::jsonb)->>'tela3'),
    'slides', jsonb_build_array(
      jsonb_build_object('ordem',1,'titulo','Tela 1','texto',(seed.telas::jsonb)->>'tela1'),
      jsonb_build_object('ordem',2,'titulo','Tela 2','texto',(seed.telas::jsonb)->>'tela2'),
      jsonb_build_object('ordem',3,'titulo','Tela 3','texto',(seed.telas::jsonb)->>'tela3')
    ),
    'template_telas', 'pt-cover + pt-content + pt-cta',
    'observacoes', 'Pelo menos 1 sticker interativo por bloco (enquete/caixinha/slider). Link só na 3a tela.'
  ),
  (SELECT id FROM accounts WHERE role = 'actor' ORDER BY id LIMIT 1),
  (SELECT batch_id FROM batch),
  'organic-15d-stories-' || seed.ordinal,
  'America/Sao_Paulo'
FROM seed
JOIN campaign ON true
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_publications existing
  WHERE existing.batch_id = (SELECT batch_id FROM batch)
    AND existing.subtype = 'stories'
);

COMMIT;
