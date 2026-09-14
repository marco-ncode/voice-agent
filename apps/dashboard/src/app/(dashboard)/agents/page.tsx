"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useOrg } from "@/components/providers/OrgProvider";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const { selectedOrgId } = useOrg();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrgId) {
      setAgents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<Agent[]>(`/v1/organizations/${selectedOrgId}/agents`)
      .then(setAgents)
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (!selectedOrgId) {
    return (
      <p className="text-sm text-gray-500">
        Crea o seleziona un&apos;organizzazione dalla barra laterale per iniziare.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agenti</h1>
        <Link
          href="/agents/new"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Nuovo agente
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Caricamento...</p>
      ) : agents.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          Nessun agente ancora creato in questa organizzazione.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <li key={agent.id}>
              <Link
                href={`/agents/${agent.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-500 hover:shadow-sm"
              >
                <div className="font-medium text-gray-900">{agent.name}</div>
                {agent.description && (
                  <div className="mt-1 text-sm text-gray-500">{agent.description}</div>
                )}
                <div className="mt-3 flex gap-2 text-xs text-gray-400">
                  <span className="rounded bg-gray-100 px-2 py-0.5">
                    {agent.provider_config.llm.provider}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5">
                    {agent.provider_config.tts.provider}
                  </span>
                  {agent.rag_enabled && (
                    <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-700">RAG</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
