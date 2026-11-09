-- compandra core schema. Every user-facing table has RLS enabled in the next migration.
-- Time model: event-local wall-clock values (date/time/timestamp without time zone)
-- plus an IANA time zone. "9:00 in Orlando" must remain 9:00 wherever the viewer is.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text,
  email text,
  notification_prefs jsonb not null default '{"schedule_changes":true,"task_assigned":true,"comments":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer','guest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  event_type text not null default 'custom' check (event_type in
    ('vacation','competition','weekend','gathering','celebration','road_trip','conference','custom')),
  destination text,
  description text,
  start_date date not null,
  end_date date not null,
  timezone text not null default 'America/New_York',
  primary_venue text,
  notes text,
  cover_path text,
  cover_scene text not null default 'coast',
  visibility text not null default 'workspace' check (visibility in ('workspace','private')),
  modules text[] not null default array['agenda','packing','tasks','documents','notes','participants'],
  pinned_modules text[] not null default array['agenda','packing','tasks'],
  archived_at timestamptz,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 366)
);
create index events_workspace_idx on public.events(workspace_id, start_date);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor','viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_invitations_ws_idx on public.workspace_invitations(workspace_id);
create index workspace_invitations_event_idx on public.workspace_invitations(event_id);

-- Access control: who may open the event in the app.
create table public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','viewer')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_members_user_idx on public.event_members(user_id);

-- The people on the trip. May have no account (for example, children).
create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  is_child boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  unique (event_id, user_id)
);

create table public.event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  day_date date not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  unique (event_id, day_date)
);

create table public.travel_segments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  mode text not null default 'flight' check (mode in ('flight','rental_car','personal_vehicle','train','shuttle','other')),
  direction text not null default 'outbound' check (direction in ('outbound','return','connecting','other')),
  carrier text,
  flight_number text,
  origin text,
  destination text,
  depart_local timestamp not null,
  depart_tz text,
  arrive_local timestamp,
  arrive_tz text,
  confirmation_number text,
  seats text,
  terminal text,
  gate text,
  pickup_location text,
  dropoff_location text,
  parking_info text,
  notes text,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create index travel_segments_event_idx on public.travel_segments(event_id, depart_local);

create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  address text,
  check_in_local timestamp not null,
  check_out_local timestamp not null,
  confirmation_number text,
  room_info text,
  phone text,
  email text,
  parking text,
  special_instructions text,
  notes text,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  check (check_out_local >= check_in_local)
);
create index accommodations_event_idx on public.accommodations(event_id, check_in_local);

create table public.competition_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null default 'competition' check (kind in ('competition','performance','conference','other')),
  name text not null check (char_length(name) between 1 and 160),
  venue text,
  address text,
  organizer text,
  division text,
  category text,
  session_label text,
  session_date date not null,
  check_in_time time,
  warmup_time time,
  start_time time,
  end_time time,
  equipment text,
  notes text,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create index competition_sessions_event_idx on public.competition_sessions(event_id, session_date);

-- The one agenda. Null event_day_id = Ideas/Unscheduled.
-- A row with source_type is the single linked representation of a domain record.
create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_day_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  start_time time,
  end_time time,
  is_all_day boolean not null default false,
  location_name text,
  address text,
  category text not null default 'activity' check (category in
    ('activity','meal','travel','flight','hotel','competition','reservation','entertainment','free_time','shopping','transportation','custom')),
  confirmation_number text,
  reservation_details text,
  notes text,
  status text not null default 'planned' check (status in ('planned','confirmed','completed','cancelled')),
  is_optional boolean not null default false,
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  position double precision not null default 0,
  source_type text check (source_type in ('travel','accommodation','competition')),
  travel_segment_id uuid,
  accommodation_id uuid,
  accommodation_kind text check (accommodation_kind in ('check_in','check_out')),
  competition_session_id uuid,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  foreign key (event_day_id, event_id) references public.event_days(id, event_id) on delete set null (event_day_id),
  foreign key (travel_segment_id, event_id) references public.travel_segments(id, event_id) on delete cascade,
  foreign key (accommodation_id, event_id) references public.accommodations(id, event_id) on delete cascade,
  foreign key (competition_session_id, event_id) references public.competition_sessions(id, event_id) on delete cascade,
  check (
    (source_type is null and travel_segment_id is null and accommodation_id is null and competition_session_id is null) or
    (source_type = 'travel' and travel_segment_id is not null) or
    (source_type = 'accommodation' and accommodation_id is not null and accommodation_kind is not null) or
    (source_type = 'competition' and competition_session_id is not null)
  )
);
create index itinerary_items_event_idx on public.itinerary_items(event_id, event_day_id, position);
create unique index itinerary_items_travel_uq on public.itinerary_items(travel_segment_id) where travel_segment_id is not null;
create unique index itinerary_items_stay_uq on public.itinerary_items(accommodation_id, accommodation_kind) where accommodation_id is not null;
create unique index itinerary_items_comp_uq on public.itinerary_items(competition_session_id) where competition_session_id is not null;

