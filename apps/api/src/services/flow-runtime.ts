import type {
  AgentFlow,
  ConditionBranch,
  FlowExecutionState,
  FlowNode,
} from "@v-agent/shared";
import type { LLMMessage, LLMProvider, LLMUsage, ToolDefinition } from "@v-agent/providers";
import type { ToolExecutor } from "./tools.js";
import type { ToolCallLog, ToolCallLogInput } from "./tool-call-log.js";

const MAX_STEPS_PER_TURN = 25;

export interface FlowStepOutcome {
  replyText: string;
  /** True once a transfer/end node is reached, or the flow can't proceed further. */
  ended: boolean;
}

export type UsageContext = Omit<ToolCallLogInput, "agentToolId" | "toolName" | "arguments">;

/**
 * Walks the agent's flow graph from wherever the conversation left off,
 * advancing through nodes that don't need user input (condition,
 * extract_variable, tool_call) and stopping at a message node that awaits
 * a reply, or a terminal transfer/end node. Deterministic by construction:
 * the LLM is only ever asked to produce free text (message nodes), extract
 * one value (extract_variable), or fill one tool's arguments (tool_call) —
 * it never decides *which* node runs next. That's entirely graph + variable
 * logic (evaluateBranch below).
 */
export class FlowRuntime {
  constructor(
    private readonly flow: AgentFlow,
    private readonly llmProvider: LLMProvider,
    private readonly llmModel: string,
    private readonly llmTemperature: number | undefined,
    private readonly history: LLMMessage[],
    private readonly state: FlowExecutionState,
    private readonly toolExecutor: ToolExecutor,
    private readonly toolCallLog: ToolCallLog,
    private readonly usageContext: UsageContext,
    private readonly recordLlmUsage: (usage: LLMUsage) => Promise<void>,
  ) {}

  async run(): Promise<FlowStepOutcome> {
    let nodeId = this.state.currentNodeId ?? this.flow.nodes.find((n) => n.kind === "start")?.id;
    if (!nodeId) {
      return { replyText: "Il flusso di questo agente non è configurato correttamente.", ended: true };
    }

    for (let step = 0; step < MAX_STEPS_PER_TURN; step++) {
      const node = this.nodeById(nodeId);
      if (!node) {
        this.state.currentNodeId = null;
        return { replyText: "Il flusso ha raggiunto uno stato non valido.", ended: true };
      }

      switch (node.kind) {
        case "start": {
          const next = this.nextNodeId(node.id);
          if (!next) return this.finish("Il flusso non ha nodi dopo l'inizio.");
          nodeId = next;
          continue;
        }

        case "message": {
          const replyText = await this.speak(node.data.instruction ?? "");
          const next = this.nextNodeId(node.id);
          const waits = node.data.waitForUserReply ?? true;
          if (waits || !next) {
            this.state.currentNodeId = next ?? null;
            return { replyText, ended: !next };
          }
          nodeId = next;
          continue;
        }

        case "extract_variable": {
          const value = await this.extractVariable(node);
          if (node.data.variable) this.state.variables[node.data.variable] = value;
          const next = this.nextNodeId(node.id);
          if (!next) return this.finish();
          nodeId = next;
          continue;
        }

        case "condition": {
          const next = this.evaluateCondition(node);
          if (!next) return this.finish();
          nodeId = next;
          continue;
        }

        case "tool_call": {
          const next = await this.runToolCallNode(node);
          if (!next) return this.finish();
          nodeId = next;
          continue;
        }

        case "transfer": {
          const replyText = node.data.message
            ? await this.speak(node.data.message)
            : "Ti sto trasferendo a un operatore.";
          this.state.currentNodeId = null;
          return { replyText, ended: true };
        }

        case "end": {
          const replyText = node.data.message ? await this.speak(node.data.message) : "";
          this.state.currentNodeId = null;
          return { replyText, ended: true };
        }
      }
    }

    this.state.currentNodeId = null;
    return { replyText: "Il flusso ha superato il numero massimo di passaggi consentiti.", ended: true };
  }

  private finish(replyText = ""): FlowStepOutcome {
    this.state.currentNodeId = null;
    return { replyText, ended: true };
  }

  private nodeById(id: string): FlowNode | undefined {
    return this.flow.nodes.find((n) => n.id === id);
  }

  private nextNodeId(fromNodeId: string, handle?: string): string | undefined {
    const edge = this.flow.edges.find(
      (e) => e.source === fromNodeId && (handle === undefined ? e.sourceHandle == null : e.sourceHandle === handle),
    );
    return edge?.target;
  }

