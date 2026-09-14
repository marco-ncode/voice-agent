import json

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/llm", tags=["llm"])


class ToolCallModel(BaseModel):
    id: str
    name: str
    arguments: dict = {}


class ChatMessage(BaseModel):
    role: str
    content: str = ""
    toolCalls: list[ToolCallModel] | None = None
    toolCallId: str | None = None
    name: str | None = None


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: float | None = None
    maxTokens: int | None = None
    tools: list[ToolDefinition] | None = None
    stream: bool = False


def to_openai_messages(messages: list[ChatMessage]) -> list[dict]:
    result = []
    for m in messages:
        if m.role == "tool":
            result.append({"role": "tool", "content": m.content, "tool_call_id": m.toolCallId or ""})
        elif m.role == "assistant" and m.toolCalls:
            result.append(
                {
                    "role": "assistant",
                    "content": m.content or None,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
                        }
                        for tc in m.toolCalls
                    ],
                }
            )
        else:
            result.append({"role": m.role, "content": m.content})
    return result


def to_openai_tools(tools: list[ToolDefinition] | None) -> list[dict] | None:
    if not tools:
        return None
    return [
        {
            "type": "function",
            "function": {"name": t.name, "description": t.description, "parameters": t.parameters},
        }
        for t in tools
    ]


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Proxies to a locally-hosted OpenAI-compatible server (vLLM/TGI) running
    the chosen HuggingFace model on this GPU box, and reshapes its response
    into the flat {text, prompt_tokens, completion_tokens, tool_calls?} /
    NDJSON shape the @v-agent/providers local adapter expects. Requires the
    underlying server to be started with tool-calling support (e.g. vLLM's
    --enable-auto-tool-choice) for `tools` to actually work.
    """
    payload = {
        "model": request.model,
        "messages": to_openai_messages(request.messages),
        "temperature": request.temperature,
        "max_tokens": request.maxTokens,
        "tools": to_openai_tools(request.tools),
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

        message = data["choices"][0]["message"]
        result = {
            "text": message.get("content") or "",
            "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
            "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
        }
        tool_calls = message.get("tool_calls")
        if tool_calls:
            result["tool_calls"] = [
                {
                    "id": tc["id"],
                    "name": tc["function"]["name"],
                    "arguments": json.loads(tc["function"]["arguments"] or "{}"),
                }
                for tc in tool_calls
            ]
        return result

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
