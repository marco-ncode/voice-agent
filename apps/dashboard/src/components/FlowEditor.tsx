"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "@/lib/api";
import { FlowNodeView, type FlowNodeViewType } from "@/components/FlowNodeView";
import type {
  AgentFlow,
  AgentTool,
  ConditionBranch,
  ConditionOperator,
  FlowNodeKind,
} from "@/lib/types";

const nodeTypes: NodeTypes = { flowNode: FlowNodeView };

const NODE_KIND_OPTIONS: Array<{ kind: FlowNodeKind; label: string }> = [
  { kind: "message", label: "+ Messaggio" },
  { kind: "condition", label: "+ Condizione IF/SWITCH" },
  { kind: "extract_variable", label: "+ Estrazione variabile" },
  { kind: "tool_call", label: "+ Chiamata a strumento" },
  { kind: "transfer", label: "+ Trasferimento operatore" },
  { kind: "end", label: "+ Fine" },
];

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "è uguale a",
  not_equals: "non è uguale a",
  contains: "contiene",
  gt: "è maggiore di",
  gte: "è maggiore o uguale a",
  lt: "è minore di",
  lte: "è minore o uguale a",
  is_set: "è impostata",
  is_not_set: "non è impostata",
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function emptyStartNode(): FlowNodeViewType {
  return { id: "start", type: "flowNode", position: { x: 250, y: 20 }, data: { kind: "start" } };
}

function toFlowNodes(flow: AgentFlow | null): FlowNodeViewType[] {
  if (!flow || flow.nodes.length === 0) return [emptyStartNode()];
  return flow.nodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position,
    data: { kind: n.kind, ...n.data },
  }));
}

function toFlowEdges(flow: AgentFlow | null): Edge[] {
  if (!flow) return [];
  return flow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle }));
}

