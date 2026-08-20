-- Etapa 3 — Seed idempotente da doutrina editorial
-- Fonte: CRESCIMENTO-ORGANICO-ROTA-DE-ATAQUE.md

-- 3.3 Pilares de conteúdo (5)
INSERT INTO content_pillars (name, slug, weekly_weight, primary_objective, description, origin, locked_at, locked_by) VALUES
  ('Radar Policial', 'radar-policial', 0.30, 'Comentário + save', 'Edital, banca, vagas — notícias de concurso policial', 'manual', now(), 'doctrine-seed'),
  ('Conteúdo técnico aplicado', 'tecnico-aplicado', 0.25, 'Save', 'Questão comentada, lei seca, pegadinha de banca', 'manual', now(), 'doctrine-seed'),
  ('Método e rotina', 'metodo-rotina', 0.20, 'Save + share', 'Plano, revisão, o que cortar', 'manual', now(), 'doctrine-seed'),
  ('Identificação e bastidor', 'identificacao-bastidor', 0.15, 'Alcance + share', 'Humor, dor da rotina, solidão, reprovação', 'manual', now(), 'doctrine-seed'),
  ('TAF e etapas não-teóricas', 'taf-etapas', 0.10, 'Save + comentário', 'Físico, psicotécnico, investigação social', 'manual', now(), 'doctrine-seed')
ON CONFLICT (slug) DO NOTHING;

-- 3.3 Formatos com frequência alvo (5)
INSERT INTO format_playbook (format_name, slug, function_description, structure, frequency_min, frequency_max, frequency_unit, primary_objective, channel, origin, locked_at) VALUES
  ('Reels', 'reels', 'Alcance novo e captação de seguidor', 'Hook falado nos primeiros 2s antes de vinheta → tensão → entrega em 3 blocos → CTA de comentário com palavra-chave. 20-50s. Legenda queimada, corte a cada 3-4s, sem introdução.', 3, 4, 'week', 'Alcance e crescimento', 'instagram', 'manual', now()),
  ('Carrosséis', 'carrosseis', 'Save e autoridade técnica', 'Capa com promessa numérica e concurso nomeado → slide 2 com o problema → 4 a 7 slides de entrega, 1 ideia por slide → penúltimo slide de resumo → último com CTA de save + comentário.', 2, 3, 'week', 'Save e compartilhamento', 'instagram', 'manual', now()),
  ('Post estático', 'estatico', 'Notícia rápida e frase de posicionamento', 'Manchete legível em 1 segundo no feed + 1 linha de contexto na arte; legenda com o "e daí" para o candidato + CTA de comentário.', 1, 2, 'week', 'Comentário e alcance', 'instagram', 'manual', now()),
  ('Stories', 'stories', 'Relacionamento, pauta e conversão', '3-5 telas/dia, ao menos 1 com sticker interativo; conversão só na 3ª tela em diante.', 5, 7, 'week', 'Comentário/DM e clique', 'stories', 'manual', now()),
  ('Threads', 'threads', 'Reaproveitamento e conversa aberta', 'Texto puro, 1 ideia por post, tom de conversa, sem hashtag, sem link no primeiro post.', 7, 14, 'week', 'Comentário e descoberta', 'threads', 'manual', now())
ON CONFLICT (slug) DO NOTHING;

