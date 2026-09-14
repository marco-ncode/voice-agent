# services/inference

Servizio Python (FastAPI) eseguito sull'host con GPU dedicata (Blackwell 96GB VRAM),
esposto internamente all'`apps/api` come provider "local" per LLM/STT/TTS/embeddings.

## Architettura

- **LLM**: non reimplementato qui. Va eseguito un server OpenAI-compatible separato
  (vLLM o TGI, entrambi ottimi su Blackwell) che serve il modello HuggingFace scelto;
  questo servizio si limita a fare da proxy/adapter verso `LOCAL_LLM_BASE_URL`.
- **STT**: `faster-whisper` caricato direttamente in processo su GPU.
- **TTS**: interfaccia pluggable in `app/models/tts_backend.py`, di default Coqui XTTS
  (multilingua, adatto per italiano). Da sostituire quando si sceglie il modello definitivo.
- **Embeddings (RAG)**: EmbeddingGemma (`google/embeddinggemma-300m`) via
  `sentence-transformers`, dimensione nativa 768 — deve corrispondere alla colonna
  `vector(768)` in `packages/db/migrations/0004_rag.sql`. Usa `encode_query`/
  `encode_document` (template di prompt diversi per interrogazioni vs. documenti indicizzati).

## Avvio locale

```bash
pip install -r requirements.txt
# in un altro processo/container: vLLM che serve il modello scelto su :8001
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Variabili d'ambiente: vedi `app/config.py`.
