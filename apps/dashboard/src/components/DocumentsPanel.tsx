"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AgentDocument } from "@/lib/types";

export function DocumentsPanel({
  organizationId,
  agentId,
  ragEnabled,
}: {
  organizationId: string;
  agentId: string;
  ragEnabled: boolean;
}) {
  const [documents, setDocuments] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const basePath = `/v1/organizations/${organizationId}/agents/${agentId}/documents`;

  async function refresh() {
    setLoading(true);
    try {
      setDocuments(await apiFetch<AgentDocument[]>(basePath));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, agentId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title.trim()) setTitle(file.name);
    setContent(await file.text());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(basePath, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      setTitle("");
      setContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!window.confirm("Rimuovere questo documento dalla base di conoscenza?")) return;
    await apiFetch(`${basePath}/${documentId}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      {!ragEnabled && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Il RAG è disattivato per questo agente: i documenti caricati qui non verranno usati
          nelle risposte finché non lo abiliti nella scheda Configurazione.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-5"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Aggiungi documento
        </h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo documento"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Incolla qui il testo, oppure carica un file .txt/.md qui sotto"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={handleFileChange}
            className="text-sm text-gray-500"
          />
          <button
            type="submit"
            disabled={submitting || !title.trim() || !content.trim()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Caricamento..." : "Carica"}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Solo testo semplice per ora (.txt, .md o incolla direttamente). PDF e altri formati
          non sono ancora supportati.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Caricamento...</p>
        ) : documents.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessun documento caricato.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                  <div className="text-xs text-gray-500">
                    {doc.chunkCount} chunk ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString("it-IT")}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
