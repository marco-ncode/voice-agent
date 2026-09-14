export type ConversationChannel = "web" | "phone" | "api";
export type ConversationStatus = "active" | "completed" | "failed";

export interface Conversation {
  id: string;
  organizationId: string;
  agentId: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  startedAt: string;
  endedAt: string | null;
  metadata: Record<string, unknown>;
}

export type ConversationTurnRole = "user" | "agent" | "tool";

export interface ConversationTurn {
  id: string;
  conversationId: string;
  role: ConversationTurnRole;
  text: string;
  audioUrl: string | null;
  createdAt: string;
}
