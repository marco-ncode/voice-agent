import tempfile

from fastapi import APIRouter, Request

from app.models.whisper_backend import transcribe

router = APIRouter(prefix="/stt", tags=["stt"])


@router.post("/transcribe")
async def transcribe_endpoint(request: Request):
    audio = await request.body()
    language = request.headers.get("x-language") or None

    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tmp.write(audio)
        tmp.flush()
        text, duration = transcribe(tmp.name, language=language)

    return {"text": text, "audio_seconds": duration}
