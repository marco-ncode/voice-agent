export type EmbeddingTask = "query" | "document";

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[], task?: EmbeddingTask): Promise<number[][]>;
}