-- 3.4 Regras editoriais — tom de voz e interdições
INSERT INTO editorial_rules (rule_type, scope, rule_text, justification, severity, origin, locked_at) VALUES
  -- Tom de voz (do)
  ('do', 'global', 'Tom direto, técnico e adulto — instrutor que já esteve do outro lado, não marca', 'Posicionamento de autoridade com proximidade', 'warning', 'manual', now()),
  ('do', 'global', 'Formalidade média-baixa: segunda pessoa (você), frases curtas, sem juridiquês desnecessário', 'Linguagem do público-alvo', 'warning', 'manual', now()),
  ('do', 'global', 'Autoridade ancorada em dado (peso da banca, incidência, estatística de erro), nunca em adjetivo', 'Diferencial do Rota é o dado', 'warning', 'manual', now()),
  ('do', 'global', 'Proximidade alta: reconhecer cansaço, reprovação e medo antes de dar solução', 'Empatia gera compartilhamento', 'warning', 'manual', now()),
  ('do', 'global', 'Usar vocabulário do público: farda, Diário Oficial, TAF, banca, lei seca, ciclo, edital verticalizado, cadastro de reserva', 'Linguagem real coletada de comentários', 'warning', 'manual', now()),
  ('do', 'global', 'CTA obrigatório em 100% dos posts — comentário com palavra-chave, save ou marcação', '0 comentários em 16 posts porque nunca pediu; todos os outliers têm CTA', 'block', 'manual', now()),
  -- Interdições (dont)
  ('dont', 'global', 'Estética militarista agressiva e armamento', 'Posicionamento de estudo, não de corporação', 'block', 'manual', now()),
  ('dont', 'global', 'Qualquer conteúdo político ou de segurança pública opinativa', 'Risco de polarização sem retorno', 'block', 'manual', now()),
  ('dont', 'global', 'Promessa de tempo de aprovação (ex: aprovado em 6 meses)', 'Sem evidência e expõe legalmente', 'block', 'manual', now()),
  ('dont', 'global', 'Post de release de feature como conteúdo principal', 'Piso medido: 46-49 de alcance nos posts de feature', 'block', 'manual', now()),
  ('dont', 'global', 'Emojis em excesso', 'Prejudica leitura e posicionamento técnico', 'warning', 'manual', now()),
  ('dont', 'global', '"Link na bio" como única razão do post', 'Sem valor para quem não vai clicar', 'warning', 'manual', now()),
  ('dont', 'global', 'Imagem estática institucional como formato dominante', 'Nenhum outlier do nicho é imagem estática de produto', 'warning', 'manual', now()),
  ('dont', 'global', 'Legenda longa sem CTA', 'Padrão dos 16 posts com 0 comentários', 'warning', 'manual', now()),
  ('dont', 'global', 'Falar "plataforma", "recursos", "ferramentas" antes de falar do problema do candidato', 'O problema vem primeiro, o produto é consequência', 'warning', 'manual', now()),
  ('dont', 'global', 'Linguagem de "fórmula/segredo"', 'Contradiz o posicionamento técnico baseado em dado', 'warning', 'manual', now()),
  ('dont', 'global', 'Humor sobre a instituição, a farda, a prova ou o candidato', 'Humor permitido só sobre a rotina, no pilar de identificação', 'block', 'manual', now()),
  ('dont', 'global', 'Provocação contra pessoas ou concorrentes', 'Provocação permitida contra hábitos, nunca contra pessoas', 'block', 'manual', now())
ON CONFLICT DO NOTHING;

-- 3.5 Metadados usados pelo seed de concorrentes e pelo worker de inteligência.
-- A tabela legada só possuía username_candidate/evidence; ampliar antes do seed
-- mantém instalações antigas e novas com o mesmo contrato.
ALTER TABLE candidate_sources
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS display_name text;

-- 3.5 Seed dos 20 concorrentes
INSERT INTO candidate_sources (id, platform, handle, display_name, discovered_via, origin, locked_at, locked_by, status)
VALUES
  (gen_random_uuid(), 'instagram', 'pmminas', 'Método OBA / PM Minas', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'institutorodolfosouza', 'Instituto Rodolfo Souza', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'pgconcursospoliciais', 'PG Concursos Policiais', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'pontojuriscp', 'PontoJuris CP', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'oficialmilitar', 'Oficial Militar', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'enfimpolicial', 'Enfim Policial', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'gemeosconcurseiros.40', 'Gêmeos Concurseiros', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'paiva.alvopolicial', 'Paiva Alvo Policial', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'odistintivoenosso', 'O Distintivo É Nosso', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'profjonathanrocha', 'Prof Jonathan Rocha', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'abreumentoria', 'Abreu Mentoria', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'rota01carreiraspoliciais', 'Rota 01 Carreiras Policiais', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'bizucaveira', 'Bizucaveira', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'mdm.carreiraspoliciais', 'MDM Carreiras Policiais', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'tiktok', 'aprendaagora100', 'Aprenda Agora', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'tiktok', 'fernandosdadalto', 'Fernando Sdadalto', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'tiktok', 'aprovadoemconcurso01', 'Aprovado em Concurso', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'braboconcursos', 'Brabo Concursos', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'concurseiracomtdah', 'Concurseira com TDAH', 'manual', 'manual', now(), 'doctrine-seed', 'active'),
  (gen_random_uuid(), 'instagram', 'gurujaconcursos', 'Gurujá Concursos', 'manual', 'manual', now(), 'doctrine-seed', 'active')
ON CONFLICT DO NOTHING;

