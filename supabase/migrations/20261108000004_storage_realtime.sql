-- Private bucket for documents and covers. Path convention: {event_id}/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-files', 'event-files', false, 26214400)
on conflict (id) do update set public = false;

-- Avatars are public-read at unguessable paths; they are not private documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create function public.storage_event_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end $$;

create policy event_files_select on storage.objects for select to authenticated
  using (bucket_id = 'event-files' and public.can_view_event(public.storage_event_id(name)));
create policy event_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-files' and public.can_edit_event(public.storage_event_id(name)));
create policy event_files_update on storage.objects for update to authenticated
  using (bucket_id = 'event-files' and public.can_edit_event(public.storage_event_id(name)));
create policy event_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-files' and public.can_edit_event(public.storage_event_id(name)));

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- Realtime: one feed per event (activity_log) plus personal notifications. Both honour RLS.
alter publication supabase_realtime add table public.activity_log, public.notifications;

-- Least privilege: anonymous visitors get nothing except the invitation preview.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function public.get_invitation_preview(text) to anon;
-- Policy helpers must stay callable while RLS evaluates for the authenticated role (granted above).
-- Trigger-only functions are not callable via the API because they return trigger.
revoke execute on function public.resync_linked_items(uuid) from authenticated;
revoke execute on function public.sync_travel_item(public.travel_segments) from authenticated;
revoke execute on function public.sync_stay_items(public.accommodations) from authenticated;
revoke execute on function public.sync_competition_item(public.competition_sessions) from authenticated;
revoke execute on function public.notify_event(uuid,text,text,text,text,text) from authenticated;
