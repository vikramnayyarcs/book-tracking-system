import type { Embedder } from "./ai/types.ts";

export const EMBEDDING_DIMENSIONS = 384;
export const EMBED_BATCH = 50;

export type PendingInsight = { id: string; text: string };

export type EmbeddingStore = {
  save: (id: string, text: string, vector: string) => Promise<boolean>;
  pending: (limit: number) => Promise<PendingInsight[]>;
};

export type Embeddings = { embedder: Embedder; store: EmbeddingStore };

export const toVector = (values: number[]) =>
  values.length === EMBEDDING_DIMENSIONS && values.every(Number.isFinite)
    ? `[${values.join(",")}]`
    : undefined;

const embedRows = async (
  { embedder, store }: Embeddings,
  rows: PendingInsight[],
) => {
  if (rows.length === 0) {
    return 0;
  }
  const vectors = await embedder.embed(rows.map((row) => row.text));
  let saved = 0;
  for (const [index, row] of rows.entries()) {
    const vector = toVector(vectors[index] ?? []);
    if (vector !== undefined && (await store.save(row.id, row.text, vector))) {
      saved += 1;
    }
  }
  return saved;
};

export const embedOnWrite = async (
  embeddings: Embeddings,
  rows: PendingInsight[],
) => {
  try {
    await embedRows(embeddings, rows);
  } catch {
    return;
  }
};

export const backfillEmbeddings = async (
  embeddings: Embeddings,
  batch = EMBED_BATCH,
) => embedRows(embeddings, await embeddings.store.pending(batch));
