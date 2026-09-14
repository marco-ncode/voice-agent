import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RagMatch {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Embeds the query and retrieves the top matching chunks for a single
 * agent via the match_agent_document_chunks RPC (see packages/db/migrations/0004_rag.sql).
 * Embeddings use OpenAI text-embedding-3-small (1536 dims) regardless of
 * which LLM/STT/TTS providers the agent is configured with.
 */
export class RagService {
  private readonly openai: OpenAI;

  constructor(
    private readonly db: SupabaseClient,
    openaiApiKey: string,
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  async query(agentId: string, text: string, matchCount = 5): Promise<RagMatch[]> {
    const embeddingResponse = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const queryEmbedding = embeddingResponse.data[0]?.embedding;
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