-- 3.6 Vocabulário do público (expressões coletadas de comentários)
INSERT INTO audience_vocabulary (term, context, evidence_source, category, origin, locked_at) VALUES
  ('bora pro TAF', 'Motivação para treino físico', 'Comentários TikTok', 'jargon', 'manual', now()),
  ('só não passa quem desiste', 'Frase de resiliência recorrente', 'Comentários Instagram', 'desire', 'manual', now()),
  ('fiquei apenas em português', 'Reprovar em uma matéria específica', 'Comentários Instagram', 'pain', 'manual', now()),
  ('ficou por 1 ponto', 'Frustração de margem mínima', 'Comentários Instagram', 'pain', 'manual', now()),
  ('ANULA A 30', 'Mobilização espontânea por recurso', 'Comentários Instagram', 'jargon', 'manual', now()),
  ('tem dicas para a prova da polícia penal do ES?', 'Pedido de pauta explícito', 'Comentários Instagram', 'question', 'manual', now()),
  ('faz sobre legislação especial e português pf', 'Pedido de conteúdo técnico', 'Comentários Instagram', 'question', 'manual', now()),
  ('a jornada do concurseiro é solitária', 'Dor emocional recorrente', 'Comentários Instagram e Reddit', 'pain', 'manual', now()),
  ('fui muito desacreditado', 'Falta de apoio do entorno', 'Comentários Instagram', 'pain', 'manual', now()),
  ('Ninguém te prepara para a pior parte de estudar: a solidão', 'Topo de threads no r/concursospublicos', 'Reddit via Bright Data', 'pain', 'manual', now()),
  ('Estudar para concurso é depressivo', 'Título de thread popular no Reddit', 'Reddit via Bright Data', 'pain', 'manual', now()),
  ('fechem as redes sociais de vocês', 'Aviso sobre investigação social', 'Reddit via Bright Data', 'jargon', 'manual', now()),
  ('tatuagem no pescoço reprova PM?', 'Dúvida factual recorrente sobre etapa', 'Reddit via Bright Data', 'question', 'manual', now()),
  ('tem TAF na Polícia Civil de SP?', 'Desinformação factual viral (não tem desde 2018)', 'Reddit via Bright Data', 'question', 'manual', now()),
  ('Não usem a PM como concurso de escada', 'Arrependimento de escolha de carreira', 'Reddit via Bright Data', 'pain', 'manual', now()),
  ('farda', 'Vocabulário emocional dominante — símbolo de aprovação', 'Comentários gerais', 'desire', 'manual', now()),
  ('Diário Oficial', 'Momento de realização da aprovação', 'Comentários gerais', 'desire', 'manual', now()),
  ('não tenho tempo', 'Objeção principal do público', 'Comentários gerais', 'objection', 'manual', now()),
  ('não tenho dinheiro pra curso', 'Barreira econômica', 'Comentários gerais', 'objection', 'manual', now()),
  ('já tentei e reprovei', 'Descrença após fracasso', 'Comentários gerais', 'objection', 'manual', now()),
  ('isso não cai no meu edital', 'Resistência a conteúdo genérico', 'Comentários gerais', 'objection', 'manual', now()),
  ('mais uma plataforma igual às outras', 'Objeção de diferenciação', 'Comentários gerais', 'objection', 'manual', now()),
  ('Comente PRF para receber', 'CTA que gerou 14,7x mediana', 'Instagram @institutorodolfosouza', 'cta', 'manual', now()),
  ('Manda para os polícias que você conhece', 'Share-bait puro — 42x mediana', 'Instagram @pgconcursospoliciais', 'cta', 'manual', now()),
  ('já salve esse post', 'CTA de save padrão do nicho', 'Múltiplos perfis', 'cta', 'manual', now()),
  ('Comenta PM26', 'Comment-bait com palavra-chave do concurso', 'TikTok — múltiplos criadores', 'cta', 'manual', now()),
  ('Salva pra consultar quando sair o teu', 'CTA de save para radar de editais', 'Benchmarks do nicho', 'cta', 'manual', now())
ON CONFLICT DO NOTHING;

-- 3.6 Hooks validados com resultado medido
INSERT INTO validated_hooks (hook_text, source_profile, source_platform, result_metric, result_value, result_multiplier, format, origin, locked_at) VALUES
  ('Alguém com esse problema também?', '@oficialmilitar', 'instagram', 'comentários', 'acima da mediana', NULL, 'reels', 'manual', now()),
  ('Vai fazer [concurso]? Então presta atenção', 'Nicho policial geral', 'instagram', 'views', 'hook padrão', NULL, 'reels', 'manual', now()),
  ('Isso caiu na última prova da [banca] e quase ninguém acertou', 'Nicho policial geral', 'tiktok', 'saves', 'alto save rate', NULL, 'reels', 'manual', now()),
  ('Passou na objetiva e caiu no TAF — foi você?', 'Nicho policial geral', 'instagram', 'comentários', 'alta interação', NULL, 'reels', 'manual', now()),
  ('Vida de concurseiro não é fácil', '@gemeosconcurseiros.40', 'instagram', 'views', '756.886 views', 16.0, 'reels', 'manual', now()),
  ('Comente PRF para receber o material', '@institutorodolfosouza', 'instagram', 'curtidas', '14,7x mediana', 14.7, 'feed', 'manual', now()),
  ('Manda para os polícias que você conhece', '@pgconcursospoliciais', 'instagram', 'curtidas', '42x mediana', 42.0, 'feed', 'manual', now()),
  ('Salve este post', '@braboconcursos', 'instagram', 'curtidas', '6.106 curtidas vs 150 mediana', 40.0, 'carrossel', 'manual', now()),
  ('Concorda com o post?', '@braboconcursos', 'instagram', 'comentários', '50 comentários', NULL, 'carrossel', 'manual', now()),
  ('Sua vida está em pausa enquanto o mundo gira', 'r/concursospublicos', 'reddit', 'upvotes', 'topo do subreddit', NULL, 'reels', 'manual', now())
