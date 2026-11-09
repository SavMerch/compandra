-- Authorization helpers and Row Level Security for every user-accessible table.
-- Helpers are SECURITY DEFINER so policies can read membership tables without recursion.

create function public.workspace_role(p_workspace uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from workspace_members where workspace_id = p_workspace and user_id = auth.uid()
$$;

create function public.event_role(p_event uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when wm.role = 'owner' then 'owner'
    when em.role is not null then em.role
    when e.visibility = 'workspace' and wm.role <> 'guest' then wm.role
    else null end
  from events e
  left join workspace_members wm on wm.workspace_id = e.workspace_id and wm.user_id = auth.uid()
  left join event_members em on em.event_id = e.id and em.user_id = auth.uid()
  where e.id = p_event
$$;

create function public.can_view_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.event_role(p_event) is not null
$$;

create function public.can_edit_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.event_role(p_event) in ('owner','editor'), false)
$$;

create function public.shares_workspace(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from workspace_members a join workspace_members b using (workspace_id)
    where a.user_id = auth.uid() and b.user_id = p_user
  ) or exists (
    select 1 from event_members a join event_members b using (event_id)
    where a.user_id = auth.uid() and b.user_id = p_user
  )
$$;

-- profiles
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces (created through create_workspace RPC)
alter table public.workspaces enable row level security;
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.workspace_role(id) is not null);
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.workspace_role(id) = 'owner') with check (public.workspace_role(id) = 'owner');
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.workspace_role(id) = 'owner');

-- workspace_members
alter table public.workspace_members enable row level security;
create policy wm_select on public.workspace_members for select to authenticated
  using (public.workspace_role(workspace_id) is not null);
create policy wm_update on public.workspace_members for update to authenticated
  using (public.workspace_role(workspace_id) = 'owner') with check (public.workspace_role(workspace_id) = 'owner');
create policy wm_delete on public.workspace_members for delete to authenticated
  using (public.workspace_role(workspace_id) = 'owner' or user_id = auth.uid());

-- invitations: tokens are never selectable by clients beyond the row owner role; hash only.
alter table public.workspace_invitations enable row level security;
create policy wi_select on public.workspace_invitations for select to authenticated
  using (public.workspace_role(workspace_id) = 'owner'
         or (event_id is not null and public.can_edit_event(event_id)));
create policy wi_update on public.workspace_invitations for update to authenticated
  using (public.workspace_role(workspace_id) = 'owner'
         or (event_id is not null and public.can_edit_event(event_id)))
  with check (public.workspace_role(workspace_id) = 'owner'
         or (event_id is not null and public.can_edit_event(event_id)));

-- events (created through create_event RPC so creator membership is atomic)
alter table public.events enable row level security;
create policy events_select on public.events for select to authenticated
  using (public.can_view_event(id));
create policy events_update on public.events for update to authenticated
  using (public.can_edit_event(id)) with check (public.can_edit_event(id));
create policy events_delete on public.events for delete to authenticated
  using (public.workspace_role(workspace_id) = 'owner');

-- Standard event-scoped tables: anyone with access reads; editors write.
do $$
declare t text;
begin
  foreach t in array array[
    'event_members','event_participants','event_days','itinerary_items','activity_participants',
    'travel_segments','travel_segment_travelers','accommodations','accommodation_guests',
    'competition_sessions','competition_session_participants','packing_lists','notes','documents'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.can_view_event(event_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.can_edit_event(event_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.can_edit_event(event_id)) with check (public.can_edit_event(event_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.can_edit_event(event_id))', t);
  end loop;
end $$;

-- packing_items: viewers can tick unassigned items and their own.
alter table public.packing_items enable row level security;
create policy pi_select on public.packing_items for select to authenticated using (public.can_view_event(event_id));
create policy pi_insert on public.packing_items for insert to authenticated with check (public.can_edit_event(event_id));
create policy pi_delete on public.packing_items for delete to authenticated using (public.can_edit_event(event_id));
create policy pi_update on public.packing_items for update to authenticated
  using (public.can_edit_event(event_id) or (public.can_view_event(event_id) and (
    assigned_participant_id is null or exists (
      select 1 from public.event_participants p where p.id = assigned_participant_id and p.user_id = auth.uid()))))
  with check (public.can_view_event(event_id));

-- tasks: viewers can complete tasks assigned to them.
alter table public.tasks enable row level security;
create policy tasks_select on public.tasks for select to authenticated using (public.can_view_event(event_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.can_edit_event(event_id));
create policy tasks_delete on public.tasks for delete to authenticated using (public.can_edit_event(event_id));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_edit_event(event_id) or (public.can_view_event(event_id) and assignee_id = auth.uid()))
  with check (public.can_view_event(event_id));

-- comments: any event participant can comment; authors manage their own.
alter table public.comments enable row level security;
create policy comments_select on public.comments for select to authenticated using (public.can_view_event(event_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (public.can_view_event(event_id) and created_by = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (created_by = auth.uid() or public.can_edit_event(event_id));

-- notifications: strictly personal; inserted only by definer triggers.
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- activity_log: read-only to clients.
alter table public.activity_log enable row level security;
create policy activity_log_select on public.activity_log for select to authenticated using (public.can_view_event(event_id));

-- packing_templates: workspace scoped.
alter table public.packing_templates enable row level security;
create policy pt_select on public.packing_templates for select to authenticated using (public.workspace_role(workspace_id) is not null);
create policy pt_write on public.packing_templates for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner','editor'))
  with check (public.workspace_role(workspace_id) in ('owner','editor'));
