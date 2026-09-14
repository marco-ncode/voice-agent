create table agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  -- Shape validated at the application layer against
  -- @v-agent/shared's agentProviderConfigSchema.
  provider_config jsonb not null,
  rag_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_organization_id_idx on agents (organization_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agents_set_updated_at
  before update on agents
  for each row execute function set_updated_at();
