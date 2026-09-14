create table conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  agent_id uuid not null references agents (id) on delete cascade,
  channel text not null check (channel in ('web', 'phone', 'api')),
  status text not null check (status in ('active', 'completed', 'failed')) default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index conversations_organization_id_idx on conversations (organization_id);
create index conversations_agent_id_idx on conversations (agent_id);

create table conversation_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role text not null check (role in ('user', 'agent', 'tool')),
  text text not null,
  audio_url text,
  created_at timestamptz not null default now()
);

create index conversation_turns_conversation_id_idx on conversation_turns (conversation_id);
