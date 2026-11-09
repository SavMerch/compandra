import type { EventType, ModuleKey } from './types';
export interface Template { type: EventType; label: string; blurb: string; scene: string; modules: ModuleKey[]; pinned: ModuleKey[]; packing: { name: string; category: string }[]; tasks: string[]; }
const base: ModuleKey[] = ['agenda', 'packing', 'tasks', 'documents', 'notes', 'participants'];
const P = (s: string, category: string) => s.split(',').map((name) => ({ name: name.trim(), category }));
const essentials = [...P('Phone chargers', 'Electronics'), ...P('Toothbrushes,Sunscreen', 'Toiletries'), ...P('Medications', 'Medications')];
export const templates: Template[] = [
  { type: 'vacation', label: 'Vacation', blurb: 'Flights, stays, and days to fill', scene: 'coast', modules: [...base, 'travel', 'stay'], pinned: ['agenda', 'travel', 'packing'], packing: [...essentials, ...P('Swimsuits,Comfortable shoes', 'Clothing'), ...P('IDs and passports', 'Travel documents')], tasks: ['Book accommodation', 'Arrange pet or house care', 'Check IDs and passports'] },
  { type: 'competition', label: 'Competition', blurb: 'Sessions, venue, and gear', scene: 'arena', modules: [...base, 'competition', 'travel', 'stay'], pinned: ['agenda', 'competition', 'packing'], packing: [...essentials, ...P('Competition uniform,Warm-up clothes', 'Clothing'), ...P('Water bottle,Athlete equipment', 'Sports equipment'), ...P('Healthy snacks', 'Snacks')], tasks: ['Confirm session times', 'Book accommodation', 'Check venue parking'] },
  { type: 'weekend', label: 'Weekend trip', blurb: 'A quick escape', scene: 'mountains', modules: [...base, 'stay'], pinned: ['agenda', 'stay', 'packing'], packing: [...essentials, ...P('Change of clothes', 'Clothing')], tasks: ['Book a place to stay'] },
  { type: 'gathering', label: 'Family gathering', blurb: 'Activities and shared lists', scene: 'home', modules: base, pinned: ['agenda', 'tasks', 'notes'], packing: [], tasks: ['Confirm who is coming', 'Plan the menu'] },
  { type: 'celebration', label: 'Celebration', blurb: 'Weddings, birthdays, milestones', scene: 'garden', modules: [...base, 'travel', 'stay'], pinned: ['agenda', 'tasks', 'documents'], packing: [...essentials, ...P('Formal outfits', 'Clothing')], tasks: ['RSVP', 'Choose a gift'] },
  { type: 'road_trip', label: 'Road trip', blurb: 'Stops along the way', scene: 'desert', modules: [...base, 'travel', 'stay'], pinned: ['agenda', 'travel', 'packing'], packing: [...essentials, ...P('Road snacks', 'Snacks'), ...P('Car charger', 'Electronics')], tasks: ['Service the car', 'Plan overnight stops'] },
  { type: 'conference', label: 'Conference', blurb: 'Sessions and logistics', scene: 'city', modules: [...base, 'competition', 'travel', 'stay'], pinned: ['agenda', 'competition', 'travel'], packing: [...essentials, ...P('Laptop and charger', 'Electronics'), ...P('Badge and registration', 'Travel documents')], tasks: ['Register', 'Pick sessions'] },
  { type: 'custom', label: 'Custom', blurb: 'Start from scratch', scene: 'lake', modules: base, pinned: ['agenda', 'packing', 'tasks'], packing: [], tasks: [] },
];
export const templateFor = (t: EventType) => templates.find((x) => x.type === t) ?? templates[templates.length - 1];
