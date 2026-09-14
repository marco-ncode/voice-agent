from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import embeddings, llm, stt, tts

app = FastAPI(title="V Agent Inference Service")


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {settings.inference_api_key}":
        return JSONResponse(status_code=401, content={"error": "invalid_api_key"})
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(llm.router)
app.include_router(stt.router)
app.include_router(tts.router)
app.include_router(embeddings.router)
