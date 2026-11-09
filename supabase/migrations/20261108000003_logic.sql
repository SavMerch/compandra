-- Triggers and transactional RPCs.

-- ─── Profiles ───────────────────────────────────────────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into profiles (id, email, display_name, avatar_url)
  values (new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''),
      -- Apple private-relay addresses make poor names; leave blank so onboarding asks.
      case when new.email ilike '%@privaterelay.appleid.com' then '' else split_part(coalesce(new.email,''),'@',1) end),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── updated_at / version / attribution ─────────────────────────────────────
create function public.touch_row() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Bumps version only on content changes, so drag-reordering never causes false conflicts.
create function public.bump_version() returns trigger language plpgsql as $$
declare ignore_keys text[] := array['position','version','updated_at','updated_by'];
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  if (to_jsonb(new) - ignore_keys) is distinct from (to_jsonb(old) - ignore_keys) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','workspaces','workspace_members','workspace_invitations','event_members',
    'event_participants','event_days','packing_lists','packing_items','packing_templates','documents','comments'] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_row()', t);
  end loop;
  foreach t in array array['events','itinerary_items','travel_segments','accommodations','competition_sessions','tasks','notes'] loop
    execute format('create trigger bump before update on public.%I for each row execute function public.bump_version()', t);
  end loop;
  -- created_by defaults for client inserts
  foreach t in array array['event_participants','travel_segments','accommodations','competition_sessions','itinerary_items',
    'packing_lists','packing_items','packing_templates','tasks','notes','documents','event_members'] loop
    execute format('alter table public.%I alter column created_by set default auth.uid()', t);
  end loop;
end $$;