export function FlowEditor({ organizationId, agentId }: { organizationId: string; agentId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeViewType>([emptyStartNode()]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [enabled, setEnabled] = useState(true);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const flowPath = `/v1/organizations/${organizationId}/agents/${agentId}/flow`;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<AgentFlow | null>(flowPath),
      apiFetch<AgentTool[]>(`/v1/organizations/${organizationId}/agents/${agentId}/tools`),
    ])
      .then(([flow, agentTools]) => {
        setNodes(toFlowNodes(flow));
        setEdges(toFlowEdges(flow));
        setEnabled(flow?.enabled ?? true);
        setTools(agentTools);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, agentId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  function addNode(kind: FlowNodeKind) {
    const id = `${kind}_${Math.random().toString(36).slice(2, 9)}`;
    const data = kind === "condition" ? { kind, branches: [] } : { kind };
    setNodes((nds) => [
      ...nds,
      { id, type: "flowNode", position: { x: 100 + nds.length * 40, y: 120 + nds.length * 60 }, data },
    ]);
    setSelectedId(id);
  }

  function deleteSelected() {
    if (!selectedId || selectedId === "start") return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  function updateSelectedData(patch: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: AgentFlow = {
        enabled,
        nodes: nodes.map((n) => {
          const { kind, ...data } = n.data;
          return { id: n.id, kind, position: n.position, data };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
        })),
      };
      await apiFetch(flowPath, { method: "PUT", body: JSON.stringify(body) });
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Caricamento...</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Costruisci un flusso deterministico per questo agente: i nodi condizione valutano solo
        variabili strutturate (mai l&apos;LLM), quindi il percorso della conversazione è sempre
        prevedibile. Se il flusso è disattivato o vuoto, l&apos;agente usa il prompt libero
        configurato in &quot;Configurazione&quot;.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {NODE_KIND_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              onClick={() => addNode(opt.kind)}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Flusso attivo
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva flusso"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && !error && <p className="text-sm text-green-700">Flusso salvato.</p>}

      <div className="flex gap-3">
        <div className="h-[520px] flex-1 rounded-lg border border-gray-200 bg-white">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <div className="w-72 shrink-0 rounded-lg border border-gray-200 bg-white p-4">
          {!selectedNode ? (
            <p className="text-sm text-gray-400">Seleziona un nodo per modificarlo.</p>
          ) : (
            <NodePropertyPanel
              node={selectedNode}
              tools={tools}
              onChange={updateSelectedData}
              onDelete={deleteSelected}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NodePropertyPanel({
  node,
  tools,
  onChange,
  onDelete,
}: {
  node: FlowNodeViewType;
  tools: AgentTool[];
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const { kind } = node.data;

  function addBranch() {
    const branches: ConditionBranch[] = node.data.branches ?? [];
    onChange({
      branches: [
        ...branches,
        { id: `b_${Math.random().toString(36).slice(2, 8)}`, label: "", variable: "", operator: "equals" },
      ],
    });
  }

  function updateBranch(index: number, patch: Partial<ConditionBranch>) {
    const branches = [...(node.data.branches ?? [])];
    branches[index] = { ...branches[index], ...patch };
    onChange({ branches });
  }

  function removeBranch(index: number) {
    const branches = [...(node.data.branches ?? [])];
    branches.splice(index, 1);
    onChange({ branches });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-500">{kind}</span>
        {node.id !== "start" && (
          <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:underline">
            Elimina nodo
          </button>
        )}
      </div>

      {kind === "start" && <p className="text-xs text-gray-400">Punto di ingresso del flusso.</p>}

      {kind === "message" && (
        <>
          <label className="block text-xs text-gray-500">
            Istruzione per l&apos;LLM (cosa deve dire in questo punto)
            <textarea
              value={node.data.instruction ?? ""}
              onChange={(e) => onChange({ instruction: e.target.value })}
              rows={4}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={node.data.waitForUserReply ?? true}
              onChange={(e) => onChange({ waitForUserReply: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Attendi la risposta dell&apos;utente prima di continuare
          </label>
        </>
      )}

      {kind === "extract_variable" && (
        <>
          <label className="block text-xs text-gray-500">
            Nome variabile
            <input
              value={node.data.variable ?? ""}
              onChange={(e) => onChange({ variable: e.target.value })}
              placeholder="es. email_cliente"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Cosa estrarre (descrizione per l&apos;LLM)
            <textarea
              value={node.data.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Tipo
            <select
              value={node.data.variableType ?? "string"}
              onChange={(e) => onChange({ variableType: e.target.value })}
              className={`${inputClass} mt-1`}
            >
              <option value="string">Testo</option>
              <option value="number">Numero</option>
              <option value="boolean">Booleano</option>
            </select>
          </label>
        </>
      )}

      {kind === "condition" && (
        <div className="space-y-2">
          {(node.data.branches ?? []).map((branch, i) => (
            <div key={branch.id} className="space-y-1 rounded border border-gray-200 p-2">
              <input
                value={branch.label}
                onChange={(e) => updateBranch(i, { label: e.target.value })}
                placeholder="Etichetta ramo"
                className={inputClass}
              />
              <input
                value={branch.variable}
                onChange={(e) => updateBranch(i, { variable: e.target.value })}
                placeholder="Nome variabile"
                className={inputClass}
              />
              <select
                value={branch.operator}
                onChange={(e) => updateBranch(i, { operator: e.target.value as ConditionOperator })}
                className={inputClass}
              >
                {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                  <option key={op} value={op}>
                    {label}
                  </option>
                ))}
              </select>
              {branch.operator !== "is_set" && branch.operator !== "is_not_set" && (
                <input
                  value={String(branch.value ?? "")}
                  onChange={(e) => updateBranch(i, { value: e.target.value })}
                  placeholder="Valore di confronto"
                  className={inputClass}
                />
              )}
              <button
                type="button"
                onClick={() => removeBranch(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Rimuovi ramo
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addBranch}
            className="w-full rounded-md border border-gray-300 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            + Aggiungi ramo
          </button>
          <p className="text-xs text-gray-400">
            I rami sono valutati in ordine; collega l&apos;handle &quot;else&quot; al nodo da
            eseguire se nessuno corrisponde.
          </p>
        </div>
      )}

      {kind === "tool_call" && (
        <>
          <label className="block text-xs text-gray-500">
            Strumento
            <select
              value={node.data.agentToolId ?? ""}
              onChange={(e) => onChange({ agentToolId: e.target.value })}
              className={`${inputClass} mt-1`}
            >
              <option value="">-- seleziona --</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-500">
            Nome funzione sul server (solo se il server MCP espone più
            strumenti, opzionale)
            <input
              value={node.data.toolName ?? ""}
              onChange={(e) => onChange({ toolName: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <p className="text-xs text-gray-400">
            Collega gli handle &quot;successo&quot; e &quot;fallito&quot; ai nodi successivi.
          </p>
        </>
      )}

      {(kind === "transfer" || kind === "end") && (
        <>
          <label className="block text-xs text-gray-500">
            Messaggio finale (opzionale)
            <textarea
              value={node.data.message ?? ""}
              onChange={(e) => onChange({ message: e.target.value })}
              rows={3}
              className={`${inputClass} mt-1`}
            />
          </label>
          {kind === "transfer" && (
            <label className="block text-xs text-gray-500">
              Destinazione (informativo, es. reparto/numero)
              <input
                value={node.data.destination ?? ""}
                onChange={(e) => onChange({ destination: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}
