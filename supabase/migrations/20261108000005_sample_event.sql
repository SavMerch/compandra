-- Optional demo data. Only runs when a user explicitly asks for it; never automatic.
create function public.create_sample_event(p_workspace uuid, p_start date default (current_date + 14)) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_id uuid; v_me uuid; v_grandma uuid; v_partner uuid; v_a uuid; v_b uuid; v_list uuid; v_kids uuid;
  v_hotel uuid; v_s1 uuid; v_s2 uuid; v_s3 uuid; v_seg uuid;
  d0 date := p_start; d1 date := p_start + 1; d2 date := p_start + 2; d3 date := p_start + 3;
  v_name text; v_pos int := 0;
begin
  if coalesce(public.workspace_role(p_workspace),'') not in ('owner','editor') then
    raise exception 'You do not have permission to add events here.' using errcode = '42501';
  end if;
  v_id := public.create_event(jsonb_build_object('workspace_id', p_workspace, 'title', 'Orlando Competition Weekend (Sample)',
    'event_type','competition','destination','Orlando, Florida','description','A fictional weekend showing how every module connects.',
    'start_date',d0,'end_date',d3,'timezone','America/New_York','primary_venue','Sunshine Arena (fictional)','cover_scene','arena',
    'modules', '["agenda","travel","stay","competition","packing","tasks","documents","notes","participants"]'::jsonb,
    'pinned_modules','["agenda","competition","packing"]'::jsonb));

  select id into v_me from event_participants where event_id = v_id and user_id = v_uid;
  insert into event_participants (event_id, display_name) values (v_id,'Partner') returning id into v_partner;
  insert into event_participants (event_id, display_name) values (v_id,'Grandma') returning id into v_grandma;
  insert into event_participants (event_id, display_name, is_child) values (v_id,'Avery',true) returning id into v_a;
  insert into event_participants (event_id, display_name, is_child) values (v_id,'Rowan',true) returning id into v_b;

  insert into travel_segments (event_id, mode, direction, carrier, origin, destination, depart_local, depart_tz, arrive_local, arrive_tz, parking_info, notes, created_by)
    values (v_id,'personal_vehicle','outbound','Family van','Home','Orlando', d0 + time '08:00','America/New_York', d0 + time '13:30','America/New_York','Hotel garage, level 2','Sample drive',v_uid) returning id into v_seg;
  insert into travel_segment_travelers (segment_id, participant_id, event_id) select v_seg, p, v_id from unnest(array[v_me,v_partner,v_a,v_b]) p;
  insert into travel_segments (event_id, mode, direction, carrier, flight_number, origin, destination, depart_local, depart_tz, arrive_local, arrive_tz, confirmation_number, seats, terminal, created_by)
    values (v_id,'flight','outbound','Example Air','EX 214','ATL','MCO', d0 + time '10:15','America/New_York', d0 + time '11:50','America/New_York','SAMPLE1','14C','South',v_uid) returning id into v_seg;
  insert into travel_segment_travelers (segment_id, participant_id, event_id) values (v_seg, v_grandma, v_id);
  insert into travel_segments (event_id, mode, direction, carrier, origin, destination, depart_local, arrive_local, created_by)
    values (v_id,'personal_vehicle','return','Family van','Orlando','Home', d3 + time '14:00', d3 + time '19:30', v_uid);

  insert into accommodations (event_id, name, address, check_in_local, check_out_local, confirmation_number, room_info, phone, parking, special_instructions, created_by)
    values (v_id,'Palm Court Hotel (fictional)','100 Example Blvd, Orlando, FL 32819', d0 + time '15:00', d3 + time '11:00','HTL-00000','2 connecting rooms, 4th floor','+14075550100','Garage, $18 per night','Ask for late checkout on Sunday.',v_uid) returning id into v_hotel;
  insert into accommodation_guests (accommodation_id, participant_id, event_id) select v_hotel, p, v_id from unnest(array[v_me,v_partner,v_grandma,v_a,v_b]) p;

  insert into competition_sessions (event_id, name, venue, address, organizer, division, category, session_label, session_date, check_in_time, warmup_time, start_time, end_time, equipment, created_by)
    values (v_id,'Sunshine Invitational','Sunshine Arena (fictional)','200 Example Way, Orlando, FL 32819','Example Gymnastics League','Level 4','Vault and bars','Session 1', d1, '07:30','08:00','09:00','11:00','Grips, leotard, water bottle',v_uid) returning id into v_s1;
  insert into competition_session_participants values (v_s1, v_a, v_id);
  insert into competition_sessions (event_id, name, venue, address, organizer, division, category, session_label, session_date, check_in_time, warmup_time, start_time, end_time, equipment, created_by)
    values (v_id,'Sunshine Invitational','Sunshine Arena (fictional)','200 Example Way, Orlando, FL 32819','Example Gymnastics League','Level 2','Floor and beam','Session 4', d1, '13:00','13:30','14:30','16:00','Hair ties, leotard',v_uid) returning id into v_s2;
  insert into competition_session_participants values (v_s2, v_b, v_id);
  insert into competition_sessions (event_id, name, venue, address, organizer, division, category, session_label, session_date, check_in_time, warmup_time, start_time, end_time, created_by)
    values (v_id,'Sunshine Invitational Finals','Sunshine Arena (fictional)','200 Example Way, Orlando, FL 32819','Example Gymnastics League','Level 4','All around','Finals', d2, '09:00','09:30','10:30','12:30',v_uid) returning id into v_s3;
  insert into competition_session_participants values (v_s3, v_a, v_id);

  insert into itinerary_items (event_id, event_day_id, title, start_time, end_time, location_name, address, category, position, created_by)
  values
    (v_id, public.day_id_for(v_id,d0), 'Team pizza dinner', '18:30','20:00','Slice House (fictional)','300 Example Ave, Orlando, FL','meal', 66600, v_uid),
    (v_id, public.day_id_for(v_id,d1), 'Hotel breakfast', '06:30','07:10','Palm Court lobby',null,'meal', 23400, v_uid),
    (v_id, public.day_id_for(v_id,d1), 'Celebration ice cream', '16:30','17:15','Scoop Stop (fictional)',null,'meal', 59400, v_uid),
    (v_id, public.day_id_for(v_id,d2), 'Pool time', '14:00','16:00','Palm Court pool',null,'free_time', 50400, v_uid),
    (v_id, public.day_id_for(v_id,d2), 'Family dinner', '18:00','19:30','Lakeside Grill (fictional)','400 Example Ln, Orlando, FL','meal', 64800, v_uid),
    (v_id, public.day_id_for(v_id,d3), 'Brunch before the drive', '09:30','10:30','Palm Court lobby',null,'meal', 34200, v_uid);
  insert into itinerary_items (event_id, title, location_name, category, notes, created_by)
    values (v_id,'Mini-golf','Putt Paradise (fictional)','entertainment','If Saturday afternoon is free',v_uid),
           (v_id,'Science museum','Orlando','entertainment','Rainy-day idea',v_uid);

  insert into packing_lists (event_id, name, kind, created_by) values (v_id,'Family packing','shared',v_uid) returning id into v_list;
  foreach v_name in array array['Sunscreen|Toiletries','Phone chargers|Electronics','Swimsuits|Clothing','Snacks|Snacks','Travel documents|Travel documents','Pain reliever|Medications'] loop
    v_pos := v_pos + 1000;
    insert into packing_items (event_id, list_id, name, category, position, created_by) values (v_id, v_list, split_part(v_name,'|',1), split_part(v_name,'|',2), v_pos, v_uid);
  end loop;
  insert into packing_lists (event_id, name, kind, owner_participant_id, created_by) values (v_id,'Competition gear','individual',v_a,v_uid) returning id into v_kids;
  foreach v_name in array array['Competition leotard','Grips','Hair ties','Water bottle','Warm-up jacket'] loop
    v_pos := v_pos + 1000;
    insert into packing_items (event_id, list_id, name, category, assigned_participant_id, position, created_by) values (v_id, v_kids, v_name, 'Sports equipment', v_a, v_pos, v_uid);
  end loop;

  insert into tasks (event_id, title, assignee_id, due_date, priority, created_by) values
    (v_id,'Confirm late checkout', v_uid, d0 - 3, 'normal', v_uid),
    (v_id,'Print coach passes', v_uid, d0 - 1, 'high', v_uid),
    (v_id,'Book team dinner table', null, d0 - 5, 'normal', v_uid);
  insert into notes (event_id, title, body, is_pinned, created_by) values
    (v_id,'Arena tips','Spectator entry is on the east side. Bring cash for parking. (Sample note)',true,v_uid),
    (v_id,'Dinner ideas','Avery wants pizza after session one.',false,v_uid);
  insert into documents (event_id, name, storage_path, mime_type, doc_type, created_by) values
    (v_id,'Example competition schedule (no file attached)', v_id || '/sample/schedule-placeholder.pdf','application/pdf','schedule',v_uid);
  return v_id;
end $$;
revoke execute on function public.create_sample_event(uuid, date) from public, anon;
grant execute on function public.create_sample_event(uuid, date) to authenticated;