-- ─── Event days ─────────────────────────────────────────────────────────────
-- Items on removed days fall back to Ideas (ON DELETE SET NULL); nothing is lost.
create function public.resync_linked_items(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.sync_travel_item(t) from travel_segments t where t.event_id = p_event;
  perform public.sync_stay_items(a) from accommodations a where a.event_id = p_event;
  perform public.sync_competition_item(c) from competition_sessions c where c.event_id = p_event;
end $$;

create function public.sync_event_days() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.start_date = old.start_date and new.end_date = old.end_date then
    return new;
  end if;
  delete from event_days where event_id = new.id and (day_date < new.start_date or day_date > new.end_date);
  insert into event_days (event_id, day_date)
    select new.id, d::date from generate_series(new.start_date, new.end_date, interval '1 day') d
    on conflict (event_id, day_date) do nothing;
  if tg_op = 'UPDATE' then perform public.resync_linked_items(new.id); end if;
  return new;
end $$;

-- ─── Linked itinerary items: one row per domain record ──────────────────────
create function public.day_id_for(p_event uuid, p_date date) returns uuid
language sql stable set search_path = public, pg_temp as $$
  select id from event_days where event_id = p_event and day_date = p_date
$$;

create function public.sync_travel_item(s public.travel_segments) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_title text;
  v_cat text := case when s.mode = 'flight' then 'flight' when s.mode in ('train','shuttle','rental_car') then 'transportation' else 'travel' end;
  v_route text := nullif(concat_ws(' → ', nullif(s.origin,''), nullif(s.destination,'')), '');
begin
  v_title := case s.mode
    when 'flight' then concat_ws(' ', 'Flight', nullif(concat_ws(' ', s.carrier, s.flight_number), ''))
    when 'rental_car' then concat_ws(' ', 'Rental car', nullif(s.carrier,''))
    when 'personal_vehicle' then 'Drive'
    when 'train' then concat_ws(' ', 'Train', nullif(concat_ws(' ', s.carrier, s.flight_number), ''))
    when 'shuttle' then concat_ws(' ', 'Shuttle', nullif(s.carrier,''))
    else coalesce(nullif(s.carrier,''), 'Transportation') end;
  if v_route is not null then v_title := left(v_title || ': ' || v_route, 200); end if;
  insert into itinerary_items (event_id, event_day_id, title, start_time, end_time, category, location_name, address,
      confirmation_number, source_type, travel_segment_id, position, created_by)
    values (s.event_id, public.day_id_for(s.event_id, s.depart_local::date), v_title, s.depart_local::time,
      case when s.arrive_local::date = s.depart_local::date then s.arrive_local::time end,
      v_cat, coalesce(nullif(s.pickup_location,''), nullif(s.origin,'')), null, s.confirmation_number,
      'travel', s.id, extract(epoch from s.depart_local::time), s.created_by)
  on conflict (travel_segment_id) where travel_segment_id is not null do update set
    event_day_id = excluded.event_day_id, title = excluded.title, start_time = excluded.start_time, end_time = excluded.end_time,
    category = excluded.category, location_name = excluded.location_name, confirmation_number = excluded.confirmation_number;
end $$;

create function public.sync_stay_items(a public.accommodations) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare k text; v_ts timestamp;
begin
  foreach k in array array['check_in','check_out'] loop
    v_ts := case k when 'check_in' then a.check_in_local else a.check_out_local end;
    insert into itinerary_items (event_id, event_day_id, title, start_time, category, location_name, address, confirmation_number,
        source_type, accommodation_id, accommodation_kind, position, created_by)
      values (a.event_id, public.day_id_for(a.event_id, v_ts::date),
        left(case k when 'check_in' then 'Check in: ' else 'Check out: ' end || a.name, 200), v_ts::time, 'hotel', a.name, a.address,
        a.confirmation_number, 'accommodation', a.id, k, extract(epoch from v_ts::time), a.created_by)
    on conflict (accommodation_id, accommodation_kind) where accommodation_id is not null do update set
      event_day_id = excluded.event_day_id, title = excluded.title, start_time = excluded.start_time,
      location_name = excluded.location_name, address = excluded.address, confirmation_number = excluded.confirmation_number;
  end loop;
end $$;

create function public.sync_competition_item(c public.competition_sessions) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_title text := left(concat_ws(' · ', c.name, nullif(c.session_label,'')), 200);
declare v_start time := coalesce(c.check_in_time, c.warmup_time, c.start_time);
begin
  insert into itinerary_items (event_id, event_day_id, title, start_time, end_time, is_all_day, category, location_name, address,
      source_type, competition_session_id, position, created_by)
    values (c.event_id, public.day_id_for(c.event_id, c.session_date), v_title, v_start, c.end_time, v_start is null, 'competition',
      c.venue, c.address, 'competition', c.id, coalesce(extract(epoch from v_start), 0), c.created_by)
  on conflict (competition_session_id) where competition_session_id is not null do update set
    event_day_id = excluded.event_day_id, title = excluded.title, start_time = excluded.start_time, end_time = excluded.end_time,
    is_all_day = excluded.is_all_day, location_name = excluded.location_name, address = excluded.address;
end $$;

create function public.trg_sync_travel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public.sync_travel_item(new); return new; end $$;
create function public.trg_sync_stay() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public.sync_stay_items(new); return new; end $$;
create function public.trg_sync_competition() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public.sync_competition_item(new); return new; end $$;

create trigger sync_item after insert or update on public.travel_segments for each row execute function public.trg_sync_travel();
create trigger sync_item after insert or update on public.accommodations for each row execute function public.trg_sync_stay();
create trigger sync_item after insert or update on public.competition_sessions for each row execute function public.trg_sync_competition();

-- Mirror people assigned on a domain record onto its linked agenda item(s).
create function public.trg_sync_linked_people() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_col text := tg_argv[0]; v_parent uuid;
begin
  r := coalesce(new, old);
  v_parent := (to_jsonb(r)->>v_col)::uuid;
  if tg_op = 'INSERT' then
    insert into activity_participants (item_id, participant_id, event_id)
      select i.id, r.participant_id, r.event_id from itinerary_items i
      where (case tg_argv[1] when 'travel' then i.travel_segment_id when 'stay' then i.accommodation_id else i.competition_session_id end) = v_parent
      on conflict do nothing;
    return new;
  end if;
  delete from activity_participants ap using itinerary_items i
    where ap.item_id = i.id and ap.participant_id = r.participant_id
      and (case tg_argv[1] when 'travel' then i.travel_segment_id when 'stay' then i.accommodation_id else i.competition_session_id end) = v_parent;
  return old;
end $$;
create trigger sync_people after insert or delete on public.travel_segment_travelers for each row execute function public.trg_sync_linked_people('segment_id','travel');
create trigger sync_people after insert or delete on public.accommodation_guests for each row execute function public.trg_sync_linked_people('accommodation_id','stay');
create trigger sync_people after insert or delete on public.competition_session_participants for each row execute function public.trg_sync_linked_people('session_id','competition');

-- Direct edits may not diverge a linked item from its source record.
create function public.guard_linked_item() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.source_type is not null then
      raise exception 'This item is linked to a % record. Delete it there.', old.source_type using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.source_type is not null then
      raise exception 'Linked items are created automatically.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.source_type is distinct from old.source_type
     or new.travel_segment_id is distinct from old.travel_segment_id
     or new.accommodation_id is distinct from old.accommodation_id
     or new.competition_session_id is distinct from old.competition_session_id then
    raise exception 'Item links cannot be changed.' using errcode = 'P0001';
  end if;
  if old.source_type is not null and (
     new.title is distinct from old.title or new.event_day_id is distinct from old.event_day_id
     or new.start_time is distinct from old.start_time or new.end_time is distinct from old.end_time
     or new.category is distinct from old.category or new.confirmation_number is distinct from old.confirmation_number) then
    raise exception 'This item is linked to a % record. Edit it there.', old.source_type using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_linked before insert or update or delete on public.itinerary_items
  for each row execute function public.guard_linked_item();

-- ─── Viewer column limits ───────────────────────────────────────────────────
create function public.guard_packing_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.is_packed is distinct from old.is_packed then
    new.packed_by := case when new.is_packed then auth.uid() end;
    new.packed_at := case when new.is_packed then now() end;
  end if;
  if auth.uid() is not null and public.event_role(old.event_id) = 'viewer' and (
     new.name, new.category, new.quantity, new.notes, new.assigned_participant_id, new.list_id, new.position)
     is distinct from (old.name, old.category, old.quantity, old.notes, old.assigned_participant_id, old.list_id, old.position) then
    raise exception 'Viewers can only check items off.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_packing before update on public.packing_items for each row execute function public.guard_packing_item();

create function public.guard_task() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    new.completed_at := case when new.status = 'done' then now() end;
  end if;
  if auth.uid() is not null and public.event_role(old.event_id) = 'viewer' and (
     new.title, new.description, new.assignee_id, new.due_date, new.priority, new.itinerary_item_id)
     is distinct from (old.title, old.description, old.assignee_id, old.due_date, old.priority, old.itinerary_item_id) then
    raise exception 'Viewers can only update task status.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_task before update on public.tasks for each row execute function public.guard_task();

create function public.guard_last_owner() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') and pg_trigger_depth() = 1
     and exists (select 1 from workspaces where id = old.workspace_id)
     and not exists (select 1 from workspace_members where workspace_id = old.workspace_id and role = 'owner' and id <> old.id) then
    raise exception 'A workspace must keep at least one owner.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger guard_owner before update or delete on public.workspace_members
  for each row execute function public.guard_last_owner();

-- Roles and owner can't be escalated through a self-profile or event trick.
create function public.guard_event_workspace() returns trigger language plpgsql as $$
begin
  if new.workspace_id <> old.workspace_id then raise exception 'Events cannot change workspace.'; end if;
  return new;
end $$;
create trigger guard_workspace before update on public.events for each row execute function public.guard_event_workspace();

-- ─── Participants follow members ────────────────────────────────────────────
create function public.ensure_participant() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into event_participants (event_id, user_id, display_name, created_by)
    select new.event_id, new.user_id, coalesce(nullif(p.display_name,''), split_part(p.email,'@',1), 'Family member'), new.created_by
    from profiles p where p.id = new.user_id
  on conflict (event_id, user_id) do nothing;
  return new;
end $$;
create trigger ensure_participant after insert on public.event_members for each row execute function public.ensure_participant();

create trigger sync_days after insert or update of start_date, end_date on public.events
  for each row execute function public.sync_event_days();

-- ─── Activity log (attribution + the single realtime change feed) ───────────
create function public.log_activity() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_event uuid := coalesce((r->>'event_id')::uuid, case when tg_argv[0] = 'event' then (r->>'id')::uuid end);
  v_quiet boolean := coalesce((tg_argv[2])::boolean, false);
  noise text[] := array['position','version','updated_at','updated_by'];
begin
  if not exists (select 1 from events where id = v_event) then return coalesce(new, old); end if;
  if tg_argv[0] = 'itinerary' and r->>'source_type' is not null then v_quiet := true; end if;
  if tg_op = 'UPDATE' and (r - noise) = (o - noise) then v_quiet := true; end if;
  insert into activity_log (event_id, actor_id, entity_type, entity_id, action, summary, is_quiet)
  values (v_event, auth.uid(), tg_argv[0], (r->>'id')::uuid,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    left(r->>tg_argv[1], 200), v_quiet);
  return coalesce(new, old);
end $$;

create trigger log after insert or update on public.events for each row execute function public.log_activity('event','title','false');
create trigger log after insert or update or delete on public.itinerary_items for each row execute function public.log_activity('itinerary','title','false');
create trigger log after insert or update or delete on public.travel_segments for each row execute function public.log_activity('travel','origin','false');
create trigger log after insert or update or delete on public.accommodations for each row execute function public.log_activity('stay','name','false');
create trigger log after insert or update or delete on public.competition_sessions for each row execute function public.log_activity('competition','name','false');
create trigger log after insert or update or delete on public.packing_lists for each row execute function public.log_activity('packing','name','false');
create trigger log after insert or update or delete on public.packing_items for each row execute function public.log_activity('packing','name','true');
create trigger log after insert or update or delete on public.tasks for each row execute function public.log_activity('task','title','false');
create trigger log after insert or update or delete on public.notes for each row execute function public.log_activity('note','title','false');
create trigger log after insert or update or delete on public.documents for each row execute function public.log_activity('document','name','false');
create trigger log after insert or update or delete on public.comments for each row execute function public.log_activity('comment','body','true');
create trigger log after insert or update or delete on public.event_participants for each row execute function public.log_activity('participant','display_name','false');
create trigger log after insert or update or delete on public.event_members for each row execute function public.log_activity('member','role','true');
create trigger log after insert or delete on public.activity_participants for each row execute function public.log_activity('itinerary','item_id','true');
create trigger log after insert or delete on public.travel_segment_travelers for each row execute function public.log_activity('travel','segment_id','true');
create trigger log after insert or delete on public.accommodation_guests for each row execute function public.log_activity('stay','accommodation_id','true');
create trigger log after insert or delete on public.competition_session_participants for each row execute function public.log_activity('competition','session_id','true');

-- ─── Notifications ──────────────────────────────────────────────────────────
create function public.notify_event(p_event uuid, p_kind text, p_pref text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public, pg_temp as $$
  with audience as (
    select em.user_id from event_members em where em.event_id = p_event
    union
    select wm.user_id from workspace_members wm join events e on e.workspace_id = wm.workspace_id
      where e.id = p_event and ((e.visibility = 'workspace' and wm.role <> 'guest') or wm.role = 'owner')
  )
  insert into notifications (user_id, event_id, actor_id, kind, title, body, link)
  select a.user_id, p_event, auth.uid(), p_kind, p_title, p_body, p_link
  from audience a join profiles p on p.id = a.user_id
  where a.user_id is distinct from auth.uid()
    and coalesce((p.notification_prefs->>p_pref)::boolean, true);
$$;

create function public.notify_item_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_day date;
begin
  if tg_op = 'DELETE' then
    if old.event_day_id is null or old.source_type is not null or not exists (select 1 from events where id = old.event_id) then return old; end if;
    perform public.notify_event(old.event_id, 'schedule_change', 'schedule_changes', 'Removed from the schedule', old.title, '/events/' || old.event_id || '/agenda');
    return old;
  end if;
  if old.event_day_id is null and new.event_day_id is null then return new; end if;
  if (new.event_day_id, new.start_time, new.end_time, new.location_name, new.address)
     is not distinct from (old.event_day_id, old.start_time, old.end_time, old.location_name, old.address)
     and not (new.status = 'cancelled' and old.status <> 'cancelled') then
    return new;
  end if;
  select day_date into v_day from event_days where id = new.event_day_id;
  perform public.notify_event(new.event_id, 'schedule_change', 'schedule_changes',
    case when new.status = 'cancelled' then 'Cancelled' else 'Schedule changed' end,
    new.title || coalesce(' · ' || to_char(v_day, 'Dy Mon FMDD'), '') || coalesce(' at ' || to_char(new.start_time, 'FMHH12:MI AM'), ''),
    '/events/' || new.event_id || '/agenda');
  return new;
end $$;
create trigger notify after update or delete on public.itinerary_items
  for each row execute function public.notify_item_change();

create function public.notify_task() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and exists (select 1 from profiles p where p.id = new.assignee_id and coalesce((p.notification_prefs->>'task_assigned')::boolean, true)) then
    insert into notifications (user_id, event_id, actor_id, kind, title, body, link)
    values (new.assignee_id, new.event_id, auth.uid(), 'task_assigned', 'New task for you', new.title, '/events/' || new.event_id || '/tasks');
  end if;
  return new;
end $$;
create trigger notify after insert or update of assignee_id on public.tasks for each row execute function public.notify_task();

create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.notify_event(new.event_id, 'comment', 'comments', 'New comment', left(new.body, 140),
    '/events/' || new.event_id || case when new.task_id is not null then '/tasks' else '/agenda' end);
  return new;
end $$;
create trigger notify after insert on public.comments for each row execute function public.notify_comment();

-- ─── RPCs ───────────────────────────────────────────────────────────────────
create function public.create_workspace(p_name text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  insert into workspaces (name, owner_id, created_by) values (p_name, v_uid, v_uid) returning id into v_id;
  insert into workspace_members (workspace_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

create function public.create_event(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid; v_uid uuid := auth.uid(); v_ws uuid := (p->>'workspace_id')::uuid; v_u uuid; v_name text;
  v_list uuid; v_item jsonb; v_pos int := 0;
begin
  if public.workspace_role(v_ws) not in ('owner','editor') or public.workspace_role(v_ws) is null then
    raise exception 'You do not have permission to create events here.' using errcode = '42501';
  end if;
  insert into events (workspace_id, title, event_type, destination, description, start_date, end_date, timezone,
      primary_venue, notes, cover_path, cover_scene, visibility, modules, pinned_modules, created_by, updated_by)
  values (v_ws, p->>'title', coalesce(p->>'event_type','custom'), nullif(p->>'destination',''), nullif(p->>'description',''),
    (p->>'start_date')::date, (p->>'end_date')::date, coalesce(nullif(p->>'timezone',''),'America/New_York'),
    nullif(p->>'primary_venue',''), nullif(p->>'notes',''), nullif(p->>'cover_path',''), coalesce(nullif(p->>'cover_scene',''),'coast'),
    coalesce(p->>'visibility','workspace'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'modules') x), array['agenda','packing','tasks','documents','notes','participants']),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'pinned_modules') x), array['agenda','packing','tasks']),
    v_uid, v_uid)
  returning id into v_id;

  insert into event_members (event_id, user_id, role, created_by) values (v_id, v_uid, 'editor', v_uid);
  for v_u in select (x)::uuid from jsonb_array_elements_text(coalesce(p->'member_ids','[]'::jsonb)) x loop
    -- Only existing workspace members can be added here.
    insert into event_members (event_id, user_id, role, created_by)
      select v_id, wm.user_id, case when wm.role = 'viewer' then 'viewer' else 'editor' end, v_uid
      from workspace_members wm where wm.workspace_id = v_ws and wm.user_id = v_u
      on conflict do nothing;
  end loop;
  for v_name in select x from jsonb_array_elements_text(coalesce(p->'guest_names','[]'::jsonb)) x loop
    if trim(v_name) <> '' then
      insert into event_participants (event_id, display_name, created_by) values (v_id, trim(v_name), v_uid);
    end if;
  end loop;

  if jsonb_array_length(coalesce(p->'starter_packing','[]'::jsonb)) > 0 then
    insert into packing_lists (event_id, name, kind, created_by) values (v_id, 'Family packing', 'shared', v_uid) returning id into v_list;
    for v_item in select * from jsonb_array_elements(p->'starter_packing') loop
      v_pos := v_pos + 1;
      insert into packing_items (event_id, list_id, name, category, position, created_by)
        values (v_id, v_list, v_item->>'name', coalesce(v_item->>'category','Miscellaneous'), v_pos * 1000, v_uid);
    end loop;
  end if;
  for v_name in select x from jsonb_array_elements_text(coalesce(p->'starter_tasks','[]'::jsonb)) x loop
    insert into tasks (event_id, title, created_by) values (v_id, v_name, v_uid);
  end loop;
  return v_id;
