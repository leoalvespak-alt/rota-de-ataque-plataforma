# RAG e embeddings

Documentos são normalizados, divididos preservando parágrafos e headings e gravados como chunks. `OpenAIEmbeddingProvider` implementa a interface de embeddings; a coluna pgvector recebe vetores de 1536 dimensões. A busca começa por filtros e texto e pode ser enriquecida por similaridade vetorial quando houver provider configurado.
