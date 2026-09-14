from functools import lru_cache
from faster_whisper import WhisperModel

from app.config import settings


@lru_cache(maxsize=1)
def get_whisper_model() -> WhisperModel:
    return WhisperModel(
        settings.whisper_model_size,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )


def transcribe(audio_path: str, language: str | None = None) -> tuple[str, float]:
    model = get_whisper_model()
    segments, info = model.transcribe(audio_path, language=language)
    text = " ".join(segment.text.strip() for segment in segments)
    return text, info.duration
