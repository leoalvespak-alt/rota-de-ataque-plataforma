-- Fase 15: armazenamento vetorial do RAG documental no PostgreSQL.
-- A tabela knowledge_embeddings (1536d) e o FAISS de questões permanecem intactos.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  model_name varchar(255) NOT NULL,
  model_version varchar(255) NOT NULL,
  embedding vector(768) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rag_embeddings_chunk_model_unique UNIQUE (chunk_id, model_name, model_version)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_embeddings_embedding_hnsw
  ON rag_embeddings USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_embeddings_metadata_gin
  ON rag_embeddings USING gin (metadata);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_embeddings_chunk_idx
  ON rag_embeddings (chunk_id);
