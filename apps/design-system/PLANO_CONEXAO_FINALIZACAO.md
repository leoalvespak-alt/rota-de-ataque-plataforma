# Plano de conexão e finalização dos 22 recursos

Este documento transforma a fundação já existente em recursos utilizáveis na interface, sem alterar o comportamento do editor com as flags desativadas. Cada etapa só avança após lint, TypeScript estrito, testes e validação visual pertinente.

## Etapa 1 — Sessão, projetos e recuperação

1. Expor projeto, campanha e arte atuais na interface e permitir nomear, criar, abrir e trocar documentos.
2. Conectar editor, decoração e série aos adaptadores de documento em ambas as direções.
3. Concluir autosave: indicador de estado, debounce, flush, snapshot, erro de quota e recuperação/comparação/descarte.
4. Criar testes de integração IndexedDB para criação, migração, interrupção e restauração.

**Aceite:** fechar/reabrir preserva a arte; nenhuma chave de IA entra em snapshot; erro de persistência é visível.

## Etapa 2 — Mutação segura, templates, layouts e qualidade

1. Conectar `MutationService` a um diálogo comum com escopo, preview, confirmação e undo.
2. Completar metadados explícitos dos 26 templates: schema, capabilities, variantes, equivalências, qualidade e layouts.
3. Expor variantes aprovadas, estilos semânticos e layouts inteligentes no painel de edição.
4. Conectar regras condicionais e trava de marca na edição, importação, IA e exportação.
5. Finalizar validador DOM-aware, incluindo overflow e resolução de imagem, com navegação até o campo.

**Aceite:** nenhuma operação em massa modifica o documento sem preview/undo; exportação bloqueia apenas erros configurados.

## Etapa 3 — Campanhas, biblioteca e dados

1. Criar telas para campanhas, presets, componentes vinculados e duplicação com conteúdo alternativo.
2. Unificar biblioteca de renders, fundos, texturas e assets; criar metadata, hash, tags, filtros e arquivamento seguro.
3. Criar central de dados reutilizáveis, bindings, freeze, impacto e histórico.
4. Implementar diálogos de propagação por card/carrossel/campanha via `MutationService`.

**Aceite:** presets, componentes e dados mostram impacto antes da sincronização e respeitam overrides.

## Etapa 4 — Central de comandos e atalhos

1. Migrar atalhos existentes de `AppShell` para `CommandRegistry`.
2. Criar command palette acessível com busca, atalhos customizáveis e detecção de conflitos.
3. Registrar templates, assets, formatos, presets e exportações como destinos pesquisáveis.

**Aceite:** todos os atalhos atuais continuam funcionando; atalhos não disparam em inputs/modais.

## Etapa 5 — Lote e multiformato

1. Instalar e isolar parsing XLSX em worker, preservando CSV seguro.
2. Construir interface de importação: escolha de planilha, headers, mapeamento, validação, preview, progresso e retomada.
3. Conectar conversão multiformato às equivalências aprovadas, preview e validação.

**Aceite:** arquivos grandes não bloqueiam a UI e conversões nunca usam posicionamento livre.

## Etapa 6 — IA, variações e pacotes

1. Criar wizard de criação e assistente de carrossel com respostas estruturadas revisáveis.
2. Conectar variações em branches, comparação e promoção seletiva.
3. Criar planejador de pacotes de campanha e regeneração isolada.

**Aceite:** IA só produz propostas válidas; cancelamento ou erro não modifica a arte atual.

## Etapa 7 — Revisão, planejamento e exportação

1. Criar fluxo de revisão, comentários, responsáveis, transições e bloqueio pós-aprovação.
2. Adicionar aba Planejamento com calendário/lista, filtros e navegação de retorno ao editor.
3. Conectar perfis, nomes, manifesto, checksums e fila de exportação client-side.

**Aceite:** comentários ficam na revisão correta; jobs são retomáveis; exportação padrão não muda.

## Etapa 8 — Auditoria final e rollout

1. Criar matriz de aceite das 22 implementações em `AUDITORIA_22_RECURSOS.md`.
2. Executar unitários, integração IndexedDB, E2E, baseline visual light/dark, acessibilidade e responsividade.
3. Testar offline, quota, cancelamento, migrações interrompidas, upload e CSV/XLSX malformados.
4. Corrigir achados impeditivos, registrar riscos residuais e liberar flags gradualmente.

**Aceite final:** build, lint, testes, E2E e baseline visual aprovados; toda linha da auditoria tem evidência e nenhum erro impeditivo aberto.
