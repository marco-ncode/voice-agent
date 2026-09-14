"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOrg } from "@/components/providers/OrgProvider";
import type { ToolCallRequest } from "@/lib/types";

export default function ApprovalsPage() {
  const { selectedOrgId } = useOrg();
  const [requests, setRequests] = useState<ToolCallRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const basePath = `/v1/organizations/${selectedOrgId}/tool-call-requests`;

  async function refresh() {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const query = showAll ? "" : "?status=pending";
      setRequests(await apiFetch<ToolCallRequest[]>(`${basePath}${query}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, showAll]);

  async function handleDecision(id: string, decision: "approve" | "reject") {
    await apiFetch(`${basePath}/${id}/${decision}`, { method: "POST" });
    await refresh();
  }

  if (!selectedOrgId) {
    return <p className="text-sm text-gray-500">Seleziona prima un&apos;organizzazione.</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Approvazioni</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Mostra anche le decise
        </label>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Chiamate a strumenti configurati con &quot;richiede approvazione&quot;: l&apos;agente le ha
        messe in coda invece di eseguirle. Approvarle le esegue subito, ma non riprende la
        chiamata/conversazione originale — l&apos;agente aveva già risposto che serviva
        un&apos;approvazione.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Caricamento...</p>
        ) : requests.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuna richiesta in attesa.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {requests.map((req) => (
              <li key={req.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{req.tool_name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      agente: {req.agents?.name ?? req.agent_id}
                    </span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      req.status === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : req.status === "executed"
                          ? "bg-green-50 text-green-700"
                          : req.status === "rejected"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-red-50 text-red-700"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                  {JSON.stringify(req.arguments, null, 2)}
                </pre>
                {req.result != null && (
                  <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-500">
                    {JSON.stringify(req.result, null, 2)}
                  </pre>
                )}
                {req.status === "pending" && (
                  <div className="mt-2 flex gap-3 text-sm">
                    <button
                      onClick={() => handleDecision(req.id, "approve")}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
                    >
                      Approva ed esegui
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, "reject")}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                    >
                      Rifiuta
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
