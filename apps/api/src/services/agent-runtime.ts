import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLLMProvider,
  createSTTProvider,
  createTTSProvider,
  type LLMMessage,
  type LLMUsage,
} from "@v-agent/providers";
import type { AgentProviderConfig } from "@v-agent/shared";
import { config } from "../config.js";
import { UsageTracker } from "./usage-tracker.js";
import { RagService } from "./rag.js";
import { pcmToWav } from "./audio.js";
import { ToolExecutor } from "./tools.js";
import { ToolCallLog } from "./tool-call-log.js";

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

const MAX_TOOL_ROUNDS = 4;

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
 * let the LLM call any tools configured for the agent (MCP servers or
 * custom APIs), get its final reply, and synthesize it to audio.
 * Non-streaming end-to-end for simplicity; each provider's streaming
 * methods are already exposed for a lower-latency version later.
 */
export class AgentRuntime {
  private readonly usageTracker: UsageTracker;
  private readonly toolCallLog: ToolCallLog;
  private readonly rag?: RagService;

  constructor(
    private readonly db: SupabaseClient,
    private readonly agent: AgentRecord,
    private readonly conversationId: string | undefined,
    private readonly history: LLMMessage[],
  ) {
    this.usageTracker = new UsageTracker(db);
    this.toolCallLog = new ToolCallLog(db);
    if (agent.ragEnabled && config.providers.INFERENCE_SERVICE_URL && config.providers.INFERENCE_SERVICE_API_KEY) {
      this.rag = new RagService(db, {
        baseUrl: config.providers.INFERENCE_SERVICE_URL,
        apiKey: config.providers.INFERENCE_SERVICE_API_KEY,
      });
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

  private async recordLlmUsage(usage: LLMUsage): Promise<void> {
    await this.usageTracker.record({
      organizationId: this.agent.organizationId,
      agentId: this.agent.id,
      conversationId: this.conversationId,
      kind: "llm",
      provider: this.agent.providerConfig.llm.provider,
      model: this.agent.providerConfig.llm.model,
      unit: "tokens",
      quantity: usage.promptTokens + usage.completionTokens,
    });
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
    const toolExecutor = new ToolExecutor(this.db);
    let replyText: string;

    try {
      const toolDefs = await toolExecutor.loadForAgent(this.agent.id);
      replyText = await this.runToolCallingLoop(llmProvider, llm, toolDefs, toolExecutor);
    } finally {
      await toolExecutor.dispose();
    }

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

  /**
   * Alternates LLM calls with tool execution until the model returns a
   * plain text reply (no more tool calls) or MAX_TOOL_ROUNDS is hit, in
   * which case one final call without tools forces a wrap-up answer.
   */
  private async runToolCallingLoop(
    llmProvider: ReturnType<typeof createLLMProvider>,
    llm: AgentProviderConfig["llm"],
    toolDefs: Awaited<ReturnType<ToolExecutor["loadForAgent"]>>,
    toolExecutor: ToolExecutor,
  ): Promise<string> {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await llmProvider.chat({
        model: llm.model,
        messages: this.history,
        temperature: llm.temperature,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      });
      await this.recordLlmUsage(result.usage);

      if (!result.toolCalls?.length) {
        this.history.push({ role: "assistant", content: result.text });
        return result.text;
      }

      this.history.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });

      for (const call of result.toolCalls) {
        await this.executeToolCall(call, toolExecutor);
      }
    }

    const finalResult = await llmProvider.chat({ model: llm.model, messages: this.history, temperature: llm.temperature });
    await this.recordLlmUsage(finalResult.usage);
    const replyText = finalResult.text || "Non sono riuscito a completare l'azione richiesta.";
    this.history.push({ role: "assistant", content: replyText });
    return replyText;
  }

  private async executeToolCall(
    call: { id: string; name: string; arguments: Record<string, unknown> },
    toolExecutor: ToolExecutor,
  ): Promise<void> {
    const tool = toolExecutor.findTool(call.name);
    if (!tool) {
      this.history.push({
        role: "tool",
        content: JSON.stringify({ error: "unknown_tool" }),
        toolCallId: call.id,
        name: call.name,
      });
      return;
    }

    const logInput = {
      organizationId: this.agent.organizationId,
      agentId: this.agent.id,
      agentToolId: tool.agentToolId,
      conversationId: this.conversationId,
      toolName: call.name,
      arguments: call.arguments,
    };

    if (tool.requiresConfirmation) {
      await this.toolCallLog.recordPending(logInput);
      this.history.push({
        role: "tool",
        content: JSON.stringify({
          status: "pending_approval",
          message: "Questa azione richiede l'approvazione di un operatore prima di essere eseguita.",
        }),
        toolCallId: call.id,
        name: call.name,
      });
      return;
    }

    try {
      const output = await tool.execute(call.arguments);
      await this.toolCallLog.recordExecuted(logInput, output);
      this.history.push({ role: "tool", content: output, toolCallId: call.id, name: call.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : "tool_execution_failed";
      await this.toolCallLog.recordFailed(logInput, message);
      this.history.push({
        role: "tool",
        content: JSON.stringify({ error: message }),
        toolCallId: call.id,
        name: call.name,
      });
    }
  }
}
