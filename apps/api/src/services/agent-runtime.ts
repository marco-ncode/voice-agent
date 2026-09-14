import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLLMProvider,
  createSTTProvider,
  createTTSProvider,
  type LLMMessage,
} from "@v-agent/providers";
import type { AgentProviderConfig } from "@v-agent/shared";
import { config } from "../config.js";
import { UsageTracker } from "./usage-tracker.js";
import { RagService } from "./rag.js";
import { pcmToWav } from "./audio.js";

export interface AgentRecord {
  id: string;
  organizationId: string;
  providerConfig: AgentProviderConfig;
  ragEnabled: boolean;
}

export interface TurnResult {
  transcript: string;
  replyText: string;
  audio: Buffer;
}

export async function loadAgent(
  db: SupabaseClient,
  organizationId: string,
  agentId: string,
): Promise<AgentRecord | null> {
  const { data } = await db
    .from("agents")
    .select("id, organization_id, provider_config, rag_enabled")
    .eq("id", agentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    providerConfig: data.provider_config as AgentProviderConfig,
    ragEnabled: data.rag_enabled,
  };
}

/**
 * Runs one full user-turn: transcribe the buffered utterance (or skip
 * straight to the LLM when the caller already has text, e.g. the dashboard
 * playground's text mode), optionally augment the prompt with RAG context,
 * get the LLM's reply, and synthesize it to audio. Non-streaming end-to-end
 * for simplicity; each provider's streaming methods are already exposed for
 * a lower-latency version later.
 */
export class AgentRuntime {
  private readonly usageTracker: UsageTracker;
  private readonly rag?: RagService;

  constructor(
    private readonly db: SupabaseClient,
    private readonly agent: AgentRecord,
    private readonly conversationId: string | undefined,
    private readonly history: LLMMessage[],
  ) {
    this.usageTracker = new UsageTracker(db);
    if (agent.ragEnabled && config.providers.OPENAI_API_KEY) {
      this.rag = new RagService(db, config.providers.OPENAI_API_KEY);
    }
  }

  /** Utterance in as raw 16kHz mono PCM16LE (from VAD or a mic recording). */
  async runTurn(audio: Buffer): Promise<TurnResult> {
    const { stt } = this.agent.providerConfig;
    const sttProvider = createSTTProvider(stt.provider, config.providers);
    const { text: transcript, audioSeconds } = await sttProvider.transcribe({
      audio: pcmToWav(audio),
      mimeType: "audio/wav",
      language: stt.language,
      model: stt.model,
    });
    await this.usageTracker.record({
      organizationId: this.agent.organizationId,
      agentId: this.agent.id,
      conversationId: this.conversationId,
      kind: "stt",
      provider: stt.provider,
      model: stt.model,
      unit: "audio_seconds",
      quantity: audioSeconds,
    });

    const { replyText, audio: replyAudio } = await this.completeTurn(transcript);
    return { transcript, replyText, audio: replyAudio };
  }

  /** Text in directly, skipping STT (dashboard playground's text chat mode). */
  async runTextTurn(text: string): Promise<Omit<TurnResult, "transcript">> {
    return this.completeTurn(text);
  }

  private async completeTurn(userText: string): Promise<Omit<TurnResult, "transcript">> {
    const { llm, tts } = this.agent.providerConfig;

    let userMessage = userText;
    if (this.rag) {
      const matches = await this.rag.query(this.agent.id, userText, 5);
      if (matches.length > 0) {
        const context = matches.map((m) => `- ${m.content}`).join("\n");
        userMessage = `Contesto rilevante:\n${context}\n\nDomanda utente: ${userText}`;
      }
    }
    this.history.push({ role: "user", content: userMessage });

    const llmProvider = createLLMProvider(llm.provider, config.providers);
    const { text: replyText, usage } = await llmProvider.chat({
      model: llm.model,
      messages: this.history,
      temperature: llm.temperature,
    });
    this.history.push({ role: "assistant", content: replyText });
    await this.usageTracker.record({
      organizationId: this.agent.organizationId,
      agentId: this.agent.id,
      conversationId: this.conversationId,
      kind: "llm",
      provider: llm.provider,
      model: llm.model,
      unit: "tokens",
      quantity: usage.promptTokens + usage.completionTokens,
    });

    const ttsProvider = createTTSProvider(tts.provider, config.providers);
    const replyAudio = await ttsProvider.synthesize({
      text: replyText,
      voiceId: tts.voiceId,
      model: tts.model,
    });
    await this.usageTracker.record({
      organizationId: this.agent.organizationId,
      agentId: this.agent.id,
      conversationId: this.conversationId,
      kind: "tts",
      provider: tts.provider,
      model: tts.model,
      unit: "audio_seconds",
      quantity: replyText.length / 15, // rough chars-per-second estimate until real duration is threaded through
    });

    if (this.conversationId) {
      await this.db.from("conversation_turns").insert([
        { conversation_id: this.conversationId, role: "user", text: userText },
        { conversation_id: this.conversationId, role: "agent", text: replyText },
      ]);
    }

    return { replyText, audio: replyAudio };
  }
}
