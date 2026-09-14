import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const CHUNK_SIZE = 1_000;
const CHUNK_OVERLAP = 150;
const MAX_CONTENT_LENGTH = 300_000;

/** Splits text into overlapping character-based chunks for embedding + retrieval. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export interface IngestDocumentParams {
  organizationId: string;
  agentId: string;
  title: string;
  sourceUrl?: string;
  content: string;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
}

/**
 * Chunks the document, embeds every chunk (OpenAI text-embedding-3-small,
 * matching the 1536-dim column in packages/db/migrations/0004_rag.sql), and
 * stores both the document and its chunks scoped to the given agent.
 */
export async function ingestDocument(
  db: SupabaseClient,
  openaiApiKey: string,
  params: IngestDocumentParams,
): Promise<IngestResult> {
  if (params.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Document too large (${params.content.length} chars, max ${MAX_CONTENT_LENGTH}). Split it into multiple documents.`,
    );
  }

  const chunks = chunkText(params.content);
  if (chunks.length === 0) {
    throw new Error("Document has no extractable text content");
  }

  const { data: document, error: documentError } = await db
    .from("agent_documents")
    .insert({
      agent_id: params.agentId,
      organization_id: params.organizationId,
      title: params.title,
      source_url: params.sourceUrl ?? null,
    })
    .select("id")
    .single();
  if (documentError) throw new Error(`Failed to create document: ${documentError.message}`);

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  const rows = chunks.map((content, i) => ({
    document_id: document.id as string,
    agent_id: params.agentId,
    organization_id: params.organizationId,
    content,
    embedding: embeddingResponse.data[i]!.embedding,
  }));

  const { error: chunksError } = await db.from("agent_document_chunks").insert(rows);
  if (chunksError) {
    // Roll back the orphaned document row rather than leaving a
    // document with zero chunks (would surface with no retrievable content).
    await db.from("agent_documents").delete().eq("id", document.id);
    throw new Error(`Failed to store document chunks: ${chunksError.message}`);
  }

  return { documentId: document.id as string, chunkCount: rows.length };
}
