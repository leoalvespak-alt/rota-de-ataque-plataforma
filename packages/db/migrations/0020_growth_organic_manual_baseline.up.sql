-- Baseline editorial manual extraído de Docs/CRESCIMENTO-ORGANICO-ROTA-DE-ATAQUE.md.
-- O conteúdo nasce protegido contra automação, mas continua editável por uma sessão humana.

ALTER TABLE theses
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'
    CHECK(origin IN ('manual','ai_generated','automation')),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

DROP TRIGGER IF EXISTS theses_manual_guard ON theses;
CREATE TRIGGER theses_manual_guard
  BEFORE UPDATE ON theses
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability();

DROP TRIGGER IF EXISTS theses_manual_guard_delete ON theses;
CREATE TRIGGER theses_manual_guard_delete
  BEFORE DELETE ON theses
  FOR EACH ROW EXECUTE FUNCTION enforce_manual_immutability_delete();

-- As seis teses são uma base da campanha Rota de Ataque. Se já houver teses ativas,
-- somente as que couberem no limite de sete nascem ativas; nenhuma tese existente é alterada.
WITH thesis_seed(ordinal, slug, title, description, tenets, example_hooks) AS (
  VALUES
    (1, 'direcao-vence-esforco', 'Direção vence esforço',
      'O concurseiro policial não reprova por falta de horas; reprova por falta de direção.',
      jsonb_build_array(
        'Um plano com peso de banca e incidência vale mais que oito horas de estudo aleatório.',
        'Combate estudo sem prioridade, troca constante de material e cronograma abandonado.',
        'Transforma o Plano Inteligente em demonstração natural, não propaganda.'
      ),
      jsonb_build_array('As 5 matérias que decidem a prova de [concurso policial ativo]', 'O que cortar do estudo quando o tempo é curto')),
    (2, 'concurso-policial-nao-acaba-na-objetiva', 'O concurso policial não acaba na objetiva',
      'TAF, psicotécnico e investigação social são matérias do edital, não detalhes burocráticos.',
      jsonb_build_array(
        'Quem deixa as demais etapas para depois pode perder uma vaga já conquistada.',
        'Combate a preparação restrita à prova teórica.',
        'Ocupa um território de alta ansiedade e baixa cobertura por plataformas de estudo.'
      ),
      jsonb_build_array('Passou na objetiva e caiu no TAF — foi você?', 'Como treinar TAF sem perder rendimento no estudo')),
    (3, 'erro-e-dado-nao-fracasso', 'Erro é dado, não fracasso',
      'Acertar o que você já sabe é conforto; o que aprova é atacar o ponto cego.',
      jsonb_build_array(
        'A revisão deve ser guiada por erro medido, não por sensação.',
        'Combate a estagnação de quem revisa apenas o que já domina.',
        'Sustenta conteúdo técnico recorrente com questões, simulados e diagnóstico.'
      ),
      jsonb_build_array('Isso caiu na última prova da [banca] e quase ninguém acertou', 'Revisar o que você já sabe é ego')),
    (4, 'radar-policial-informacao-antes', 'Radar Policial: informação antes de todo mundo',
      'Quem começa antes do edital chega à prova com vantagem estrutural.',
      jsonb_build_array(
        'Autorização, comissão e banca definida já são motivo para agir.',
        'Combate o hábito de esperar a publicação do edital.',
        'Edital, banca e vagas são os conteúdos com maior evidência de save e comentário.'
      ),
      jsonb_build_array('Radar Policial: todos os concursos com edital previsto', 'Banca definida: o que muda na sua preparação')),
    (5, 'gente-comum-passa', 'Gente comum passa',
      'Aprovação policial é método replicável, não talento reservado a poucos.',
      jsonb_build_array(
        'Rotina possível é melhor que rotina heroica.',
        'Combate descrença, comparação com jornadas irreais e solidão.',
        'Histórias reais e rotina geram identificação, compartilhamento e conversa.'
      ),
      jsonb_build_array('A rotina de quem estuda depois de dez horas de trabalho', 'Reprovou? O plano de 7 dias para voltar')),
    (6, 'menos-material-mais-execucao', 'Menos material, mais execução',
      'O problema não é falta de conteúdo; é excesso dele.',
      jsonb_build_array(
        'Escolher material demais consome energia que deveria ir para a aprendizagem.',
        'Combate o acúmulo de PDFs, cursos e planilhas sem progresso.',
        'Posiciona o Rota como consolidador de teoria, questões, revisão e plano.'
      ),
      jsonb_build_array('O que cortar do estudo quando falta um mês', 'Uma fonte por matéria: a revisão mínima viável'))
),
active_campaigns AS (
  SELECT id FROM campaigns WHERE status = 'active' AND name = 'Rota de Ataque'
),
active_counts AS (
  SELECT campaign.id, count(thesis.id) FILTER (WHERE thesis.active)::int AS active_count
  FROM active_campaigns campaign
  LEFT JOIN theses thesis ON thesis.campaign_id = campaign.id
  GROUP BY campaign.id
)
INSERT INTO theses(
  campaign_id,slug,title,description,tenets,forbidden_angles,tone_guidelines,
  example_hooks,version,active,origin,locked_at,locked_by
)
SELECT
  campaign.id, seed.slug, seed.title, seed.description, seed.tenets, '[]'::jsonb,
  'Direto, técnico e adulto; segunda pessoa; frases curtas; autoridade ancorada em dados; reconhecer a dor antes de orientar; sem promessa de aprovação.',
  seed.example_hooks, 1, seed.ordinal <= GREATEST(0, 7 - campaign.active_count),
  'manual', now(), 'growth-organic-baseline-v1'
