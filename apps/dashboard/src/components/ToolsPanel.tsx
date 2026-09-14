"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AgentTool, AgentToolKind } from "@/lib/types";

function parseJsonOr<T>(text: string, fallback: T): T {
  if (!text.trim()) return fallback;
  return JSON.parse(text) as T;
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function ToolsPanel({
  organizationId,
  agentId,
}: {
  organizationId: string;
  agentId: string;
}) {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<AgentToolKind>("mcp_server");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("POST");
  const [parametersSchemaText, setParametersSchemaText] = useState(
    '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
  );

  const basePath = `/v1/organizations/${organizationId}/agents/${agentId}/tools`;

  async function refresh() {
    setLoading(true);
    try {
      setTools(await apiFetch<AgentTool[]>(basePath));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, agentId]);

  function resetForm() {
    setName("");
    setDescription("");
    setRequiresConfirmation(false);
    setUrl("");
    setHeadersText("");
    setMethod("POST");
    setParametersSchemaText('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const headers = parseJsonOr<Record<string, string>>(headersText, {});
      const config =
        kind === "mcp_server"
          ? { url, headers: Object.keys(headers).length ? headers : undefined }
          : {
              method,
              url,
              headers: Object.keys(headers).length ? headers : undefined,
              parametersSchema: parseJsonOr(parametersSchemaText, { type: "object", properties: {} }),
            };

      await apiFetch(basePath, {
        method: "POST",
        body: JSON.stringify({ kind, name, description, requiresConfirmation, config }),
      });
      resetForm();
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore durante la creazione (controlla che gli header/schema siano JSON valido)",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleEnabled(tool: AgentTool) {
    await apiFetch(`${basePath}/${tool.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !tool.enabled }),
    });
    await refresh();
  }

  async function handleDelete(toolId: string) {
    if (!window.confirm("Rimuovere questo strumento dall'agente?")) return;
    await apiFetch(`${basePath}/${toolId}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-gray-500">
        Collega server MCP o API esterne che l&apos;agente può chiamare durante la
        conversazione per eseguire azioni (consultare un CRM, creare un ticket, ecc.).
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex gap-1 text-xs">
          {(["mcp_server", "custom_api"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 ${
                kind === k ? "bg-brand-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {k === "mcp_server" ? "Server MCP" : "API personalizzata"}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (es. crm, meteo)"
          required
          className={inputClass}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            kind === "custom_api"
              ? "Descrizione per l'LLM: quando e come usare questo strumento"
              : "Descrizione (opzionale)"
          }
          className={inputClass}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={kind === "mcp_server" ? "URL del server MCP (https://...)" : "URL dell'endpoint"}
          required
          className={inputClass}
        />

        {kind === "custom_api" && (
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className={inputClass}
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        <label className="block text-xs text-gray-500">
          Header HTTP (JSON, opzionale)
          <textarea
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
            rows={2}
            placeholder='{"Authorization": "Bearer ..."}'
            className={`${inputClass} mt-1 font-mono`}
          />
        </label>

        {kind === "custom_api" && (
          <label className="block text-xs text-gray-500">
            Schema parametri (JSON Schema, cosa deve fornire l&apos;LLM)
            <textarea
              value={parametersSchemaText}
              onChange={(e) => setParametersSchemaText(e.target.value)}
              rows={5}
              className={`${inputClass} mt-1 font-mono`}
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={requiresConfirmation}
            onChange={(e) => setRequiresConfirmation(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Richiede approvazione umana prima dell&apos;esecuzione
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? "Salvataggio..." : "Aggiungi strumento"}
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Caricamento...</p>
        ) : tools.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuno strumento configurato.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tools.map((tool) => (
              <li key={tool.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{tool.name}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {tool.kind === "mcp_server" ? "MCP" : "API"}
                    </span>
                    {tool.requires_confirmation && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        richiede approvazione
                      </span>
                    )}
                    {!tool.enabled && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400">disattivato</span>
                    )}
                  </div>
                  {tool.description && (
                    <div className="mt-1 text-xs text-gray-500">{tool.description}</div>
                  )}
                </div>
                <div className="flex gap-3 text-sm">
                  <button onClick={() => handleToggleEnabled(tool)} className="text-gray-500 hover:underline">
                    {tool.enabled ? "Disattiva" : "Attiva"}
                  </button>
                  <button onClick={() => handleDelete(tool.id)} className="text-red-600 hover:underline">
                    Rimuovi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
