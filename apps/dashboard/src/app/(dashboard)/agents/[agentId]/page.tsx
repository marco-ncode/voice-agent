"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useOrg } from "@/components/providers/OrgProvider";
import { AgentForm } from "@/components/AgentForm";
import { PlaygroundChat } from "@/components/PlaygroundChat";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ToolsPanel } from "@/components/ToolsPanel";
import type { Agent, AgentFormValues } from "@/lib/types";

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedOrgId } = useOrg();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tab, setTab] = useState<"config" | "playground" | "documents" | "tools">("playground");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    apiFetch<Agent>(`/v1/organizations/${selectedOrgId}/agents/${agentId}`)
      .then(setAgent)
      .finally(() => setLoading(false));
  }, [selectedOrgId, agentId]);

  if (!selectedOrgId) return null;
  if (loading) return <p className="text-sm text-gray-500">Caricamento...</p>;
  if (!agent) return <p className="text-sm text-red-600">Agente non trovato.</p>;

  async function handleUpdate(values: AgentFormValues) {
    const updated = await apiFetch<Agent>(
      `/v1/organizations/${selectedOrgId}/agents/${agentId}`,
      { method: "PATCH", body: JSON.stringify(values) },
    );
    setAgent(updated);
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminare l'agente "${agent!.name}"? L'azione non è reversibile.`)) {
      return;
    }
    await apiFetch(`/v1/organizations/${selectedOrgId}/agents/${agentId}`, { method: "DELETE" });
    router.push("/agents");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{agent.name}</h1>
        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
          Elimina agente
        </button>
      </div>

      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {(
          [
            ["playground", "Playground"],
            ["documents", "Documenti"],
            ["tools", "Strumenti"],
            ["config", "Configurazione"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "playground" && (
          <PlaygroundChat organizationId={selectedOrgId} agentId={agent.id} />
        )}
        {tab === "documents" && (
          <DocumentsPanel
            organizationId={selectedOrgId}
            agentId={agent.id}
            ragEnabled={agent.rag_enabled}
          />
        )}
        {tab === "tools" && <ToolsPanel organizationId={selectedOrgId} agentId={agent.id} />}
        {tab === "config" && (
          <AgentForm
            organizationId={selectedOrgId}
            initialAgent={agent}
            onSubmit={handleUpdate}
            submitLabel="Salva modifiche"
          />
        )}
      </div>
    </div>
  );
}
