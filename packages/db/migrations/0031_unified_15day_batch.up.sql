BEGIN;

-- Remover os ciclos antigo e unificado antes das oportunidades que eles
-- referenciam. O lote unificado pode existir em bancos nos quais o seed foi
-- aplicado antes de a migration ter sido registrada no ledger.
DELETE FROM scheduled_publications
WHERE batch_id IN (
  'd15db4a0-2026-4a08-8a15-d00000000030'::uuid,
  'd15db4a0-2026-4a08-8a15-d00000000031'::uuid
)
OR content_opportunity_id IN (
  SELECT id
  FROM content_opportunities
  WHERE evidence->>'source' LIKE 'PLANO-DE-PUBLICACAO-15-DIAS%'
);
DELETE FROM content_variants WHERE origin = 'manual' AND status IN ('ready', 'draft') AND locked_by = 'organic-15day-batch-v1';
DELETE FROM content_items WHERE origin = 'manual' AND status IN ('ready', 'draft') AND locked_by = 'organic-15day-batch-v1';
DELETE FROM content_opportunities WHERE id IN (SELECT id FROM content_opportunities WHERE evidence->>'source' LIKE 'PLANO-DE-PUBLICACAO-15-DIAS%');

-- Batch ID do novo ciclo unificado
WITH batch AS (
  SELECT 'd15db4a0-2026-4a08-8a15-d00000000031'::uuid AS batch_id
),
seed AS (
  SELECT * FROM (VALUES
    (1, DATE '2026-08-21', TIME '12:00', 'carousel', 'carrosseis', 'radar-policial-informacao-antes', 'radar-policial-informacao-antes',
     'Radar Policial: O que mudou nesta semana',
     E'Atualizações da semana nos editais policiais. A banca [banca] divulgou o edital para [cargo]. A banca [banca] foi escolhida. Hora de focar no perfil dela. Quem antecipa a preparação sai na frente. Não espere a concorrência acordar. Siga a base comum policial e garanta a melhor preparação antes mesmo da publicação. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta RADAR ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL','texto','Atualizações da semana nos editais policiais.'),
         jsonb_build_object('ordem',2,'titulo','[Estado] - Edital Publicado','texto','A banca [banca] divulgou o edital para [cargo].'),
         jsonb_build_object('ordem',3,'titulo','[Estado] - Banca Definida','texto','A banca [banca] foi escolhida. Hora de focar no perfil dela.'),
         jsonb_build_object('ordem',4,'titulo','O que isso significa','texto','Quem antecipa a preparação sai na frente. Não espere a concorrência acordar.'),
         jsonb_build_object('ordem',5,'titulo','O seu Próximo Passo','texto','Siga a base comum policial e garanta a melhor preparação antes mesmo da publicação.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-educacional | isca: RADAR'),

    (2, DATE '2026-08-21', TIME '19:30', 'carousel', 'carrosseis', 'direcao-vence-esforco', 'direcao-vence-esforco',
     'O que a banca mais cobra em Legislação Especial',
     E'Você não precisa decorar tudo, só o que realmente cai. Art. 28 x Art. 33. A diferença entre uso e tráfico. Foque no dolo específico. Sem ele, não há crime. Diferença entre tortura e lesão corporal grave. Posse x Porte. A banca sempre inverte esses dois. Estude com estratégia, não com força bruta. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta LEI ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Legislação Especial','texto','Você não precisa decorar tudo, só o que realmente cai.'),
         jsonb_build_object('ordem',2,'titulo','Lei de Drogas','texto','Art. 28 x Art. 33. A diferença entre uso e tráfico.'),
         jsonb_build_object('ordem',3,'titulo','Abuso de Autoridade','texto','Foque no dolo específico. Sem ele, não há crime.'),
         jsonb_build_object('ordem',4,'titulo','Tortura','texto','Diferença entre tortura e lesão corporal grave.'),
         jsonb_build_object('ordem',5,'titulo','Estatuto do Desarmamento','texto','Posse x Porte. A banca sempre inverte esses dois.'),
         jsonb_build_object('ordem',6,'titulo','Resumo','texto','Estude com estratégia, não com força bruta.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-curto | isca: LEI'),

    (3, DATE '2026-08-22', TIME '12:00', 'carousel', 'carrosseis', 'concurso-policial-nao-acaba-na-objetiva', 'concurso-policial-nao-acaba-na-objetiva',
     'Tatuagem reprova em concurso policial?',
     E'A resposta não é tão simples quanto parece. Tatuagens que fazem apologia ao crime, discriminação ou violência. Depende do edital. Locais visíveis com o uniforme podem ser restritos em algumas PMs. Leia o seu edital. O que vale para a PC não necessariamente vale para a PM. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta TATTOO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Tatuagem reprova?','texto','A resposta não é tão simples quanto parece.'),
         jsonb_build_object('ordem',2,'titulo','O que realmente reprova','texto','Tatuagens que fazem apologia ao crime, discriminação ou violência.'),
         jsonb_build_object('ordem',3,'titulo','O local importa','texto','Depende do edital. Locais visíveis com o uniforme podem ser restritos em algumas PMs.'),
         jsonb_build_object('ordem',4,'titulo','A regra de ouro','texto','Leia o seu edital. O que vale para a PC não necessariamente vale para a PM.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-impacto | isca: TATTOO'),

    (4, DATE '2026-08-22', TIME '19:30', 'carousel', 'carrosseis', 'direcao-vence-esforco', 'direcao-vence-esforco',
     'As 7 matérias que decidem qualquer edital policial',
     E'Focar na base é o segredo para passar mais rápido. A matéria que mais elimina candidatos desatentos. O coração da área policial. Domine a parte geral. Prisões, provas e direitos fundamentais. Diferencial competitivo. Não negligencie. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta BASE ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','As 7 matérias de ouro','texto','Focar na base é o segredo para passar mais rápido.'),
         jsonb_build_object('ordem',2,'titulo','Português','texto','A matéria que mais elimina candidatos desatentos.'),
         jsonb_build_object('ordem',3,'titulo','Direito Penal','texto','O coração da área policial. Domine a parte geral.'),
         jsonb_build_object('ordem',4,'titulo','Processo Penal e Constitucional','texto','Prisões, provas e direitos fundamentais.'),
         jsonb_build_object('ordem',5,'titulo','Administrativo e RLM','texto','Diferencial competitivo. Não negligencie.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-misto | isca: BASE'),

    (5, DATE '2026-08-23', TIME '12:00', 'carousel', 'carrosseis', 'escolha-a-farda-certa', 'escolha-a-farda-certa',
     'PM, Polícia Penal, Polícia Civil ou PRF?',
     E'Não escolha pelo salário. Escolha pela rotina. Escala intensa, patrulhamento ostensivo, hierarquia forte. Investigação e ambiente prisional. Rotinas completamente diferentes. Rodovias federais. Lotação inicial quase sempre longe de casa. Qual dessas rotinas você aguenta por 30 anos? 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta FARDA ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Escolha a farda certa','texto','Não escolha pelo salário. Escolha pela rotina.'),
         jsonb_build_object('ordem',2,'titulo','Polícia Militar','texto','Escala intensa, patrulhamento ostensivo, hierarquia forte.'),
         jsonb_build_object('ordem',3,'titulo','Polícia Civil e Penal','texto','Investigação e ambiente prisional. Rotinas completamente diferentes.'),
         jsonb_build_object('ordem',4,'titulo','PRF','texto','Rodovias federais. Lotação inicial quase sempre longe de casa.'),
         jsonb_build_object('ordem',5,'titulo','A decisão','texto','Qual dessas rotinas você aguenta por 30 anos?')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-lista | isca: FARDA'),

    (6, DATE '2026-08-23', TIME '19:30', 'carousel', 'carrosseis', 'radar-policial-informacao-antes', 'radar-policial-informacao-antes',
     'Radar Policial: Autorizações e comissões formadas',
     E'As comissões formadas que vão virar edital logo. Passo anterior à escolha da banca. O edital está esquentando. Governo autorizou as vagas. É hora de intensificar a base. Ajuste seu ciclo de estudos para englobar essas oportunidades. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta RADAR ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL','texto','As comissões formadas que vão virar edital logo.'),
         jsonb_build_object('ordem',2,'titulo','[Estado] - Comissão Formada','texto','Passo anterior à escolha da banca. O edital está esquentando.'),
         jsonb_build_object('ordem',3,'titulo','[Estado] - Autorização Oficial','texto','Governo autorizou as vagas. É hora de intensificar a base.'),
         jsonb_build_object('ordem',4,'titulo','Seu próximo passo','texto','Ajuste seu ciclo de estudos para englobar essas oportunidades.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-educacional | isca: RADAR'),

    (7, DATE '2026-08-24', TIME '12:00', 'carousel', 'carrosseis', 'erro-e-dado-nao-fracasso', 'erro-e-dado-nao-fracasso',
     '5 questões que a banca usa para te derrubar',
     E'Você sabe a lei, mas erra a questão. Por quê? A banca troca "5 dias" por "10 dias". Leitura atenta é essencial. A palavra que muda todo o sentido da frase, geralmente no final. "Sempre", "nunca", "exclusivamente". Desconfie delas. Treine a leitura dinâmica e sublinhe palavras-chave. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta 60 ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','As pegadinhas clássicas','texto','Você sabe a lei, mas erra a questão. Por quê?'),
         jsonb_build_object('ordem',2,'titulo','A inversão de prazos','texto','A banca troca "5 dias" por "10 dias". Leitura atenta é essencial.'),
         jsonb_build_object('ordem',3,'titulo','O "exceto" escondido','texto','A palavra que muda todo o sentido da frase, geralmente no final.'),
         jsonb_build_object('ordem',4,'titulo','Palavras absolutas','texto','"Sempre", "nunca", "exclusivamente". Desconfie delas.'),
         jsonb_build_object('ordem',5,'titulo','Como não cair','texto','Treine a leitura dinâmica e sublinhe palavras-chave.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-curto | isca: 60'),

    (8, DATE '2026-08-24', TIME '19:30', 'carousel', 'carrosseis', 'concurso-policial-nao-acaba-na-objetiva', 'concurso-policial-nao-acaba-na-objetiva',
     'Investigação social: o que reprova de verdade',
     E'O terror de quem já passou na objetiva e no TAF. Omitir informações. A mentira reprova mais que o fato. Em regra, não. Mas dívidas inexplicáveis chamam atenção. O que você posta hoje pode ser a sua eliminação amanhã. Cuidado. Seja transparente. A banca vai descobrir de qualquer jeito. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta SOCIAL ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Investigação Social','texto','O terror de quem já passou na objetiva e no TAF.'),
         jsonb_build_object('ordem',2,'titulo','O que reprova na hora','texto','Omitir informações. A mentira reprova mais que o fato.'),
         jsonb_build_object('ordem',3,'titulo','Nome sujo reprova?','texto','Em regra, não. Mas dívidas inexplicáveis chamam atenção.'),
         jsonb_build_object('ordem',4,'titulo','Redes Sociais','texto','O que você posta hoje pode ser a sua eliminação amanhã. Cuidado.'),
         jsonb_build_object('ordem',5,'titulo','A dica de ouro','texto','Seja transparente. A banca vai descobrir de qualquer jeito.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-impacto | isca: SOCIAL'),

    (9, DATE '2026-08-25', TIME '12:00', 'carousel', 'carrosseis', 'concurso-policial-nao-acaba-na-objetiva', 'concurso-policial-nao-acaba-na-objetiva',
     '6 erros no TAF que não têm a ver com condicionamento',
     E'Não é só sobre força. É sobre técnica. Não passar o queixo ou não estender totalmente o braço. Gastar toda a energia no primeiro minuto. Controle o pace. Mãos escapando da nuca ou cotovelo não tocando o joelho. Treine gravando a si mesmo e corrija a postura. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta TAF ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Reprovação no TAF','texto','Não é só sobre força. É sobre técnica.'),
         jsonb_build_object('ordem',2,'titulo','Barra Fixa','texto','Não passar o queixo ou não estender totalmente o braço.'),
         jsonb_build_object('ordem',3,'titulo','Corrida','texto','Gastar toda a energia no primeiro minuto. Controle o pace.'),
         jsonb_build_object('ordem',4,'titulo','Abdominal','texto','Mãos escapando da nuca ou cotovelo não tocando o joelho.'),
         jsonb_build_object('ordem',5,'titulo','A execução perfeita','texto','Treine gravando a si mesmo e corrija a postura.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-misto | isca: TAF'),

    (10, DATE '2026-08-25', TIME '19:30', 'carousel', 'carrosseis', 'menos-material-mais-execucao', 'menos-material-mais-execucao',
     'Falta 1 mês: O que CORTAR do seu estudo',
     E'A um mês da prova, adicionar material é pedir para reprovar. Se não resumiu até agora, vá para as questões. Foque na lei seca e na jurisprudência consolidada. Gastar horas no que vale 0,5 ponto não faz sentido agora. Revisão ativa, simulados e muitas questões da banca. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta 30 ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Reta Final','texto','A um mês da prova, adicionar material é pedir para reprovar.'),
         jsonb_build_object('ordem',2,'titulo','Corte resumos novos','texto','Se não resumiu até agora, vá para as questões.'),
         jsonb_build_object('ordem',3,'titulo','Corte doutrina densa','texto','Foque na lei seca e na jurisprudência consolidada.'),
         jsonb_build_object('ordem',4,'titulo','Corte matérias sem peso','texto','Gastar horas no que vale 0,5 ponto não faz sentido agora.'),
         jsonb_build_object('ordem',5,'titulo','O que manter','texto','Revisão ativa, simulados e muitas questões da banca.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-lista | isca: 30'),

    (11, DATE '2026-08-26', TIME '12:00', 'carousel', 'carrosseis', 'erro-e-dado-nao-fracasso', 'erro-e-dado-nao-fracasso',
     'Português: 4 pegadinhas que eliminam sem dó',
     E'Português elimina mais que Direito. Antes de palavra masculina e verbo. A banca ama. Sujeito distante do verbo para confundir a leitura. Próclise, mesóclise e ênclise. Conheça as palavras atrativas. Leia muito e faça questões exaustivamente. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O vilão das provas','texto','Português elimina mais que Direito.'),
         jsonb_build_object('ordem',2,'titulo','Crase','texto','Antes de palavra masculina e verbo. A banca ama.'),
         jsonb_build_object('ordem',3,'titulo','Concordância verbal','texto','Sujeito distante do verbo para confundir a leitura.'),
         jsonb_build_object('ordem',4,'titulo','Colocação pronominal','texto','Próclise, mesóclise e ênclise. Conheça as palavras atrativas.'),
         jsonb_build_object('ordem',5,'titulo','Como melhorar','texto','Leia muito e faça questões exaustivamente.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-educacional | isca: nenhuma'),

    (12, DATE '2026-08-26', TIME '19:30', 'carousel', 'carrosseis', 'escolha-a-farda-certa', 'escolha-a-farda-certa',
     'PM x Polícia Penal: Qual é a sua batalha?',
     E'Duas instituições respeitadas, duas realidades distintas. PM nas ruas, contato com a população. PP no sistema prisional, segurança interna. PP costuma ter escalas de plantão mais previsíveis (ex: 24x72). PM varia muito. Ambas exigem controle emocional gigante, mas de formas diferentes. Analise o seu perfil antes de se jogar nos livros. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta FARDA ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O duelo das fardas','texto','Duas instituições respeitadas, duas realidades distintas.'),
         jsonb_build_object('ordem',2,'titulo','O ambiente de trabalho','texto','PM nas ruas, contato com a população. PP no sistema prisional, segurança interna.'),
         jsonb_build_object('ordem',3,'titulo','A escala','texto','PP costuma ter escalas de plantão mais previsíveis (ex: 24x72). PM varia muito.'),
         jsonb_build_object('ordem',4,'titulo','O perfil exigido','texto','Ambas exigem controle emocional gigante, mas de formas diferentes.'),
         jsonb_build_object('ordem',5,'titulo','Sua escolha','texto','Analise o seu perfil antes de se jogar nos livros.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-curto | isca: FARDA'),

    (13, DATE '2026-08-27', TIME '12:00', 'carousel', 'carrosseis', 'concurso-policial-nao-acaba-na-objetiva', 'concurso-policial-nao-acaba-na-objetiva',
     'Psicotécnico: Verdades e lendas de WhatsApp',
     E'A etapa mais subjetiva (e temida) do concurso. Não é para ver se você sabe desenhar pauzinhos, é sobre ritmo e equilíbrio. Não tente burlar ou ser o "super-herói". A mentira aparece na incongruência. Ansiedade extrema no dia do teste. Durma bem. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O medo invisível','texto','A etapa mais subjetiva (e temida) do concurso.'),
         jsonb_build_object('ordem',2,'titulo','O teste do palográfico','texto','Não é para ver se você sabe desenhar pauzinhos, é sobre ritmo e equilíbrio.'),
         jsonb_build_object('ordem',3,'titulo','Testes de personalidade','texto','Não tente burlar ou ser o "super-herói". A mentira aparece na incongruência.'),
         jsonb_build_object('ordem',4,'titulo','A maior causa de reprovação','texto','Ansiedade extrema no dia do teste. Durma bem.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-impacto | isca: nenhuma'),

    (14, DATE '2026-08-27', TIME '19:30', 'carousel', 'carrosseis', 'erro-e-dado-nao-fracasso', 'erro-e-dado-nao-fracasso',
     'A banca troca UMA palavra e inverte a resposta',
     E'Como perder pontos preciosos por falta de atenção. A diferença entre faculdade e obrigação legal. Termos restritivos que quase sempre tornam a alternativa falsa. A exceção que confirma a regra. Leia até o ponto final. Nunca pare na primeira vírgula. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta 60 ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','A arte da pegadinha','texto','Como perder pontos preciosos por falta de atenção.'),
         jsonb_build_object('ordem',2,'titulo','"Poderá" x "Deverá"','texto','A diferença entre faculdade e obrigação legal.'),
         jsonb_build_object('ordem',3,'titulo','"Apenas" / "Somente"','texto','Termos restritivos que quase sempre tornam a alternativa falsa.'),
         jsonb_build_object('ordem',4,'titulo','"Salvo disposição em contrário"','texto','A exceção que confirma a regra.'),
         jsonb_build_object('ordem',5,'titulo','O antídoto','texto','Leia até o ponto final. Nunca pare na primeira vírgula.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-misto | isca: 60'),

    (15, DATE '2026-08-28', TIME '12:00', 'carousel', 'carrosseis', 'escolha-a-farda-certa', 'escolha-a-farda-certa',
     'Antes de escolher o edital, responda isso',
     E'Foco é o que diferencia aprovados de eternos concurseiros. Qual é a minha real vocação? Policiamento ostensivo, investigação ou sistema prisional?  Estou disposto a mudar de estado ou cidade? O edital base já está consolidado na minha cabeça? Tenho estrutura emocional e familiar para a jornada? Concurso não é loteria. É projeto de vida. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Não atire para todo lado','texto','Foco é o que diferencia aprovados de eternos concurseiros.'),
         jsonb_build_object('ordem',2,'titulo','Pergunta 1','texto','Qual é a minha real vocação? Policiamento ostensivo, investigação ou sistema prisional? '),
         jsonb_build_object('ordem',3,'titulo','Pergunta 2','texto','Estou disposto a mudar de estado ou cidade?'),
         jsonb_build_object('ordem',4,'titulo','Pergunta 3','texto','O edital base já está consolidado na minha cabeça?'),
         jsonb_build_object('ordem',5,'titulo','Pergunta 4','texto','Tenho estrutura emocional e familiar para a jornada?'),
         jsonb_build_object('ordem',6,'titulo','A reflexão','texto','Concurso não é loteria. É projeto de vida.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-lista | isca: nenhuma'),

    (16, DATE '2026-08-28', TIME '19:30', 'carousel', 'carrosseis', 'gente-comum-passa', 'gente-comum-passa',
     'Trabalha 8h e quer passar? Siga esse roteiro',
     E'Conciliar CLT e estudos não é para fracos. Ônibus, fila, horário de almoço. Tudo vira flashcard e revisão. Você não tem tempo para ler PDFs de 200 páginas. Vá para os resumos esquematizados. 2 horas concentradas valem mais que 6 horas com celular do lado. A jornada é mais longa, mas a posse tem o mesmo gosto. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','A realidade da maioria','texto','Conciliar CLT e estudos não é para fracos.'),
         jsonb_build_object('ordem',2,'titulo','Aproveite os "tempos mortos"','texto','Ônibus, fila, horário de almoço. Tudo vira flashcard e revisão.'),
         jsonb_build_object('ordem',3,'titulo','Estudo ativo é lei','texto','Você não tem tempo para ler PDFs de 200 páginas. Vá para os resumos esquematizados.'),
         jsonb_build_object('ordem',4,'titulo','O poder das 2 horas líquidas','texto','2 horas concentradas valem mais que 6 horas com celular do lado.'),
         jsonb_build_object('ordem',5,'titulo','O final','texto','A jornada é mais longa, mas a posse tem o mesmo gosto.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-educacional | isca: nenhuma'),

    (17, DATE '2026-08-29', TIME '12:00', 'carousel', 'carrosseis', 'direcao-vence-esforco', 'direcao-vence-esforco',
     'Como montar um plano de ataque indestrutível',
     E'Porque você planeja o ideal, não o real. Não engesse seus horários. Defina metas semanais, não diárias. Comece sempre pela matéria que você tem mais dificuldade. Se não tem revisão no seu cronograma, você está apenas lendo, não estudando. Pelo menos 30% do seu tempo deve ser resolvendo questões. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta BASE ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Seu cronograma falha?','texto','Porque você planeja o ideal, não o real.'),
         jsonb_build_object('ordem',2,'titulo','Regra 1: Flexibilidade','texto','Não engesse seus horários. Defina metas semanais, não diárias.'),
         jsonb_build_object('ordem',3,'titulo','Regra 2: Priorização','texto','Comece sempre pela matéria que você tem mais dificuldade.'),
         jsonb_build_object('ordem',4,'titulo','Regra 3: Revisão embutida','texto','Se não tem revisão no seu cronograma, você está apenas lendo, não estudando.'),
         jsonb_build_object('ordem',5,'titulo','Regra 4: Questões','texto','Pelo menos 30% do seu tempo deve ser resolvendo questões.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-curto | isca: BASE'),

    (18, DATE '2026-08-29', TIME '19:30', 'carousel', 'carrosseis', 'erro-e-dado-nao-fracasso', 'erro-e-dado-nao-fracasso',
     'Por que seus simulados estão mentindo para você',
     E'Tirar 90% no simulado feito no sofá não garante nada. Faça o simulado no horário da prova, com máscara (se exigido), em silêncio absoluto. A prova não será no seu quarto com ar condicionado. Acostume-se. Fazer o simulado é 30% do trabalho. Os outros 70% são corrigir cada erro. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta 60 ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','A ilusão da nota alta','texto','Tirar 90% no simulado feito no sofá não garante nada.'),
         jsonb_build_object('ordem',2,'titulo','Simule o inferno','texto','Faça o simulado no horário da prova, com máscara (se exigido), em silêncio absoluto.'),
         jsonb_build_object('ordem',3,'titulo','A cadeira desconfortável','texto','A prova não será no seu quarto com ar condicionado. Acostume-se.'),
         jsonb_build_object('ordem',4,'titulo','A correção é o ouro','texto','Fazer o simulado é 30% do trabalho. Os outros 70% são corrigir cada erro.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-impacto | isca: 60'),

    (19, DATE '2026-08-30', TIME '12:00', 'carousel', 'carrosseis', 'gente-comum-passa', 'gente-comum-passa',
     'Todo aprovado tem uma coleção de fracassos',
     E'O Instagram só mostra o nome no Diário Oficial. A maioria dos aprovados colecionou reprovações antes da vitória. Muitos caíram na barra antes de conseguir o apto. Ficar por 1 ponto destrói, mas também mostra que você está no caminho. A reprovação é um degrau, não o fim da escada. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O lado que ninguém mostra','texto','O Instagram só mostra o nome no Diário Oficial.'),
         jsonb_build_object('ordem',2,'titulo','As reprovações','texto','A maioria dos aprovados colecionou reprovações antes da vitória.'),
         jsonb_build_object('ordem',3,'titulo','O TAF que não deu','texto','Muitos caíram na barra antes de conseguir o apto.'),
         jsonb_build_object('ordem',4,'titulo','O quase lá','texto','Ficar por 1 ponto destrói, mas também mostra que você está no caminho.'),
         jsonb_build_object('ordem',5,'titulo','Siga em frente','texto','A reprovação é um degrau, não o fim da escada.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-misto | isca: nenhuma'),

    (20, DATE '2026-08-30', TIME '19:30', 'carousel', 'carrosseis', 'radar-policial-informacao-antes', 'radar-policial-informacao-antes',
     'Radar Policial: Onde estão as maiores oportunidades',
     E'Concursos com previsão de milhares de vagas. Historicamente, editais gigantes. Fique de olho em PE e CE. Déficit enorme de efetivo. SP e MG sempre aquecidos. A janela de ouro está aberta. A hora de plantar é agora. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta RADAR ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL','texto','Concursos com previsão de milhares de vagas.'),
         jsonb_build_object('ordem',2,'titulo','Polícias Militares do Nordeste','texto','Historicamente, editais gigantes. Fique de olho em PE e CE.'),
         jsonb_build_object('ordem',3,'titulo','Polícias Civis do Sudeste','texto','Déficit enorme de efetivo. SP e MG sempre aquecidos.'),
         jsonb_build_object('ordem',4,'titulo','O momento','texto','A janela de ouro está aberta. A hora de plantar é agora.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-lista | isca: RADAR'),

    (21, DATE '2026-08-31', TIME '12:00', 'carousel', 'carrosseis', 'menos-material-mais-execucao', 'menos-material-mais-execucao',
     'Pare de comprar cursinho novo agora',
     E'Comprar material dá a falsa sensação de estar estudando. Nenhum material milagroso vai estudar por você. PDF básico, lei seca e site de questões. É só isso. Escolha um e vá até o fim. Pular de galho em galho só atrasa a posse. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O ciclo do vício','texto','Comprar material dá a falsa sensação de estar estudando.'),
         jsonb_build_object('ordem',2,'titulo','A verdade dói','texto','Nenhum material milagroso vai estudar por você.'),
         jsonb_build_object('ordem',3,'titulo','O feijão com arroz','texto','PDF básico, lei seca e site de questões. É só isso.'),
         jsonb_build_object('ordem',4,'titulo','O foco','texto','Escolha um e vá até o fim. Pular de galho em galho só atrasa a posse.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-educacional | isca: nenhuma'),

    (22, DATE '2026-08-31', TIME '19:30', 'carousel', 'carrosseis', 'concurso-policial-nao-acaba-na-objetiva', 'concurso-policial-nao-acaba-na-objetiva',
     'Exames médicos: O que te tira do jogo antes da posse',
     E'Muitos esquecem que a saúde também é avaliada. Alguns editais têm limites rígidos. Cuidado com a balança. Verifique se o seu grau de miopia/astigmatismo está dentro do permitido. Faça um check-up antes do edital. Colesterol e glicemia nas alturas podem complicar. Cuide da saúde como cuida das revisões. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','A fase clínica','texto','Muitos esquecem que a saúde também é avaliada.'),
         jsonb_build_object('ordem',2,'titulo','Índice de Massa Corporal (IMC)','texto','Alguns editais têm limites rígidos. Cuidado com a balança.'),
         jsonb_build_object('ordem',3,'titulo','Acuidade visual','texto','Verifique se o seu grau de miopia/astigmatismo está dentro do permitido.'),
         jsonb_build_object('ordem',4,'titulo','Alterações laboratoriais','texto','Faça um check-up antes do edital. Colesterol e glicemia nas alturas podem complicar.'),
         jsonb_build_object('ordem',5,'titulo','Prevenção','texto','Cuide da saúde como cuida das revisões.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-curto | isca: nenhuma'),

    (23, DATE '2026-09-01', TIME '12:00', 'carousel', 'carrosseis', 'direcao-vence-esforco', 'direcao-vence-esforco',
     'A mentira das 12 horas de estudo diárias',
     E'Quem posta que estuda 12h líquidas, provavelmente está mentindo. O cérebro não absorve tudo. Após 4h intensas, o rendimento despenca. 3h focadas são muito superiores a 8h arrastadas. Dormir consolida a memória. Quem não dorme, não aprende. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O mito do herói','texto','Quem posta que estuda 12h líquidas, provavelmente está mentindo.'),
         jsonb_build_object('ordem',2,'titulo','A curva de esquecimento','texto','O cérebro não absorve tudo. Após 4h intensas, o rendimento despenca.'),
         jsonb_build_object('ordem',3,'titulo','Qualidade > Quantidade','texto','3h focadas são muito superiores a 8h arrastadas.'),
         jsonb_build_object('ordem',4,'titulo','O descanso','texto','Dormir consolida a memória. Quem não dorme, não aprende.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-impacto | isca: nenhuma'),

    (24, DATE '2026-09-01', TIME '19:30', 'carousel', 'carrosseis', 'escolha-a-farda-certa', 'escolha-a-farda-certa',
     'Estou "velho" demais para o concurso policial?',
     E'Mito e realidade sobre concursos policiais e idade. A maioria tem limite de 30 a 35 anos. Fique atento à lei do estado. Em regra, o limite é a idade da aposentadoria compulsória. Se você tem 40 anos, seu adversário no TAF não é o garoto de 20. É você mesmo. A maturidade ajuda a manter a calma na prova e na profissão. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O limite da idade','texto','Mito e realidade sobre concursos policiais e idade.'),
         jsonb_build_object('ordem',2,'titulo','Polícia Militar','texto','A maioria tem limite de 30 a 35 anos. Fique atento à lei do estado.'),
         jsonb_build_object('ordem',3,'titulo','Polícia Civil, Penal e Federal','texto','Em regra, o limite é a idade da aposentadoria compulsória.'),
         jsonb_build_object('ordem',4,'titulo','O vigor físico','texto','Se você tem 40 anos, seu adversário no TAF não é o garoto de 20. É você mesmo.'),
         jsonb_build_object('ordem',5,'titulo','Experiência conta','texto','A maturidade ajuda a manter a calma na prova e na profissão.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-misto | isca: nenhuma'),

    (25, DATE '2026-09-02', TIME '12:00', 'carousel', 'carrosseis', 'erro-e-dado-nao-fracasso', 'erro-e-dado-nao-fracasso',
     'A arte do chute consciente na prova policial',
     E'Existe técnica até para quando você não sabe a resposta. Sempre elimine primeiro os absurdos jurídicos. Exclua alternativas com "sempre", "jamais", "unicamente". Na dúvida, vá pela alternativa que defende o interesse público. Em provas Cespe/Cebraspe, avalie se vale a pena arriscar o ponto. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Chutar não é loteria','texto','Existe técnica até para quando você não sabe a resposta.'),
         jsonb_build_object('ordem',2,'titulo','Eliminação','texto','Sempre elimine primeiro os absurdos jurídicos.'),
         jsonb_build_object('ordem',3,'titulo','As absolutas','texto','Exclua alternativas com "sempre", "jamais", "unicamente".'),
         jsonb_build_object('ordem',4,'titulo','A jurisprudência','texto','Na dúvida, vá pela alternativa que defende o interesse público.'),
         jsonb_build_object('ordem',5,'titulo','Risco calculado','texto','Em provas Cespe/Cebraspe, avalie se vale a pena arriscar o ponto.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-lista | isca: nenhuma'),

    (26, DATE '2026-09-02', TIME '19:30', 'carousel', 'carrosseis', 'gente-comum-passa', 'gente-comum-passa',
     'Seu ambiente está roubando sua aprovação',
     E'Estudar na cama assistindo TV é sabotagem. Tire tudo que não for usar. O celular deve estar em outro cômodo. Invista em conforto. Suas costas vão agradecer em seis meses. Luz branca e direta. Não deixe o sono te vencer. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-educacional','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','Onde você estuda importa','texto','Estudar na cama assistindo TV é sabotagem.'),
         jsonb_build_object('ordem',2,'titulo','A mesa limpa','texto','Tire tudo que não for usar. O celular deve estar em outro cômodo.'),
         jsonb_build_object('ordem',3,'titulo','A cadeira','texto','Invista em conforto. Suas costas vão agradecer em seis meses.'),
         jsonb_build_object('ordem',4,'titulo','A iluminação','texto','Luz branca e direta. Não deixe o sono te vencer.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-educacional | isca: nenhuma'),

    (27, DATE '2026-09-03', TIME '12:00', 'carousel', 'carrosseis', 'menos-material-mais-execucao', 'menos-material-mais-execucao',
     'Como fazer um caderno de erros que funciona',
     E'Sua arma mais letal na reta final. Anote apenas o conceito que você errou. Seja breve. Separe por matérias e assuntos. Facilite a busca. Leia seu caderno de erros 2x por semana. Ele deve ser sua leitura de cabeceira. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-curto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','O caderno de erros','texto','Sua arma mais letal na reta final.'),
         jsonb_build_object('ordem',2,'titulo','Não copie a questão','texto','Anote apenas o conceito que você errou. Seja breve.'),
         jsonb_build_object('ordem',3,'titulo','Organização','texto','Separe por matérias e assuntos. Facilite a busca.'),
         jsonb_build_object('ordem',4,'titulo','A revisão ativa','texto','Leia seu caderno de erros 2x por semana. Ele deve ser sua leitura de cabeceira.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-curto | isca: nenhuma'),

    (28, DATE '2026-09-03', TIME '19:30', 'carousel', 'carrosseis', 'radar-policial-informacao-antes', 'radar-policial-informacao-antes',
     'Radar Policial: Os editais iminentes',
     E'Aqueles que podem sair a qualquer momento. Contrato com a banca assinado? É questão de dias. Não mude seu foco drasticamente. Acelere a base comum. Siga nosso radar e não seja pego de surpresa. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta RADAR ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-impacto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','RADAR POLICIAL','texto','Aqueles que podem sair a qualquer momento.'),
         jsonb_build_object('ordem',2,'titulo','Os indícios','texto','Contrato com a banca assinado? É questão de dias.'),
         jsonb_build_object('ordem',3,'titulo','O que fazer','texto','Não mude seu foco drasticamente. Acelere a base comum.'),
         jsonb_build_object('ordem',4,'titulo','Acompanhamento','texto','Siga nosso radar e não seja pego de surpresa.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-impacto | isca: RADAR'),

    (29, DATE '2026-09-04', TIME '12:00', 'carousel', 'carrosseis', 'concurso-policial-nao-acaba-na-objetiva', 'concurso-policial-nao-acaba-na-objetiva',
     'Prova de títulos: Vale a pena focar nisso?',
     E'Mestrado, especialização... muda muito a nota? Títulos desempatam, mas raramente te colocam nas vagas se a objetiva foi ruim. Foque 95% na objetiva e discursiva. Título é bônus. Deixar de estudar para tentar uma pós-graduação às pressas. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover','preset','preset-misto','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','A caça aos títulos','texto','Mestrado, especialização... muda muito a nota?'),
         jsonb_build_object('ordem',2,'titulo','A realidade','texto','Títulos desempatam, mas raramente te colocam nas vagas se a objetiva foi ruim.'),
         jsonb_build_object('ordem',3,'titulo','A estratégia','texto','Foque 95% na objetiva e discursiva. Título é bônus.'),
         jsonb_build_object('ordem',4,'titulo','O erro','texto','Deixar de estudar para tentar uma pós-graduação às pressas.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover + cr-list + cr-cta | preset-misto | isca: nenhuma'),

    (30, DATE '2026-09-04', TIME '19:30', 'carousel', 'carrosseis', 'direcao-vence-esforco', 'direcao-vence-esforco',
     'O segredo da redação policial nota máxima',
     E'Onde muita gente boa é eliminada. A banca quer ver introdução, desenvolvimento e conclusão claros. Cite leis, Constituição e Direitos Humanos. É o que eles querem ler. Faça pelo menos uma redação por semana. A mão tem que acostumar. 

Siga o nosso perfil para dicas diárias. E não esqueça de comentar e salvar este post para revisar mais tarde!',
     'Comenta EU QUERO ou Salva para ver depois! E nos siga para não perder nada.',
     jsonb_build_array('#concursopolicial','#carreiraspoliciais','#concursopublico','#concurseiro','#rotadeataque','#foco'),
     jsonb_build_object(
       'template_capa','cr-cover-dark','preset','preset-lista','slides_fechamento','cr-cta',
       'slides', jsonb_build_array(
         jsonb_build_object('ordem',1,'titulo','A redação','texto','Onde muita gente boa é eliminada.'),
         jsonb_build_object('ordem',2,'titulo','Estrutura > Criatividade','texto','A banca quer ver introdução, desenvolvimento e conclusão claros.'),
         jsonb_build_object('ordem',3,'titulo','O conteúdo','texto','Cite leis, Constituição e Direitos Humanos. É o que eles querem ler.'),
         jsonb_build_object('ordem',4,'titulo','A prática','texto','Faça pelo menos uma redação por semana. A mão tem que acostumar.')
       ),
       'observacoes', 'Gerado para 15-day cycle unification. Status em andamento.'
     ),
     'cards: cr-cover-dark + cr-list + cr-cta | preset-lista | isca: nenhuma')
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
    jsonb_build_object('seed','organic-15day-batch-v1','ordinal',seed.ordinal,'source','PLANO-DE-PUBLICACAO-15-DIAS-UNIFICADO'),
    60, 'manual-v1', 0.8, '[]'::jsonb, 'new'
  FROM seed CROSS JOIN campaign
  WHERE NOT EXISTS (
    SELECT 1 FROM scheduled_publications existing
    WHERE existing.batch_id = (SELECT batch_id FROM batch)
      AND existing.channel = 'instagram' AND existing.subtype = 'carousel'
      AND existing.idempotency_key = 'organic-15d-feed-' || seed.ordinal
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
ON CONFLICT DO NOTHING;

COMMIT;
