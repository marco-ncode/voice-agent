"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useOrg } from "@/components/providers/OrgProvider";
import { AgentForm } from "@/components/AgentForm";
import type { Agent, AgentFormValues } from "@/lib/types";

export default function NewAgentPage() {
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  if (!selectedOrgId) {
    return <p className="text-sm text-gray-500">Seleziona prima un&apos;organizzazione.</p>;
  }

  async function handleSubmit(values: AgentFormValues) {
    const agent = await apiFetch<Agent>(`/v1/organizations/${selectedOrgId}/agents`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    router.push(`/agents/${agent.id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Nuovo agente</h1>
      <div className="mt-6">
        <AgentForm onSubmit={handleSubmit} submitLabel="Crea agente" />
      </div>
    </div>
  );
}
