import json

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/llm", tags=["llm"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: float | None = None
    maxTokens: int | None = None
    stream: bool = False


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Proxies to a locally-hosted OpenAI-compatible server (vLLM/TGI) running
    the chosen HuggingFace model on this GPU box, and reshapes its response
    into the flat {text, prompt_tokens, completion_tokens} / NDJSON shape
    the @v-agent/providers local adapter expects.
    """
    payload = {
        "model": request.model,
        "messages": [m.model_dump() for m in request.messages],
        "temperature": request.temperature,
        "max_tokens": request.maxTokens,
        "stream": request.stream,
    }

    if not request.stream:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.local_llm_base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {settings.local_llm_api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
        return {
            "text": data["choices"][0]["message"]["content"],
            "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
            "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
        }

    async def stream_ndjson():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{settings.local_llm_base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {settings.local_llm_api_key}"},
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if data == "[DONE]":
                        yield json.dumps({"delta": "", "done": True}) + "\n"
                        break
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    finished = chunk["choices"][0].get("finish_reason") is not None
                    if delta or finished:
                        yield json.dumps({"delta": delta, "done": finished}) + "\n"

    return StreamingResponse(stream_ndjson(), media_type="application/x-ndjson")
