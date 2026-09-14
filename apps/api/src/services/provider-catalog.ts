import { config } from "../config.js";

export interface CatalogEntry {
  available: boolean;
  models?: string[];
  voices?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface ProviderCatalog {
  llm: Record<string, CatalogEntry>;
  stt: Record<string, CatalogEntry>;
  tts: Record<string, CatalogEntry>;
}

const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
].map((id) => ({ id, name: id }));

const CATALOG_CACHE_TTL_MS = 5 * 60_000;
let cached: { at: number; catalog: ProviderCatalog } | null = null;

async function fetchList<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string }> {
  try {
    return { value: await fn() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "fetch_failed" };
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models request failed: ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string }> };
  return data.data
    .map((m) => m.id)
    .filter((id) => /^(gpt-|o1|o3|o4|chatgpt-)/.test(id))
    .sort();
}

async function fetchLocalModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/llm/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`local inference models request failed: ${res.status}`);
  const data = (await res.json()) as { models: string[] };
  return data.models;
}

async function fetchElevenLabsVoices(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`ElevenLabs voices request failed: ${res.status}`);
  const data = (await res.json()) as { voices: Array<{ voice_id: string; name: string }> };
  return data.voices.map((v) => ({ id: v.voice_id, name: v.name }));
}

async function fetchCartesiaVoices(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("https://api.cartesia.ai/voices", {
    headers: { "X-API-Key": apiKey, "Cartesia-Version": "2024-06-10" },
  });
  if (!res.ok) throw new Error(`Cartesia voices request failed: ${res.status}`);
  const data = (await res.json()) as Array<{ id: string; name: string }>;
  return data.map((v) => ({ id: v.id, name: v.name }));
}

/**
 * Builds the catalog of models/voices actually usable right now, based on
 * which provider API keys are configured server-side. Where a provider
 * exposes a discovery API (OpenAI models, ElevenLabs/Cartesia voices, the
 * locally-hosted vLLM/TGI server's models) the list is fetched live;
 * otherwise (Deepgram, OpenAI's fixed TTS voice set, Azure — not yet
 * implemented) a curated static list is returned instead.
 */
export async function buildProviderCatalog(): Promise<ProviderCatalog> {
  if (cached && Date.now() - cached.at < CATALOG_CACHE_TTL_MS) {
    return cached.catalog;
  }

  const p = config.providers;
  const hasLocal = Boolean(p.INFERENCE_SERVICE_URL && p.INFERENCE_SERVICE_API_KEY);

  const catalog: ProviderCatalog = { llm: {}, stt: {}, tts: {} };

  if (p.OPENAI_API_KEY) {
    const { value, error } = await fetchList(() => fetchOpenAIModels(p.OPENAI_API_KEY!));
    catalog.llm.openai = { available: true, models: value ?? [], error };
  } else {
    catalog.llm.openai = { available: false };
  }
  catalog.llm["azure-openai"] = {
    available: Boolean(p.AZURE_OPENAI_API_KEY && p.AZURE_OPENAI_ENDPOINT),
  };
  if (hasLocal) {
    const { value, error } = await fetchList(() =>
      fetchLocalModels(p.INFERENCE_SERVICE_URL!, p.INFERENCE_SERVICE_API_KEY!),
    );
    catalog.llm.local = { available: true, models: value ?? [], error };
  } else {
    catalog.llm.local = { available: false };
  }

  catalog.stt.openai = { available: Boolean(p.OPENAI_API_KEY), models: ["whisper-1"] };
  catalog.stt.deepgram = {
    available: Boolean(p.DEEPGRAM_API_KEY),
    models: ["nova-3", "nova-2", "nova", "enhanced", "base"],
  };
  catalog.stt.azure = { available: Boolean(p.AZURE_SPEECH_KEY && p.AZURE_SPEECH_REGION) };
  catalog.stt.local = { available: hasLocal };

  catalog.tts.openai = {
    available: Boolean(p.OPENAI_API_KEY),
    models: ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"],
    voices: OPENAI_TTS_VOICES,
  };
  if (p.ELEVENLABS_API_KEY) {
    const { value, error } = await fetchList(() => fetchElevenLabsVoices(p.ELEVENLABS_API_KEY!));
    catalog.tts.elevenlabs = { available: true, voices: value ?? [], error };
  } else {
    catalog.tts.elevenlabs = { available: false };
  }
  if (p.CARTESIA_API_KEY) {
    const { value, error } = await fetchList(() => fetchCartesiaVoices(p.CARTESIA_API_KEY!));
    catalog.tts.cartesia = { available: true, voices: value ?? [], error };
  } else {
    catalog.tts.cartesia = { available: false };
  }
  catalog.tts.azure = { available: Boolean(p.AZURE_SPEECH_KEY && p.AZURE_SPEECH_REGION) };
  catalog.tts.local = { available: hasLocal };

  cached = { at: Date.now(), catalog };
  return catalog;
}
