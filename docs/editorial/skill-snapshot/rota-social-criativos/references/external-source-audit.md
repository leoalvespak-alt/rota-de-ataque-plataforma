# Registro da evolução da skill (23/09/2026)

Registro de pesquisa, **não** dependência de execução. Os repositórios foram consultados em clones temporários `--depth 1`. Nenhum foi instalado na pasta da skill; as regras finais estão nos outros arquivos deste diretório e as decisões da Rota prevalecem.

Revisões consultadas: Taste `a6153b3`; Marketing Skills `5b2c000`; Frontend Slides `9906a34`; Social Media Skills `6e30eeb`; Threads Carousel `cc775b6`.

| Projeto e arquivos consultados | Conceitos adaptados | Destino |
|---|---|---|
| `Leonxlnx/taste-skill`: `skills/taste-skill/SKILL.md`, `skills/gpt-tasteskill/SKILL.md` | Inferir direção do briefing; variância/densidade como controles contextuais; auditoria anti-slop e preflight; preservar identidade em redesign. | `visual-direction.md`, `production-qa.md`. |
| `coreyhaines31/marketingskills`: `skills/social/SKILL.md`, `skills/social/references/carousel-frameworks.md`, `skills/ad-creative/SKILL.md`, `skills/ad-creative/references/static-ad-templates.md`, `skills/ad-creative/references/hook-system.md` | Ângulo por motivação e prova; arquiteturas Value-Stack, Problem-Proof, Hack/List, Rant/Callout, Demo; tratamentos seletivos de estáticos; diferença entre variação de ângulo e sinônimo. | `narrative-frameworks.md`, `angles-and-copy.md`. |
| `zarazhangrui/frontend-slides`: `SKILL.md`, `STYLE_PRESETS.md`, `bold-template-pack/README.md`, `bold-template-pack/templates/bold-poster/preview.md`, `bold-template-pack/templates/bold-poster/design.md` | Descoberta visual por três prévias/composições; progressive disclosure; comparar imagem real renderizada; densidade conforme conteúdo. | `SKILL.md`, `visual-direction.md`, `html-css-system.md`. |
| `social-media-skills/skills`: `skills/brand-profile/SKILL.md`, `skills/voice-builder/SKILL.md`, `skills/hook-writer/SKILL.md`, `skills/hook-writer/references/scoring.md`, `skills/carousel-writer/SKILL.md`, `skills/carousel-writer/references/architecture.md`, `skills/carousel-writer/references/slide-craft.md`, `skills/story-writer/SKILL.md`, `skills/story-writer/references/the-frame-framework.md` | Hook nascido do conteúdo; promessa paga; marca/voz com evidência; capa isolada, um beat por card, sequência de Stories com uma ação. | `angles-and-copy.md`, `narrative-frameworks.md`, `formats.md`. |
| `itchernetski/threads-carousel-claude-skill`: `SKILL.md`, `template/src/lib/types.ts`, `template/src/lib/presets.ts`, `template/src/slides.ts`, `template/src/app/CarouselApp.tsx`, `template/src/app/globals.css` | Arquétipos de informação; conteúdo separado do motor; tipografia adaptada ao texto, `text-wrap: balance`; preview/export no mesmo canvas. | `html-css-system.md`, `formats.md`. |

## Referência visual de 24/09/2026

O usuário forneceu capturas do perfil concorrente `@gurujacursos` na pasta local `C:\Users\Lenovo\Downloads\Telegram Desktop\arquivo (1)`. A análise identificou princípios de composição: cenas de fundo em tela cheia, imagens escuras com texto de alto contraste, recortes ilustrados sem fundo que avançam entre cards e destaque tipográfico localizado. A skill registra esses princípios em `style-orchestration.md`; não copia nome, marca, layout, texto, personagem, captura ou arquivo visual do concorrente. O acervo do concorrente não é dependência da skill.

## Deliberadamente não importado

- Regras de frontend web, GSAP, motion e layout responsivo de site: o produto final aqui é PNG estático (`MOTION_INTENSITY = 0`).
- Randomização de fonte/layout, paletas prontas, presets rígidos, gradientes/glow default: poderiam apagar a identidade da Rota ou repetir estética genérica.
- Next.js/React, Tailwind, Bun e o motor de exportação do Threads Carousel: dependências desnecessárias para HTML/CSS simples editável.
- “Mesmo template em todos os slides” literal: preservamos sistema de marca e grade, mas variamos composição e enquadramento conforme cada prova.
- Depoimentos, estatísticas, resultados, imprensa e comparações de templates externos sem fonte: a regra factual da Rota é mais rígida.
- Legendas, hashtags, calendário, scheduling, publicação, Reels, vídeo/UGC e imagem gerada como arte principal: fora do escopo padrão pedido pelo usuário.

## Refinamento de estratégia e copy (23/09/2026)

Consulta local orientada pelo `PLANO_MELHORIACOPY.md`. Os arquivos abaixo foram consultados por conceitos relevantes, sem transcrever capítulos; a skill não precisa deles para operar.

| Arquivo local consultado em `Livros RAG - Copy e Persuasão` | Conceito adaptado | Destino |
|---|---|---|
| `Great Leads Ebook PDF.md` | Consciência aproximada, Regra do Um, abertura direta/indireta. | `audience-and-message.md`, `angles-and-copy.md`, `narrative-frameworks.md`. |
| `Copywriting Secrets - Jim Edwards - Português PDF Dinheiro Pensamento.md` | PQR² e benefício além da funcionalidade. | `audience-and-message.md`, `angles-and-copy.md`. |
| `Cómo Construir Una StoryBrand (Donald Miller) PDF PDF Marketing Apple Inc.md` | Aluno como protagonista, marca como guia, plano e próxima ação. | `narrative-frameworks.md`. |
| `Psicologia da Persuasão de Cialdini PDF Psicologia Tempo.md` | Princípios de influência apenas como diagnóstico de evidência real. | `rota-brand-and-evidence.md`. |
| `Conversas Cruciais - Joseph Grenny (Traduzido) PDF Emoções Vida (1).md` | Problema certo, fato versus interpretação e objeção sem ataque. | `audience-and-message.md`, `rota-brand-and-evidence.md`. |
| `base_de_conhecimento_rag.json` | Metadados e ordem das obras como apoio de proveniência; conceitos conferidos nos materiais correspondentes. | Registro de proveniência; não é dependência da skill. |

Não foram importados formatos de carta de vendas longa, gatilhos como checklist, urgência fictícia, “segredos”, promessa de aprovação, linguagem de guru nem obrigação de aplicar StoryBrand em toda peça. A prova e a marca Rota têm precedência.
