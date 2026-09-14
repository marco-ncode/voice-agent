-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Organizations (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Membership, backed by Supabase Auth users
create table organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')) default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx on organization_members (user_id);

-- API keys used by external systems (SIP gateways, CRMs, ...) to call V Agent's public API
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  hashed_key text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index api_keys_organization_id_idx on api_keys (organization_id);