ON CONFLICT DO NOTHING;

-- Seed das fontes de notícias (Etapa 4, Passo 4.1)
INSERT INTO news_sources (name, url, feed_url, source_type, portal, active) VALUES
  ('PCI Concursos', 'https://www.pciconcursos.com.br', 'https://www.pciconcursos.com.br/rss/', 'rss', 'PCI Concursos', true),
  ('Folha Dirigida', 'https://www.folhadirigida.com.br', 'https://www.folhadirigida.com.br/feed', 'rss', 'Folha Dirigida', true),
  ('JC Concursos', 'https://jcconcursos.com.br', 'https://jcconcursos.com.br/rss', 'rss', 'JC Concursos', true),
  ('Gran Cursos Online', 'https://blog.grancursosonline.com.br', 'https://blog.grancursosonline.com.br/feed/', 'rss', 'Gran Cursos', true),
  ('Direção Concursos', 'https://www.direcaoconcursos.com.br/noticias', 'https://www.direcaoconcursos.com.br/noticias/feed/', 'rss', 'Direção Concursos', true),
  ('Qconcursos', 'https://www.qconcursos.com/noticias', NULL, 'scrape', 'Qconcursos', true),
  ('DOU - Imprensa Nacional', 'https://www.in.gov.br/consulta', 'https://www.in.gov.br/rss/dou-secao-2', 'api', 'DOU', true)
ON CONFLICT (url) DO NOTHING;

-- Seed de worker_settings com todos os workers existentes + novos
INSERT INTO worker_settings (worker_name, enabled, domain) VALUES
  -- Radar (novos)
  ('news-radar', false, 'radar'),
  -- Inteligência
  ('competitive-intel', false, 'intelligence'),
  ('discovery', false, 'intelligence'),
  ('search-mining', false, 'intelligence'),
  ('reddit-intelligence', false, 'intelligence'),
  ('audience-overlap', false, 'intelligence'),
  ('community-map', false, 'intelligence'),
  ('follower-mining', false, 'intelligence'),
  ('mention-monitor', false, 'intelligence'),
  ('live-monitor', false, 'intelligence'),
  ('source-roi', false, 'intelligence'),
  -- Publicação
  ('publisher', false, 'publishing'),
  ('threads-publisher', false, 'publishing'),
  ('threads-adapter', false, 'publishing'),
  ('content-item-orchestrator', false, 'publishing'),
  ('content-opportunity', false, 'publishing'),
  -- Mensageria
  ('conversation-agent', false, 'messaging'),
  ('dm-copilot', false, 'messaging'),
  ('private-reply', false, 'messaging'),
  ('whatsapp-inbound', false, 'messaging'),
  ('whatsapp-outbound', false, 'messaging'),
  ('email-flow-engine', false, 'messaging'),
  ('email-events-consumer', false, 'messaging'),
  -- Manutenção
  ('adaptive-crawler', false, 'maintenance'),
  ('alerts', false, 'maintenance'),
  ('classification', false, 'maintenance'),
  ('collab-discovery', false, 'maintenance'),
  ('contact-policy-engine', false, 'maintenance'),
  ('conversion-tracking', false, 'maintenance'),
  ('data-quality', false, 'maintenance'),
  ('engagement', false, 'maintenance'),
  ('enrichment', false, 'maintenance'),
  ('extraction', false, 'maintenance'),
  ('identity-resolver', false, 'maintenance'),
  ('meta-sync', false, 'maintenance'),
  ('meta-webhook-consumer', false, 'maintenance'),
  ('nba-engine', false, 'maintenance'),
  ('next-best-channel', false, 'maintenance'),
  ('reciprocity-detector', false, 'maintenance'),
  ('retention-tracker', false, 'maintenance'),
  ('scoring', false, 'maintenance')
ON CONFLICT (worker_name) DO NOTHING;
