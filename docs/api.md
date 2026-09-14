# API pubbliche di V Agent

Queste sono le API pensate per collegare V Agent a **sistemi esterni**: gestori di
protocollo SIP/VoIP, CRM, contact center, o qualunque integrazione custom. Sono
distinte dalle route usate dalla dashboard (`/v1/organizations/...`), che invece
autenticano con la sessione utente Supabase.

Base URL: quella su cui gira `apps/api` (in locale `http://localhost:8080`).

## Autenticazione

Tutte le API pubbliche richiedono una **chiave API**, generata dalla dashboard
(**Chiavi API** nella sidebar, scope su un'organizzazione). Va passata come:

```
Authorization: Bearer <chiave>
```

La chiave viene mostrata **una sola volta** alla creazione — se la perdi, revocala e
creane una nuova. Una richiesta senza chiave valida risponde `401` con
`{ "error": "missing_api_key" }` o `{ "error": "invalid_api_key" }`.

---

## Conversazioni (`/v1/conversations`)

Modello base: una **conversazione** appartiene a un agente, contiene una sequenza di
**turni** (`user` / `agent` / `tool`). Usale se il tuo sistema gestisce tu stesso
STT/LLM/TTS altrove e vuoi solo salvare la trascrizione, oppure come contenitore
per il canale realtime (vedi sotto).

### Avviare una conversazione

```
POST /v1/conversations
Authorization: Bearer <chiave>
Content-Type: application/json

{
  "agentId": "<uuid dell'agente>",
  "channel": "phone",            // "web" | "phone" | "api"
  "metadata": { "any": "json" }  // opzionale, default {}
}
```

Risposta `201`:
```json
{
  "id": "...",
  "organization_id": "...",
  "agent_id": "...",
  "channel": "phone",
  "status": "active",
  "started_at": "...",
  "ended_at": null,
  "metadata": {}
}
```
`404 { "error": "agent_not_found" }` se `agentId` non esiste o non appartiene alla
tua organizzazione.

### Leggere una conversazione (con i turni)

```
GET /v1/conversations/:id
Authorization: Bearer <chiave>
```

Risposta `200`: la conversazione con `"turns": [...]` in ordine cronologico.
`404 { "error": "not_found" }` se non esiste o appartiene a un'altra organizzazione.

### Aggiungere un turno

```
POST /v1/conversations/:id/turns
Authorization: Bearer <chiave>
Content-Type: application/json

{
  "role": "user",           // "user" | "agent" | "tool"
  "text": "Testo del turno",
  "audioUrl": "https://..." // opzionale
}
```

Risposta `201` con il turno creato. `404` se la conversazione non esiste.

### Terminare una conversazione

```
POST /v1/conversations/:id/end
Authorization: Bearer <chiave>
```

Imposta `status: "completed"` e `ended_at`. Risposta `200` con la conversazione
aggiornata, `404` se non trovata.

---

## Webhook telefonia (`/v1/webhooks/telephony/:agentId`)

Endpoint generico per connettori SIP/VoIP (Twilio, Vonage, un trunk SIP, un'integrazione
PBX, ecc.) per notificare l'inizio/fine di una chiamata. Ogni connettore mappa i propri
eventi su `call.started` / `call.ended`; l'audio vero e proprio passa dal canale
realtime (sotto), correlato tramite lo stesso `externalCallId`.

```
POST /v1/webhooks/telephony/:agentId
Authorization: Bearer <chiave>
Content-Type: application/json

{
  "event": "call.started",       // "call.started" | "call.ended"
  "externalCallId": "CA123...",  // ID della chiamata nel tuo sistema
  "metadata": {}                 // opzionale, solo su call.started
}
```

- `call.started` → crea una conversazione (`channel: "phone"`), risposta `201`.
- `call.ended` → trova la conversazione con quello stesso `externalCallId` nei
  metadata e la marca `completed`, risposta `200`. `404` se non trovata o se
  `agentId` non esiste nella tua organizzazione.

---

## Canale realtime (WebSocket) — `/v1/realtime/:agentId`

Il canale bidirezionale per lo streaming audio: qui si collega un connettore
SIP/RTP (traducendo RTP ↔ questi frame WebSocket), oppure un client browser/mobile
direttamente.

```
wss://<host>/v1/realtime/:agentId?api_key=<chiave>&conversation_id=<opzionale>
```

L'`api_key` può essere passata come query param (comodo per client che non
gestiscono header custom sull'handshake WS) oppure come header
`Authorization: Bearer <chiave>`. Se `conversation_id` è presente, ogni turno viene
salvato lì (via `conversation_turns`); altrimenti gira "a vuoto" senza persistenza.

**Client → server**: frame binari di audio raw **PCM16LE mono a 16kHz**. Il VAD
lato server (silenzio configurato nell'agente) rileva la fine di un'enunciazione e
avvia la pipeline STT → (RAG) → LLM → TTS.

**Server → client**:
- frame testo JSON: `{ "type": "transcript", "text": "..." }` — trascrizione dell'utente
- frame testo JSON: `{ "type": "reply", "text": "..." }` — testo della risposta dell'agente
- frame binario: audio della risposta sintetizzata (stesso formato/qualità del provider
  TTS configurato sull'agente)
- in caso di errore: `{ "type": "error", "message": "..." }` e la connessione viene chiusa se l'errore è di autenticazione/agente non trovato

Se la chiave o l'`agentId` non sono validi, il server invia un frame `error` e chiude
subito la connessione.

> Nota: i frame di controllo testuali dal client (non binari) sono al momento
> ignorati — riservati per una futura gestione del barge-in.

---

## Configurazione di un agente (riferimento campi)

Il comportamento di un agente (prompt, provider, voce, VAD) si configura dalla
dashboard, ma se stai orchestrando la creazione via API dashboard-side, la forma di
`providerConfig` è:

```ts
{
  llm:  { provider: "openai" | "azure-openai" | "local", model: string, temperature?: number, systemPrompt: string },
  stt:  { provider: "openai" | "deepgram" | "azure" | "local", model?: string, language?: string },
  tts:  { provider: "openai" | "elevenlabs" | "cartesia" | "azure" | "local", voiceId: string, model?: string },
  vad:  { silenceTimeoutMs: number, minSpeechMs: number },
}
```

---

## Flusso conversazionale (builder grafico)

Dalla tab **Flusso** della dashboard si può costruire, per ogni agente, un grafo
deterministico di nodi (messaggio, condizione IF/SWITCH, estrazione variabile,
chiamata a strumento, trasferimento a operatore, fine) in alternativa al prompt
libero. Quando un agente ha un flusso **attivo**, sia il canale realtime che
l'endpoint playground lo eseguono automaticamente — non serve alcuna chiamata API
aggiuntiva lato tuo connettore.

L'unica cosa rilevante per un'integrazione esterna è che lo stato di esecuzione
(nodo corrente + variabili raccolte) è legato al `conversation_id`: passandolo
sempre sulla stessa connessione WebSocket (o riaprendola con lo stesso
`conversation_id` dopo una disconnessione), la conversazione riprende dal punto
in cui si trovava invece di ripartire dall'inizio del flusso. Senza flusso attivo
configurato, il comportamento resta quello preesistente (prompt libero + LLM).

---

## Codici di errore comuni

| Status | Corpo | Significato |
|---|---|---|
| 401 | `{ "error": "missing_api_key" }` | Header `Authorization` assente |
| 401 | `{ "error": "invalid_api_key" }` | Chiave non valida o revocata |
| 404 | `{ "error": "agent_not_found" }` | `agentId` inesistente o di un'altra organizzazione |
| 404 | `{ "error": "not_found" }` | Conversazione inesistente o di un'altra organizzazione |
| 400 | `{ "error": "<messaggio zod>" }` | Corpo della richiesta non valido rispetto allo schema |

## Esempio: integrare un gestore SIP

Un connettore SIP/VoIP tipico farebbe, per ogni chiamata:

1. Alla ricezione della chiamata (`INVITE`): `POST /v1/webhooks/telephony/:agentId`
   con `event: "call.started"` per creare la conversazione, salvando `externalCallId`.
2. Apre una connessione `wss://.../v1/realtime/:agentId?api_key=...&conversation_id=<id creato al passo 1>`
   e inizia a forwardare l'audio RTP (transcodificato a PCM16 16kHz mono) come frame
   binari, riproducendo verso la linea telefonica i frame binari audio ricevuti.
3. Alla fine della chiamata (`BYE`): `POST /v1/webhooks/telephony/:agentId` con
   `event: "call.ended"` e lo stesso `externalCallId`.

Non esiste ancora un connettore SIP nativo incluso nel repo (roadmap): questa API è
il punto di attacco per costruirlo, sia come componente separato sia integrandolo
in un gateway SIP esistente (es. Asterisk/FreeSWITCH/drachtio) o tramite un provider
VoIP cloud (Twilio/Vonage) che esponga già gli hook di chiamata verso questi endpoint.
