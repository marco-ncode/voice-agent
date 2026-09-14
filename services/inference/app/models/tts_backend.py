from functools import lru_cache
import io

import numpy as np

from app.config import settings


@lru_cache(maxsize=1)
def get_tts_model():
    """
    Lazily imports Coqui TTS so the service can boot (and serve LLM/STT)
    even when the TTS extra hasn't been installed yet. Swap this out for
    whichever local TTS stack you settle on (XTTS, StyleTTS2, a
    HF pipeline, ...) - callers only depend on synthesize() below.
    """
    from TTS.api import TTS  # noqa: PLC0415

    return TTS(settings.tts_model_id).to(settings.tts_device)


def synthesize(text: str, voice_id: str, language: str = "it") -> bytes:
    model = get_tts_model()
    wav = model.tts(text=text, speaker=voice_id, language=language)
    pcm16 = (np.clip(np.array(wav), -1.0, 1.0) * 32767).astype(np.int16)
    buffer = io.BytesIO()
    buffer.write(pcm16.tobytes())
    return buffer.getvalue()
