-- Tools an agent can invoke mid-conversation: either a remote MCP server
-- (tools discovered live at call time) or a directly-defined custom HTTP API
-- tool. requires_confirmation gates whether the tool executes immediately
-- or is queued in tool_call_requests for a human to approve.

create table agent_tools (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text not null default '',
  kind text not null check (kind in ('mcp_server', 'custom_api')),
  enabled boolean not null default true,
  requires_confirmation boolean not null default false,
  -- mcp_server: { url: string, headers?: Record<string,string> }
  -- custom_api:  { method: string, url: string, headers?: Record<string,string>, parametersSchema: JsonSchema }
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_tools_agent_id_idx on agent_tools (agent_id);

create trigger agent_tools_set_updated_at
  before update on agent_tools
  for each row execute function set_updated_at();

alter table agent_tools enable row level security;
create policy agent_tools_all on agent_tools
  for all using (is_org_member(organization_id));

-- Pending/decided tool invocations that required human confirmation.
-- Approving here executes the tool and records the result, but (current
-- limitation) does not resume the live voice call that requested it — the
-- agent already told the caller the action needs approval and moved on.
create table tool_call_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  agent_id uuid not null references agents (id) on delete cascade,
  agent_tool_id uuid not null references agent_tools (id) on delete cascade,
  conversation_id uuid references conversations (id) on delete set null,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')) default 'pending',
  result jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id)
);

create index tool_call_requests_organization_id_idx on tool_call_requests (organization_id);
create index tool_call_requests_status_idx on tool_call_requests (status);

alter table tool_call_requests enable row level security;
create policy tool_call_requests_all on tool_call_requests
  for all using (is_org_member(organization_id));
