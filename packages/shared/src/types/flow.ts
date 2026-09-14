export type FlowNodeKind =
  | "start"
  | "message"
  | "condition"
  | "extract_variable"
  | "tool_call"
  | "transfer"
  | "end";

export interface FlowPosition {
  x: number;
  y: number;
}

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_set"
  | "is_not_set";

export interface ConditionBranch {
  id: string;
  label: string;
  variable: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
}

/**
 * Flat optional-field bag rather than a discriminated union so the editor
 * (which mirrors react-flow's own generic `data: T` node shape) can render
 * one property panel keyed off `kind` without a big type-narrowing dance.
 * Which fields apply depends on the node's `kind`:
 *   message           -> instruction, waitForUserReply
 *   condition          -> branches (evaluated in order; "default" edge handle for no-match)
 *   extract_variable   -> variable, description, variableType
 *   tool_call          -> agentToolId, toolName (edges use "success" / "failure" handles)
 *   transfer / end     -> message, destination (transfer only)
 */
export interface FlowNodeData {
  instruction?: string;
  waitForUserReply?: boolean;
  branches?: ConditionBranch[];
  variable?: string;
  description?: string;
  variableType?: "string" | "number" | "boolean";
  agentToolId?: string;
  toolName?: string;
  message?: string;
  destination?: string;
}

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  position: FlowPosition;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  /** Branch id for condition nodes ("default" for the else edge), "success"/"failure" for tool_call, otherwise omitted. */
  sourceHandle?: string;
  target: string;
}

export interface AgentFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  enabled: boolean;
}

export interface FlowExecutionState {
  currentNodeId: string | null;
  variables: Record<string, unknown>;
}
