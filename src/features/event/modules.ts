import { CalendarDays, CheckSquare, FileText, Hotel, ListChecks, Luggage, NotebookPen, Plane, Trophy, Users, type LucideIcon } from 'lucide-react';
import type { ModuleKey } from '@/domain/types';
export const MODULES: Record<ModuleKey, { label: string; icon: LucideIcon; path: string; optional: boolean }> = {
  agenda: { label: 'Agenda', icon: CalendarDays, path: 'agenda', optional: false },
  travel: { label: 'Travel', icon: Plane, path: 'travel', optional: true },
  stay: { label: 'Stay', icon: Hotel, path: 'stay', optional: true },
  competition: { label: 'Sessions', icon: Trophy, path: 'competition', optional: true },
  lists: { label: 'Lists', icon: ListChecks, path: 'lists', optional: false },
  packing: { label: 'Packing', icon: Luggage, path: 'packing', optional: true },
  tasks: { label: 'Tasks', icon: CheckSquare, path: 'tasks', optional: true },
  documents: { label: 'Documents', icon: FileText, path: 'documents', optional: true },
  notes: { label: 'Notes', icon: NotebookPen, path: 'notes', optional: true },
  participants: { label: 'People', icon: Users, path: 'participants', optional: false },
};
export const MODULE_ORDER: ModuleKey[] = ['agenda', 'travel', 'stay', 'competition', 'lists', 'packing', 'tasks', 'documents', 'notes', 'participants'];
