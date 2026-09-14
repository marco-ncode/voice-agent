from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Configuration for the local inference service. Runs alongside a
    separately-hosted OpenAI-compatible LLM server (vLLM / TGI / Ollama) on
    the same GPU box, and hosts STT/TTS in-process.
    """

    inference_api_key: str = "change-me"

    # LLM: proxied to an OpenAI-compatible server (vLLM/TGI) rather than
    # reimplemented here, so any HuggingFace model vLLM supports works
    # without code changes.
    local_llm_base_url: str = "http://localhost:8001/v1"
    local_llm_api_key: str = "not-needed"

    # STT: faster-whisper, loaded directly onto the GPU in this process.
    whisper_model_size: str = "large-v3"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"

    # TTS: model id is backend-specific; see app/models/tts_backend.py.
    tts_model_id: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    tts_device: str = "cuda"

    class Config:
        env_prefix = ""


settings = Settings()
