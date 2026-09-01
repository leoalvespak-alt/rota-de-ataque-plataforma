# Embeddings documentais

O RAG documental usa `PgVectorStore` em `rota_design`, com embeddings de 768 dimensões, metadata filtrável e índice HNSW. A ingestão é idempotente por chunk, modelo e versão.

Não altere a dimensão sem migration explícita. O FAISS grande de questões permanece separado e não deve ser reprocessado ou copiado para o PostgreSQL.
