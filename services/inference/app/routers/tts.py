from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from app.models.tts_backend import synthesize

router = APIRouter(prefix="/tts", tags=["tts"])


class SynthesizeRequest(BaseModel):
    text: str
    voiceId: str
    model: str | None = None
    stream: bool = False


@router.post("/synthesize")
async def synthesize_endpoint(request: SynthesizeRequest):
    # `stream` is accepted for API-shape parity with the other providers;
    # the underlying TTS backend here is not incremental, so the full
    # buffer is returned in one response either way.
    audio = synthesize(text=request.text, voice_id=request.voiceId)
    return Response(content=audio, media_type="application/octet-stream")
