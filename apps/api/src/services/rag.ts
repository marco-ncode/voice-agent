import type { SupabaseClient } from "@supabase/supabase-js";
import { LocalEmbeddingProvider, type LocalInferenceConfig } from "@v-agent/providers";

export interface RagMatch {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Embeds the query and retrieves the top matching chunks for a single
 * agent via the match_agent_document_chunks RPC (see
 * packages/db/migrations/0004_rag.sql). Embeddings use EmbeddingGemma
 * (768 dims, local GPU inference) for both indexing and querying.
 */
export class RagService {
  private readonly embeddings: LocalEmbeddingProvider;

  constructor(
    private readonly db: SupabaseClient,
    inferenceConfig: LocalInferenceConfig,
  ) {
    this.embeddings = new LocalEmbeddingProvider(inferenceConfig);
  }

  async query(agentId: string, text: string, matchCount = 5): Promise<RagMatch[]> {
    const [queryEmbedding] = await this.embeddings.embed([text], "query");
    if (!queryEmbedding) return [];

    const { data, error } = await this.db.rpc("match_agent_document_chunks", {
      p_agent_id: agentId,
      p_query_embedding: queryEmbedding,
      p_match_count: matchCount,
    });
    if (error) throw new Error(`RAG query failed: ${error.message}`);

    return (
      data as Array<{
        id: string;
        document_id: string;
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
      }>
    ).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
    }));
  }
}
