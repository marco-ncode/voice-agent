"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AgentDocument } from "@/lib/types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  const [mode, setMode] = useState<"paste" | "file">("file");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ""));
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (mode === "paste" && !content.trim()) return;
    if (mode === "file" && !file) return;

    setSubmitting(true);
    setError(null);
    try {
      const body =
        mode === "paste"
          ? { title: title.trim(), content: content.trim() }
          : {
              title: title.trim(),
              fileBase64: await fileToBase64(file!),
              fileName: file!.name,
              mimeType: file!.type || "application/octet-stream",
            };

      await apiFetch(basePath, { method: "POST", body: JSON.stringify(body) });
      resetForm();
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Aggiungi documento
          </h3>
          <div className="flex rounded-md border border-gray-300 text-xs">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`rounded-l-md px-3 py-1.5 ${
                mode === "file" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Carica file
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`rounded-r-md border-l border-gray-300 px-3 py-1.5 ${
                mode === "paste" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Incolla testo
            </button>
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo documento"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        {mode === "file" ? (
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500"
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Incolla qui il testo del documento"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {mode === "file"
              ? "Formati supportati: PDF, Word (.docx), .txt, .md — max 10MB."
              : "Il testo verrà suddiviso in blocchi e indicizzato per la ricerca semantica."}
          </p>
          <button
            type="submit"
            disabled={submitting || !title.trim() || (mode === "file" ? !file : !content.trim())}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Caricamento..." : "Carica"}
          </button>
        </div>
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