create table public.activity_participants (
  item_id uuid not null,
  participant_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (item_id, participant_id),
  foreign key (item_id, event_id) references public.itinerary_items(id, event_id) on delete cascade,
  foreign key (participant_id, event_id) references public.event_participants(id, event_id) on delete cascade
);
create index activity_participants_event_idx on public.activity_participants(event_id);

create table public.travel_segment_travelers (
  segment_id uuid not null,
  participant_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (segment_id, participant_id),
  foreign key (segment_id, event_id) references public.travel_segments(id, event_id) on delete cascade,
  foreign key (participant_id, event_id) references public.event_participants(id, event_id) on delete cascade
);
create index travel_segment_travelers_event_idx on public.travel_segment_travelers(event_id);

create table public.accommodation_guests (
  accommodation_id uuid not null,
  participant_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (accommodation_id, participant_id),
  foreign key (accommodation_id, event_id) references public.accommodations(id, event_id) on delete cascade,
  foreign key (participant_id, event_id) references public.event_participants(id, event_id) on delete cascade
);
create index accommodation_guests_event_idx on public.accommodation_guests(event_id);

create table public.competition_session_participants (
  session_id uuid not null,
  participant_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (session_id, participant_id),
  foreign key (session_id, event_id) references public.competition_sessions(id, event_id) on delete cascade,
  foreign key (participant_id, event_id) references public.event_participants(id, event_id) on delete cascade
);
create index competition_session_participants_event_idx on public.competition_session_participants(event_id);

create table public.packing_lists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'shared' check (kind in ('shared','individual')),
  owner_participant_id uuid,
  position double precision not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  foreign key (owner_participant_id, event_id) references public.event_participants(id, event_id) on delete set null (owner_participant_id)
);
create index packing_lists_event_idx on public.packing_lists(event_id);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  list_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  category text not null default 'Miscellaneous',
  quantity integer not null default 1 check (quantity between 1 and 999),
  notes text,
  assigned_participant_id uuid,
  is_packed boolean not null default false,
  packed_by uuid references public.profiles(id) on delete set null,
  packed_at timestamptz,
  position double precision not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, event_id) references public.packing_lists(id, event_id) on delete cascade,
  foreign key (assigned_participant_id, event_id) references public.event_participants(id, event_id) on delete set null (assigned_participant_id)
);
create index packing_items_list_idx on public.packing_items(list_id, position);
create index packing_items_event_idx on public.packing_items(event_id);

create table public.packing_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  items jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index packing_templates_ws_idx on public.packing_templates(workspace_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'open' check (status in ('open','in_progress','done')),
  itinerary_item_id uuid,
  completed_at timestamptz,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  foreign key (itinerary_item_id, event_id) references public.itinerary_items(id, event_id) on delete set null (itinerary_item_id)
);
create index tasks_event_idx on public.tasks(event_id, status, due_date);
create index tasks_assignee_idx on public.tasks(assignee_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  body text not null default '',
  is_pinned boolean not null default false,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_event_idx on public.notes(event_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  doc_type text not null default 'other' check (doc_type in ('ticket','confirmation','map','schedule','other')),
  is_important boolean not null default false,
  itinerary_item_id uuid,
  travel_segment_id uuid,
  accommodation_id uuid,
  competition_session_id uuid,
  task_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (itinerary_item_id, event_id) references public.itinerary_items(id, event_id) on delete set null (itinerary_item_id),
  foreign key (travel_segment_id, event_id) references public.travel_segments(id, event_id) on delete set null (travel_segment_id),
  foreign key (accommodation_id, event_id) references public.accommodations(id, event_id) on delete set null (accommodation_id),
  foreign key (competition_session_id, event_id) references public.competition_sessions(id, event_id) on delete set null (competition_session_id),
  foreign key (task_id, event_id) references public.tasks(id, event_id) on delete set null (task_id)
);
create index documents_event_idx on public.documents(event_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  itinerary_item_id uuid,
  task_id uuid,
  body text not null check (char_length(body) between 1 and 4000),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (itinerary_item_id, event_id) references public.itinerary_items(id, event_id) on delete cascade,
  foreign key (task_id, event_id) references public.tasks(id, event_id) on delete cascade,
  check (num_nonnulls(itinerary_item_id, task_id) = 1)
);
create index comments_item_idx on public.comments(itinerary_item_id);
create index comments_task_idx on public.comments(task_id);
create index comments_event_idx on public.comments(event_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('created','updated','deleted')),
  summary text,
  is_quiet boolean not null default false,
  created_at timestamptz not null default now()
);
create index activity_log_event_idx on public.activity_log(event_id, created_at desc);
