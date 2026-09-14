-- Visual conversation flow (nodes/edges graph) an agent can follow instead
-- of a single free-form system prompt, for deterministic branching logic.
-- One flow per agent; disabling it (rather than deleting) falls back to
-- the agent's normal free-prompt behavior.

create table agent_flows (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references agents (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agent_flows_set_updated_at
  before update on agent_flows
  for each row execute function set_updated_at();

alter table agent_flows enable row level security;
create policy agent_flows_all on agent_flows
  for all using (is_org_member(organization_id));

-- Per-conversation flow execution state: which node the conversation is
-- currently paused at, and the variables extracted so far.
alter table conversations add column current_node_id text;
alter table conversations add column variables jsonb not null default '{}'::jsonb;
