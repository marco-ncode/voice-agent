from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import settings


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer(settings.embedding_model_id, device=settings.embedding_device)


def embed(texts: list[str], task: str = "document") -> list[list[float]]:
    """
    EmbeddingGemma uses different prompt templates for queries vs. the
    documents being searched over; encode_query/encode_document apply the
    right one automatically. Native output is 768-dim (no Matryoshka
    truncation applied), matching the pgvector column.
    """
    model = get_embedding_model()
    vectors = model.encode_query(texts) if task == "query" else model.encode_document(texts)
    return vectors.tolist()