  private async speak(instruction: string): Promise<string> {
    const messages: LLMMessage[] = [
      ...this.history,
      { role: "system", content: `Istruzione per questo turno: ${instruction}` },
    ];
    const result = await this.llmProvider.chat({
      model: this.llmModel,
      messages,
      temperature: this.llmTemperature,
    });
    await this.recordLlmUsage(result.usage);
    this.history.push({ role: "assistant", content: result.text });
    return result.text;
  }

  private async extractVariable(node: FlowNode): Promise<unknown> {
    const description = node.data.description ?? node.data.variable ?? "";
    const type = node.data.variableType ?? "string";
    const instruction =
      `Analizza la conversazione fin qui e determina: ${description}. ` +
      `Rispondi SOLO con un oggetto JSON nella forma {"found": true|false, "value": <valore come ${type}>}. ` +
      `Se non riesci a determinarlo con certezza, rispondi {"found": false, "value": null}.`;
    const messages: LLMMessage[] = [...this.history, { role: "system", content: instruction }];
    const result = await this.llmProvider.chat({ model: this.llmModel, messages, temperature: 0 });
    await this.recordLlmUsage(result.usage);
    return parseExtractionJson(result.text, type);
  }

  private evaluateCondition(node: FlowNode): string | undefined {
    for (const branch of node.data.branches ?? []) {
      if (evaluateBranch(branch, this.state.variables)) {
        return this.nextNodeId(node.id, branch.id);
      }
    }
    return this.nextNodeId(node.id, "default");
  }

  private async runToolCallNode(node: FlowNode): Promise<string | undefined> {
    const agentToolId = node.data.agentToolId;
    if (!agentToolId) return this.nextNodeId(node.id, "failure");

    const tool = this.toolExecutor.findToolByAgentToolId(agentToolId, node.data.toolName);
    if (!tool) return this.nextNodeId(node.id, "failure");

    const args = await this.fillToolArguments(tool.definition);
    const logInput: ToolCallLogInput = {
      ...this.usageContext,
      agentToolId: tool.agentToolId,
      toolName: tool.definition.name,
      arguments: args,
    };

    try {
      const output = await tool.execute(args);
      await this.toolCallLog.recordExecuted(logInput, output);
      this.history.push({
        role: "system",
        content: `Risultato dello strumento "${tool.definition.name}": ${output}`,
      });
      return this.nextNodeId(node.id, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "tool_execution_failed";
      await this.toolCallLog.recordFailed(logInput, message);
      return this.nextNodeId(node.id, "failure");
    }
  }

  private async fillToolArguments(definition: ToolDefinition): Promise<Record<string, unknown>> {
    const instruction =
      `Determina i parametri da passare allo strumento "${definition.name}" (${definition.description}) ` +
      `in base alla conversazione e alle variabili raccolte (${JSON.stringify(this.state.variables)}). ` +
      `Rispondi SOLO con un oggetto JSON valido conforme a questo schema: ${JSON.stringify(definition.parameters)}.`;
    const messages: LLMMessage[] = [...this.history, { role: "system", content: instruction }];
    const result = await this.llmProvider.chat({ model: this.llmModel, messages, temperature: 0 });
    await this.recordLlmUsage(result.usage);
    return parseJsonObject(result.text) ?? {};
  }
}

function evaluateBranch(branch: ConditionBranch, variables: Record<string, unknown>): boolean {
  const actual = variables[branch.variable];
  switch (branch.operator) {
    case "is_set":
      return actual !== undefined && actual !== null && actual !== "";
    case "is_not_set":
      return actual === undefined || actual === null || actual === "";
    case "equals":
      return String(actual) === String(branch.value);
    case "not_equals":
      return String(actual) !== String(branch.value);
    case "contains":
      return (
        typeof actual === "string" &&
        typeof branch.value === "string" &&
        actual.toLowerCase().includes(branch.value.toLowerCase())
      );
    case "gt":
      return Number(actual) > Number(branch.value);
    case "gte":
      return Number(actual) >= Number(branch.value);
    case "lt":
      return Number(actual) < Number(branch.value);
    case "lte":
      return Number(actual) <= Number(branch.value);
    default:
      return false;
  }
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[0]);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function parseExtractionJson(text: string, type: "string" | "number" | "boolean"): unknown {
  const parsed = parseJsonObject(text) as { found?: boolean; value?: unknown } | undefined;
  if (!parsed || !parsed.found) return undefined;
  if (type === "number") {
    const n = typeof parsed.value === "number" ? parsed.value : Number(parsed.value);
    return Number.isNaN(n) ? undefined : n;
  }
  if (type === "boolean") {
    return typeof parsed.value === "boolean" ? parsed.value : String(parsed.value).toLowerCase() === "true";
  }
  return parsed.value == null ? undefined : String(parsed.value);
}

export { evaluateBranch, parseExtractionJson, parseJsonObject };