FROM active_counts campaign
CROSS JOIN thesis_seed seed
ON CONFLICT (campaign_id,slug,version) DO NOTHING;

-- Calendário exemplo de sete dias. Os horários são placeholders operacionais
-- e o status "idea" impede qualquer publicação automática antes da edição/aprovação humana.
WITH calendar_seed(day_offset, title, caption, subtype, format_slug, thesis_slug, pillar, cta) AS (
  VALUES
    (0, 'Radar Policial: concursos com edital previsto', 'Mapa dos concursos policiais com edital ou movimentação prevista.', 'carousel', 'carrosseis', 'radar-policial-informacao-antes', 'radar-policial', 'Salva para consultar quando sair o teu.'),
    (1, 'Questão da banca resolvida em 45 segundos', 'Questão real da banca do edital da vez, resolvida passo a passo.', 'reels', 'reels', 'erro-e-dado-nao-fracasso', 'tecnico-aplicado', 'Comenta se você acertou.'),
    (2, 'A rotina de quem estuda depois de dez horas de trabalho', 'Identificação com a rotina possível de quem concilia trabalho, estudo e treino.', 'reels', 'reels', 'gente-comum-passa', 'identificacao-bastidor', 'Marca quem estuda assim.'),
    (3, 'As 5 matérias que decidem a prova do concurso policial ativo', 'Prioridades de estudo orientadas por banca, incidência e tempo disponível.', 'carousel', 'carrosseis', 'direcao-vence-esforco', 'metodo-rotina', 'Salva e me diz qual é a tua pior.'),
    (4, 'TAF: o erro de execução na barra que zera repetição', 'Correção técnica de uma falha de execução que pode eliminar no TAF.', 'reels', 'reels', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas', 'Comenta TAF para receber o guia.'),
    (5, 'Notícia policial da semana', 'Banca, retificação, vagas ou edital: a notícia e o que ela muda para o candidato.', 'static', 'estatico', 'radar-policial-informacao-antes', 'radar-policial', 'Vai encarar? Comenta o cargo.'),
    (6, 'O que cortar do estudo quando falta um mês', 'Prioridades para reduzir material e aumentar execução na reta final.', 'carousel', 'carrosseis', 'menos-material-mais-execucao', 'metodo-rotina', 'Salva e manda para teu parceiro de estudo.')
),
active_campaigns AS (
  SELECT id FROM campaigns WHERE status = 'active' AND name = 'Rota de Ataque'
),
next_monday AS (
  SELECT CURRENT_DATE + ((8 - EXTRACT(ISODOW FROM CURRENT_DATE)::int) % 7) AS day
)
INSERT INTO scheduled_publications(
  campaign_id,title,caption,scheduled_for,status,channel,subtype,cta,thesis_id,pillar,format,
  timezone,batch_id,origin,locked_at,locked_by,curation_status
)
SELECT
  campaign.id, seed.title, seed.caption,
  ((monday.day + seed.day_offset)::date + time '19:00') AT TIME ZONE 'America/Sao_Paulo',
  'idea', 'instagram', seed.subtype, seed.cta, thesis.id, seed.pillar, seed.format_slug,
  'America/Sao_Paulo', 'c0a62026-0818-4020-8a00-000000000001'::uuid,
  'manual', now(), 'growth-organic-baseline-v1', 'approved'
FROM active_campaigns campaign
CROSS JOIN calendar_seed seed
CROSS JOIN next_monday monday
LEFT JOIN LATERAL (
  SELECT item.id FROM theses item
  WHERE item.campaign_id = campaign.id AND item.slug = seed.thesis_slug
  ORDER BY item.version DESC LIMIT 1
) thesis ON true
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_publications existing
  WHERE existing.campaign_id = campaign.id
    AND existing.batch_id = 'c0a62026-0818-4020-8a00-000000000001'::uuid
    AND existing.title = seed.title
);

