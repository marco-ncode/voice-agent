"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MicRecorder } from "@/lib/audio";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FlowState {
  currentNodeId: string | null;
  variables: Record<string, unknown>;
}

interface PlaygroundTurnResponse {
  transcript: string;
  replyText: string;
  audioBase64: string;
  audioMimeType: string;
  flowState: FlowState;
}

export function PlaygroundChat({
  organizationId,
  agentId,
}: {
  organizationId: string;
  agentId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [flowState, setFlowState] = useState<FlowState>({ currentNodeId: null, variables: {} });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function sendTurn(payload: { text?: string; audioBase64?: string }) {
    setSending(true);
    setError(null);
    try {
      const result = await apiFetch<PlaygroundTurnResponse>(
        `/v1/organizations/${organizationId}/agents/${agentId}/playground/turn`,
        {
          method: "POST",
          body: JSON.stringify({ ...payload, history: messages, flowState }),
        },
      );

      setMessages((prev) => [
        ...prev,
        { role: "user", content: payload.text ?? result.transcript },
        { role: "assistant", content: result.replyText },
      ]);
      setFlowState(result.flowState);

      if (audioRef.current) {
        audioRef.current.src = `data:${result.audioMimeType};base64,${result.audioBase64}`;
        void audioRef.current.play();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la conversazione");
    } finally {
      setSending(false);
    }
  }

  async function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const value = text.trim();
    setText("");
    await sendTurn({ text: value });
  }

  async function handleToggleRecording() {
    if (recording) {
      const recorder = recorderRef.current;
      setRecording(false);
      if (!recorder) return;
      const audioBase64 = recorder.stop();
      await sendTurn({ audioBase64 });
      return;
    }

    try {
      const recorder = new MicRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setError(null);
    } catch {
      setError("Impossibile accedere al microfono. Controlla i permessi del browser.");
    }
  }

  return (
    <div className="flex max-w-2xl flex-col rounded-lg border border-gray-200 bg-white">
      <div className="flex h-96 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">
            Scrivi un messaggio o usa il microfono per testare l&apos;agente.
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              message.role === "user"
                ? "self-end bg-brand-600 text-white"
                : "self-start bg-gray-100 text-gray-900"
            }`}
          >
            {message.content}
          </div>
        ))}
        {sending && <p className="self-start text-sm text-gray-400">L&apos;agente sta rispondendo...</p>}
      </div>

      {error && <p className="px-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSendText} className="flex items-center gap-2 border-t border-gray-200 p-3">
        <button
          type="button"
          onClick={handleToggleRecording}
          disabled={sending}
          className={`shrink-0 rounded-full p-2.5 text-white disabled:opacity-50 ${
            recording ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-800"
          }`}
          title={recording ? "Ferma registrazione e invia" : "Registra un messaggio vocale"}
        >
          {recording ? "■" : "🎙"}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending || recording}
          placeholder="Scrivi un messaggio..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={sending || recording || !text.trim()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Invia
        </button>
      </form>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
