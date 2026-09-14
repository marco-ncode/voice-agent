"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Agent, AgentFormValues, AgentProviderConfig, ProviderCatalog } from "@/lib/types";
import { DEFAULT_PROVIDER_CONFIG } from "@/lib/types";

const LLM_PROVIDERS = ["openai", "azure-openai", "local"] as const;
const STT_PROVIDERS = ["openai", "deepgram", "azure", "local"] as const;
const TTS_PROVIDERS = ["openai", "elevenlabs", "cartesia", "azure", "local"] as const;

function inputClass() {
  return "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function AvailabilityHint({
  catalog,
  section,
  provider,
}: {
  catalog: ProviderCatalog | null;
  section: keyof ProviderCatalog;
  provider: string;
}) {
  const entry = catalog?.[section]?.[provider];
  if (!entry) return null;
  if (!entry.available) {
    return (
      <p className="sm:col-span-2 -mt-2 text-xs text-amber-600">
        Chiave API per &quot;{provider}&quot; non configurata su questo deployment: il campo
        sotto resta a inserimento manuale.
      </p>
    );
  }
  if (entry.error) {
    return (
      <p className="sm:col-span-2 -mt-2 text-xs text-amber-600">
        Elenco modelli/voci non disponibile ({entry.error}): inserisci il valore manualmente.
      </p>
    );
  }
  return null;
}

export function AgentForm({
  organizationId,
  initialAgent,
  onSubmit,
  submitLabel,
}: {
  organizationId: string;
  initialAgent?: Agent;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [name, setName] = useState(initialAgent?.name ?? "");
  const [description, setDescription] = useState(initialAgent?.description ?? "");
  const [ragEnabled, setRagEnabled] = useState(initialAgent?.rag_enabled ?? false);
  const [config, setConfig] = useState<AgentProviderConfig>(
    initialAgent?.provider_config ?? DEFAULT_PROVIDER_CONFIG,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalog | null>(null);

  useEffect(() => {
    apiFetch<ProviderCatalog>(`/v1/organizations/${organizationId}/provider-catalog`)
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, [organizationId]);

  function update<K extends keyof AgentProviderConfig>(
    section: K,
    patch: Partial<AgentProviderConfig[K]>,
  ) {
    setConfig((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, description: description || undefined, providerConfig: config, ragEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio");
    } finally {
      setSubmitting(false);
    }
  }

  const llmModels = catalog?.llm[config.llm.provider]?.models ?? [];
  const sttModels = catalog?.stt[config.stt.provider]?.models ?? [];
  const ttsEntry = catalog?.tts[config.tts.provider];
  const ttsModels = ttsEntry?.models ?? [];
  const ttsVoices = ttsEntry?.voices ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <Section title="Informazioni generali">
        <Field label="Nome agente">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass()}
          />
        </Field>
        <Field label="Descrizione (opzionale)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass()}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="System prompt">
            <textarea
              required
              rows={4}
              value={config.llm.systemPrompt}
              onChange={(e) => update("llm", { systemPrompt: e.target.value })}
              className={inputClass()}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={ragEnabled}
            onChange={(e) => setRagEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-gray-700">
            Abilita RAG (risponde usando i documenti caricati per questo agente)
          </span>
        </label>
      </Section>

      <Section title="Modello linguistico (LLM)">
        <Field label="Provider">
          <select
            value={config.llm.provider}
            onChange={(e) => update("llm", { provider: e.target.value as AgentProviderConfig["llm"]["provider"] })}
            className={inputClass()}
          >
            {LLM_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modello">
          <input
            required
            list="llm-models"
            value={config.llm.model}
            onChange={(e) => update("llm", { model: e.target.value })}
            placeholder="es. gpt-4o-mini"
            className={inputClass()}
          />
          <datalist id="llm-models">
            {llmModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <AvailabilityHint catalog={catalog} section="llm" provider={config.llm.provider} />
        <Field label="Temperatura">
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={config.llm.temperature ?? 0.7}
            onChange={(e) => update("llm", { temperature: Number(e.target.value) })}
            className={inputClass()}
          />
        </Field>
      </Section>

      <Section title="Riconoscimento vocale (STT)">
        <Field label="Provider">
          <select
            value={config.stt.provider}
            onChange={(e) => update("stt", { provider: e.target.value as AgentProviderConfig["stt"]["provider"] })}
            className={inputClass()}
          >
            {STT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modello (opzionale)">
          <input
            list="stt-models"
            value={config.stt.model ?? ""}
            onChange={(e) => update("stt", { model: e.target.value || undefined })}
            placeholder="es. whisper-1, nova-2"
            className={inputClass()}
          />
          <datalist id="stt-models">
            {sttModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <AvailabilityHint catalog={catalog} section="stt" provider={config.stt.provider} />
        <Field label="Lingua (opzionale)">
          <input
            value={config.stt.language ?? ""}
            onChange={(e) => update("stt", { language: e.target.value || undefined })}
            placeholder="it"
            className={inputClass()}
          />
        </Field>
      </Section>

      <Section title="Sintesi vocale (TTS)">
        <Field label="Provider">
          <select
            value={config.tts.provider}
            onChange={(e) => update("tts", { provider: e.target.value as AgentProviderConfig["tts"]["provider"] })}
            className={inputClass()}
          >
            {TTS_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Voice ID">
          <input
            required
            list="tts-voices"
            value={config.tts.voiceId}
            onChange={(e) => update("tts", { voiceId: e.target.value })}
            placeholder="es. alloy, o l'ID voce del provider"
            className={inputClass()}
          />
          <datalist id="tts-voices">
            {ttsVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </datalist>
        </Field>
        <AvailabilityHint catalog={catalog} section="tts" provider={config.tts.provider} />
        <Field label="Modello (opzionale)">
          <input
            list="tts-models"
            value={config.tts.model ?? ""}
            onChange={(e) => update("tts", { model: e.target.value || undefined })}
            placeholder="es. tts-1, eleven_turbo_v2_5"
            className={inputClass()}
          />
          <datalist id="tts-models">
            {ttsModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Lingua (opzionale)">
          <input
            value={config.tts.language ?? ""}
            onChange={(e) => update("tts", { language: e.target.value || undefined })}
            placeholder="it"
            className={inputClass()}
          />
        </Field>
        <p className="text-xs text-gray-400 sm:col-span-2">
          Supporto variabile per provider: ElevenLabs (modelli turbo/multilingual) e Cartesia la
          usano per forzare la lingua; OpenAI la ignora (rileva automaticamente dal testo); locale
          (XTTS) la usa per scegliere la pronuncia.
        </p>
      </Section>

      <Section title="Rilevamento voce (VAD)">
        <Field label="Timeout silenzio (ms)">
          <input
            type="number"
            min={100}
            step={50}
            value={config.vad.silenceTimeoutMs}
            onChange={(e) => update("vad", { silenceTimeoutMs: Number(e.target.value) })}
            className={inputClass()}
          />
        </Field>
        <Field label="Durata minima parlato (ms)">
          <input
            type="number"
            min={0}
            step={50}
            value={config.vad.minSpeechMs}
            onChange={(e) => update("vad", { minSpeechMs: Number(e.target.value) })}
            className={inputClass()}
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Salvataggio..." : submitLabel}
      </button>
    </form>
  );
}