-- Os vinte temas prioritários entram como sugestões manuais, ainda sem aprovação.
WITH topic_seed(rank, title, suggested_format, objective, thesis_slug, pillar) AS (
  VALUES
    (1, 'O que a [banca] mais cobra em Legislação Especial', 'carrosseis', 'Save', 'erro-e-dado-nao-fracasso', 'tecnico-aplicado'),
    (2, 'Questão real da banca resolvida em 45 segundos', 'reels', 'Alcance', 'erro-e-dado-nao-fracasso', 'tecnico-aplicado'),
    (3, 'Radar Policial semanal: editais e pré-editais', 'carrosseis', 'Save', 'radar-policial-informacao-antes', 'radar-policial'),
    (4, 'Passou na objetiva e caiu no TAF: os 4 erros', 'reels', 'Comentário', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas'),
    (5, 'Rotina real de quem trabalha 8 horas e estuda 2 horas', 'reels', 'Share', 'gente-comum-passa', 'identificacao-bastidor'),
    (6, 'Comparativo PM x PP x PC x PRF', 'carrosseis', 'Save', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas'),
    (7, 'Base comum dos editais policiais antes do edital', 'carrosseis', 'Save', 'direcao-vence-esforco', 'metodo-rotina'),
    (8, 'Revisar o que você já sabe é ego', 'reels', 'Comentário', 'erro-e-dado-nao-fracasso', 'tecnico-aplicado'),
    (9, 'Direitos Humanos: o recorte que a banca cobra', 'carrosseis', 'Save', 'erro-e-dado-nao-fracasso', 'tecnico-aplicado'),
    (10, 'Plano de 60 dias pós-edital', 'carrosseis', 'Save', 'direcao-vence-esforco', 'metodo-rotina'),
    (11, 'Psicotécnico e investigação social: o que reprova', 'carrosseis', 'Comentário', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas'),
    (12, 'Português: as 5 pegadinhas que derrubam candidato policial', 'carrosseis', 'Save', 'erro-e-dado-nao-fracasso', 'tecnico-aplicado'),
    (13, 'História de aprovado: nota, tempo e a etapa crítica', 'reels', 'Share', 'gente-comum-passa', 'identificacao-bastidor'),
    (14, 'Tatuagem reprova? O que cada corporação aceita', 'carrosseis', 'Save', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas'),
    (15, 'Investigação social: o que reprova e o que é lenda', 'carrosseis', 'Comentário', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas'),
    (16, 'Como treinar TAF sem perder rendimento no estudo', 'reels', 'Save', 'concurso-policial-nao-acaba-na-objetiva', 'taf-etapas'),
    (17, 'Erros de cronograma: uma matéria por dia atrapalha', 'reels', 'Comentário', 'direcao-vence-esforco', 'metodo-rotina'),
    (18, 'Banca definida: o que muda na preparação', 'estatico', 'Comentário', 'radar-policial-informacao-antes', 'radar-policial'),
    (19, 'Sua vida está em pausa enquanto o mundo gira', 'reels', 'Share', 'gente-comum-passa', 'identificacao-bastidor'),
    (20, 'Reprovou? O plano de 7 dias para voltar', 'reels', 'Share', 'gente-comum-passa', 'identificacao-bastidor')
),
active_campaigns AS (
  SELECT id FROM campaigns WHERE status = 'active' AND name = 'Rota de Ataque'
)
INSERT INTO content_suggestions(
  source_type,title,description,suggested_format,suggested_channel,thesis_id,pillar,
  evidence,editorial_rules_validated,curation_status,campaign_id
)
SELECT
  'manual', seed.title, 'Tema prioritário do manual de crescimento orgânico. Objetivo: ' || seed.objective,
  seed.suggested_format, 'instagram', thesis.id, seed.pillar,
  jsonb_build_object('seed','growth-organic-baseline-v1','source','CRESCIMENTO-ORGANICO-ROTA-DE-ATAQUE.md','rank',seed.rank,'objective',seed.objective),
  true, 'proposed', campaign.id
FROM active_campaigns campaign
CROSS JOIN topic_seed seed
LEFT JOIN LATERAL (
  SELECT item.id FROM theses item
  WHERE item.campaign_id = campaign.id AND item.slug = seed.thesis_slug
  ORDER BY item.version DESC LIMIT 1
) thesis ON true
WHERE NOT EXISTS (
  SELECT 1 FROM content_suggestions existing
  WHERE existing.campaign_id = campaign.id
    AND existing.evidence->>'seed' = 'growth-organic-baseline-v1'
    AND (existing.evidence->>'rank')::int = seed.rank
);
