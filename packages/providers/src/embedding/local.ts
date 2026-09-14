import type { EmbeddingProvider, EmbeddingTask } from "./types.js";
import type { LocalInferenceConfig } from "../llm/local.js";

/**
 * EmbeddingGemma (google/embeddinggemma-300m), served by services/inference
 * on the dedicated GPU. Native output is 768-dim, matching the pgvector
 * column in packages/db/migrations/0004_rag.sql.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dimensions = 768;

  constructor(private readonly config: LocalInferenceConfig) {}

  async embed(texts: string[], task: EmbeddingTask = "document"): Promise<number[][]> {
    const res = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ texts, task }),
    });
    if (!res.ok) {
      throw new Error(`local embedding inference failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }
}