end $$;

create function public.create_invitation(p_workspace uuid, p_email text, p_role text, p_event uuid default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not (public.workspace_role(p_workspace) = 'owner'
     or (p_event is not null and public.can_edit_event(p_event))) then
    raise exception 'You do not have permission to invite people.' using errcode = '42501';
  end if;
  if p_event is not null and not exists (select 1 from events where id = p_event and workspace_id = p_workspace) then
    raise exception 'Event not found in this workspace.';
  end if;
  insert into workspace_invitations (workspace_id, event_id, email, role, token_hash, created_by)
  values (p_workspace, p_event, lower(trim(p_email)), p_role, encode(sha256(convert_to(v_token,'UTF8')),'hex'), auth.uid());
  return v_token; -- returned once; only the hash is stored
end $$;

create function public.get_invitation_preview(p_token text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('workspace', w.name, 'event', e.title, 'role', i.role,
    'invited_by', p.display_name,
    'valid', i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from workspace_invitations i
  join workspaces w on w.id = i.workspace_id
  left join events e on e.id = i.event_id
  left join profiles p on p.id = i.created_by
  where i.token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex')
$$;

-- The token is the bearer credential. Email is not matched, because Apple Hide My Email
-- legitimately signs people in under a different address than the one invited.
create function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare i workspace_invitations; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into i from workspace_invitations
    where token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found or i.revoked_at is not null or i.expires_at <= now() then
    raise exception 'This invitation is no longer valid.' using errcode = 'P0001';
  end if;
  if i.accepted_at is not null then
    if i.accepted_by = v_uid then
      return jsonb_build_object('workspace_id', i.workspace_id, 'event_id', i.event_id);
    end if;
    raise exception 'This invitation has already been used.' using errcode = 'P0001';
  end if;
  -- Event-only invites grant a 'guest' row: workspace context, but no access to other events.
  insert into workspace_members (workspace_id, user_id, role)
    values (i.workspace_id, v_uid, case when i.event_id is null then i.role else 'guest' end)
    on conflict (workspace_id, user_id) do nothing;
  if i.event_id is not null then
    insert into event_members (event_id, user_id, role, created_by)
      values (i.event_id, v_uid, i.role, i.created_by)
      on conflict (event_id, user_id) do update set role = excluded.role;
  end if;
  update workspace_invitations set accepted_at = now(), accepted_by = v_uid where id = i.id;
  if i.created_by is not null and i.created_by <> v_uid then
    insert into notifications (user_id, event_id, actor_id, kind, title, body, link)
    select i.created_by, i.event_id, v_uid, 'invite_accepted', 'Invitation accepted',
      coalesce(nullif(p.display_name,''),'Someone') || ' joined', case when i.event_id is not null then '/events/' || i.event_id || '/participants' else '/profile' end
    from profiles p where p.id = v_uid;
  end if;
  return jsonb_build_object('workspace_id', i.workspace_id, 'event_id', i.event_id);
end $$;

create function public.move_itinerary_item(p_item uuid, p_day uuid, p_ordered uuid[]) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_item itinerary_items;
begin
  select * into v_item from itinerary_items where id = p_item for update;
  if not found or not public.can_edit_event(v_item.event_id) then
    raise exception 'You do not have permission to move this item.' using errcode = '42501';
  end if;
  if v_item.event_day_id is distinct from p_day then
    if v_item.source_type is not null then
      raise exception 'Change the date on the linked % record.', v_item.source_type using errcode = 'P0001';
    end if;
    update itinerary_items set event_day_id = p_day where id = p_item;
  end if;
  update itinerary_items t set position = o.ord * 1000
    from unnest(p_ordered) with ordinality o(id, ord)
    where t.id = o.id and t.event_id = v_item.event_id;
end $$;

create function public.copy_packing_list(p_list uuid, p_target_event uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare s packing_lists; v_new uuid;
begin
  select * into s from packing_lists where id = p_list;
  if not found or not public.can_view_event(s.event_id) or not public.can_edit_event(p_target_event) then
    raise exception 'You do not have permission to copy this list.' using errcode = '42501';
  end if;
  insert into packing_lists (event_id, name, kind, created_by)
    values (p_target_event, s.name, s.kind, auth.uid()) returning id into v_new;
  insert into packing_items (event_id, list_id, name, category, quantity, notes, position, created_by)
    select p_target_event, v_new, name, category, quantity, notes, position, auth.uid() from packing_items where list_id = p_list;
  return v_new;
end $$;

-- Copies the reusable plan. Bookings are deliberately left behind: confirmation numbers don't carry over.
create function public.duplicate_event(p_event uuid, p_title text, p_start date) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare s events; v_new uuid; v_uid uuid := auth.uid(); v_shift int; v_list record; v_new_list uuid;
begin
  select * into s from events where id = p_event;
  if not found or not public.can_view_event(p_event) or public.workspace_role(s.workspace_id) not in ('owner','editor') then
    raise exception 'You do not have permission to duplicate this event.' using errcode = '42501';
  end if;
  v_shift := p_start - s.start_date;
  insert into events (workspace_id, title, event_type, destination, description, start_date, end_date, timezone, primary_venue,
      notes, cover_scene, visibility, modules, pinned_modules, created_by, updated_by)
  values (s.workspace_id, p_title, s.event_type, s.destination, s.description, p_start, s.end_date + v_shift, s.timezone,
      s.primary_venue, s.notes, s.cover_scene, s.visibility, s.modules, s.pinned_modules, v_uid, v_uid)
  returning id into v_new;
  insert into event_members (event_id, user_id, role, created_by)
    select v_new, user_id, role, v_uid from event_members where event_id = p_event;
  insert into event_members (event_id, user_id, role, created_by) values (v_new, v_uid, 'editor', v_uid) on conflict do nothing;
  insert into event_participants (event_id, display_name, is_child, created_by)
    select v_new, display_name, is_child, v_uid from event_participants where event_id = p_event and user_id is null;
  insert into itinerary_items (event_id, event_day_id, title, description, start_time, end_time, is_all_day, location_name, address,
      category, notes, is_optional, reminder_minutes, position, created_by)
    select v_new, nd.id, i.title, i.description, i.start_time, i.end_time, i.is_all_day, i.location_name, i.address,
      i.category, i.notes, i.is_optional, i.reminder_minutes, i.position, v_uid
    from itinerary_items i
    left join event_days od on od.id = i.event_day_id
    left join event_days nd on nd.event_id = v_new and nd.day_date = od.day_date + v_shift
    where i.event_id = p_event and i.source_type is null;
  for v_list in select * from packing_lists where event_id = p_event loop
    insert into packing_lists (event_id, name, kind, position, created_by)
      values (v_new, v_list.name, v_list.kind, v_list.position, v_uid) returning id into v_new_list;
    insert into packing_items (event_id, list_id, name, category, quantity, notes, position, created_by)
      select v_new, v_new_list, name, category, quantity, notes, position, v_uid from packing_items where list_id = v_list.id;
  end loop;
  insert into tasks (event_id, title, description, priority, created_by)
    select v_new, title, description, priority, v_uid from tasks where event_id = p_event;
  insert into notes (event_id, title, body, is_pinned, created_by)
    select v_new, title, body, is_pinned, v_uid from notes where event_id = p_event;
  return v_new;
end $$;

-- SECURITY INVOKER: results are filtered by the caller's RLS policies.
create function public.search_all(p_query text, p_event uuid default null)
returns table (kind text, id uuid, event_id uuid, title text, subtitle text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with q as (select '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p)
  select * from (
    select 'event', e.id, e.id, e.title, e.destination from events e, q
      where p_event is null and (e.title ilike q.p or e.destination ilike q.p)
    union all
    select 'activity', i.id, i.event_id, i.title, coalesce(i.location_name, i.confirmation_number) from itinerary_items i, q
      where (p_event is null or i.event_id = p_event) and i.source_type is null
        and (i.title ilike q.p or i.location_name ilike q.p or i.address ilike q.p or i.confirmation_number ilike q.p or i.notes ilike q.p)
    union all
    select 'travel', t.id, t.event_id, concat_ws(' ', t.carrier, t.flight_number, nullif(concat_ws(' → ', t.origin, t.destination), '')),
        t.confirmation_number from travel_segments t, q
      where (p_event is null or t.event_id = p_event)
        and (t.carrier ilike q.p or t.flight_number ilike q.p or t.origin ilike q.p or t.destination ilike q.p or t.confirmation_number ilike q.p)
    union all
    select 'stay', a.id, a.event_id, a.name, coalesce(a.confirmation_number, a.address) from accommodations a, q
      where (p_event is null or a.event_id = p_event) and (a.name ilike q.p or a.address ilike q.p or a.confirmation_number ilike q.p)
    union all
    select 'competition', c.id, c.event_id, c.name, c.session_label from competition_sessions c, q
      where (p_event is null or c.event_id = p_event) and (c.name ilike q.p or c.venue ilike q.p or c.session_label ilike q.p)
    union all
    select 'document', d.id, d.event_id, d.name, d.doc_type from documents d, q
      where (p_event is null or d.event_id = p_event) and d.name ilike q.p
    union all
    select 'task', t.id, t.event_id, t.title, t.status from tasks t, q
      where (p_event is null or t.event_id = p_event) and (t.title ilike q.p or t.description ilike q.p)
    union all
    select 'note', n.id, n.event_id, coalesce(nullif(n.title,''),'Note'), left(n.body, 80) from notes n, q
      where (p_event is null or n.event_id = p_event) and (n.title ilike q.p or n.body ilike q.p)
  ) r limit 50
$$;
