"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ConditionBranch, FlowNodeData, FlowNodeKind } from "@/lib/types";

export type FlowNodeViewData = FlowNodeData & { kind: FlowNodeKind; [key: string]: unknown };
export type FlowNodeViewType = Node<FlowNodeViewData, "flowNode">;

const KIND_META: Record<FlowNodeKind, { label: string; color: string }> = {
  start: { label: "Inizio", color: "border-gray-400 bg-gray-50" },
  message: { label: "Messaggio", color: "border-blue-400 bg-blue-50" },
  condition: { label: "Condizione (IF/SWITCH)", color: "border-amber-400 bg-amber-50" },
  extract_variable: { label: "Estrazione variabile", color: "border-purple-400 bg-purple-50" },
  tool_call: { label: "Chiamata a strumento", color: "border-teal-400 bg-teal-50" },
  transfer: { label: "Trasferimento a operatore", color: "border-rose-400 bg-rose-50" },
  end: { label: "Fine", color: "border-gray-500 bg-gray-100" },
};

function summarize(data: FlowNodeViewData): string {
  switch (data.kind) {
    case "message":
      return data.instruction || "(nessuna istruzione)";
    case "extract_variable":
      return data.variable ? `→ ${data.variable}` : "(nessuna variabile)";
    case "condition":
      return `${data.branches?.length ?? 0} ramo/i`;
    case "tool_call":
      return data.toolName || (data.agentToolId ? "strumento selezionato" : "(nessuno strumento)");
    case "transfer":
    case "end":
      return data.message || "";
    default:
      return "";
  }
}

/** Bottom source handles: one per condition branch + "default" (else), or "success"/"failure" for tool_call. */
function sourceHandles(data: FlowNodeViewData): Array<{ id?: string; label: string }> {
  if (data.kind === "condition") {
    const branches: ConditionBranch[] = data.branches ?? [];
    return [...branches.map((b) => ({ id: b.id, label: b.label || b.id })), { id: "default", label: "else" }];
  }
  if (data.kind === "tool_call") {
    return [
      { id: "success", label: "successo" },
      { id: "failure", label: "fallito" },
    ];
  }
  if (data.kind === "transfer" || data.kind === "end") return [];
  return [{ id: undefined, label: "" }];
}

export function FlowNodeView({ data, selected }: NodeProps<FlowNodeViewType>) {
  const meta = KIND_META[data.kind];
  const handles = sourceHandles(data);

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-lg border-2 px-3 py-2 shadow-sm ${meta.color} ${
        selected ? "ring-2 ring-brand-500" : ""
      }`}
    >
      {data.kind !== "start" && <Handle type="target" position={Position.Top} />}
      <div className="text-xs font-semibold text-gray-700">{meta.label}</div>
      <div className="mt-1 truncate text-xs text-gray-600">{summarize(data)}</div>

      {handles.length === 1 ? (
        <Handle type="source" position={Position.Bottom} id={handles[0].id} />
      ) : (
        <div className="mt-2 flex justify-between gap-1">
          {handles.map((h, i) => (
            <div key={h.id ?? i} className="relative flex-1 text-center">
              <span className="text-[10px] text-gray-500">{h.label}</span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={h.id}
                style={{ position: "absolute", left: "50%", bottom: -14 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
