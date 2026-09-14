# V Agent

Piattaforma per costruire agenti vocali conversazionali multi-provider — collegabile a
OpenAI, Azure, HuggingFace/modelli locali (GPU dedicata), ed esposta via API pubbliche
per l'integrazione con sistemi terzi (gestori SIP/VoIP, CRM, contact center, ecc.).

## Struttura del monorepo

```
apps/
  api/            Gateway Node.js/TypeScript (Fastify): REST + webhook + WebSocket
                  real-time per audio streaming, orchestrazione STT -> LLM -> TTS.
packages/
  shared/         Tipi di dominio e schemi zod condivisi.
  providers/      Layer di astrazione multi-provider per LLM / STT / TTS.
  db/             Schema SQL Supabase (multi-tenant, RAG via pgvector, RLS) + client.
services/
  inference/      Servizio Python (FastAPI) eseguito sulla GPU dedicata (Blackwell 96GB):
                  proxy verso vLLM/TGI per gli LLM locali, faster-whisper per lo STT,
                  backend TTS pluggable (default Coqui XTTS).
infra/
  hetzner/        Note di deploy per il nodo GPU bare-metal.
```

## Provider supportati

| Modalità | Provider |
|---|---|
| LLM | OpenAI, Azure OpenAI, locale (via `services/inference`) |
| STT | OpenAI (Whisper), Deepgram, Azure Speech *(stub, TODO)*, locale |
| TTS | OpenAI, ElevenLabs, Cartesia, Azure Speech *(stub, TODO)*, locale |

Ogni agente configura i provider desiderati indipendentemente (`packages/shared`'s
`AgentProviderConfig`); il layer in `packages/providers` normalizza le differenze dietro
un'interfaccia comune, cosi lo switch provider non richiede modifiche al core.

## Setup

```bash
pnpm install
cp .env.example .env   # popolare le chiavi Supabase + provider
pnpm dev:api
```

Per applicare lo schema Supabase, vedi `packages/db/README.md`.

Per il servizio di inferenza locale, vedi `services/inference/README.md`.

## Stato / prossimi passi

Questo scaffold copre: layer multi-provider, schema DB multi-tenant con RAG, API REST +
webhook + WebSocket real-time, servizio di inferenza GPU. **Non ancora implementata**:
la dashboard/builder UI (configurazione agenti stile ElevenLabs Agents + playground
chat/voce) e i connettori SIP/telefonia dedicati — le API sono progettate per
supportarli, ma i connettori stessi sono un prossimo step.
