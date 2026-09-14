# V Agent

Piattaforma per costruire agenti vocali conversazionali multi-provider — collegabile a
OpenAI, Azure, HuggingFace/modelli locali (GPU dedicata), ed esposta via API pubbliche
per l'integrazione con sistemi terzi (gestori SIP/VoIP, CRM, contact center, ecc.).

## Struttura del monorepo

```
apps/
  api/            Gateway Node.js/TypeScript (Fastify): REST + webhook + WebSocket
                  real-time per audio streaming, orchestrazione STT -> LLM -> TTS.
  dashboard/      Builder UI (Next.js): gestione organizzazioni/agenti/chiavi API,
                  playground chat + voce per testare un agente senza uscire dal browser.
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

cp apps/dashboard/.env.local.example apps/dashboard/.env.local   # chiavi Supabase pubbliche + URL api
pnpm dev:dashboard
```

Per applicare lo schema Supabase, vedi `packages/db/README.md`.

Per il servizio di inferenza locale, vedi `services/inference/README.md`.

## Dashboard

Login/registrazione via Supabase Auth (email + password) → creazione/selezione
organizzazione → CRUD agenti (prompt, provider LLM/STT/TTS, voce, VAD, RAG) → scheda
Documenti per alimentare il RAG dell'agente (incolla testo o carica .txt/.md) →
playground per testare l'agente via chat testuale o microfono direttamente dal browser →
gestione chiavi API per collegare sistemi esterni. Il playground e l'ingestion documenti
autenticano con la sessione utente (non richiedono una chiave API) tramite endpoint
dedicati lato `apps/api` (`/v1/organizations/:id/agents/:id/playground/turn` e
`/v1/organizations/:id/agents/:id/documents`); quest'ultimo chunka il testo, lo embedda
(OpenAI `text-embedding-3-small`) e lo scrive nelle tabelle pgvector scoped per agente.

## Stato / prossimi passi

Questo scaffold copre: layer multi-provider, schema DB multi-tenant con RAG (incluso il
caricamento documenti dalla UI), API REST + webhook + WebSocket real-time, servizio di
inferenza GPU, dashboard/builder UI con playground chat + voce. **Non ancora
implementati**: i connettori SIP/telefonia dedicati (le API sono già progettate per
supportarli) e l'estrazione testo da PDF/altri formati per il RAG (per ora solo testo
semplice: incollato o file .txt/.md).
