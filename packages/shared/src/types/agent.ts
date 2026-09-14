import type { AgentProviderConfig } from "./provider.js";

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  providerConfig: AgentProviderConfig;
  ragEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}

export interface ApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  createdAt: string;
  revokedAt: string | null;
}
