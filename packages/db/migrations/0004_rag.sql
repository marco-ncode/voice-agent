-- RAG knowledge base, scoped per agent.
-- Embedding dimension defaults to 1536 (OpenAI text-embedding-3-small).
-- If multiple embedding models/dimensions are needed later, split into
-- per-dimension tables or move to a provider-agnostic vector store.

create table agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  source_url text,
  created_at timestamptz not null default now()
);

create index agent_documents_agent_id_idx on agent_documents (agent_id);

create table agent_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references agent_documents (id) on delete cascade,
  agent_id uuid not null references agents (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index agent_document_chunks_agent_id_idx on agent_document_chunks (agent_id);
create index agent_document_chunks_embedding_idx on agent_document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Similarity search scoped to a single agent (and therefore its organization).
create or replace function match_agent_document_chunks(
  p_agent_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from agent_document_chunks c
  where c.agent_id = p_agent_id
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;
