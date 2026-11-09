export type Role = 'owner' | 'editor' | 'viewer' | 'guest';
export type EventRole = 'owner' | 'editor' | 'viewer';
export type EventState = 'upcoming' | 'active' | 'completed';
export type EventType = 'vacation' | 'competition' | 'weekend' | 'gathering' | 'celebration' | 'road_trip' | 'conference' | 'custom';
export type ModuleKey = 'agenda' | 'travel' | 'stay' | 'competition' | 'packing' | 'tasks' | 'documents' | 'notes' | 'participants' | 'lists';
export type Category = 'activity' | 'meal' | 'travel' | 'flight' | 'hotel' | 'competition' | 'reservation' | 'entertainment' | 'free_time' | 'shopping' | 'transportation' | 'custom';

export interface Profile { id: string; display_name: string; avatar_url: string | null; email: string | null; notification_prefs: Record<string, boolean>; }
export interface Workspace { id: string; name: string; owner_id: string; }
export interface WorkspaceMember { id: string; workspace_id: string; user_id: string; role: Role; profile?: Profile; }
export interface EventRow {
  id: string; workspace_id: string; title: string; event_type: EventType; destination: string | null; description: string | null;
  start_date: string; end_date: string; timezone: string; primary_venue: string | null; notes: string | null; cover_path: string | null;
  cover_scene: string; visibility: 'workspace' | 'private'; modules: ModuleKey[]; pinned_modules: ModuleKey[]; archived_at: string | null;
  version: number; updated_at: string; created_by: string | null;
}
export interface EventMember { id: string; event_id: string; user_id: string; role: 'editor' | 'viewer'; }
export interface Participant { id: string; event_id: string; user_id: string | null; display_name: string; is_child: boolean; }
export interface EventDay { id: string; event_id: string; day_date: string; title: string | null; }
export interface ItineraryItem {
  id: string; event_id: string; event_day_id: string | null; title: string; description: string | null; start_time: string | null; end_time: string | null;
  is_all_day: boolean; location_name: string | null; address: string | null; category: Category; confirmation_number: string | null;
  reservation_details: string | null; notes: string | null; status: 'planned' | 'confirmed' | 'completed' | 'cancelled'; is_optional: boolean;
  reminder_minutes: number | null; position: number; source_type: 'travel' | 'accommodation' | 'competition' | null; travel_segment_id: string | null;
  accommodation_id: string | null; accommodation_kind: 'check_in' | 'check_out' | null; competition_session_id: string | null; version: number;
  updated_at: string; updated_by: string | null; created_by: string | null;
}
export interface TravelSegment {
  id: string; event_id: string; mode: 'flight' | 'rental_car' | 'personal_vehicle' | 'train' | 'shuttle' | 'other'; direction: 'outbound' | 'return' | 'connecting' | 'other';
  carrier: string | null; flight_number: string | null; origin: string | null; destination: string | null; depart_local: string; depart_tz: string | null; arrive_local: string | null; arrive_tz: string | null;
  confirmation_number: string | null; seats: string | null; terminal: string | null; gate: string | null; pickup_location: string | null; dropoff_location: string | null; parking_info: string | null; notes: string | null; version: number;
}
export interface Accommodation {
  id: string; event_id: string; name: string; address: string | null; check_in_local: string; check_out_local: string; confirmation_number: string | null; room_info: string | null;
  phone: string | null; email: string | null; parking: string | null; special_instructions: string | null; notes: string | null; version: number;
}
export interface CompetitionSession {
  id: string; event_id: string; kind: 'competition' | 'performance' | 'conference' | 'other'; name: string; venue: string | null; address: string | null; organizer: string | null; division: string | null; category: string | null;
  session_label: string | null; session_date: string; check_in_time: string | null; warmup_time: string | null; start_time: string | null; end_time: string | null; equipment: string | null; notes: string | null; version: number;
}
export interface PackingList { id: string; event_id: string; name: string; kind: 'shared' | 'individual'; owner_participant_id: string | null; position: number; }
export interface PackingItem { id: string; event_id: string; list_id: string; name: string; category: string; quantity: number; notes: string | null; assigned_participant_id: string | null; is_packed: boolean; packed_by: string | null; position: number; }
export interface EventList { id: string; event_id: string; name: string; position: number; }
export interface EventListItem { id: string; event_id: string; list_id: string; name: string; notes: string | null; is_done: boolean; position: number; }
export interface PackingTemplate { id: string; workspace_id: string; name: string; items: { name: string; category: string; quantity: number }[]; }
export interface Task { id: string; event_id: string; title: string; description: string | null; assignee_id: string | null; due_date: string | null; priority: 'low' | 'normal' | 'high'; status: 'open' | 'in_progress' | 'done'; itinerary_item_id: string | null; version: number; }
export interface Note { id: string; event_id: string; title: string; body: string; is_pinned: boolean; version: number; updated_at: string; updated_by: string | null; }
export interface DocumentRow { id: string; event_id: string; name: string; storage_path: string; mime_type: string | null; size_bytes: number | null; doc_type: 'ticket' | 'confirmation' | 'map' | 'schedule' | 'other'; is_important: boolean; itinerary_item_id: string | null; travel_segment_id: string | null; accommodation_id: string | null; competition_session_id: string | null; task_id: string | null; created_at: string; }
export interface Comment { id: string; event_id: string; itinerary_item_id: string | null; task_id: string | null; body: string; created_by: string | null; created_at: string; }
export interface NotificationRow { id: string; event_id: string | null; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; actor_id: string | null; }
export interface ActivityEntry { id: string; event_id: string; actor_id: string | null; entity_type: string; action: 'created' | 'updated' | 'deleted'; summary: string | null; is_quiet: boolean; created_at: string; }
export interface Invitation { id: string; email: string; role: string; event_id: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null; }

/** Everything needed to render an event. One query, one offline snapshot. */
export interface EventBundle {
  event: EventRow; days: EventDay[]; items: ItineraryItem[]; itemPeople: { item_id: string; participant_id: string }[];
  participants: Participant[]; members: EventMember[]; profiles: Profile[]; travel: TravelSegment[]; travelers: { segment_id: string; participant_id: string }[];
  stays: Accommodation[]; guests: { accommodation_id: string; participant_id: string }[]; sessions: CompetitionSession[]; sessionPeople: { session_id: string; participant_id: string }[];
  lists: PackingList[]; packing: PackingItem[]; checklists: EventList[]; checklistItems: EventListItem[]; tasks: Task[]; notes: Note[]; documents: DocumentRow[]; comments: Comment[]; activity: ActivityEntry[]; myRole: EventRole;
}
