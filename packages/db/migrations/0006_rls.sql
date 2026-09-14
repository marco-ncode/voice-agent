-- Row Level Security: every tenant-scoped table is only visible to members
-- of the owning organization. The apps/api service uses the service-role
-- key (bypasses RLS) and enforces organization scoping in application code;
-- these policies protect any direct Supabase client access (e.g. from the
-- dashboard using the user's own session).

create or replace function is_org_member(p_organization_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
  );
$$;

alter table organizations enable row level security;
create policy organizations_select on organizations
  for select using (is_org_member(id));

alter table organization_members enable row level security;
create policy organization_members_select on organization_members
  for select using (is_org_member(organization_id));

alter table api_keys enable row level security;
create policy api_keys_all on api_keys
  for all using (is_org_member(organization_id));

alter table agents enable row level security;
create policy agents_all on agents
  for all using (is_org_member(organization_id));

alter table conversations enable row level security;
create policy conversations_all on conversations
  for all using (is_org_member(organization_id));

alter table conversation_turns enable row level security;
create policy conversation_turns_all on conversation_turns
  for all using (
    exists (
      select 1 from conversations c
      where c.id = conversation_turns.conversation_id
        and is_org_member(c.organization_id)
    )
  );

alter table agent_documents enable row level security;
create policy agent_documents_all on agent_documents
  for all using (is_org_member(organization_id));

alter table agent_document_chunks enable row level security;
create policy agent_document_chunks_all on agent_document_chunks
  for all using (is_org_member(organization_id));

alter table usage_events enable row level security;
create policy usage_events_select on usage_events
  for select using (is_org_member(organization_id));
