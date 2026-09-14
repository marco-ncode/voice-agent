create table usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  agent_id uuid not null references agents (id) on delete cascade,
  conversation_id uuid references conversations (id) on delete set null,
  kind text not null check (kind in ('llm', 'stt', 'tts')),
  provider text not null,
  model text,
  unit text not null check (unit in ('tokens', 'audio_seconds')),
  quantity numeric not null,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create index usage_events_organization_id_idx on usage_events (organization_id);
create index usage_events_agent_id_idx on usage_events (agent_id);
create index usage_events_created_at_idx on usage_events (created_at);
