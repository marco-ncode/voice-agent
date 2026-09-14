from fastapi import APIRouter
from pydantic import BaseModel

from app.models.embedding_backend import embed

router = APIRouter(tags=["embeddings"])


class EmbedRequest(BaseModel):
    texts: list[str]
    task: str = "document"  # "query" | "document"


@router.post("/embeddings")
async def embeddings_endpoint(request: EmbedRequest):
    return {"embeddings": embed(request.texts, task=request.task)}
