-- 003_pgvector.sql - Semantic Memory & Permission-Aware Vector Storage

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS community_embeddings (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  required_role_id TEXT DEFAULT 'everyone',
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-004',
  embedding_dimension INT NOT NULL DEFAULT 768,
  embedding vector(768) NOT NULL,
  content_snippet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security for Vector Store
ALTER TABLE community_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY embeddings_tenant_isolation ON community_embeddings
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- HNSW Vector Index for approximate nearest neighbor similarity searches
CREATE INDEX IF NOT EXISTS community_embeddings_hnsw_idx 
  ON community_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
